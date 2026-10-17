# Build phases: copy-paste prompts for Claude Code

How to use this:

- Open Claude Code in the repo, switch to **plan mode** (Shift+Tab), and paste one phase prompt.
- Review the plan and correct anything you disagree with, then let it build.
- Commit when the "Done when" list is true, then start a fresh session for the next phase. A fresh session keeps context clean, and `CLAUDE.md` carries everything forward.

---

## Phase 0: Scaffold and app shell

```
Read CLAUDE.md. We're on Phase 0.

1. Scaffold Next.js in this folder (TypeScript, App Router, src/, Tailwind, ESLint).
   Keep the existing CLAUDE.md, docs/, supabase/ and design-reference/ folders.
2. Add the design tokens from CLAUDE.md to globals.css under @theme. Load Barlow and
   Barlow Condensed with next/font.
3. Build the app shell:
   - Sticky navy header with the 2px ball-green border.
   - Bottom tab bar under md (Home, Matches, Availability, Captain), top nav at md and up.
   - Slide-out menu for the other pages.
   - Match design-reference/Main.dc.html exactly at 390px.
4. Add empty route stubs for every page in the folder layout, plus a typecheck script.
No Supabase yet.
```

**Done when:** the shell at 390px is visually indistinguishable from the prototype header and tab bar, every route renders, and lint and typecheck pass.

---

## Phase 1: Database, RLS and seed

```
Read CLAUDE.md. We're on Phase 1.

1. Initialize Supabase locally (npx supabase init). Keep the existing
   supabase/migrations/*_init.sql and supabase/seed.sql.
2. Run `npx supabase db reset` and fix anything that fails. Explain each fix before making it.
3. Generate types into src/lib/database.types.ts.
4. docs/rls-smoke-test.sql is a plain-psql smoke test that already passed against
   this schema. Convert it to pgTAP in supabase/tests/rls.sql (run with
   `supabase test db`) so it proves:
   - anon cannot select players, availability or matches, and CAN call
     public_team_summary() and insert a pending registration (but not an approved one);
   - a player can read the roster and set only their own availability;
   - a player cannot update lineup_slots directly but can via set_my_rsvp;
   - a non-rostered authenticated user sees nothing;
   - a captain can do all of the above, plus manage matches.
Do not build any UI in this phase.
```

**Done when:** `supabase db reset` runs clean, `supabase test db` passes, and the types are generated.

---

## Phase 2: Auth and roles

```
Read CLAUDE.md. We're on Phase 2.

Implement:
- Supabase clients in src/lib/supabase/ (server, browser, admin; admin is server-only).
- Session refresh in the request middleware/proxy file for the installed Next version.
- A /sign-in page with email magic link, and an auth callback route.
- src/lib/auth.ts with getCurrentPlayer(), requireMember() and requireCaptain().
- Layout guards on the (member) and (captain) route groups.
- A "You're not on the roster yet — ask your captain" page for signed-in non-members.
- Tab bar shows the Captain tab only for captains.
Test with the seeded captain email (edit seed.sql to use my real email first).
```

**Done when:**
- Sign-in works.
- A captain sees the Captain tab and a seeded player does not.
- A random email lands on the not-on-roster page.

---

## Phase 3: Public pages and Join

```
Read CLAUDE.md. We're on Phase 3.

Build the public pages from design-reference (Main.dc.html, Join.dc.html):
- Home: hero, stats from public_team_summary(), next-match card, public news_posts,
  and the contact card.
- About: mission, league, locations, culture, expectations (content as editable
  constants for now).
- Join: the 6-step explainer and the registration form. The form uses a server
  action with zod, a honeypot field and Cloudflare Turnstile, inserts into
  registrations, and shows the success state.
- Schedule (public): public_schedule() as mobile cards.
- Contact: a form that emails the captain (stub the send function; Phase 7 wires it).
```

**Done when:** a Join submission appears in `registrations` as pending, the honeypot blocks bots, and Home shows live numbers from the seed.

---

## Phase 4: Roster and directory

```
Read CLAUDE.md. We're on Phase 4.

Members:
- Players directory with search, filters (rating, singles/doubles, availability
  for the next match), and player cards.
- Player profile with contact info, preferred position, win/loss from
  player_records, and match history.
- Let a player edit their own phone and position via update_my_profile.

Captain:
- Add and edit players, deactivate (no hard delete), and bulk edit rating or
  active status.
- CSV import (papaparse):
  - Upload, then map columns.
  - Preview with per-row validation errors.
  - Upsert by email.
  - Show a summary of created, updated and skipped rows.
- Export the roster to CSV.
```

