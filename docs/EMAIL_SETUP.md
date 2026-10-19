# Email setup (Resend)

The app sends team email through [Resend](https://resend.com): one email per player, never a shared To: line.
Everything lives in `src/lib/email/`. This guide gets you from nothing to live team email.

**Safety default:** unless `EMAIL_MODE=live`, every email is redirected to `EMAIL_DEV_REDIRECT`. The subject
reads `[DEV → J. Chen] …` and the top of the body says who it was for. Without an API key or a redirect
address, emails are only logged to the server console. Development can never email the team by accident.

---

## Part 1: Development (no domain needed), about 5 minutes

Resend's shared sender `onboarding@resend.dev` works without a domain, but **only delivers to the email
address you signed up to Resend with**. That's exactly what redirect mode needs.

1. Sign up at <https://resend.com/signup> with **your own address** (the one you want test emails at).
2. Resend dashboard → **API Keys** → **Create API key**
   - Name: `stags-dev`
   - Permission: **Sending access**
   - Domain: *All domains* (you have none yet)
   - Copy the key (starts with `re_`). It's shown once.
3. In `.env.local` add:
   ```
   RESEND_API_KEY=re_...
   EMAIL_MODE=redirect
   EMAIL_DEV_REDIRECT=you@example.com     # the same address you signed up with
   TEAM_INBOX=you@example.com             # Contact-form messages (also redirected in dev)
   # EMAIL_FROM left empty → "Stamford Stags <onboarding@resend.dev>"
   ```
4. Restart `npm run dev`. Compose a message at **Captain → Messages → New message**. The compose page
   shows a blue "Dev mode" banner. You get one email per intended player in your inbox.

One-tap links in dev point at `NEXT_PUBLIC_SITE_URL` (default `http://localhost:3000`), so tap them on
the same computer. To tap them on your phone, set it to your computer's LAN address (the one
`npm run dev` prints, for example `http://192.168.4.75:3000`).

---

## Part 2: The domain

The team domain is **`stamfordstags.com`**, registered at Namecheap with DNS in Namecheap's
**Advanced DNS** tab. Email goes out **From `Stamford Stags <captain@stamfordstags.com>`**.
Resend handles bounces on its own **`send.`** subdomain (the return path), so its records never collide with
the website (apex A / `www` CNAME) or with Namecheap's email forwarding (apex MX).

---

## Part 3: Verify the domain in Resend, about 10 minutes plus up to a few hours for DNS

1. Resend → **Domains** → **Add domain** → enter `stamfordstags.com`. Region: **North Virginia (us-east-1)**,
   the closest to Stamford.
2. Add these in Namecheap → **Advanced DNS**. **Copy the DKIM value from Resend exactly.**

   | Type | Host (Namecheap) | Value | Priority | Why |
   |---|---|---|---|---|
   | MX  | `send` | `feedback-smtp.us-east-1.amazonses.com` | 10 | Bounce handling (return path) |
   | TXT | `send` | `v=spf1 include:amazonses.com ~all` | | SPF for the return path |
   | TXT | `resend._domainkey` | `p=MIGfMA0GCSq…` (long key, from Resend) | | DKIM signature |
   | TXT | `_dmarc` | `v=DMARC1; p=none; rua=mailto:captain@stamfordstags.com` | | DMARC (add it yourself) |

   - **Host column:** Namecheap wants the host *without* the root domain (`send`, not `send.stamfordstags.com`).
   - **MX records in Namecheap:** the `send` MX goes in the **Mail Settings** section. If Namecheap only
     allows it with **Custom MX** selected, see Part 3b first, or forwarding to Gmail stops.
3. Check from the project: `npm run check-dns -- --only=resend`. Then in Resend click **Verify DNS records**.
   The domain turns **Verified** when all records pass (usually minutes, up to 48 hours).
4. DMARC: start with `p=none` (monitor only). After a few weeks of clean sending, tighten it to
   `p=quarantine`. DKIM is signed for `stamfordstags.com` and the return path `send.stamfordstags.com` aligns
   (relaxed), so team email passes DMARC.

### Part 3b: Namecheap email forwarding (replies reach the captain's Gmail)

Resend only sends. `captain@stamfordstags.com` receives mail through Namecheap's free forwarding:

