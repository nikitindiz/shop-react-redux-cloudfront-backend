import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));

export const handler = async (
    event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
    console.log("getProductsById", event);
    try {
        const productId = event.pathParameters?.productId;

        if (!productId) {
            return {
                statusCode: 400,
                headers: {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*",
                },
                body: JSON.stringify({ message: "Product ID is required" }),
            };
        }

        const [productResult, stockResult] = await Promise.all([
            client.send(
                new GetCommand({
                    TableName: process.env.PRODUCTS_TABLE_NAME,
                    Key: { id: productId },
                }),
            ),
            client.send(
                new GetCommand({
                    TableName: process.env.STOCK_TABLE_NAME,
                    Key: { product_id: productId },
                }),
            ),
        ]);

        if (!productResult.Item) {
            return {
                statusCode: 404,
                headers: {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*",
                },
                body: JSON.stringify({ message: "Product not found" }),
            };
        }

        return {
            statusCode: 200,
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
            },
            body: JSON.stringify({
                ...productResult.Item,
                count: stockResult.Item?.count ?? 0,
            }),
        };
    } catch (error) {
        return {
            statusCode: 500,
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
            },
            body: JSON.stringify({ message: "Internal server error" }),
        };
    }
};
