#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { ProductsApiStack } from "../lib/deploy-web-app-stack";
import { ImportServiceStack } from "../lib/import-service-stack";

const app = new cdk.App();

const env = {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
};

const productsStack = new ProductsApiStack(app, "ProductsApiStack", { env });
new ImportServiceStack(app, "ImportServiceStack", {
    env,
    catalogItemsQueue: productsStack.catalogItemsQueue,
});
