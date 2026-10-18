import type { Metadata, Viewport } from "next";
import { Barlow, Barlow_Condensed } from "next/font/google";
import { AppShell } from "@/components/shell/app-shell";
import "./globals.css";

const barlow = Barlow({
  variable: "--font-barlow",
  // 500 (font-medium, a handful of chips) falls back to 400: one less font file to preload.
  weight: ["400", "600", "700"],
  subsets: ["latin"],
  display: "swap",
});

const barlowCondensed = Barlow_Condensed({
  variable: "--font-barlow-condensed",
  weight: ["700"],
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL?.trim() || "http://localhost:3000"),
  title: {
    default: "Stamford Stags",
    template: "%s · Stamford Stags",
  },
  description: "USTA adult league tennis team in Stamford, CT.",
  applicationName: "Stamford Stags",
  // Home-screen web app on iPhone: opens full screen with "Stags" under the icon.
  appleWebApp: { capable: true, title: "Stags", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#0F172A",
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${barlow.variable} ${barlowCondensed.variable} antialiased`}
    >
      <body className="min-h-dvh font-sans">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
