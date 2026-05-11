import { Stack, type StackProps } from "aws-cdk-lib";
import type { aws_sqs } from "aws-cdk-lib";
import { Construct } from "constructs";
import { ProductsApiService } from "./deployment-service";

export class ProductsApiStack extends Stack {
    public readonly catalogItemsQueue: aws_sqs.Queue;

    constructor(scope: Construct, id: string, props?: StackProps) {
        super(scope, id, props);

        const service = new ProductsApiService(this, "products-api");
        this.catalogItemsQueue = service.catalogItemsQueue;
    }
}
