import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));

export const handler = async (
    _event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
    try {
        const [productsResult, stockResult] = await Promise.all([
            client.send(
                new ScanCommand({ TableName: process.env.PRODUCTS_TABLE_NAME }),
            ),
            client.send(
                new ScanCommand({ TableName: process.env.STOCK_TABLE_NAME }),
            ),
        ]);

        const stockMap = new Map(
            (stockResult.Items ?? []).map((s) => [s.product_id, s.count]),
        );

        const products = (productsResult.Items ?? []).map((p) => ({
            ...p,
            count: stockMap.get(p.id) ?? 0,
        }));

        return {
            statusCode: 200,
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
            },
            body: JSON.stringify(products),
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
