# Demo deployment plan (not built yet)

A public portfolio demo of the app, separate from production. Agreed on 2026-10-19; build it in a fresh
session **after go-live**. Start that session in plan mode and confirm this plan still matches the code.

## Goal

- A demo at a neutral Vercel address (**`stags-demo.vercel.app`**, or the closest free project name), not a
  `stamfordstags.com` subdomain, so players don't mistake it for the real site.
- Only fake data. **Never points at stags-prod** (`ksdlfayrqisedqdcbybu`).
- Visitors try it as captain or player without email; nothing sends; data resets nightly; not indexed.

## Decisions

| Topic | Decision | Why |
|---|---|---|
| Database | **Reuse Stags-Dev** (`jljyylzalwiczrimaguz`) | Free tier allows 2 active Supabase projects (dev + prod). A third means Supabase Pro (~$25+/month). |
| Address | Separate Vercel Hobby project at `*.vercel.app` | Free; keeps the team domain for the real site only |
| Sign-in | "Try as Captain" / "Try as Player" buttons, password sign-in to two fixed demo accounts | No email, and no service-role key on a public action |
| Email | Always log-only | Demo must never send |
| Photo uploads | **Off** in demo mode | Anyone can be "captain"; uploads can be made public on Home |
| Seed captain | Replace the real email and phone in `supabase/seed.sql` with a fake captain | The demo shows seed data publicly |
| Turnstile | Cloudflare test keys on the demo project | Vercel runs with `NODE_ENV=production`, so keys must be set; forms send nothing anyway |

### Trade-offs of reusing Stags-Dev (accepted)

- The nightly reset also resets dev to seed data, so local test data doesn't survive overnight (and dev starts
  each day clean).
- The demo Vercel project holds the Stags-Dev secret key, server-side only (same exposure as Preview).
- A migration pushed to Stags-Dev is live on the demo before its code is deployed: push and merge close together.

## Free-tier check

| Piece | Cost | Notes |
|---|---|---|
| Vercel demo project (Hobby) | $0 | Same GitHub repo, its own env vars |
| Cron jobs | $0 | Hobby: up to 100 jobs per project (Vercel docs, Jan 2026), once per day each. `vercel.json` is shared, so both projects get all 3 jobs (reminders, keep-alive, demo-reset); each route refuses where it doesn't belong. Older docs said 2 per account: Vercel rejects a deploy that exceeds the limit, so the first demo deploy confirms it. |
| Supabase | $0 | Reuses Stags-Dev |
| Domain | $0 | `*.vercel.app` |

## Design

### 1. Demo mode and its guard: `src/lib/demo.ts`

- `isDemo()` is true only when `DEMO_MODE === "on"` **and** the Supabase URL's project ref is Stags-Dev.
- If `DEMO_MODE=on` but the ref is stags-prod (or anything not on the allowlist), demo features stay off and the
  server logs an error. Prod never sets `DEMO_MODE`; the ref check is the backstop.
- Every demo-only route, action and UI branch goes through `isDemo()`.

### 2. "Try as Captain" / "Try as Player"

- Seed two fixed accounts, e.g. `captain@demo.invalid` (role captain) and `player@demo.invalid` (role player),
  with fake names and phones.
- A one-time script (dev-only, same guards as `dev-login`, listed in `.vercelignore`) creates the two auth users
  with `email_confirm: true` and sets their password from `DEMO_PASSWORD`. The `players` rows link by email
  automatically (existing trigger).
- `/sign-in` in demo mode: two buttons → server action `demoSignIn(role)` → `signInWithPassword` with the fixed
  email and `DEMO_PASSWORD` (server-only env var) → `/matches`. zod-validated `role`.
- **No service role**: CLAUDE.md non-negotiable 2 stays intact.
- In demo mode, hide the email (magic link) form and make its action refuse, so visitors can't make Stags-Dev's
  mailer send links to arbitrary addresses.
- **Stags-Dev dashboard:** Authentication → turn **off** "Allow new users to sign up" (the publishable key is
  public). Also make sure the **Email provider's password sign-in** is enabled. `dev-login` keeps working: it
  creates users through the admin API, which ignores that setting.

### 3. Banner

"Demo — data resets nightly" at the top of every page in demo mode (navy with ball-green accent, matching the
header; real text, 4.5:1 contrast, works at 390px).

### 4. Email off

- Demo Vercel project: no `RESEND_API_KEY`, no `EMAIL_MODE` → log-only already.
- Belt and braces: `src/lib/email/config.ts` → delivery is `"log"` whenever `isDemo()`, even if a key is added.
- Contact: logs only (follows from the above). Join never sent email; it inserts a registration, which is fine in
  the demo (the dashboard Invite flow then works) and is cleared by the reset.

