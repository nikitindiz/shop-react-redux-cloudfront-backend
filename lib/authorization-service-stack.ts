import {
    Stack,
    type StackProps,
    aws_lambda,
    aws_lambda_nodejs,
} from "aws-cdk-lib";
import { Construct } from "constructs";
import * as path from "path";
import * as dotenv from "dotenv";

export class AuthorizationServiceStack extends Stack {
    public readonly basicAuthorizerFunction: aws_lambda_nodejs.NodejsFunction;

    constructor(scope: Construct, id: string, props?: StackProps) {
        super(scope, id, props);

        const envConfig = dotenv.config();
        const credentials: Record<string, string> = {};
        if (envConfig.parsed) {
            for (const [key, value] of Object.entries(envConfig.parsed)) {
                credentials[key] = value;
            }
        }

        this.basicAuthorizerFunction = new aws_lambda_nodejs.NodejsFunction(
            this,
            "BasicAuthorizerLambda",
            {
                functionName: "basicAuthorizer",
                entry: path.join(__dirname, "../labmdas/basicAuthorizer.ts"),
                handler: "handler",
                runtime: aws_lambda.Runtime.NODEJS_22_X,
                bundling: {
                    minify: true,
                    sourceMap: true,
                    target: "node22",
                    externalModules: [],
                },
                environment: credentials,
            },
        );
    }
}
