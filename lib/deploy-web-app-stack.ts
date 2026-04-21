import { Stack, type StackProps } from "aws-cdk-lib";
import { Construct } from "constructs";
import { ProductsApiService } from "./deployment-service";

export class ProductsApiStack extends Stack {
    constructor(scope: Construct, id: string, props?: StackProps) {
        super(scope, id, props);

        new ProductsApiService(this, "products-api");
    }
}
