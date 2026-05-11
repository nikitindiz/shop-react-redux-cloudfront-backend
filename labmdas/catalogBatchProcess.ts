import type { SQSEvent } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
    DynamoDBDocumentClient,
    TransactWriteCommand,
} from "@aws-sdk/lib-dynamodb";
import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";
import { randomUUID } from "crypto";

const dbClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const snsClient = new SNSClient({});

export const handler = async (event: SQSEvent): Promise<void> => {
    console.log("catalogBatchProcess", JSON.stringify(event));

    const createdProducts: Array<{
        id: string;
        title: string;
        price: number;
    }> = [];

    for (const record of event.Records) {
        const item = JSON.parse(record.body);
        const { title, description = "", price, count = 0 } = item;

        if (!title || price === undefined || price === null) {
            console.error("Invalid product data, skipping:", item);
            continue;
        }

        const numPrice = Number(price);
        const numCount = Number(count);

        if (Number.isNaN(numPrice) || numPrice < 0) {
            console.error("Invalid price, skipping:", item);
            continue;
        }

        if (Number.isNaN(numCount) || numCount < 0) {
            console.error("Invalid count, skipping:", item);
            continue;
        }

        const id = randomUUID();

        await dbClient.send(
            new TransactWriteCommand({
                TransactItems: [
                    {
                        Put: {
                            TableName: process.env.PRODUCTS_TABLE_NAME,
                            Item: { id, title, description, price: numPrice },
                        },
                    },
                    {
                        Put: {
                            TableName: process.env.STOCK_TABLE_NAME,
                            Item: { product_id: id, count: numCount },
                        },
                    },
                ],
            }),
        );

        console.log(`Created product: ${id} - ${title}`);
        createdProducts.push({ id, title, price: numPrice });
    }

    if (createdProducts.length > 0 && process.env.SNS_TOPIC_ARN) {
        for (const product of createdProducts) {
            await snsClient.send(
                new PublishCommand({
                    TopicArn: process.env.SNS_TOPIC_ARN,
                    Subject: `New product created: ${product.title}`,
                    Message: JSON.stringify(product),
                    MessageAttributes: {
                        price: {
                            DataType: "Number",
                            StringValue: String(product.price),
                        },
                    },
                }),
            );
        }

        console.log(`Published ${createdProducts.length} SNS notifications`);
    }
};
