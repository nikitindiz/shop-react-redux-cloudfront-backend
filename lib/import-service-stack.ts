import {
    Stack,
    type StackProps,
    RemovalPolicy,
    aws_lambda,
    aws_lambda_nodejs,
    aws_apigateway,
    aws_s3,
    aws_s3_notifications,
    aws_sqs,
} from "aws-cdk-lib";
import { Construct } from "constructs";
import * as path from "path";

interface ImportServiceStackProps extends StackProps {
    catalogItemsQueue: aws_sqs.Queue;
    basicAuthorizerArn: string;
}

export class ImportServiceStack extends Stack {
    constructor(scope: Construct, id: string, props: ImportServiceStackProps) {
        super(scope, id, props);

        const importBucket = new aws_s3.Bucket(this, "ImportBucket", {
            removalPolicy: RemovalPolicy.DESTROY,
            autoDeleteObjects: true,
            cors: [
                {
                    allowedMethods: [aws_s3.HttpMethods.PUT],
                    allowedOrigins: ["*"],
                    allowedHeaders: ["*"],
                },
            ],
        });

        const importProductsFileLambda = new aws_lambda_nodejs.NodejsFunction(
            this,
            "ImportProductsFileLambda",
            {
                functionName: "importProductsFile",
                entry: path.join(__dirname, "../labmdas/importProductsFile.ts"),
                handler: "handler",
                runtime: aws_lambda.Runtime.NODEJS_22_X,
                bundling: {
                    minify: true,
                    sourceMap: true,
                    target: "node22",
                    externalModules: [],
                },
                environment: {
                    BUCKET_NAME: importBucket.bucketName,
                },
            },
        );

        importBucket.grantPut(importProductsFileLambda, "uploaded/*");

        const importFileParserLambda = new aws_lambda_nodejs.NodejsFunction(
            this,
            "ImportFileParserLambda",
            {
                functionName: "importFileParser",
                entry: path.join(__dirname, "../labmdas/importFileParser.ts"),
                handler: "handler",
                runtime: aws_lambda.Runtime.NODEJS_22_X,
                bundling: {
                    minify: true,
                    sourceMap: true,
                    target: "node22",
                    externalModules: [],
                },
                environment: {
                    SQS_QUEUE_URL: props.catalogItemsQueue.queueUrl,
                },
            },
        );

        importBucket.grantReadWrite(importFileParserLambda);
        props.catalogItemsQueue.grantSendMessages(importFileParserLambda);

        importBucket.addEventNotification(
            aws_s3.EventType.OBJECT_CREATED,
            new aws_s3_notifications.LambdaDestination(importFileParserLambda),
            { prefix: "uploaded/" },
        );

        const api = new aws_apigateway.RestApi(this, "ImportApi", {
            restApiName: "Import Service",
            defaultCorsPreflightOptions: {
                allowOrigins: aws_apigateway.Cors.ALL_ORIGINS,
                allowMethods: aws_apigateway.Cors.ALL_METHODS,
            },
        });

        const basicAuthorizerFn = aws_lambda.Function.fromFunctionAttributes(
            this,
            "BasicAuthorizerRef",
            {
                functionArn: props.basicAuthorizerArn,
                sameEnvironment: true,
            },
        );

        const authorizer = new aws_apigateway.TokenAuthorizer(
            this,
            "ImportAuthorizer",
            {
                handler: basicAuthorizerFn,
                identitySource: "method.request.header.Authorization",
            },
        );

        api.addGatewayResponse("Unauthorized", {
            type: aws_apigateway.ResponseType.UNAUTHORIZED,
            responseHeaders: {
                "Access-Control-Allow-Origin": "'*'",
            },
        });

        api.addGatewayResponse("AccessDenied", {
            type: aws_apigateway.ResponseType.ACCESS_DENIED,
            responseHeaders: {
                "Access-Control-Allow-Origin": "'*'",
            },
        });

        const importResource = api.root.addResource("import");
        importResource.addMethod(
            "GET",
            new aws_apigateway.LambdaIntegration(importProductsFileLambda),
            {
                authorizer,
                authorizationType: aws_apigateway.AuthorizationType.CUSTOM,
            },
        );
    }
}
