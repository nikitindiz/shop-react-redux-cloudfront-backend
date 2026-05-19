import type {
    APIGatewayTokenAuthorizerEvent,
    APIGatewayAuthorizerResult,
} from "aws-lambda";

function generatePolicy(
    principalId: string,
    effect: "Allow" | "Deny",
    resource: string,
): APIGatewayAuthorizerResult {
    return {
        principalId,
        policyDocument: {
            Version: "2012-10-17",
            Statement: [
                {
                    Action: "execute-api:Invoke",
                    Effect: effect,
                    Resource: resource,
                },
            ],
        },
    };
}

export const handler = async (
    event: APIGatewayTokenAuthorizerEvent,
): Promise<APIGatewayAuthorizerResult> => {
    const authorizationToken = event.authorizationToken;

    if (!authorizationToken) {
        throw new Error("Unauthorized");
    }

    const [scheme, token] = authorizationToken.split(" ");

    if (scheme !== "Basic" || !token) {
        throw new Error("Unauthorized");
    }

    const decoded = Buffer.from(token, "base64").toString("utf-8");
    const [login, password] = decoded.split(":");

    if (!login || !password) {
        return generatePolicy("user", "Deny", event.methodArn);
    }

    const expectedPassword = process.env[login];

    if (expectedPassword && expectedPassword === password) {
        return generatePolicy(login, "Allow", event.methodArn);
    }

    return generatePolicy(login, "Deny", event.methodArn);
};
