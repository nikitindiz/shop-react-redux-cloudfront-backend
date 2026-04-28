import type { APIGatewayProxyEvent } from "aws-lambda";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { handler } from "../labmdas/getProductsById";

jest.mock("@aws-sdk/client-dynamodb", () => ({ DynamoDBClient: jest.fn() }));
jest.mock("@aws-sdk/lib-dynamodb", () => ({
    DynamoDBDocumentClient: { from: jest.fn(() => ({ send: jest.fn() })) },
    GetCommand: jest.fn((params: unknown) => params),
}));

const getSend = () =>
    (DynamoDBDocumentClient.from as jest.Mock).mock.results[0].value
        .send as jest.Mock;

function makeEvent(productId: string | undefined): APIGatewayProxyEvent {
    return {
        pathParameters: productId ? { productId } : null,
    } as unknown as APIGatewayProxyEvent;
}

beforeEach(() => getSend().mockClear());

test("returns 200 with the matching product joined with stock", async () => {
    getSend()
        .mockResolvedValueOnce({
            Item: { id: "1", title: "A", description: "", price: 10 },
        })
        .mockResolvedValueOnce({ Item: { product_id: "1", count: 3 } });

    const result = await handler(makeEvent("1"));

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toEqual({
        id: "1",
        title: "A",
        description: "",
        price: 10,
        count: 3,
    });
});

test("returns 404 when product is not found", async () => {
    getSend()
        .mockResolvedValueOnce({ Item: undefined })
        .mockResolvedValueOnce({ Item: undefined });

    const result = await handler(makeEvent("non-existent-id"));

    expect(result.statusCode).toBe(404);
    expect(JSON.parse(result.body)).toEqual({ message: "Product not found" });
});
