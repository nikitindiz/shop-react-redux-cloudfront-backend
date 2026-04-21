import { aws_apigateway, aws_lambda, aws_lambda_nodejs } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as path from "path";

export class ProductsApiService extends Construct {
    constructor(scope: Construct, id: string) {
        super(scope, id);

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
            },
        );

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
            },
        );

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

        const productById = products.addResource("{productId}");
        productById.addMethod(
            "GET",
            new aws_apigateway.LambdaIntegration(getProductsByIdLambda),
        );
    }
}
