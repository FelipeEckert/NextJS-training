import "server-only"; // reads a secret API key, so it must never be bundled for the browser

const BASE_URL = "https://economia.awesomeapi.com.br";

// One place for the base URL, the timeout and the optional API key, shared by quotes and history
export function fetchAwesomeApi(path: string) {
  // Optional: a free key raises AwesomeAPI's per-IP limit (shared cloud IPs like Vercel's hit it fast)
  const apiKey = process.env.AWESOMEAPI_KEY;

  return fetch(`${BASE_URL}${path}`, {
    signal: AbortSignal.timeout(5000), // fail fast if the API hangs, instead of hanging our page
    headers: apiKey ? { "x-api-key": apiKey } : {},
  });
}
