import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3Client = new S3Client({});

const CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET",
};

export const handler = async (
    event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
    console.log("importProductsFile", event);

    const fileName = event.queryStringParameters?.name;

    if (!fileName) {
        return {
            statusCode: 400,
            headers: { "Content-Type": "application/json", ...CORS_HEADERS },
            body: JSON.stringify({
                message: "Query parameter 'name' is required",
            }),
        };
    }

    const bucketName = process.env.BUCKET_NAME!;
    const key = `uploaded/${fileName}`;

    const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        ContentType: "text/csv",
    });

    const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 300 });

    return {
        statusCode: 200,
        headers: { "Content-Type": "text/plain", ...CORS_HEADERS },
        body: signedUrl,
    };
};
