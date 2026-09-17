import { loadCatalog } from "@/lib/learning/catalog-store";
import { notFound } from "next/navigation";
import { LearningWorkspace } from "./workspace";
import type { Metadata } from "next";

export async function generateMetadata({ params }: { params: Promise<{ path: string }> }): Promise<Metadata> {
  const { path } = await params;
  const selected = (await loadCatalog()).find(entry => entry.path.id === path);
  return { title: `${selected?.path.title || "Learning path"} · JobPilot` };
}
export default async function LearningPathPage({ params }: { params: Promise<{ path: string }> }) {
  const { path } = await params;
  const selected = (await loadCatalog()).find(entry => entry.path.id === path);
  if (!selected) notFound();
  return <LearningWorkspace key={selected.path.id} path={selected.path} readings={selected.readings} />;
}
