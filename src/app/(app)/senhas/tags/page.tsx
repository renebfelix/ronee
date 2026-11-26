import type { Metadata } from "next";
import { TagsView } from "@/features/passwords";

export const metadata: Metadata = { title: "Tags de senhas" };

export const instant = false;

export default function PasswordTagsPage() {
  return <TagsView />;
}
