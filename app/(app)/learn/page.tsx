import type { Metadata } from "next";
import { LearningHome } from "./learning-client";

export const metadata: Metadata = { title: "Learn & Certify · Parth Careers", description: "Free career-connected learning paths and honest credentials." };
export default async function LearningPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  return <LearningHome initialQuery={typeof q === "string" ? q.slice(0, 120) : ""} />;
}
