import type { Metadata } from "next";
import { PracticeStudio } from "./practice-studio";
import { validId } from "@/lib/practice/model";

export const metadata: Metadata = { title: "Interview Practice · Parth Careers", description: "Free, private interview practice with honest self-review." };
export default async function PracticePage({ searchParams }: { searchParams: Promise<{ job?: string; session?: string }> }) {
  const { job, session } = await searchParams;
  return <PracticeStudio initialJob={typeof job === "string" && job.length <= 200 ? job : ""} initialSession={validId(session) ? session : ""} />;
}
