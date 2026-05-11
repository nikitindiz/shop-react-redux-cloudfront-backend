import type { S3Event } from "aws-lambda";
import {
    S3Client,
    GetObjectCommand,
    CopyObjectCommand,
    DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { Readable } from "stream";
import csv from "csv-parser";

const s3Client = new S3Client({});
const sqsClient = new SQSClient({});

export const handler = async (event: S3Event): Promise<void> => {
    console.log("importFileParser", JSON.stringify(event));

    for (const record of event.Records) {
        const bucketName = record.s3.bucket.name;
        const key = decodeURIComponent(
            record.s3.object.key.replace(/\+/g, " "),
        );

        console.log(`Parsing s3://${bucketName}/${key}`);

        const { Body } = await s3Client.send(
            new GetObjectCommand({ Bucket: bucketName, Key: key }),
        );

        if (!Body) {
            console.error(`Empty body for key ${key}`);
            continue;
        }

        await new Promise<void>((resolve, reject) => {
            (Body as Readable)
                .pipe(csv())
                .on("data", async (row) => {
                    await sqsClient.send(
                        new SendMessageCommand({
                            QueueUrl: process.env.SQS_QUEUE_URL,
                            MessageBody: JSON.stringify(row),
                        }),
                    );
                })
                .on("end", resolve)
                .on("error", reject);
        });

        // Move file: copy to parsed/ then delete from uploaded/
        const fileName = key.split("/").pop()!;
        const parsedKey = `parsed/${fileName}`;

        await s3Client.send(
            new CopyObjectCommand({
                Bucket: bucketName,
                CopySource: `${bucketName}/${key}`,
                Key: parsedKey,
            }),
        );

        await s3Client.send(
            new DeleteObjectCommand({ Bucket: bucketName, Key: key }),
        );

        console.log(`Moved ${key} -> ${parsedKey}`);
    }
};
