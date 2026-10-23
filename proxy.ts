import { NextResponse, type NextRequest } from "next/server";
import { PAIRS } from "@/lib/currencies";

// Runs BEFORE any page renders. Good for fast checks on the request.
// Not a security boundary on its own: pages and Server Actions verify again.
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Unknown currency pair → real 404, before the page starts streaming
  //    (inside the page, notFound() would come too late and keep a 200 status)
  if (pathname.startsWith("/currency")) {
    const pair = pathname.split("/")[2]?.toUpperCase() ?? "";
    if (!PAIRS.includes(pair)) {
      return NextResponse.rewrite(new URL("/404", request.url), { status: 404 });
    }
  }

  // 2. Optimistic auth check: no session cookie → go sign in first.
  //    It only checks that the cookie EXISTS. The page checks that it's valid.
  if (pathname.startsWith("/favorites") && !request.cookies.has("session")) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname); // come back here after signing in
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

// Only run on these paths, so every other request skips the proxy entirely
export const config = {
  matcher: ["/currency/:path*", "/favorites/:path*"],
};
