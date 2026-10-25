import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiError, withApiKey, type ApiAuth } from "./api";
import { authenticateApiKey } from "./api-keys";
import { hitRateLimit } from "./rate-limit";

vi.mock("./api-keys", () => ({ authenticateApiKey: vi.fn() }));
vi.mock("./rate-limit", () => ({ hitRateLimit: vi.fn() }));

describe("apiError", () => {
  it("returns the status and a JSON error body", async () => {
    const res = apiError(404, "UNKNOWN_PAIR", "Unknown pair.");
    expect(res.status).toBe(404);
    expect(res.headers.get("content-type")).toMatch(/^application\/json/);
    expect(await res.json()).toEqual({ error: { code: "UNKNOWN_PAIR", message: "Unknown pair." } });
  });

  it("keeps extra headers", () => {
    const res = apiError(429, "RATE_LIMITED", "Too many requests.", { "Retry-After": "5" });
    expect(res.headers.get("Retry-After")).toBe("5");
    expect(res.headers.get("content-type")).toMatch(/^application\/json/);
  });
});

describe("withApiKey", () => {
  const auth: ApiAuth = { userId: 3, keyId: 9 };
  const request = (key?: string) =>
    new Request("http://localhost/api/v1/test", {
      headers: key ? { authorization: `Bearer ${key}` } : {},
    });

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("answers 401 with a challenge and skips the rate limiter when the key is missing", async () => {
    vi.mocked(authenticateApiKey).mockResolvedValue(null);
    const handler = vi.fn(async () => Response.json({ ok: true }));

    const res = await withApiKey(handler)(request(), {});

    expect(authenticateApiKey).toHaveBeenCalledWith(null);
    expect(res.status).toBe(401);
    expect(res.headers.get("WWW-Authenticate")).toBe("Bearer");
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(res.headers.get("X-RateLimit-Remaining")).toBeNull();
    expect(await res.json()).toEqual({
      error: { code: "UNAUTHORIZED", message: "Missing or invalid API key." },
    });
    expect(hitRateLimit).not.toHaveBeenCalled();
    expect(handler).not.toHaveBeenCalled();
  });

  it("answers 429 with Retry-After when the rate limit is hit", async () => {
    vi.mocked(authenticateApiKey).mockResolvedValue(auth);
    vi.mocked(hitRateLimit).mockResolvedValue({ allowed: false, remaining: 0, retryAfterSeconds: 7 });
    const handler = vi.fn(async () => Response.json({ ok: true }));

    const res = await withApiKey(handler)(request("ptk_key"), {});

    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("7");
    expect(res.headers.get("X-RateLimit-Remaining")).toBe("0");
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect((await res.json()).error.code).toBe("RATE_LIMITED");
    expect(handler).not.toHaveBeenCalled();
  });

  it("runs the handler with the auth and passes its response through", async () => {
    vi.mocked(authenticateApiKey).mockResolvedValue(auth);
    vi.mocked(hitRateLimit).mockResolvedValue({ allowed: true, remaining: 42, retryAfterSeconds: 1 });
    const handler = vi.fn(async () => Response.json({ data: [1] }, { status: 201 }));
    const ctx = { params: "x" };

    const res = await withApiKey(handler)(request("ptk_key"), ctx);

    expect(hitRateLimit).toHaveBeenCalledWith("api:9", 60, 60_000);
    expect(handler).toHaveBeenCalledWith(expect.any(Request), ctx, auth);
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ data: [1] });
    expect(res.headers.get("X-RateLimit-Remaining")).toBe("42");
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("answers 500 without leaking the error text when the handler throws", async () => {
    vi.mocked(authenticateApiKey).mockResolvedValue(auth);
    vi.mocked(hitRateLimit).mockResolvedValue({ allowed: true, remaining: 42, retryAfterSeconds: 1 });
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
    const handler = vi.fn(async (): Promise<Response> => {
      throw new Error("secret detail");
    });

    const res = await withApiKey(handler)(request("ptk_key"), {});

    expect(res.status).toBe(500);
    expect(res.headers.get("X-RateLimit-Remaining")).toBe("42");
    const body = await res.text();
    expect(JSON.parse(body)).toEqual({
      error: { code: "INTERNAL_ERROR", message: "Something went wrong." },
    });
    expect(body).not.toContain("secret detail");
    expect(errorLog).toHaveBeenCalledWith("secret detail");
    errorLog.mockRestore();
  });

  it("answers 500 JSON when the key lookup fails", async () => {
    vi.mocked(authenticateApiKey).mockRejectedValue(new Error("db down"));
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
    const handler = vi.fn(async () => Response.json({ ok: true }));

    const res = await withApiKey(handler)(request("ptk_key"), {});

    expect(res.status).toBe(500);
    expect(res.headers.get("content-type")).toMatch(/^application\/json/);
    expect(res.headers.get("X-RateLimit-Remaining")).toBeNull();
    expect((await res.json()).error.code).toBe("INTERNAL_ERROR");
    expect(hitRateLimit).not.toHaveBeenCalled();
    expect(handler).not.toHaveBeenCalled();
    errorLog.mockRestore();
  });
});
