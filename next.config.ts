import type { NextConfig } from "next";
import { networkInterfaces } from "node:os";

// This machine's LAN IPv4 addresses, so a phone on the same Wi-Fi can load
// dev assets from http://<ip>:3000. Only affects `next dev`.
const lanAddresses = Object.values(networkInterfaces())
  .flat()
  .filter((net) => net?.family === "IPv4" && !net.internal)
  .map((net) => net!.address);

const nextConfig: NextConfig = {
  cacheComponents: true,
  allowedDevOrigins: lanAddresses,
  // Keep the dev badge off the bottom tab bar.
  devIndicators: { position: "top-right" },
  partialPrefetching: true,
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
