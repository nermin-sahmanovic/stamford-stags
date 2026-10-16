import type { Metadata } from "next";
import { PageHero } from "@/components/page-hero";
import { getTurnstileSiteKey } from "@/lib/spam";
import { ContactForm } from "./contact-form";

export const metadata: Metadata = { title: "Contact" };

export default function ContactPage() {
  return (
    <>
      <PageHero eyebrow="Get in touch" title="Contact the captain">
        Questions about joining, match day or anything else. Messages go to the team inbox and the
        captain replies by email.
      </PageHero>
      <div className="mx-auto max-w-xl px-4 pt-5 pb-6">
        <ContactForm siteKey={getTurnstileSiteKey()} />
      </div>
    </>
  );
}
