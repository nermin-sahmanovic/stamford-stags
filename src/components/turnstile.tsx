"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";

type TurnstileApi = {
  render: (el: HTMLElement, options: Record<string, unknown>) => string;
  reset: (widgetId: string) => void;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

/**
 * Cloudflare Turnstile, rendered explicitly so it survives client navigation.
 * The widget adds a hidden "cf-turnstile-response" input to the enclosing form.
 * Change `resetKey` after a failed submit: tokens are single-use.
 */
export function Turnstile({ siteKey, resetKey }: { siteKey: string; resetKey?: unknown }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const api = window.turnstile;
    if (!ready || !api || !containerRef.current || !siteKey) return;
    widgetId.current = api.render(containerRef.current, {
      sitekey: siteKey,
      theme: "light",
      size: "flexible",
    });
    return () => {
      if (widgetId.current) api.remove(widgetId.current);
      widgetId.current = null;
    };
  }, [ready, siteKey]);

  useEffect(() => {
    if (resetKey !== undefined && widgetId.current) window.turnstile?.reset(widgetId.current);
  }, [resetKey]);

  if (!siteKey) {
    return (
      <p className="text-[13px] font-semibold text-warn">
        Spam protection isn&apos;t configured, so this form can&apos;t be sent right now.
      </p>
    );
  }

  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onReady={() => setReady(true)}
      />
      <div ref={containerRef} className="min-h-[65px]" />
    </>
  );
}
