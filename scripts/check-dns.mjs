// Read-only check of the stamfordstags.com DNS records the deploy needs (Vercel, Resend,
// ImprovMX email forwarding). Asks public resolvers directly, so a stale local cache doesn't lie.
//
//   npm run check-dns
//   npm run check-dns -- --only=resend      (groups: site, resend, forwarding)
//
// Exit code 1 if any checked record is missing or wrong.
import { Resolver } from "node:dns/promises";

const DOMAIN = "stamfordstags.com";
const resolver = new Resolver({ timeout: 5000, tries: 2 });
resolver.setServers(["1.1.1.1", "8.8.8.8"]);

const only = process.argv.find((a) => a.startsWith("--only="))?.slice("--only=".length);

const txt = async (name) => (await resolver.resolveTxt(name)).map((chunks) => chunks.join(""));
const mx = async (name) => (await resolver.resolveMx(name)).map((r) => `${r.priority} ${r.exchange.toLowerCase()}`);

/** Each check returns { ok, got }. A lookup error (no record) counts as a failure. */
const checks = [
  {
    group: "site",
    name: `A ${DOMAIN} → Vercel`,
    run: async () => {
      const got = await resolver.resolve4(DOMAIN);
      // Vercel's apex addresses: the classic 76.76.21.21 and the newer 216.198.79.x range.
      return { ok: got.length > 0 && got.every((ip) => /^(76\.76\.21|216\.198\.79)\.\d+$/.test(ip)), got };
    },
  },
  {
    group: "site",
    name: `CNAME www.${DOMAIN} → *.vercel-dns*.com`,
    run: async () => {
      const got = await resolver.resolveCname(`www.${DOMAIN}`);
      return { ok: got.some((c) => /(^|\.)vercel-dns(-\d+)?\.com$/i.test(c)), got };
    },
  },
  // Resend "Forge" (2026): two CNAMEs replace the old send MX + SPF TXT pair on Amazon SES.
  {
    group: "resend",
    name: `CNAME send.${DOMAIN} → send.forge.rmta.net`,
    run: async () => {
      const got = await resolver.resolveCname(`send.${DOMAIN}`);
      return { ok: got.length === 1 && got[0].toLowerCase() === "send.forge.rmta.net", got };
    },
  },
  {
    group: "resend",
    name: `CNAME rsend.${DOMAIN} → rsend.forge.rmta.net`,
    run: async () => {
      const got = await resolver.resolveCname(`rsend.${DOMAIN}`);
      return { ok: got.length === 1 && got[0].toLowerCase() === "rsend.forge.rmta.net", got };
    },
  },
  {
    group: "resend",
    name: `TXT resend._domainkey.${DOMAIN} (DKIM)`,
    run: async () => {
      const got = await txt(`resend._domainkey.${DOMAIN}`);
      return { ok: got.some((t) => /(^|;\s*)p=[A-Za-z0-9+/]{100,}/.test(t)), got: got.map((t) => `${t.slice(0, 40)}…`) };
    },
  },
  {
    group: "resend",
    name: `TXT _dmarc.${DOMAIN} (DMARC)`,
    run: async () => {
      const got = (await txt(`_dmarc.${DOMAIN}`)).filter((t) => t.startsWith("v=DMARC1"));
      return { ok: got.length === 1, got };
    },
  },
  {
    group: "forwarding",
    name: `MX ${DOMAIN} → ImprovMX (10 mx1, 20 mx2 .improvmx.com)`,
    run: async () => {
      const got = await mx(DOMAIN);
      const want = ["10 mx1.improvmx.com", "20 mx2.improvmx.com"];
      return { ok: got.length === want.length && want.every((w) => got.includes(w)), got };
    },
  },
  {
    group: "forwarding",
    name: `TXT ${DOMAIN} (one SPF, include:spf.improvmx.com)`,
    run: async () => {
      const got = (await txt(DOMAIN)).filter((t) => t.startsWith("v=spf1"));
      return { ok: got.length === 1 && got[0].includes("include:spf.improvmx.com"), got };
    },
  },
];

let failures = 0;
for (const check of checks.filter((c) => !only || c.group === only)) {
  let result;
  try {
    result = await check.run();
  } catch (err) {
    result = { ok: false, got: [err.code ?? String(err)] };
  }
  if (!result.ok) failures++;
  console.log(`${result.ok ? "ok    " : "NOT OK"}  [${check.group}] ${check.name}`);
  console.log(`          ${result.got.length ? result.got.join(" | ") : "(none)"}`);
}
console.log(failures ? `\n${failures} record(s) missing or wrong.` : "\nAll records look right.");
process.exit(failures ? 1 : 0);
