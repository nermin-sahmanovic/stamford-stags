/** Shown while a layout guard checks the session. Matches PageStub spacing. */
export function GuardFallback() {
  return (
    <section aria-busy="true" className="mx-auto max-w-5xl px-4 pt-4 pb-6">
      <span className="sr-only">Loading…</span>
      <div className="h-8 w-48 animate-pulse rounded-md bg-line motion-reduce:animate-none" />
      <div className="mt-2 h-4 w-64 animate-pulse rounded bg-line motion-reduce:animate-none" />
    </section>
  );
}
