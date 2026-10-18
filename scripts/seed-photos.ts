// Dev only. Adds sample photos to Stags-Dev so the gallery and Home team photo have something
// to choose from. seed.sql can't hold image files, so this generates them.
//
//   npm run seed-photos            add (or refresh) the samples
//   npm run seed-photos -- --remove   delete them again
//
// The images are drawn court illustrations labelled "SAMPLE", processed like a real upload
// (2048px JPEG + 640px thumbnail, no metadata) and stored under photos/samples/. They start
// private; a captain makes one public or picks it as the Home team photo in /photos.
// Uses the service role key from .env.local. Never imported by the app; excluded from deploys.

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

const DEV_PROJECT_REF = "jljyylzalwiczrimaguz"; // Stags-Dev
const BUCKET = "photos";

function fail(message: string): never {
  console.error(`seed-photos: ${message}`);
  process.exit(1);
}

function readEnvLocal(): Record<string, string> {
  let text: string;
  try {
    text = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  } catch {
    fail(".env.local not found in the project root.");
  }
  const vars: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*([^#\s]*)/);
    if (match) vars[match[1]] = match[2].replace(/^(["'])(.*)\1$/, "$2");
  }
  return vars;
}

type Sample = { slug: string; caption: string; surface: string; out: string; sky: string; balls: [number, number][] };

// Ball positions in court metres: [across from the centre line, along from the near baseline].
const SAMPLES: Sample[] = [
  { slug: "home-courts", caption: "Sample: home courts at Stamford", surface: "#2563EB", out: "#1E3A8A", sky: "#0F172A", balls: [[-2.5, 3], [1.8, 8.5], [3.2, 16], [-1, 19.5]] },
  { slug: "clay-day", caption: "Sample: clay court practice", surface: "#C2410C", out: "#7C2D12", sky: "#1E293B", balls: [[-3.5, 2], [0.5, 7], [2.8, 4], [-2, 15]] },
  { slug: "grass-social", caption: "Sample: end-of-season social", surface: "#3F7D3A", out: "#24521F", sky: "#0F172A", balls: [[2.5, 1.5], [-1.5, 9], [0, 17], [3.8, 20]] },
  { slug: "indoor-match", caption: "Sample: indoor match night", surface: "#0E7490", out: "#164E63", sky: "#111827", balls: [[-4, 5], [1, 3.5], [2.2, 14], [-2.8, 21]] },
  { slug: "doubles-warmup", caption: "Sample: doubles warm-up", surface: "#4338CA", out: "#312E81", sky: "#0F172A", balls: [[-1.2, 2.5], [3.5, 6], [-3, 16.5], [1.5, 18]] },
  { slug: "match-point", caption: "Sample: match point", surface: "#15803D", out: "#14532D", sky: "#1E293B", balls: [[0.8, 4.5], [-3.2, 8], [2.6, 15.5], [-0.5, 20.5]] },
];

// Real court dimensions (metres) and a camera behind the near baseline, looking straight down the
// court, so every line is level and the court is centred.
const LENGTH = 23.77;
const HALF_DOUBLES = 10.97 / 2;
const HALF_SINGLES = 8.23 / 2;
const SERVICE = 6.4; // service line distance from the net
const NET_POST = 0.914; // net height at the posts (1.07 m in the middle is close enough here)
const POST_OUT = 0.914; // posts stand this far outside the doubles sidelines

const W = 2400;
const H = 1600;
const CX = W / 2;
const HORIZON = 360;
const CAMERA_BACK = 7; // metres behind the near baseline
const FOCAL = 1350; // pixels
const CAMERA_HEIGHT = 5.2; // metres

/** Court point (x across, z along from the near baseline, height y) → screen pixels. */
function project(x: number, z: number, y = 0) {
  const depth = z + CAMERA_BACK;
  return { x: CX + (x * FOCAL) / depth, y: HORIZON + ((CAMERA_HEIGHT - y) * FOCAL) / depth };
}

const pt = (x: number, z: number, y = 0) => {
  const p = project(x, z, y);
  return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
};
const line = (x1: number, z1: number, x2: number, z2: number) => {
  const a = project(x1, z1);
  const b = project(x2, z2);
  return `<line x1="${a.x.toFixed(1)}" y1="${a.y.toFixed(1)}" x2="${b.x.toFixed(1)}" y2="${b.y.toFixed(1)}"/>`;
};

/** A level 3:2 court scene in true perspective, with a "SAMPLE" badge and a caption pill. */
function svgFor(sample: Sample) {
  const netZ = LENGTH / 2;
  const far = LENGTH;
  const surround = `${pt(-HALF_DOUBLES - 3.5, -1)} ${pt(HALF_DOUBLES + 3.5, -1)} ${pt(HALF_DOUBLES + 3.5, far + 5)} ${pt(-HALF_DOUBLES - 3.5, far + 5)}`;
  const court = `${pt(-HALF_DOUBLES, 0)} ${pt(HALF_DOUBLES, 0)} ${pt(HALF_DOUBLES, far)} ${pt(-HALF_DOUBLES, far)}`;
  const lines = [
    line(-HALF_DOUBLES, 0, HALF_DOUBLES, 0), // near baseline
    line(-HALF_DOUBLES, far, HALF_DOUBLES, far), // far baseline
    line(-HALF_DOUBLES, 0, -HALF_DOUBLES, far), // doubles sidelines
    line(HALF_DOUBLES, 0, HALF_DOUBLES, far),
    line(-HALF_SINGLES, 0, -HALF_SINGLES, far), // singles sidelines
    line(HALF_SINGLES, 0, HALF_SINGLES, far),
    line(-HALF_SINGLES, netZ - SERVICE, HALF_SINGLES, netZ - SERVICE), // service lines
    line(-HALF_SINGLES, netZ + SERVICE, HALF_SINGLES, netZ + SERVICE),
    line(0, netZ - SERVICE, 0, netZ + SERVICE), // centre service line
    line(0, 0, 0, 0.3), // centre marks
    line(0, far, 0, far - 0.3),
  ].join("");

  // Net: a band between the posts, with mesh lines that follow the perspective.
  const postX = HALF_DOUBLES + POST_OUT;
  const net = `${pt(-postX, netZ, NET_POST)} ${pt(postX, netZ, NET_POST)} ${pt(postX, netZ)} ${pt(-postX, netZ)}`;
  const mesh = Array.from({ length: 29 }, (_, i) => {
    const x = -postX + (i * 2 * postX) / 28;
    const top = project(x, netZ, NET_POST);
    const bottom = project(x, netZ);
    return `<line x1="${top.x.toFixed(1)}" y1="${top.y.toFixed(1)}" x2="${bottom.x.toFixed(1)}" y2="${bottom.y.toFixed(1)}"/>`;
  }).join("");
  const tape = `${pt(-postX, netZ, NET_POST)} ${pt(postX, netZ, NET_POST)} ${pt(postX, netZ, NET_POST - 0.08)} ${pt(-postX, netZ, NET_POST - 0.08)}`;
  const posts = [-postX, postX]
    .map((x) => {
      const top = project(x, netZ, NET_POST + 0.05);
      const bottom = project(x, netZ);
      return `<line x1="${top.x.toFixed(1)}" y1="${top.y.toFixed(1)}" x2="${bottom.x.toFixed(1)}" y2="${bottom.y.toFixed(1)}"/>`;
    })
    .join("");

  // Balls on the court surface, sized by distance (a ball is 6.7 cm across).
  const balls = sample.balls
    .map(([x, z]) => {
      const p = project(x, z, 0.034);
      const r = Math.max(9, (0.12 * FOCAL) / (z + CAMERA_BACK));
      return `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${r.toFixed(1)}" fill="#C7EA46"/>`;
    })
    .join("");

  const caption = sample.caption.replace("Sample: ", "");
  const captionWidth = Math.round(caption.length * 33 + 80);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="${sample.sky}"/>
  <polygon points="${surround}" fill="${sample.out}"/>
  <rect y="${HORIZON + (CAMERA_HEIGHT * FOCAL) / (far + 5 + CAMERA_BACK)}" width="${W}" height="${H}" fill="${sample.out}"/>
  <polygon points="${court}" fill="${sample.surface}"/>
  <g stroke="#fff" stroke-width="9" stroke-linecap="square">${lines}</g>
  <polygon points="${net}" fill="#0F172A" fill-opacity="0.35"/>
  <g stroke="#E2E8F0" stroke-width="2" opacity="0.6">${mesh}</g>
  <polygon points="${tape}" fill="#F8FAFC"/>
  <g stroke="#94A3B8" stroke-width="10" stroke-linecap="round">${posts}</g>
  ${balls}
  <g font-family="Arial, Helvetica, sans-serif" font-weight="700">
    <rect x="72" y="64" width="360" height="104" rx="16" fill="#0F172A" fill-opacity="0.85"/>
    <text x="252" y="138" font-size="64" letter-spacing="8" fill="#C7EA46" text-anchor="middle">SAMPLE</text>
    <rect x="${(W - captionWidth) / 2}" y="${H - 150}" width="${captionWidth}" height="96" rx="48" fill="#0F172A" fill-opacity="0.85"/>
    <text x="${W / 2}" y="${H - 85}" font-size="56" fill="#FFFFFF" text-anchor="middle">${caption}</text>
  </g>
</svg>`;
}

async function main() {
  if (process.env.NODE_ENV !== "development") {
    fail(`refusing to run: NODE_ENV is "${process.env.NODE_ENV ?? ""}", not "development". Use npm run seed-photos.`);
  }
  if (process.env.VERCEL || process.env.CI) fail("refusing to run in a deploy or CI environment.");

  const env = readEnvLocal();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) fail("NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing from .env.local.");
  if (new URL(url).hostname !== `${DEV_PROJECT_REF}.supabase.co`) {
    fail(`refusing to run: .env.local doesn't point at Stags-Dev (${DEV_PROJECT_REF}).`);
  }

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const paths = SAMPLES.flatMap((s) => [`samples/${s.slug}.jpg`, `samples/${s.slug}-thumb.jpg`]);

  if (process.argv.includes("--remove")) {
    const { error: rowError } = await admin.from("photos").delete().like("path", "samples/%");
    if (rowError) fail(`couldn't delete sample rows: ${rowError.message}`);
    const { error: fileError } = await admin.storage.from(BUCKET).remove(paths);
    if (fileError) fail(`couldn't delete sample files: ${fileError.message}`);
    console.log(`seed-photos: removed ${SAMPLES.length} sample photos.`);
    return;
  }

  const { data: season } = await admin.from("seasons").select("id").eq("is_current", true).maybeSingle();

  for (const [index, sample] of SAMPLES.entries()) {
    const source = sharp(Buffer.from(svgFor(sample)));
    const full = await source
      .clone()
      .resize({ width: 2048, height: 2048, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 80, mozjpeg: true })
      .toBuffer({ resolveWithObject: true });
    const thumb = await source
      .clone()
      .resize({ width: 640, height: 640, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 72, mozjpeg: true })
      .toBuffer();

    const path = `samples/${sample.slug}.jpg`;
    const thumbPath = `samples/${sample.slug}-thumb.jpg`;
    const options = { contentType: "image/jpeg", cacheControl: "31536000", upsert: true };
    for (const [p, body] of [[path, full.data], [thumbPath, thumb]] as const) {
      const { error } = await admin.storage.from(BUCKET).upload(p, body, options);
      if (error) fail(`upload of ${p} failed: ${error.message}`);
    }

    // Re-running refreshes the files but keeps the row (and any public/team-photo choice).
    const { error } = await admin.from("photos").upsert(
      {
        path,
        thumb_path: thumbPath,
        width: full.info.width,
        height: full.info.height,
        caption: sample.caption,
        season_id: season?.id ?? null,
        // Spread out so the gallery shows them in a stable order, newest first.
        created_at: new Date(Date.now() - (index + 1) * 3_600_000).toISOString(),
      },
      { onConflict: "path", ignoreDuplicates: false },
    );
    if (error) fail(`row for ${path} failed: ${error.message}`);
    console.log(`seed-photos: ${sample.caption} (${full.info.width}x${full.info.height})`);
  }
  console.log(`seed-photos: ${SAMPLES.length} sample photos ready in /photos (private until a captain changes that).`);
}

main().catch((err) => fail(err instanceof Error ? err.message : String(err)));
