import { brandIcon } from "@/lib/brand-icon";

// Browser tab icon plus the home-screen sizes the web app manifest lists (src/app/manifest.ts).
// The maskable one keeps the mark inside the central safe zone, since Android crops to a circle.
const ICONS = {
  "32": { size: 32, scale: 0.86 },
  "192": { size: 192, scale: 0.72 },
  "512": { size: 512, scale: 0.72 },
  maskable: { size: 512, scale: 0.56 },
} as const;

export function generateImageMetadata() {
  return Object.entries(ICONS).map(([id, { size }]) => ({
    id,
    size: { width: size, height: size },
    contentType: "image/png",
    alt: "Stamford Stags",
  }));
}

export default async function Icon({ id }: { id: Promise<string | number> }) {
  const icon = ICONS[String(await id) as keyof typeof ICONS] ?? ICONS["32"];
  return brandIcon(icon.size, icon.scale);
}
