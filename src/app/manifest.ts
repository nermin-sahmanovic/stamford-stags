import type { MetadataRoute } from "next";

// Lets players "Add to Home Screen". It opens on Match Center; signed-out players go through
// sign-in and come back to it.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Stamford Stags",
    short_name: "Stags",
    description: "Matches, availability and lineups for the Stamford Stags USTA team.",
    start_url: "/matches",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0F172A",
    theme_color: "#0F172A",
    icons: [
      { src: "/icon/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon/maskable", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
