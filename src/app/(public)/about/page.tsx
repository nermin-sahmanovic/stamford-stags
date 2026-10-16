import type { Metadata } from "next";
import { PageStub } from "@/components/page-stub";

export const metadata: Metadata = { title: "About" };

export default function AboutPage() {
  return <PageStub title="About" />;
}
