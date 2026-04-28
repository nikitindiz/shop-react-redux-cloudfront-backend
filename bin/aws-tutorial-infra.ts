#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { ProductsApiStack } from "../lib/deploy-web-app-stack";

const app = new cdk.App();
new ProductsApiStack(app, "ProductsApiStack", {
    env: {
        account: process.env.CDK_DEFAULT_ACCOUNT,
        region: process.env.CDK_DEFAULT_REGION,
    },
});
