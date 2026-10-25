// Only allow paths on our own site. Without this, a phishing link like
// /login?next=https://evil.com would send users to an attacker right after a real login
// (an "open redirect"). Parsing with URL also catches tricks like "//evil.com" and "/\evil.com".
export function safeNextPath(next: string | undefined) {
  if (!next) return "/wallet";
  const base = "http://internal";
  try {
    const url = new URL(next, base);
    // "/.//evil.com" keeps our origin but normalises to "//evil.com", which browsers treat as another site
    if (url.origin !== base || url.pathname.startsWith("//") || url.pathname.startsWith("/\\")) {
      return "/wallet";
    }
    return `${url.pathname}${url.search}`;
  } catch {
    return "/wallet"; // malformed input such as "//[" makes URL throw
  }
}
