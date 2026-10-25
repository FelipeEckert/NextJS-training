import "server-only"; // reads a secret API key, so it must never be bundled for the browser

// One place for the base URL, the timeout and the optional API key, shared by quotes and history
export function fetchAwesomeApi(path: string) {
  // Read per call, not at import time; the smoke test points this at a fake API
  const baseUrl = process.env.AWESOMEAPI_BASE_URL || "https://economia.awesomeapi.com.br";
  // Optional: a free key raises AwesomeAPI's per-IP limit (shared cloud IPs like Vercel's hit it fast)
  const apiKey = process.env.AWESOMEAPI_KEY;

  return fetch(`${baseUrl}${path}`, {
    signal: AbortSignal.timeout(5000), // fail fast if the API hangs, instead of hanging our page
    headers: apiKey ? { "x-api-key": apiKey } : {},
  });
}
