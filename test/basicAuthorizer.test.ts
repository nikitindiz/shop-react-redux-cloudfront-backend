import type { APIGatewayTokenAuthorizerEvent } from "aws-lambda";
import { handler } from "../labmdas/basicAuthorizer";

const methodArn =
    "arn:aws:execute-api:us-east-1:123456789:api-id/stage/GET/import";

function createEvent(
    authorizationToken?: string,
): APIGatewayTokenAuthorizerEvent {
    return {
        type: "TOKEN",
        authorizationToken: authorizationToken || "",
        methodArn,
    } as APIGatewayTokenAuthorizerEvent;
}

describe("basicAuthorizer", () => {
    beforeAll(() => {
        process.env["testuser"] = "TEST_PASSWORD";
    });

    it("throws Unauthorized when no Authorization header", async () => {
        const event = createEvent("");
        await expect(handler(event)).rejects.toThrow("Unauthorized");
    });

    it("returns Deny policy for invalid credentials", async () => {
        const token = Buffer.from("testuser:WRONG_PASSWORD").toString("base64");
        const event = createEvent(`Basic ${token}`);
        const result = await handler(event);
        expect(result.policyDocument.Statement[0].Effect).toBe("Deny");
    });

    it("returns Allow policy for valid credentials", async () => {
        const token = Buffer.from("testuser:TEST_PASSWORD").toString("base64");
        const event = createEvent(`Basic ${token}`);
        const result = await handler(event);
        expect(result.policyDocument.Statement[0].Effect).toBe("Allow");
    });
});
