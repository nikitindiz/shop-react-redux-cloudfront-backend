import {
    Stack,
    type StackProps,
    RemovalPolicy,
    aws_lambda,
    aws_lambda_nodejs,
    aws_apigateway,
    aws_ec2,
    aws_rds,
    CfnOutput,
    Duration,
} from "aws-cdk-lib";
import { Construct } from "constructs";
import * as path from "path";
import * as dotenv from "dotenv";

export class CartServiceStack extends Stack {
    constructor(scope: Construct, id: string, props?: StackProps) {
        super(scope, id, props);

        const appEnvConfig = dotenv.config();
        const appEnv: Record<string, string> = {};
        if (appEnvConfig.parsed) {
            for (const [key, value] of Object.entries(appEnvConfig.parsed)) {
                appEnv[key] = value;
            }
        }

        // VPC: private isolated subnets for RDS, private with egress for Lambda
        const vpc = new aws_ec2.Vpc(this, "CartVpc", {
            maxAzs: 2,
            natGateways: 1,
            subnetConfiguration: [
                {
                    name: "public",
                    subnetType: aws_ec2.SubnetType.PUBLIC,
                    cidrMask: 24,
                },
                {
                    name: "private",
                    subnetType: aws_ec2.SubnetType.PRIVATE_WITH_EGRESS,
                    cidrMask: 24,
                },
                {
                    name: "isolated",
                    subnetType: aws_ec2.SubnetType.PRIVATE_ISOLATED,
                    cidrMask: 24,
                },
            ],
        });

        // Security groups
        const lambdaSecurityGroup = new aws_ec2.SecurityGroup(
            this,
            "LambdaSecurityGroup",
            {
                vpc,
                description: "Security group for Cart Lambda",
                allowAllOutbound: true,
            },
        );

        const rdsSecurityGroup = new aws_ec2.SecurityGroup(
            this,
            "RdsSecurityGroup",
            {
                vpc,
                description: "Security group for Cart RDS",
                allowAllOutbound: false,
            },
        );

        rdsSecurityGroup.addIngressRule(
            lambdaSecurityGroup,
            aws_ec2.Port.tcp(5432),
            "Allow PostgreSQL from Lambda",
        );

        // RDS PostgreSQL instance
        const rdsInstance = new aws_rds.DatabaseInstance(this, "CartDatabase", {
            engine: aws_rds.DatabaseInstanceEngine.postgres({
                version: aws_rds.PostgresEngineVersion.VER_16,
            }),
            instanceType: aws_ec2.InstanceType.of(
                aws_ec2.InstanceClass.T3,
                aws_ec2.InstanceSize.MICRO,
            ),
            vpc,
            vpcSubnets: { subnetType: aws_ec2.SubnetType.PRIVATE_ISOLATED },
            securityGroups: [rdsSecurityGroup],
            credentials: aws_rds.Credentials.fromGeneratedSecret("postgres"),
            databaseName: "cart",
            removalPolicy: RemovalPolicy.DESTROY,
            deleteAutomatedBackups: true,
            multiAz: false,
            allocatedStorage: 20,
        });

        // Lambda function running NestJS
        const cartLambda = new aws_lambda_nodejs.NodejsFunction(
            this,
            "CartLambda",
            {
                functionName: "cartService",
                entry: path.join(__dirname, "../aws-cart-api/src/lambda.ts"),
                handler: "handler",
                runtime: aws_lambda.Runtime.NODEJS_22_X,
                timeout: Duration.seconds(30),
                memorySize: 512,
                vpc,
                vpcSubnets: {
                    subnetType: aws_ec2.SubnetType.PRIVATE_WITH_EGRESS,
                },
                securityGroups: [lambdaSecurityGroup],
                bundling: {
                    minify: true,
                    keepNames: true,
                    sourceMap: true,
                    target: "node22",
                    tsconfig: path.join(
                        __dirname,
                        "../aws-cart-api/tsconfig.json",
                    ),
                    externalModules: [
                        // NestJS optional peer deps
                        "@nestjs/microservices",
                        "@nestjs/microservices/microservices-module",
                        "@nestjs/websockets/socket-module",
                        "class-transformer",
                        "class-validator",
                        // TypeORM optional DB drivers (only pg is needed)
                        "pg-native",
                        "mysql",
                        "mysql2",
                        "oracledb",
                        "mssql",
                        "mongodb",
                        "sqlite3",
                        "better-sqlite3",
                        "sql.js",
                        "ioredis",
                        "hdb-pool",
                        "@sap/hana-client",
                        "react-native-sqlite-storage",
                        "expo-sqlite",
                        "typeorm-aurora-data-api-driver",
                        "@google-cloud/spanner",
                        "cordova-sqlite-storage",
                    ],
                },
                environment: {
                    ...appEnv,
                    DB_HOST: rdsInstance.instanceEndpoint.hostname,
                    DB_PORT: "5432",
                    DB_USERNAME: "postgres",
                    DB_NAME: "cart",
                    DB_PASSWORD: rdsInstance
                        .secret!.secretValueFromJson("password")
                        .unsafeUnwrap(),
                },
            },
        );

        rdsInstance.grantConnect(cartLambda, "postgres");

        // API Gateway
        const api = new aws_apigateway.RestApi(this, "CartApi", {
            restApiName: "Cart Service",
            description: "Cart Service API backed by NestJS on Lambda",
            defaultCorsPreflightOptions: {
                allowOrigins: aws_apigateway.Cors.ALL_ORIGINS,
                allowMethods: aws_apigateway.Cors.ALL_METHODS,
                allowHeaders: ["*"],
            },
        });

        const cartIntegration = new aws_apigateway.LambdaIntegration(
            cartLambda,
            {
                proxy: true,
            },
        );

        api.root.addProxy({
            defaultIntegration: cartIntegration,
            anyMethod: true,
        });

        new CfnOutput(this, "CartApiUrl", {
            value: api.url,
            description: "Cart Service API Gateway URL",
        });
    }
}
