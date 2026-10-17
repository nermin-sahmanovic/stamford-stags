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

## Part 2: Get a domain, about 10 minutes plus DNS time

You need a domain you control to send real team email (e.g. `stamfordstags.com`).

1. Buy one at a registrar. **Cloudflare Registrar** (at cost, free DNS) is the simplest; Porkbun and Namecheap
   are fine too. About $10–15 a year for a `.com`.
2. Keep its DNS at the registrar (or move it to Cloudflare). You only need to add a few records.

Tip: send from a **subdomain** such as `mail.stamfordstags.com`. It keeps team email reputation separate from
anything else on the main domain, and the DNS records don't collide with a website or other mail later.

---

## Part 3: Verify the domain in Resend, about 10 minutes plus up to a few hours for DNS

1. Resend → **Domains** → **Add domain** → enter `mail.stamfordstags.com` (or your domain). Region: **North
   Virginia (us-east-1)**, the closest to Stamford.
2. Resend shows the records to create. **Copy the values from Resend exactly.** They look like this:

   | Type | Name (host) | Value | Priority | Why |
   |---|---|---|---|---|
   | MX  | `send.mail` | `feedback-smtp.us-east-1.amazonses.com` | 10 | Bounce handling (return path) |
   | TXT | `send.mail` | `v=spf1 include:amazonses.com ~all` | | SPF: Resend may send for you |
   | TXT | `resend._domainkey.mail` | `p=MIGfMA0GCSq…` (long key) | | DKIM signature |
   | TXT | `_dmarc` | `v=DMARC1; p=none; rua=mailto:you@example.com` | | DMARC (recommended; add it yourself) |

   - **Name column:** most DNS panels want the host *without* the root domain (`send.mail`, not
     `send.mail.stamfordstags.com`). Some (GoDaddy) add the root automatically, so don't type it twice.
   - **Cloudflare:** set each record to **DNS only** (grey cloud), not proxied.
   - If Resend offers **Auto configure** for your DNS provider, you can use that instead of typing the records.
3. Back in Resend, click **Verify DNS records**. Most providers take minutes; allow up to 48 hours.
   The domain turns **Verified** when all records pass.
4. DMARC: start with `p=none` (monitor only). After a few weeks of clean sending you can tighten it to
   `p=quarantine`.

---

## Part 4: Production keys and settings

1. Resend → **API Keys** → **Create API key**: name `stags-prod`, **Sending access**, restricted to your
   verified domain. Don't reuse the dev key.
2. Vercel → your project → **Settings → Environment Variables** (Production):
   ```
   RESEND_API_KEY=re_...                                  (the prod key)
   EMAIL_FROM=Stamford Stags <team@mail.stamfordstags.com>
   TEAM_INBOX=captain@...                                 (a real inbox someone reads)
   NEXT_PUBLIC_SITE_URL=https://<your production URL>
   CRON_SECRET=<long random string>                       (e.g. `openssl rand -hex 32`)
   EMAIL_MODE=live                                         ← only here, only at go-live
   ```
   For Preview deployments, leave `EMAIL_MODE` unset and set `EMAIL_DEV_REDIRECT`, so previews never
   email the team.
3. Replies: Resend only sends. Each email's **Reply-To** is the captain who sent it (automatic reminders reply
   to `TEAM_INBOX`), so player replies land in a real inbox.

---

## Part 5: Daily reminders (cron)

`vercel.json` schedules `GET /api/cron/reminders` daily at 13:00 UTC (9am Eastern in summer, 8am in winter).
For each scheduled match starting in the next 5 days, it emails players who haven't answered availability,
**once per match**. The captain's "Send reminder" button can always send another.

- Vercel sends `Authorization: Bearer $CRON_SECRET` automatically once `CRON_SECRET` is set. Without it the
  route always returns 401.
- Test it by hand:
  ```bash
  curl -i http://localhost:3000/api/cron/reminders                                    # 401
  curl -i -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/reminders
  ```

---

## Part 6 (optional, Phase 10): Supabase sign-in emails through Resend

Supabase's built-in mailer is heavily rate-limited. Point it at Resend's SMTP instead:

Supabase dashboard → **Authentication → Emails → SMTP Settings** → enable custom SMTP:

| Field | Value |
|---|---|
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | a Resend API key (Sending access, your domain) |
| Sender email | `signin@mail.stamfordstags.com` |
| Sender name | `Stamford Stags` |

Then raise the auth email rate limit under **Authentication → Rate Limits**.

---

## Go-live checklist

- [ ] Domain shows **Verified** in Resend (SPF, DKIM, MX; DMARC added)
- [ ] Production `RESEND_API_KEY`, `EMAIL_FROM`, `TEAM_INBOX`, `NEXT_PUBLIC_SITE_URL`, `CRON_SECRET` set in Vercel
- [ ] `EMAIL_MODE=live` set on **Production only**
- [ ] A test message to **Selected players → just yourself** arrives from the team address, with no `[DEV →]` prefix
- [ ] Supabase custom SMTP configured (Part 6)
