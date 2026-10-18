#!/usr/bin/env bash
# Lighthouse mobile scores against a PRODUCTION build (npm run build && npm start), never `next dev`.
#
#   bash scripts/lighthouse.sh <label> <url> [player-email]
#   bash scripts/lighthouse.sh home http://localhost:3000/
#   bash scripts/lighthouse.sh matches http://localhost:3000/matches player03@example.com
#
# Five runs with Lighthouse's default mobile settings (Moto G emulation, slow 4G, 4x CPU), each
# in a fresh headless Chrome (scripts/lighthouse-chrome.ps1, fixed port 9333: chrome-launcher
# can't pick up a dynamic debugging port on this machine). Prints the median-performance run.
# With a player email, it signs in through `npm run dev-login` (Stags-Dev only) and sends the
# session cookie, so member pages are measured as that player. Reports go to .lighthouse/.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/.lighthouse"
label="$1"; url="$2"; email="${3:-}"
mkdir -p "$OUT"

cookie=""
if [ -n "$email" ]; then
  link=$(cd "$ROOT" && npm run -s dev-login -- "$email" 2>&1 | grep -o 'http://localhost:3000/api/auth/callback[^ ]*' | head -1)
  [ -n "$link" ] || { echo "dev-login failed for $email" >&2; exit 1; }
  jar="$OUT/$label.cookies"
  rm -f "$jar"
  curl -s -o /dev/null -c "$jar" -b "$jar" -L "$link"
  cookie=$(awk -F'\t' '/^#HttpOnly_/ { sub(/^#HttpOnly_/, ""); } !/^#/ && NF >= 7 { printf "%s=%s; ", $6, $7 }' "$jar")
  rm -f "$jar"
fi

for i in 1 2 3 4 5; do
  powershell -NoProfile -ExecutionPolicy Bypass -File "$ROOT/scripts/lighthouse-chrome.ps1" >/dev/null 2>&1
  args=(--quiet --output=json --output=html --output-path="$OUT/$label-$i" --port=9333)
  if [ -n "$cookie" ]; then args+=(--extra-headers="{\"Cookie\":\"$cookie\"}"); fi
  npx --yes lighthouse@12 "$url" "${args[@]}" >/dev/null 2>&1 || echo "run $i failed"
done
powershell -NoProfile -ExecutionPolicy Bypass -File "$ROOT/scripts/lighthouse-chrome.ps1" -Stop >/dev/null 2>&1 || true

node -e '
const fs = require("fs"); const [dir, label] = process.argv.slice(1);
const runs = [1, 2, 3, 4, 5].map(i => { try { return JSON.parse(fs.readFileSync(`${dir}/${label}-${i}.report.json`, "utf8")); } catch { return null; } }).filter(Boolean);
if (!runs.length) { console.log(label, "no runs"); process.exit(1); }
runs.sort((a, b) => a.categories.performance.score - b.categories.performance.score);
const r = runs[Math.floor(runs.length / 2)], c = r.categories, a = r.audits, s = k => Math.round(c[k].score * 100);
console.log(`${label}: performance ${runs.map(x => Math.round(x.categories.performance.score * 100)).join("/")} -> median ${s("performance")} | accessibility ${s("accessibility")} | best practices ${s("best-practices")} | SEO ${s("seo")}`);
console.log(`  ${r.finalDisplayedUrl}: FCP ${a["first-contentful-paint"].displayValue}, LCP ${a["largest-contentful-paint"].displayValue}, TBT ${a["total-blocking-time"].displayValue}, CLS ${a["cumulative-layout-shift"].displayValue}`);
' "$OUT" "$label"
