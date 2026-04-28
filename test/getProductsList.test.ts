import type { APIGatewayProxyEvent } from "aws-lambda";
import { handler } from "../labmdas/getProductsList";
import { products } from "../labmdas/products";

const mockEvent = {} as unknown as APIGatewayProxyEvent;

test("returns 200 with the full products list", async () => {
    const result = await handler(mockEvent);

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toEqual(products);
});
