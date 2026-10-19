# Launch checklist: stamfordstags.com

Production runs on Vercel (Hobby) with the Supabase project **stags-prod** (East US), email through Resend
from `Stamford Stags <captain@stamfordstags.com>`, and DNS at Namecheap. Email stays in **redirect** mode
(everything goes to the captain's Gmail) until the smoke test passes.

Secrets (database password, Supabase secret key, Resend keys, Turnstile secret, `CRON_SECRET`) go only into
the Vercel and Supabase dashboards or a password manager. Never into chat, commits or screenshots.

---

## 1. Supabase production project

- [ ] Create project **stags-prod**, region **East US (North Virginia)**, free tier. Save the database password
      in a password manager.
- [ ] Link the CLI to it (prompts for the password): `npx supabase link --project-ref <prod-ref>`
- [ ] `npx supabase db push --dry-run`, then `npx supabase db push`. **Never `--include-seed`**: `seed.sql`
      is sample data for Stags-Dev only.
- [ ] `npx supabase migration list --linked`: local and remote columns match.
- [ ] Create the real season and the captain row (validated, refuses on Stags-Dev, safe to re-run):
      ```bash
      npm run prod-setup -- --confirm-ref <prod-ref> --season-name "…" --ntrp 3.5 \
        --max-roster 16 --playoff-min 2 --captain-name "…" [--league … --division … --age-group … \
        --starts YYYY-MM-DD --ends YYYY-MM-DD --captain-ntrp …]
      ```
      Add `--dry-run` first to read the SQL.
- [ ] Relink to Stags-Dev so tests and dev tools point at dev again:
      `npx supabase link --project-ref jljyylzalwiczrimaguz`. `npm run test:rls`, the anon check and
      `prod-setup` all check the linked project and refuse the wrong one.
- [ ] After go-live, import the real roster at **Captain → Roster → Import CSV**.

## 2. Supabase Auth (stags-prod dashboard)

- [ ] **Authentication → URL Configuration**
  - Site URL: `https://stamfordstags.com`
  - Redirect URLs: `https://stamfordstags.com/**` and `https://www.stamfordstags.com/**`
- [ ] **Authentication → Emails → Templates**
  - "Magic link": subject `Your Stamford Stags sign-in link`, body from `supabase/templates/magic-link.html`
  - "Confirm signup": subject `Confirm your Stamford Stags sign-in`, body from
    `supabase/templates/confirm-signup.html` (a player's first sign-in gets this one)
- [ ] **Authentication → Emails → SMTP Settings** (after Resend shows Verified, step 3): host `smtp.resend.com`,
      port `465`, username `resend`, password = the `stags-supabase-smtp` Resend key, sender
      `captain@stamfordstags.com`, name `Stamford Stags`.
- [ ] **Authentication → Rate Limits**: raise "emails sent" (for example 100 per hour).
- [ ] Leave sign-ups on. Magic links create the account on first use; being a member still requires an active
      roster row.

## 3. Resend domain (Namecheap → Advanced DNS)

Add domain `stamfordstags.com` in Resend (region us-east-1), then add:

| Type | Host | Value | Priority |
|---|---|---|---|
| MX  | `send` | `feedback-smtp.us-east-1.amazonses.com` | 10 |
| TXT | `send` | `v=spf1 include:amazonses.com ~all` | |
| TXT | `resend._domainkey` | the DKIM key, copied exactly from Resend | |
| TXT | `_dmarc` | `v=DMARC1; p=none; rua=mailto:captain@stamfordstags.com` | |

- [ ] `npm run check-dns -- --only=resend` all ok, then **Verify** in Resend → Verified.
- [ ] Create two Resend keys, both **Sending access, stamfordstags.com only**: `stags-prod` (Vercel) and
      `stags-supabase-smtp` (Supabase SMTP).

## 4. Email forwarding (captain@ → Gmail)

Namecheap's own forwarding doesn't work alongside Resend: the `send` MX needs **Custom MX**, and switching to
Custom MX drops Namecheap's aliases ("Relay access denied"). So forwarding goes through ImprovMX
(`docs/EMAIL_SETUP.md`, Part 3b).

- [ ] ImprovMX (free): add `stamfordstags.com`, alias `captain` → the captain's Gmail.
- [ ] Namecheap, Mail Settings on **Custom MX**: apex MX `mx1.improvmx.com` (10) and `mx2.improvmx.com` (20)
      only, plus the Resend `send` MX. Apex SPF TXT `@` = `v=spf1 include:spf.improvmx.com ~all` (only one).
- [ ] `npm run check-dns -- --only=forwarding` all ok, and ImprovMX shows the domain active.
- [ ] Send a test email from an account that isn't the captain's Gmail to `captain@stamfordstags.com`; it
      reaches Gmail.

## 5. Turnstile and Vercel

- [ ] Cloudflare → Turnstile → Add widget "Stamford Stags", hostnames `stamfordstags.com` and
      `www.stamfordstags.com`, mode Managed.
- [ ] Vercel → Add New → Project → import `nermin-sahmanovic/stamford-stags` (framework Next.js, defaults).
- [ ] Environment variables:

  | Variable | Production | Preview |
  |---|---|---|
  | `NEXT_PUBLIC_SITE_URL` | `https://stamfordstags.com` | (unset) |
  | `NEXT_PUBLIC_SUPABASE_URL` | stags-prod URL | Stags-Dev URL |
  | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | stags-prod publishable key | Stags-Dev publishable key |
  | `SUPABASE_SERVICE_ROLE_KEY` | stags-prod secret key | Stags-Dev secret key |
  | `RESEND_API_KEY` | `stags-prod` key | dev key |
  | `EMAIL_FROM` | `Stamford Stags <captain@stamfordstags.com>` | (unset) |
  | `TEAM_INBOX` | `captain@stamfordstags.com` | captain's Gmail |
  | `EMAIL_MODE` | `redirect` (→ `live` at go-live) | (unset) |
  | `EMAIL_DEV_REDIRECT` | captain's Gmail | captain's Gmail |
  | `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | real site key | `1x00000000000000000000AA` (test key) |
  | `TURNSTILE_SECRET_KEY` | real secret | `1x0000000000000000000000000000000AA` (test key) |
  | `CRON_SECRET` | `openssl rand -hex 32` (in your own terminal) | (unset) |

  Previews run with `NODE_ENV=production`, so they need the Turnstile test keys or their forms refuse.
- [ ] Deploy. Then **Settings → Domains**: add `stamfordstags.com` and `www.stamfordstags.com`, with
      `www` redirecting (308) to the apex.
- [ ] In Namecheap, delete the parking records (`www` CNAME `parkingpage.namecheap.com` and the `@` URL
      redirect record) and add the records Vercel shows: `A @` (e.g. `76.76.21.21` or `216.198.79.1`) and
      `CNAME www` (e.g. `cname.vercel-dns.com`). Use Vercel's exact values.
- [ ] `npm run check-dns -- --only=site` all ok, Vercel shows both domains Valid with a certificate.

## 6. Crons

- [ ] Vercel → Settings → Cron Jobs lists `/api/cron/reminders` (13:00 UTC) and `/api/cron/keep-alive`
      (09:00 UTC). Hobby: once a day per job, run within the hour.
- [ ] `curl -i https://stamfordstags.com/api/cron/keep-alive` → 401.
- [ ] In your own terminal: `curl -i -H "Authorization: Bearer <CRON_SECRET>" https://stamfordstags.com/api/cron/keep-alive`
      → 200 `{"ok":true}`. Same for `/api/cron/reminders` → `{"ok":true,"reminded":[…]}`.
- While `EMAIL_MODE=redirect`, the reminders cron sends you a redirected copy per upcoming match each day.
  Only a live reminder counts as the match's automatic reminder, so players still get theirs after go-live.

## 7. Dev-only surfaces are absent in production

- [ ] `dev-login`, `seed-photos`, `prod-setup`, `check-dns`, the Lighthouse scripts and the test scripts are in
      `.vercelignore`, so they never reach Vercel. `dev-login` and `seed-photos` also refuse unless
      `NODE_ENV=development`, refuse under `VERCEL`/`CI`, and only accept Stags-Dev.
- [ ] There are no test or debug pages in `src/app`. `https://stamfordstags.com/does-not-exist` shows the
      styled 404.
- [ ] Both cron routes return 401 without the secret (step 6).
- [ ] Join and Contact show the real Turnstile widget (not the "testing only" one).
- [ ] Captain → Messages → New message shows the "Dev mode: every email goes to …" banner (redirect mode).

---

## 8. Smoke test (phone, 390px)

Signed out:
- [ ] Home, About, Schedule (agenda and month), Results, Gallery and Contact load fast and look right. Home shows
      the season and no sample data.
- [ ] Join: submit a test registration (Turnstile passes); it appears on the captain dashboard.
- [ ] Contact: send a message; it arrives at `captain@` and is forwarded to Gmail (redirected while in redirect
      mode, labeled with the intended recipient).
- [ ] `https://www.stamfordstags.com` redirects to `https://stamfordstags.com`. Valid HTTPS on both.
- [ ] `/api/calendar/public.ics` downloads and opens in a calendar app.

Captain:
- [ ] Sign in at `/sign-in` with the captain email. The email comes **from `captain@stamfordstags.com`** with the
      Stags branding, and the link lands on the site signed in (on the phone, even if requested on a computer).
- [ ] The Captain tab shows. The dashboard loads with the real season.
- [ ] Roster → Import CSV: preview, then import the real roster. Counts look right.
- [ ] Invite the test registration from Join: the welcome email arrives (redirected), its button opens
      `/sign-in` prefilled.
- [ ] Add a match. Availability: set yours. Lineup: build and publish.
- [ ] Send a message to yourself only: it arrives (redirected) with working one-tap RSVP buttons; tapping one
      updates the tracker without signing in.
- [ ] Photos: upload one, make it public, set it as the team photo; it shows on Home.
- [ ] Your personal calendar feed (profile) subscribes.
- [ ] Sign out.

Email deliverability:
- [ ] Send a message to a [mail-tester.com](https://www.mail-tester.com) address (temporarily set
      `EMAIL_DEV_REDIRECT` to it, or do this right after go-live). Score ≥ 9/10, with SPF, DKIM and DMARC passing.
- [ ] In Gmail, "Show original" on a team email: `SPF: PASS`, `DKIM: PASS`, `DMARC: PASS`.

Clean up the test registration and test match before inviting the team.

## 9. Go live

- [ ] Vercel → Settings → Environment Variables → **Production only**: `EMAIL_MODE=live`. Redeploy
      (Deployments → latest → Redeploy) so the server picks it up.
- [ ] The compose page no longer shows the Dev mode banner.
- [ ] Send one message to **Selected players → just yourself**: it arrives with no `[DEV → …]` prefix.
- [ ] Update `CLAUDE.md` Status: Phase 10 done.
- [ ] After a few clean weeks: tighten DMARC to `v=DMARC1; p=quarantine; rua=mailto:captain@stamfordstags.com`.

---

## Rollback plan

| Problem | Do this | Time |
|---|---|---|
| A deploy breaks the site | Vercel → Deployments → the last good one → **Instant Rollback** (or **Promote**). Fix forward on `main` afterwards. | 1 min |
| Emails going to the wrong people, or too many | Set `EMAIL_MODE=redirect` on Production and redeploy. Every email then goes to `EMAIL_DEV_REDIRECT`. To stop all sending, also remove `RESEND_API_KEY` (log-only mode). | 2 min |
| Reminder cron misbehaving | Remove the entry from `vercel.json` and deploy, or unset `CRON_SECRET` (both cron routes then return 401). | 2 min |
| A bad migration | Never edit an applied migration. Write a new migration that undoes it, `db push --dry-run`, then `db push` while linked to stags-prod. | varies |
| Bad data (wrong import, deleted rows) | The free tier has daily backups but no point-in-time recovery. Before any risky change, take a dump: `npx supabase db dump --linked --data-only -f backup-YYYYMMDD.sql` (keep it out of git). | varies |
| Sign-in emails failing | Supabase → SMTP Settings: check the Resend key and sender; turn custom SMTP off temporarily to fall back to the built-in mailer (rate-limited). | 2 min |
| Domain or DNS problem | Players can still use the `*.vercel.app` URL, but sign-in links follow the Supabase Site URL. Restore the records from this checklist. The original Namecheap records were `www` CNAME `parkingpage.namecheap.com` and an `@` URL redirect (parking). Mail: apex MX `mx1`/`mx2.improvmx.com` (10/20) and SPF `include:spf.improvmx.com`; Resend on `send`, `resend._domainkey`, `_dmarc`. | DNS TTL |
| Supabase project paused | Dashboard → Restore. The keep-alive cron should prevent this; check Vercel's cron logs. | minutes |
