import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false, // don't advertise "X-Powered-By: Next.js" to attackers scanning for versions
  // Sent with every response: tells the browser to turn on its own protections
  headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // Don't guess file types: a "text" upload can't be run as a script
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Don't send our full URLs to other sites
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Our app doesn't need these devices, so no script on the page can ask for them
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          // Always use HTTPS for 2 years (browsers ignore it on plain-HTTP localhost)
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
          // CSP: no site may embed us in an iframe (clickjacking), forms only post to us,
          // no plugins. A strict script-src needs per-request nonces, a step further.
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors 'none'; form-action 'self'; base-uri 'self'; object-src 'none'",
          },
          // Same as frame-ancestors, for older browsers
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
  experimental: {
    agentFeedback: true,
  },
  cacheComponents: true,
  partialPrefetching: true,
  // Checked before any page renders. permanent: true → 308 (browsers and search engines remember it)
  redirects() {
    return [
      // A short, friendly URL
      { source: "/dollar", destination: "/currency/USD-BRL", permanent: true },
      // We renamed the route from Portuguese: keep old links and bookmarks working
      { source: "/moeda/:pair", destination: "/currency/:pair", permanent: true },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
