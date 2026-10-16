import type { Metadata } from "next";
import { PageStub } from "@/components/page-stub";

export const metadata: Metadata = { title: "Captain's Dashboard" };

export default function CaptainDashboardPage() {
  return <PageStub title="Captain's Dashboard" />;
}
