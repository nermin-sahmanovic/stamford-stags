import type { Metadata } from "next";
import { PageStub } from "@/components/page-stub";

export const metadata: Metadata = { title: "Messages" };

export default function MessagesPage() {
  return <PageStub title="Messages" />;
}
