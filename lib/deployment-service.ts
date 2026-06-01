import {
    aws_apigateway,
    aws_dynamodb,
    aws_lambda,
    aws_lambda_nodejs,
    custom_resources,
    RemovalPolicy,
} from "aws-cdk-lib";
import { Construct } from "constructs";
import * as path from "path";
import { products as productsSeedData } from "../labmdas/products";

export class ProductsApiService extends Construct {
    constructor(scope: Construct, id: string) {
        super(scope, id);

        const productsTable = new aws_dynamodb.Table(this, "ProductsTable", {
            tableName: "products",
            partitionKey: {
                name: "id",
                type: aws_dynamodb.AttributeType.STRING,
            },
            billingMode: aws_dynamodb.BillingMode.PAY_PER_REQUEST,
            removalPolicy: RemovalPolicy.DESTROY,
        });

        const stockTable = new aws_dynamodb.Table(this, "StockTable", {
            tableName: "stock",
            partitionKey: {
                name: "product_id",
                type: aws_dynamodb.AttributeType.STRING,
            },
            billingMode: aws_dynamodb.BillingMode.PAY_PER_REQUEST,
            removalPolicy: RemovalPolicy.DESTROY,
        });

        const stockCounts: Record<string, number> = {
            "7567ec4b-b10c-48c5-9345-fc73c48a80aa": 4,
            "7567ec4b-b10c-48c5-9345-fc73c48a80a1": 6,
            "7567ec4b-b10c-48c5-9345-fc73c48a80a3": 12,
            "7567ec4b-b10c-48c5-9345-fc73348a80a1": 7,
            "7567ec4b-b10c-48c5-9445-fc73c48a80a2": 0,
            "7567ec4b-b10c-45c5-9345-fc73c48a80a1": 9,
        };

        const seedData = new custom_resources.AwsCustomResource(
            this,
            "SeedDynamoData",
            {
                onCreate: {
                    service: "DynamoDB",
                    action: "batchWriteItem",
                    parameters: {
                        RequestItems: {
                            [productsTable.tableName]: productsSeedData.map(
                                (p) => ({
                                    PutRequest: {
                                        Item: {
                                            id: { S: p.id },
                                            title: { S: p.title },
                                            description: { S: p.description },
                                            price: { N: String(p.price) },
                                        },
                                    },
                                }),
                            ),
                            [stockTable.tableName]: productsSeedData.map(
                                (p) => ({
                                    PutRequest: {
                                        Item: {
                                            product_id: { S: p.id },
                                            count: {
                                                N: String(
                                                    stockCounts[p.id] ?? 0,
                                                ),
                                            },
                                        },
                                    },
                                }),
                            ),
                        },
                    },
                    physicalResourceId:
                        custom_resources.PhysicalResourceId.of(
                            "SeedDynamoData",
                        ),
                },
                onDelete: {
                    service: "DynamoDB",
                    action: "batchWriteItem",
                    parameters: {
                        RequestItems: {
                            [productsTable.tableName]: productsSeedData.map(
                                (p) => ({
                                    DeleteRequest: {
                                        Key: { id: { S: p.id } },
                                    },
                                }),
                            ),
                            [stockTable.tableName]: productsSeedData.map(
                                (p) => ({
                                    DeleteRequest: {
                                        Key: { product_id: { S: p.id } },
                                    },
                                }),
                            ),
                        },
                    },
                },
                policy: custom_resources.AwsCustomResourcePolicy.fromSdkCalls({
                    resources:
                        custom_resources.AwsCustomResourcePolicy.ANY_RESOURCE,
                }),
            },
        );
        seedData.node.addDependency(productsTable);
        seedData.node.addDependency(stockTable);

        const getProductsListLambda = new aws_lambda_nodejs.NodejsFunction(
            this,
            "GetProductsListLambda",
            {
                functionName: "getProductsList",
                entry: path.join(__dirname, "../labmdas/getProductsList.ts"),
                handler: "handler",
                runtime: aws_lambda.Runtime.NODEJS_22_X,
                bundling: {
                    minify: true,
                    sourceMap: true,
                    target: "node22",
                    externalModules: [],
                },
                environment: {
                    PRODUCTS_TABLE_NAME: productsTable.tableName,
                    STOCK_TABLE_NAME: stockTable.tableName,
                },
            },
        );

        productsTable.grantReadData(getProductsListLambda);
        stockTable.grantReadData(getProductsListLambda);

        const getProductsByIdLambda = new aws_lambda_nodejs.NodejsFunction(
            this,
            "GetProductsByIdLambda",
            {
                functionName: "getProductsById",
                entry: path.join(__dirname, "../labmdas/getProductsById.ts"),
                handler: "handler",
                runtime: aws_lambda.Runtime.NODEJS_22_X,
                bundling: {
                    minify: true,
                    sourceMap: true,
                    target: "node22",
                    externalModules: [],
                },
                environment: {
                    PRODUCTS_TABLE_NAME: productsTable.tableName,
                    STOCK_TABLE_NAME: stockTable.tableName,
                },
            },
        );

        productsTable.grantReadData(getProductsByIdLambda);
        stockTable.grantReadData(getProductsByIdLambda);

        const createProductLambda = new aws_lambda_nodejs.NodejsFunction(
            this,
            "CreateProductLambda",
            {
                functionName: "createProduct",
                entry: path.join(__dirname, "../labmdas/createProduct.ts"),
                handler: "handler",
                runtime: aws_lambda.Runtime.NODEJS_22_X,
                bundling: {
                    minify: true,
                    sourceMap: true,
                    target: "node22",
                    externalModules: [],
                },
                environment: {
                    PRODUCTS_TABLE_NAME: productsTable.tableName,
                    STOCK_TABLE_NAME: stockTable.tableName,
                },
            },
        );

        productsTable.grantWriteData(createProductLambda);
        stockTable.grantWriteData(createProductLambda);

        const api = new aws_apigateway.RestApi(this, "ProductsApi", {
            restApiName: "Products Service",
            defaultCorsPreflightOptions: {
                allowOrigins: aws_apigateway.Cors.ALL_ORIGINS,
                allowMethods: aws_apigateway.Cors.ALL_METHODS,
            },
        });

        const products = api.root.addResource("products");
        products.addMethod(
            "GET",
            new aws_apigateway.LambdaIntegration(getProductsListLambda),
        );
        products.addMethod(
            "POST",
            new aws_apigateway.LambdaIntegration(createProductLambda),
        );

        const productById = products.addResource("{productId}");
        productById.addMethod(
            "GET",
            new aws_apigateway.LambdaIntegration(getProductsByIdLambda),
        );
    }
}
