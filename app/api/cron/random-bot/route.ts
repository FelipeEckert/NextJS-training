import { apiError } from "@/lib/api";
import { isCronRequest } from "@/lib/cron";
import { runHouseBot } from "@/lib/house-bot";
import { decideRandom } from "@/lib/random-bot";

// Vercel Cron calls this once a day after the daily close, with Authorization: Bearer <CRON_SECRET>
export const maxDuration = 60; // four pairs, each with up to three sequential requests

export async function GET(request: Request) {
  if (!isCronRequest(request)) {
    return apiError(401, "UNAUTHORIZED", "Missing or invalid cron secret.");
  }

  const apiKey = process.env.RANDOM_BOT_API_KEY;
  if (!apiKey) return apiError(500, "NOT_CONFIGURED", "RANDOM_BOT_API_KEY is not set.");

  // Vercel Cron calls the deployment URL, which Deployment Protection guards; the production domain is public
  const host = process.env.VERCEL_PROJECT_PRODUCTION_URL; // Vercel system variable, no protocol

  // Calls the app's own public API, so the bot trades like any user's bot
  const results = await runHouseBot({
    baseUrl: host ? `https://${host}` : new URL(request.url).origin,
    apiKey,
    now: new Date(),
    fetch,
    decide: decideRandom,
  });
  for (const result of results) {
    console.log(`random-bot ${result.pair} ${result.action} ${result.detail}`);
  }
  return Response.json({ data: results }, { headers: { "Cache-Control": "no-store" } });
}
