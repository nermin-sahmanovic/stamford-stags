import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

// The SS mark from the site header (dashed ball-green circle, "SS" in Barlow Condensed 700) on
// navy, for the favicon, home-screen icons and the web app manifest.

const NAVY = "#0F172A";
const BALL = "#C7EA46";

// Barlow Condensed 700 (SIL OFL, assets/fonts). ImageResponse reads woff, not woff2.
const font = readFile(join(process.cwd(), "assets/fonts/barlow-condensed-latin-700-normal.woff"));

/**
 * @param size  square edge in px
 * @param markScale  circle diameter as a share of the edge (maskable icons keep it in the
 *   central safe zone, so they use a smaller mark)
 */
export async function brandIcon(size: number, markScale = 0.72) {
  const diameter = Math.round(size * markScale);
  // Tiny favicons can't show dashes; a solid ring reads better at 16-32px.
  const dashed = size >= 96;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: NAVY }}>
        <div
          style={{
            width: diameter,
            height: diameter,
            borderRadius: "50%",
            border: `${Math.max(1, Math.round(diameter * (dashed ? 0.045 : 0.08)))}px ${dashed ? "dashed" : "solid"} ${BALL}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: BALL,
            fontFamily: "Barlow Condensed",
            fontSize: Math.round(diameter * 0.44),
            letterSpacing: "0.04em",
            lineHeight: 1,
          }}
        >
          SS
        </div>
      </div>
    ),
    {
      width: size,
      height: size,
      fonts: [{ name: "Barlow Condensed", data: await font, weight: 700, style: "normal" }],
    },
  );
}
