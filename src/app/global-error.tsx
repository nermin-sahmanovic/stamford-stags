"use client";

// Last resort when the root layout itself fails: it replaces the whole document, so it carries
// its own <html>, <body> and inline styles (no globals.css, no fonts).
export default function GlobalError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: "100dvh", background: "#0F172A", color: "#FFFFFF", fontFamily: "system-ui, sans-serif" }}>
        <title>Something went wrong · Stamford Stags</title>
        <main style={{ maxWidth: 480, padding: "48px 20px" }}>
          <p style={{ margin: 0, color: "#C7EA46", fontSize: 13, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>
            Stamford Stags
          </p>
          <h1 style={{ margin: "8px 0 12px", fontSize: 32, lineHeight: 1.1, textTransform: "uppercase" }}>Something went wrong</h1>
          <p style={{ margin: "0 0 24px", color: "#CBD5E1", fontSize: 16, lineHeight: 1.5 }}>
            The site couldn&apos;t load. Try again in a moment. If it keeps happening, let your captain know.
          </p>
          <button
            type="button"
            onClick={() => retry()}
            style={{ height: 48, padding: "0 20px", border: 0, borderRadius: 12, background: "#C7EA46", color: "#0F172A", fontSize: 16, fontWeight: 700, cursor: "pointer" }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
