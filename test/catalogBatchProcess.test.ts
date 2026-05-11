import type { SQSEvent } from "aws-lambda";

const mockTransactWrite = jest.fn().mockResolvedValue({});
const mockPublish = jest.fn().mockResolvedValue({});

jest.mock("@aws-sdk/client-dynamodb", () => ({
    DynamoDBClient: jest.fn(),
}));

jest.mock("@aws-sdk/lib-dynamodb", () => ({
    DynamoDBDocumentClient: {
        from: () => ({ send: mockTransactWrite }),
    },
    TransactWriteCommand: jest.fn((params: unknown) => params),
}));

jest.mock("@aws-sdk/client-sns", () => ({
    SNSClient: jest.fn(() => ({ send: mockPublish })),
    PublishCommand: jest.fn((params: unknown) => params),
}));

import { handler } from "../labmdas/catalogBatchProcess";

function makeSQSEvent(bodies: object[]): SQSEvent {
    return {
        Records: bodies.map((body, i) => ({
            messageId: `msg-${i}`,
            body: JSON.stringify(body),
            receiptHandle: `handle-${i}`,
            attributes: {} as never,
            messageAttributes: {},
            md5OfBody: "",
            eventSource: "aws:sqs",
            eventSourceARN:
                "arn:aws:sqs:us-east-1:000000000000:catalogItemsQueue",
            awsRegion: "us-east-1",
        })),
    };
}

beforeEach(() => {
    jest.clearAllMocks();
    process.env.PRODUCTS_TABLE_NAME = "products";
    process.env.STOCK_TABLE_NAME = "stock";
    process.env.SNS_TOPIC_ARN =
        "arn:aws:sns:us-east-1:000000000000:createProductTopic";
});

test("creates products in DynamoDB and publishes to SNS for valid records", async () => {
    const event = makeSQSEvent([
        { title: "Product1", description: "Desc1", price: "50", count: "10" },
        { title: "Product2", description: "Desc2", price: "200", count: "5" },
    ]);

    await handler(event);

    expect(mockTransactWrite).toHaveBeenCalledTimes(2);
    expect(mockPublish).toHaveBeenCalledTimes(2);
});

test("skips records with missing title and does not publish SNS for them", async () => {
    const event = makeSQSEvent([
        { description: "NoTitle", price: "10", count: "1" },
        { title: "Valid", price: "20", count: "2" },
    ]);

    await handler(event);

    expect(mockTransactWrite).toHaveBeenCalledTimes(1);
    expect(mockPublish).toHaveBeenCalledTimes(1);
});
