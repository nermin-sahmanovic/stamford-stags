import type { Metadata } from "next";
import { PageStub } from "@/components/page-stub";

export const metadata: Metadata = { title: "Players" };

export default function PlayersPage() {
  return <PageStub title="Players" />;
}
