import type { APIGatewayProxyEvent } from "aws-lambda";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { handler } from "../labmdas/getProductsList";

jest.mock("@aws-sdk/client-dynamodb", () => ({ DynamoDBClient: jest.fn() }));
jest.mock("@aws-sdk/lib-dynamodb", () => ({
    DynamoDBDocumentClient: { from: jest.fn(() => ({ send: jest.fn() })) },
    ScanCommand: jest.fn((params: unknown) => params),
}));

const getSend = () =>
    (DynamoDBDocumentClient.from as jest.Mock).mock.results[0].value
        .send as jest.Mock;

const mockEvent = {} as unknown as APIGatewayProxyEvent;

beforeEach(() => getSend().mockClear());

test("returns 200 with products joined with stock", async () => {
    getSend()
        .mockResolvedValueOnce({
            Items: [{ id: "1", title: "A", description: "", price: 10 }],
        })
        .mockResolvedValueOnce({ Items: [{ product_id: "1", count: 5 }] });

    const result = await handler(mockEvent);

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toEqual([
        { id: "1", title: "A", description: "", price: 10, count: 5 },
    ]);
});
