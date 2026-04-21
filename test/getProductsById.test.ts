import type { APIGatewayProxyEvent } from "aws-lambda";
import { handler } from "../labmdas/getProductsById";
import { products } from "../labmdas/products";

const existingProduct = products[0];

function makeEvent(productId: string | undefined): APIGatewayProxyEvent {
    return {
        pathParameters: productId ? { productId } : null,
    } as unknown as APIGatewayProxyEvent;
}

test("returns 200 with the matching product", async () => {
    const result = await handler(makeEvent(existingProduct.id));

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toEqual(existingProduct);
});

test("returns 404 when product is not found", async () => {
    const result = await handler(makeEvent("non-existent-id"));

    expect(result.statusCode).toBe(404);
    expect(JSON.parse(result.body)).toEqual({ message: "Product not found" });
});
