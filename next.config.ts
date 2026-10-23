import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
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