1. Namecheap → Domain List → `stamfordstags.com` → **Advanced DNS → Mail Settings: Email Forwarding**.
   That publishes the apex MX records `eforward1`–`eforward5.registrar-servers.com` and the apex SPF
   `v=spf1 include:spf.efwd.registrar-servers.com ~all`. Keep that SPF record; it's the apex's only SPF.
2. **Domain → Redirect Email**: add alias `captain` → the captain's Gmail.
3. The apex MX (forwarding) and `send` MX (Resend) are different hosts, so they don't clash. The only catch is
   Namecheap's UI: if it won't accept the `send` MX under *Email Forwarding*, switch Mail Settings to
   **Custom MX**, re-enter the five apex `eforward` MX records exactly as Namecheap had them
   (`10 eforward1`, `10 eforward2`, `10 eforward3`, `15 eforward4`, `20 eforward5` `.registrar-servers.com`),
   add the `send` MX, then send a test email from another account to `captain@stamfordstags.com`.
   If it doesn't reach Gmail, use a free forwarder such as ImprovMX on the apex MX instead; Resend's records
   stay as they are.
4. `npm run check-dns -- --only=forwarding` confirms the apex MX and SPF.

---

## Part 4: Production keys and settings

1. Resend → **API Keys** → **Create API key**: name `stags-prod`, **Sending access**, restricted to
   `stamfordstags.com`. Don't reuse the dev key. Create a second one, `stags-supabase-smtp`, for Part 6, so
   either can be revoked alone.
2. Vercel → your project → **Settings → Environment Variables** (Production):
   ```
   RESEND_API_KEY=re_...                                  (the stags-prod key)
   EMAIL_FROM=Stamford Stags <captain@stamfordstags.com>
   TEAM_INBOX=captain@stamfordstags.com                   (forwarded to the captain's Gmail)
   NEXT_PUBLIC_SITE_URL=https://stamfordstags.com
   CRON_SECRET=<long random string>                       (e.g. `openssl rand -hex 32`)
   EMAIL_MODE=redirect                                    ← until the smoke test passes; then live
   EMAIL_DEV_REDIRECT=<the captain's Gmail>
   ```
   For Preview deployments, leave `EMAIL_MODE` unset and set `EMAIL_DEV_REDIRECT`, so previews never
   email the team.
3. Replies: each email's **Reply-To** is the captain who sent it (automatic reminders reply to `TEAM_INBOX`),
   so player replies land in a real inbox.

---

## Part 5: Crons

`vercel.json` schedules two daily jobs (Vercel Hobby allows once-a-day jobs, run within the scheduled hour):

- `GET /api/cron/reminders` at 13:00 UTC (9am Eastern in summer, 8am in winter). For each scheduled match
  starting in the next 5 days, it emails players who haven't answered availability, **once per match**.
  Only a reminder that went out live counts: while `EMAIL_MODE` isn't `live`, the cron sends a redirected
  copy each day, and the real one goes out after go-live. The captain's "Send reminder" button can always
  send another.
- `GET /api/cron/keep-alive` at 09:00 UTC. One cheap public read, so the free Supabase project never pauses
  for inactivity in the off-season.

Vercel sends `Authorization: Bearer $CRON_SECRET` automatically once `CRON_SECRET` is set. Without it both
routes always return 401. Test by hand:
```bash
curl -i http://localhost:3000/api/cron/reminders                                    # 401
curl -i -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/reminders
```

---

## Part 6: Supabase sign-in emails through Resend

Supabase's built-in mailer is heavily rate-limited. Point it at Resend's SMTP instead:

Supabase dashboard → **Authentication → Emails → SMTP Settings** → enable custom SMTP:

| Field | Value |
|---|---|
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | the `stags-supabase-smtp` Resend key |
| Sender email | `captain@stamfordstags.com` |
| Sender name | `Stamford Stags` |

Then raise the email rate limit under **Authentication → Rate Limits** (for example 100 per hour), and paste
the branded templates from `supabase/templates/` (see `docs/LAUNCH-CHECKLIST.md`, step 2).

---

## Go-live checklist

The full list (smoke test, switch to live, rollback) is in `docs/LAUNCH-CHECKLIST.md`.
