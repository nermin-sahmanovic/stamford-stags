import Link from "next/link";

export default function NotFound() {
  return (
    <section className="mx-auto max-w-5xl px-4 pt-4 pb-6">
      <h1 className="font-display text-[28px] leading-tight font-bold tracking-[0.02em] uppercase">
        Page not found
      </h1>
      <p className="mt-0.5 text-[15px] text-slate-600">
        That page doesn&apos;t exist.{" "}
        <Link href="/" className="font-semibold text-court hover:text-blue-700">
          Back to home
        </Link>
      </p>
    </section>
  );
}
