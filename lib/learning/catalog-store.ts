import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { LearningPath } from "./catalog";
import type { StudioLesson } from "./studio";
import { boundedText, publicHttpsUrl, record } from "./model";

export type CatalogEntry = { path: LearningPath; readings: Record<string, StudioLesson>; questions: { prompt: string; options: string[] }[] };
const id = (value: unknown) => {
  if (typeof value !== "string" || !/^[a-z0-9][a-z0-9-]{0,63}$/.test(value)) throw Error("Invalid catalogue ID.");
  return value;
};
const text = (value: unknown) => boundedText(value, 12000, "Catalogue text", true);
const strings = (value: unknown) => {
  if (!Array.isArray(value) || value.length > 100) throw Error("Invalid catalogue list.");
  return value.map(text);
};

export function parseCatalogEntry(value: unknown): CatalogEntry {
  const row = record(value), data = record(row.definition), readings = record(row.readings);
  if (data.id !== row.id || !["Beginner", "Intermediate"].includes(String(data.level))) throw Error("Invalid catalogue path.");
  if (!Array.isArray(data.lessons) || !data.lessons.length || data.lessons.length > 100) throw Error("Invalid catalogue lessons.");
  const lessons = data.lessons.map(value => {
    const lesson = record(value), lessonId = id(lesson.id), reading = record(readings[lessonId]);
    for (const field of ["outcome", "example", "walkthrough", "mistake", "reflection", "answer"]) text(reading[field]);
    if (strings(reading.explanation).length < 2) throw Error("Missing in-app reading.");
    if (!["reading", "video"].includes(String(lesson.format)) || !Number.isInteger(lesson.minutes) || Number(lesson.minutes) < 1 || Number(lesson.minutes) > 1440) throw Error("Invalid lesson format/duration.");
    const embedUrl = lesson.embedUrl === null ? null : publicHttpsUrl(lesson.embedUrl, true);
    if (embedUrl && !/^https:\/\/www\.youtube-nocookie\.com\/embed\/[a-zA-Z0-9_-]{11}$/.test(embedUrl)) throw Error("Unsupported catalogue player.");
    return { id: lessonId, title: text(lesson.title), provider: text(lesson.provider), url: publicHttpsUrl(lesson.url, true), alternative: publicHttpsUrl(lesson.alternative, true), format: lesson.format as "reading" | "video", minutes: Number(lesson.minutes), task: text(lesson.task), embedUrl, verifiedOn: text(lesson.verifiedOn), access: text(lesson.access) };
  });
  if (new Set(lessons.map(lesson => lesson.id)).size !== lessons.length) throw Error("Duplicate lessons.");
  const credential = data.credential === null ? null : record(data.credential);
  if (!Array.isArray(row.questions) || row.questions.length !== 3) throw Error("A path needs three knowledge-check questions.");
  const questions = row.questions.map(value => { const question = record(value), options = strings(question.options); if (options.length < 2 || options.length > 6) throw Error("Invalid choices."); return { prompt: text(question.prompt), options }; });
  return { path: { id: id(data.id), title: text(data.title), description: text(data.description), skills: strings(data.skills), roles: strings(data.roles), level: data.level as LearningPath["level"], prerequisites: text(data.prerequisites), lessons, project: text(data.project), credential: credential ? { title: text(credential.title), issuer: text(credential.issuer), url: publicHttpsUrl(credential.url, true), requirements: text(credential.requirements) } : null },
    readings: Object.fromEntries(lessons.map(lesson => [lesson.id, readings[lesson.id] as StudioLesson])), questions };
}

// Request-local cache only: catalogue edits appear on the next request.
export const loadCatalog = cache(async (): Promise<CatalogEntry[]> => {
  const client = await createClient();
  // ponytail: bounded 500-course catalogue; paginate when the curated catalogue grows beyond this.
  const result = await client.from("learning_catalog").select("id,definition,readings,questions").order("id").limit(500);
  if (result.error) throw Error("Learning catalogue is unavailable. Retry shortly.");
  return (result.data || []).map(parseCatalogEntry);
});
