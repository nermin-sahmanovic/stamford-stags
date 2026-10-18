import { brandIcon } from "@/lib/brand-icon";

// iPhone "Add to Home Screen" icon. iOS rounds the corners itself, so it's a full navy square.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return brandIcon(180, 0.72);
}
