# Design reference

These are the approved prototype screens, exported from the design canvas:
Home (`Main`), Join, Match Center, Availability and Captain.

How to use them:

- **Read** the markup for layout, spacing, colors, copy and component structure. Inline styles are the source of truth for sizes and colors.
- **Don't copy** the runtime. The `<x-dc>`, `<sc-for>`, `<sc-if>` and `support.js` pieces belong to the prototyping tool. Rebuild each screen as React components with Tailwind classes.
- Each screen is a 390×844 phone frame. That is the primary target. Desktop layouts are a widening of these, not a separate design.
- Names, numbers and opponents are sample data. `supabase/seed.sql` contains the same sample data.
