import { cacheLife, cacheTag } from "next/cache";
import { fetchAwesomeApi } from "./awesomeapi";
import { PAIRS } from "./currencies";
import { type PricePoint, parseHistory } from "./analysis";

// Daily closes for up to a year. Cached for hours, since a daily chart changes slowly
export async function getHistory(pair: string): Promise<PricePoint[]> {
  // shortcut: default "use cache" lives in each server instance's memory, so on serverless (Vercel) each instance calls the API on its own; switch to "use cache: remote" when traffic grows
  "use cache";
  cacheLife("hours");
  cacheTag("history");

  if (!PAIRS.includes(pair)) throw new Error("Unsupported pair"); // never forward unknown pairs

  const res = await fetchAwesomeApi(`/json/daily/${pair}/360`);

  if (!res.ok) throw new Error(`AwesomeAPI responded ${res.status}`);

  return parseHistory(await res.json());
}
