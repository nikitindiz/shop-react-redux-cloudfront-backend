import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
    DynamoDBDocumentClient,
    TransactWriteCommand,
} from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "crypto";

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));

export const handler = async (
    event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
    console.log("createProduct", event);
    try {
        const body = JSON.parse(event.body ?? "{}");
        const { title, description = "", price, count = 0 } = body;

        if (!title || price === undefined || price === null) {
            return {
                statusCode: 400,
                headers: {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*",
                },
                body: JSON.stringify({
                    message: "title and price are required",
                }),
            };
        }

        if (
            typeof price !== "number" ||
            !Number.isInteger(price) ||
            price < 0
        ) {
            return {
                statusCode: 400,
                headers: {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*",
                },
                body: JSON.stringify({
                    message: "price must be a non-negative integer",
                }),
            };
        }

        if (
            typeof count !== "number" ||
            !Number.isInteger(count) ||
            count < 0
        ) {
            return {
                statusCode: 400,
                headers: {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*",
                },
                body: JSON.stringify({
                    message: "count must be a non-negative integer",
                }),
            };
        }

        const id = randomUUID();

        await client.send(
            new TransactWriteCommand({
                TransactItems: [
                    {
                        Put: {
                            TableName: process.env.PRODUCTS_TABLE_NAME,
                            Item: { id, title, description, price },
                        },
                    },
                    {
                        Put: {
                            TableName: process.env.STOCK_TABLE_NAME,
                            Item: { product_id: id, count },
                        },
                    },
                ],
            }),
        );

        return {
            statusCode: 201,
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
            },
            body: JSON.stringify({ id, title, description, price, count }),
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
