// Subtle court lines for navy hero blocks only (design-reference/Main and Join).

export function CourtLinesFull() {
  return (
    <svg
      aria-hidden="true"
      width="390"
      height="520"
      viewBox="0 0 390 520"
      fill="none"
      stroke="#C7EA46"
      strokeWidth="1.5"
      className="pointer-events-none absolute top-0 left-0 opacity-[0.16] md:left-1/2 md:-translate-x-1/2 md:scale-150"
    >
      <rect x="28" y="-60" width="334" height="640" />
      <path d="M70 -60v640M320 -60v640M70 150h250M195 150v-210" />
    </svg>
  );
}

export function CourtLinesBand() {
  return (
    <svg
      aria-hidden="true"
      width="390"
      height="200"
      viewBox="0 0 390 200"
      fill="none"
      stroke="#C7EA46"
      strokeWidth="1.5"
      className="pointer-events-none absolute top-0 left-0 opacity-[0.14] md:left-1/2 md:-translate-x-1/2 md:scale-150"
    >
      <path d="M-10 150h410M60 150V-10M330 150V-10M60 70h270" />
    </svg>
  );
}