### 5. Photo uploads off

- Photo upload, team-photo and public/private actions refuse in demo mode; the uploader is hidden with a short
  note ("Uploads are turned off in the demo"). Seed sample photos (`npm run seed-photos`) still display.

### 6. Nightly reset

- **Database function `public.demo_reset()`**, installed **only on Stags-Dev** from `supabase/demo/reset.sql`.
  This file is **not** a migration, so `db push` can never put it on prod.
  - Refuses unless a marker row exists (e.g. table `public.demo_marker`, created only by `reset.sql`).
  - In one transaction: truncate every table in schema `public` (looked up dynamically, so new tables are
    covered) except `demo_marker`, then re-insert the seed.
  - `revoke execute ... from public, anon, authenticated`; `grant execute ... to service_role` only.
- **One source of seed data:** a script (`scripts/build-demo-reset.mjs`) generates `supabase/demo/reset.sql`
  from `supabase/seed.sql`. Rerun it whenever `seed.sql` changes, then apply it to Stags-Dev
  (`npx supabase db query --linked -f supabase/demo/reset.sql`, refusing unless linked to Stags-Dev).
- **Route `/api/cron/demo-reset`** (GET, daily ~07:00 UTC in `vercel.json`):
  - `cronAuthorized()` (`src/lib/cron.ts`) **and** `isDemo()`, otherwise 404 (so prod returns 404).
  - Calls `rpc("demo_reset")` with the admin client.
  - Deletes Storage objects in the `photos` bucket that aren't in the seed (visitor uploads, if any) via the
    Storage API.
  - `updateTag(PUBLIC_TAG)` (and revalidate captain pages) so cached public pages refresh.
- Auth users are untouched: the demo accounts persist and relink to reseeded rows by email. RSVP and calendar
  tokens are recreated by triggers/seed.

### 7. noindex

- Root layout metadata: `robots: { index: false, follow: false }` in demo mode.
- `next.config.ts` `headers()`: `X-Robots-Tag: noindex, nofollow` when `DEMO_MODE=on`.
- New `src/app/robots.ts`: disallow all in demo mode; allow all otherwise (prod gains a normal robots.txt).

### 8. Seed changes

- `supabase/seed.sql:22`: the captain row becomes a fake captain (fake name, `@example.com` or `.invalid` email,
  fake phone). Keep the row's fixed id `11111111-0000-0000-0000-000000000001`: `supabase/tests/rls.sql`
  refers to seed rows by id.
- Add the two demo accounts (or reuse the captain and one existing sample player as the demo accounts).
- `dev-login` keeps working with any seeded email (e.g. `npm run dev-login -- captain@demo.invalid`).
- Update CLAUDE.md where it mentions signing in as the seed captain.

## Setup steps (in the build session)

1. Code changes above; lint, typecheck.
2. Stags-Dev: reseed (dashboard reset, then `db push --include-seed`, per CLAUDE.md) so the fake captain
   replaces the real details; apply `supabase/demo/reset.sql`; turn off sign-ups; check password sign-in.
3. Run the demo-account script once.
4. Vercel → Add New → Project → same repo, project name `stags-demo` (→ `stags-demo.vercel.app`).
   Env (Production scope of that project): Stags-Dev URL + publishable key + secret key, `DEMO_MODE=on`,
   `DEMO_PASSWORD`, `CRON_SECRET` (its own value), `NEXT_PUBLIC_SITE_URL=https://stags-demo.vercel.app`,
   Turnstile test keys (`1x00000000000000000000AA` / `1x0000000000000000000000000000000AA`).
   No `RESEND_API_KEY`, no `EMAIL_MODE`.
5. Deploy; confirm Settings → Cron Jobs shows 3 jobs and the deploy wasn't rejected for the cron limit.
6. Deploy prod from the same commit and confirm the new code is inert there.

## Verification

- `npm run lint && npm run typecheck`; `npm run test:rls` still passes with the new seed; the anon check passes
  and is extended to confirm anon can't execute `demo_reset`.
- Run the reset against Stags-Dev twice: the data returns to seed both times.
- **Prod** (`stamfordstags.com`): no banner, no demo buttons, `/api/cron/demo-reset` → 404 with and without the
  secret, robots.txt allows indexing, no `X-Robots-Tag` header.
- **Demo**: banner on every page at 390px; both "Try as" buttons work; email form absent; a captain message and
  the Contact form are logged, not sent; uploads refused; `X-Robots-Tag: noindex` and robots.txt disallow; the
  cron route resets visitor changes.
- Lighthouse and accessibility unaffected on prod.
