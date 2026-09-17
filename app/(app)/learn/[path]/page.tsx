import { findLearningPath } from "@/lib/learning/catalog";
import { notFound } from "next/navigation";
import { LearningWorkspace } from "./workspace";
import type { Metadata } from "next";

export async function generateMetadata({ params }: { params: Promise<{ path: string }> }): Promise<Metadata> {
  const { path } = await params;
  return { title: `${findLearningPath(path)?.title || "Learning path"} · JobPilot` };
}
export default async function LearningPathPage({ params }: { params: Promise<{ path: string }> }) {
  const { path } = await params;
  const selected = findLearningPath(path);
  if (!selected) notFound();
  return <LearningWorkspace key={selected.id} path={selected} />;
}
