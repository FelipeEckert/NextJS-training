import "server-only";

import { authenticateApiKey } from "./api-keys";
import { hitRateLimit } from "./rate-limit";

export type ApiAuth = { userId: number; keyId: number };

// Every v1 error has the same JSON shape, so clients can parse one format
export function apiError(
  status: number,
  code: string,
  message: string,
  headers?: HeadersInit,
): Response {
  return Response.json({ error: { code, message } }, { status, headers });
}

// Response headers can be immutable (e.g. from fetch), so copy the response before setting one
function withRemaining(res: Response, remaining: number): Response {
  const copy = new Response(res.body, res);
  copy.headers.set("X-RateLimit-Remaining", String(remaining));
  return copy;
}

// Order matters: a request without a valid key never reaches the rate limiter
export function withApiKey<Ctx>(
  handler: (request: Request, ctx: Ctx, auth: ApiAuth) => Promise<Response>,
): (request: Request, ctx: Ctx) => Promise<Response> {
  return async (request, ctx) => {
    const auth = await authenticateApiKey(request.headers.get("authorization"));
    if (!auth) return apiError(401, "UNAUTHORIZED", "Missing or invalid API key.");

    const limit = await hitRateLimit(`api:${auth.keyId}`, 60, 60_000);
    if (!limit.allowed) {
      return apiError(429, "RATE_LIMITED", "Too many requests. Try again later.", {
        "Retry-After": String(limit.retryAfterSeconds),
        "X-RateLimit-Remaining": String(limit.remaining),
      });
    }

    let res: Response;
    try {
      res = await handler(request, ctx, auth);
    } catch (error) {
      // Logs only the error, never the request: the Authorization header holds the key
      console.error(error);
      res = apiError(500, "INTERNAL_ERROR", "Something went wrong.");
    }
    return withRemaining(res, limit.remaining);
  };
}
