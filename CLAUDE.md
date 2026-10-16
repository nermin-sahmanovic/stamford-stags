# Stamford Stags — project guide for Claude

@AGENTS.md

Mobile-first website for the Stamford Stags, a USTA adult league tennis team.
The site has two jobs: cut the captain's admin work, and give players a fast
phone-first view of the next match. Most visitors are on a phone, so 390px wide
is the primary design target.

## Stack

- Next.js (App Router, TypeScript, `src/` dir). Use whatever version
  `create-next-app` installs and follow **that version's** docs. Conventions
  change between majors (for example, Next 16 renamed `middleware.ts` to `proxy.ts`).
- Tailwind CSS v4 (CSS-first config). Design tokens live in `src/app/globals.css` under `@theme`.
- Supabase: Postgres, Auth (email magic link), Storage. Use `@supabase/ssr` for clients.
- Email: Microsoft Graph `sendMail` from a team mailbox (see Decisions). Keep all of it in `src/lib/email/`.
- Hosting: Vercel, with Supabase cloud.
- Validation: zod on every server action and route handler input.

## Commands

```bash
npm run dev                      # local app
npx supabase start               # local Supabase (Docker)
npx supabase db reset            # re-apply migrations + seed.sql
npx supabase gen types typescript --local > src/lib/database.types.ts
npm run lint && npm run typecheck
```

## Folder layout

```
src/app/(public)/      Home, About, Join, Schedule, Results, Contact. No login needed.
src/app/(member)/      Match Center, Availability, Players, Messages. Requires an active player.
src/app/(captain)/     Dashboard, roster admin, match/lineup admin, comms. Requires captain/co-captain.
src/app/api/           Route handlers (email send, RSVP token, cron, ICS feed)
src/components/        UI primitives and screen sections
src/lib/supabase/      server.ts, client.ts, admin.ts (service role, server only)
src/lib/auth.ts        requireMember(), requireCaptain(), getCurrentPlayer()
src/lib/email/         send.ts (Graph), templates
supabase/migrations/   SQL migrations (never edit an applied migration; add a new one)
design-reference/      Prototype screens (*.dc.html). Read them for layout, spacing and copy.
```

## Design system

Match `design-reference/`. Those files are the approved look.

| Token | Value | Use |
|---|---|---|
| navy | `#0F172A` | Header, tab bar, hero, primary dark surfaces |
| ball | `#C7EA46` | Accent **on navy only** (and filled buttons with navy text). Never green text on white: it fails contrast. |
| court | `#2563EB` | Links, secondary buttons, data bars on light backgrounds |
| white | `#FFFFFF` | Cards |
| ground | `#F4F6F9` | Page background |
| line | `#E2E8F0` | Card borders |
| warn | `#C2410C` / bg `#FFEDD5` | Shortages, pending states |

- **Fonts.** Barlow Condensed 700 for display (uppercase headings, big numbers) and Barlow 400–700 for body. Load both with `next/font/google`.
- **Shape.** Cards have a 14–16px radius and a 1px `line` border, with no shadows. Buttons are 44–54px tall with a 10–12px radius.
- **Court lines.** Subtle SVG court lines (ball green at ~15% opacity) go on navy hero blocks only.
- **Phone navigation.** Sticky navy header with a 2px ball-green bottom border, plus a bottom tab bar with Home · Matches · Availability · Captain. The Captain tab shows only for captains. Everything else goes behind the header menu.
- **Desktop (md and up).** Use a top nav instead of the tab bar, with content in a `max-w-5xl` container. Cards may go 2–3 columns.
- **Icons.** Inline stroke SVG (lucide-react is fine). No emoji.
- **Touch and accessibility.** Touch targets are at least 44px. Use real `<button>`/`<a>`/`<label>` elements, keep text contrast at 4.5:1 or better, and use 16px inputs so iOS doesn't zoom.

## Data model (see `supabase/migrations/`)

