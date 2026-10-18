import type { NextConfig } from "next";
import { networkInterfaces } from "node:os";

// This machine's LAN IPv4 addresses, so a phone on the same Wi-Fi can load
// dev assets from http://<ip>:3000. Only affects `next dev`.
const lanAddresses = Object.values(networkInterfaces())
  .flat()
  .filter((net) => net?.family === "IPv4" && !net.internal)
  .map((net) => net!.address);

// Photos are served from Supabase Storage as signed URLs. Letting next/image optimize them
// (resized WebP/AVIF) keeps the Home hero light on phones.
const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname : null;

const nextConfig: NextConfig = {
  images: {
    remotePatterns: supabaseHost
      ? [{ protocol: "https", hostname: supabaseHost, pathname: "/storage/v1/object/sign/photos/**" }]
      : [],
  },
  cacheComponents: true,
  allowedDevOrigins: lanAddresses,
  // Keep the dev badge off the bottom tab bar.
  devIndicators: { position: "top-right" },
  partialPrefetching: true,
  // The icon routes read the Barlow Condensed font from disk (src/lib/brand-icon.tsx); make sure
  // deploys ship it with them.
  outputFileTracingIncludes: {
    "/icon/**": ["./assets/fonts/**"],
    "/apple-icon": ["./assets/fonts/**"],
  },
  experimental: {
    // Photo uploads: the browser shrinks to ~1-2 MB, but the server accepts up to 8 MB when it can't.
    serverActions: { bodySizeLimit: "9mb" },
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
