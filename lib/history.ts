import { cacheLife, cacheTag } from "next/cache";
import { PAIRS } from "./currencies";
import { type PricePoint, parseHistory } from "./analysis";

// Daily closes for up to a year. Cached for hours, since a daily chart changes slowly
export async function getHistory(pair: string): Promise<PricePoint[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("history");

  if (!PAIRS.includes(pair)) throw new Error("Unsupported pair"); // never forward unknown pairs

  const res = await fetch(`https://economia.awesomeapi.com.br/json/daily/${pair}/360`, {
    signal: AbortSignal.timeout(5000),
  });

  if (!res.ok) throw new Error(`AwesomeAPI responded ${res.status}`);

  return parseHistory(await res.json());
}
