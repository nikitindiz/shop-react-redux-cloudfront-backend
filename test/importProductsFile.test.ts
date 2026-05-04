import type { APIGatewayProxyEvent } from "aws-lambda";
import { S3Client } from "@aws-sdk/client-s3";
import * as presigner from "@aws-sdk/s3-request-presigner";
import { handler } from "../labmdas/importProductsFile";

jest.mock("@aws-sdk/client-s3", () => ({
    S3Client: jest.fn(),
    PutObjectCommand: jest.fn((params: unknown) => params),
}));

jest.mock("@aws-sdk/s3-request-presigner", () => ({
    getSignedUrl: jest.fn(),
}));

const mockGetSignedUrl = presigner.getSignedUrl as jest.Mock;

function makeEvent(name?: string): APIGatewayProxyEvent {
    return {
        queryStringParameters: name ? { name } : null,
    } as unknown as APIGatewayProxyEvent;
}

beforeEach(() => {
    jest.clearAllMocks();
    process.env.BUCKET_NAME = "test-bucket";
});

test("returns 200 with a signed URL when name param is provided", async () => {
    const fakeUrl =
        "https://s3.amazonaws.com/test-bucket/uploaded/test.csv?signed";
    mockGetSignedUrl.mockResolvedValue(fakeUrl);

    const result = await handler(makeEvent("test.csv"));

    expect(result.statusCode).toBe(200);
    expect(result.body).toBe(fakeUrl);
    expect(mockGetSignedUrl).toHaveBeenCalledTimes(1);
});

test("returns 400 when name param is missing", async () => {
    const result = await handler(makeEvent());

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body)).toMatchObject({
        message: expect.any(String),
    });
    expect(mockGetSignedUrl).not.toHaveBeenCalled();
});
