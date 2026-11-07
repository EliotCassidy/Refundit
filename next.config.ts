import type { NextConfig } from "next";

// Cache Components is intentionally OFF: almost every page reads the Supabase
// auth cookie, and with it ON every cookie read outside <Suspense> is a build error.
const nextConfig: NextConfig = {
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