- `seasons` holds league rules: NTRP level, line counts, roster max and the playoff match minimum. Exactly one row has `is_current`.
- `players` is the roster. `user_id` links to `auth.users` automatically by matching email (a trigger handles this). `role` is one of captain / co_captain / player.
- `matches` → `lineup_slots` (line type, line number, seat, court, RSVP) → `line_results` (won/score per line).
- `availability` has one row per (match, player): available / maybe / unavailable.
- `events` covers practices, socials, USTA deadlines and registration windows. Matches are not duplicated here.
- `registrations` stores public Join-form submissions. Anonymous users can insert, and only captains can read.
- `messages` + `message_recipients` hold the email history. They are written server-side only.
- `news_posts` holds announcements and results. `is_public` controls whether the home page shows them.
- `rsvp_tokens` backs the one-tap RSVP links in emails. It is service role only, with no RLS policies.
- Helpers:
  - `is_member()`, `is_captain()` and `current_player_id()`.
  - RPCs: `set_my_availability`, `set_my_rsvp`, `update_my_profile`, `eligible_players(match_id)`, `public_team_summary()` and `public_schedule()`.
  - Views: `player_records`, `match_availability_summary`.

## Non-negotiables

1. **Authorization lives in Postgres RLS.** Hiding a button is UX, not security. Every new table gets RLS enabled and explicit policies in the same migration.
2. **The service role key is server-only.** It is used only in `src/lib/supabase/admin.ts`, and only after `requireCaptain()` passes or a valid `rsvp_token` is verified. Never import admin.ts from a client component.
3. **Being a member means being on the roster, not having an account.** A signed-in user with no matching active `players` row sees the "Ask your captain to add you" page.
4. **No mock data in pages.** Pages read from Supabase from Phase 1 onward. Sample data belongs in `supabase/seed.sql`.
5. **Mobile first.** Build and check every screen at 390px before widening it.
6. **Mutations go through server actions or route handlers.** Validate input with zod and return typed results. No client-side writes to tables except through the `set_my_*` RPCs.
7. **Times.** Store `timestamptz` and display in `America/New_York`.
8. **No fake USTA integration.** There is no public USTA API. Scores and standings are entered manually.

## Decisions (defaults chosen; change here if the captain decides otherwise)

| Topic | Default | Notes |
|---|---|---|
| Who sees contact info | Logged-in members only | Public pages never read `players` |
| Player sign-in | Magic link, plus one-tap RSVP links in emails that work without signing in | Most players will never "log in" |
| Team email | Microsoft Graph `sendMail` from a team mailbox | App registration with the Mail.Send application permission, scoped to that one mailbox with Exchange RBAC for Applications. Fallback if there's no M365 mailbox: Resend. |
| Auth emails (magic links) | Custom SMTP in Supabase | Supabase's built-in mailer is heavily rate-limited, so it isn't fit for production |
| Eligibility | Rating ≤ season NTRP level (and ≥ `min_ntrp` if set). Playoff eligibility = completed matches ≥ `playoff_min_matches` | **TODO captain:** confirm the league's actual rules (age group, any limits on at-level players per lineup) |
| Lineup format | 2 singles + 3 doubles | Configurable per season |
| Weather | Open-Meteo (no key) | Phase 5 |
| Spam on Join form | Honeypot field + Cloudflare Turnstile | Phase 3 |

## How we work

- One phase per session, from `docs/PHASES.md`. Start in plan mode and get the plan approved before writing code.
- Each phase ends with lint and typecheck passing, a manual check at 390px, a commit, and an update to **Status** below.
- Schema changes are always new migration files. After any schema change, regenerate types.
- When something is ambiguous, ask. Don't invent league rules or business logic.

## Status

- [x] Prototype approved (design-reference/)
- [x] Phase 0 — Scaffold and app shell
- [ ] Phase 1 — Database, RLS, seed, RLS tests
- [ ] Phase 2 — Auth and roles
- [ ] Phase 3 — Public pages and Join
- [ ] Phase 4 — Roster and directory
- [ ] Phase 5 — Matches and availability
- [ ] Phase 6 — Lineup builder
- [ ] Phase 7 — Communications
- [ ] Phase 8 — Schedule, photos and results
- [ ] Phase 9 — Captain dashboard and polish
- [ ] Phase 10 — Deploy
