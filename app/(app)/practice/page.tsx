import type { Metadata } from "next";
import { PracticeStudio } from "./practice-studio";

export const metadata: Metadata = { title: "Interview Practice · JobPilot", description: "Free, private interview practice with honest self-review." };
export default async function PracticePage({ searchParams }: { searchParams: Promise<{ job?: string }> }) {
  const { job } = await searchParams;
  return <PracticeStudio initialJob={typeof job === "string" && job.length <= 200 ? job : ""} />;
}