**Done when:** importing a 20-row CSV with 2 bad rows creates 18 players and clearly reports the 2 failures, and the export round-trips through the import.

---

## Phase 5: Matches and availability (the core loop)

```
Read CLAUDE.md. We're on Phase 5.

From design-reference/MatchCenter.dc.html and Availability.dc.html:
- Match Center: upcoming/results tabs and the match detail page (opponent, time,
  location with a directions link, home/away, captain notes, Open-Meteo forecast
  for match day, the lineup if published, and the checklist).
- Availability: one-tap Available / Maybe / Out per upcoming match through
  set_my_availability, with optimistic UI.
- Team view from match_availability_summary, with "Short N" warnings and the
  list of non-responders.
- Captain: create and edit matches, enter results (line_results plus team points),
  and edit the checklist.
```

**Done when:** a player can answer all upcoming matches in under 10 seconds on a phone, and the captain sees the counts update.

---

## Phase 6: Lineup builder

```
Read CLAUDE.md. We're on Phase 6.

Captain lineup builder for a match:
- Lines come from the season config (1 singles + 3 doubles: S1, D1–D3).
- The player picker uses eligible_players(match_id). Available players sort first;
  flag ineligible and unavailable players with the reason; block double-booking.
- Assign courts per line.
- "Publish lineup" sets RSVP to pending and calls a stub notify function
  (Phase 7 sends the email).
- Players see their line and court, and can Confirm/Decline via set_my_rsvp.
```

**Done when:** building a full lineup takes under 2 minutes on a phone, and a player who declines shows up flagged on the captain's view.

---

## Phase 7: Communications

```
Read CLAUDE.md. We're on Phase 7.

1. Implement src/lib/email/send.ts with Resend (the captain chose Resend over
   Microsoft Graph). Batch recipients; never put the team in To:
   (use BCC or one email per player).
2. POST /api/messages (captain only, verified server-side): audience = team |
   match participants | custom. Write messages + message_recipients with the
   service role, and record failures.
3. Compose UI: pick an audience, then a match if needed. Show a recipient preview,
   then send.
4. One-tap RSVP links:
   - Create rsvp_tokens per player per match.
   - Add a route /r/[token]?s=available|maybe|unavailable that sets
     availability without login and shows a confirmation page.
5. Reminders:
   - "Remind non-responders" button.
   - Optional daily cron (Vercel cron + CRON_SECRET) for matches within 5 days.
6. Wire the lineup-published and contact-form notifications.
7. Communication history page.
```

**Done when:**
- An email to match participants reaches only the lineup.
- Tapping "Available" in the email updates the tracker without signing in.
- History shows recipients and dates.

---

## Phase 8: Schedule, photos and results

```
Read CLAUDE.md. We're on Phase 8.

- Calendar with month and agenda views, combining matches and events, plus mobile cards.
- Captain CRUD for events (practice, social, USTA deadline, registration).
- An ICS subscription feed at /api/calendar.ics so players can subscribe from their
  phone calendar.
- Photos: a Supabase Storage bucket (members read; captain uploads) and a gallery grid.
- Results: recent results, season stats, and a new migration for a manually
  maintained standings table.
```

**Done when:** subscribing to the ICS feed on an iPhone shows upcoming matches, and the captain can upload photos from a phone.

---

## Phase 9: Captain dashboard and polish

```
Read CLAUDE.md. We're on Phase 9.

- Captain dashboard from design-reference/Captain.dc.html:
  - KPI tiles, the "needs attention" card, pending registrations (Invite =
    create player + email invite), quick actions and recent messages.
- Polish:
  - Loading skeletons and empty states.
  - A full accessibility pass (keyboard, contrast, labels).
  - Lighthouse mobile score of 90+.
  - A web app manifest so players can add the site to their home screen.
```

**Done when:** the captain can run a whole match week from the dashboard alone, and Lighthouse mobile scores 90+ on Home and Match Center.

---

## Phase 10: Deploy

```
Read CLAUDE.md. We're on Phase 10.

Walk me through and script where possible:
- Supabase cloud project, `supabase db push`, and the auth redirect URLs.
- Custom SMTP for auth emails.
- Vercel project, env vars from .env.example, custom domain.
- The cron schedule.
- The Graph app registration, scoped to the team mailbox only.
- A production smoke-test checklist.
```
