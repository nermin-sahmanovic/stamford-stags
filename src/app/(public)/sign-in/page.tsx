import type { Metadata } from "next";
import { Suspense } from "react";
import { safeNextPath } from "@/lib/routes";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = { title: "Sign in" };

export default function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  return (
    <section className="mx-auto max-w-md px-4 pt-4 pb-6">
      <h1 className="font-display text-[28px] leading-tight font-bold tracking-[0.02em] uppercase">
        Sign in
      </h1>
      <p className="mt-0.5 mb-4 text-[15px] text-slate-600">
        We&apos;ll email you a link. Tap it and you&apos;re in.
      </p>
      <Suspense fallback={<SignInForm />}>
        <SignInBody searchParams={searchParams} />
      </Suspense>
    </section>
  );
}

async function SignInBody({ searchParams }: Pick<PageProps<"/sign-in">, "searchParams">) {
  const params = await searchParams;
  const next = safeNextPath(params.next) ?? undefined;
  const linkFailed = params.error === "link";

  return (
    <>
      {linkFailed ? (
        <p
          role="alert"
          className="mb-4 rounded-[14px] border border-warn/30 bg-warn-bg px-4 py-3 text-[15px] font-semibold text-warn"
        >
          That sign-in link has expired or was already used. Send yourself a new one.
        </p>
      ) : null}
      <SignInForm next={next} />
    </>
  );
}
