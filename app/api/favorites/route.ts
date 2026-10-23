import { getFavorites } from "@/lib/favorites";

// GET /api/favorites → the favorites stored in this visitor's cookie
export async function GET() {
  return Response.json({ data: await getFavorites() });
}
