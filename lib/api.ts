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

// Applied to every response withApiKey returns: keys and results are never cached,
// and the remaining count is sent whenever the rate limiter has answered
function finish(res: Response, remaining?: number): Response {
  // Response headers can be immutable (e.g. from fetch), so copy the response before setting them
  const out = new Response(res.body, res);
  out.headers.set("Cache-Control", "no-store");
  if (remaining !== undefined) out.headers.set("X-RateLimit-Remaining", String(remaining));
  return out;
}

// Order matters: a request without a valid key never reaches the rate limiter
export function withApiKey<Ctx>(
  handler: (request: Request, ctx: Ctx, auth: ApiAuth) => Promise<Response>,
): (request: Request, ctx: Ctx) => Promise<Response> {
  return async (request, ctx) => {
    let remaining: number | undefined; // unknown until the rate limiter has answered
    try {
      const auth = await authenticateApiKey(request.headers.get("authorization"));
      if (!auth) {
        return finish(
          apiError(401, "UNAUTHORIZED", "Missing or invalid API key.", {
            "WWW-Authenticate": "Bearer",
          }),
        );
      }

      const limit = await hitRateLimit(`api:${auth.keyId}`, 60, 60_000);
      remaining = limit.remaining;
      if (!limit.allowed) {
        return finish(
          apiError(429, "RATE_LIMITED", "Too many requests. Try again later.", {
            "Retry-After": String(limit.retryAfterSeconds),
          }),
          limit.remaining,
        );
      }

      return finish(await handler(request, ctx, auth), limit.remaining);
    } catch (error) {
      // The message only: Drizzle error objects also carry the query parameters
      console.error(error instanceof Error ? error.message : error);
      return finish(apiError(500, "INTERNAL_ERROR", "Something went wrong."), remaining);
    }
  };
}
