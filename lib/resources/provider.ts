import { safeExternalUrl } from "../utils.ts";
import type { LearningResource, ResourceQuery } from "./types.ts";

const docs = [
  ["react", "React Docs", "https://react.dev/learn"],
  ["next", "Next.js Docs", "https://nextjs.org/docs"],
  ["typescript", "TypeScript Docs", "https://www.typescriptlang.org/docs/"],
  ["javascript", "MDN JavaScript", "https://developer.mozilla.org/en-US/docs/Web/JavaScript"],
  ["html", "MDN HTML", "https://developer.mozilla.org/en-US/docs/Web/HTML"],
  ["css", "MDN CSS", "https://developer.mozilla.org/en-US/docs/Web/CSS"],
  ["node", "Node.js Learn", "https://nodejs.org/en/learn/getting-started/introduction-to-nodejs"],
  ["performance", "web.dev Performance", "https://web.dev/learn/performance"],
  ["browser", "MDN Web APIs", "https://developer.mozilla.org/en-US/docs/Web/API"],
] as const;

const slug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "resource";

export const youtubeId = (value: string) => (/^[A-Za-z0-9_-]{11}$/.test(value) ? value : null);

export function safeYoutubeResource(videoId: string, title: string, description: string, thumbnailUrl: string | null): LearningResource | null {
  const id = youtubeId(videoId);
  if (!id) return null;

  return {
    id: `youtube-${id}`,
    type: "video",
    title: title || "YouTube lesson",
    source: "YouTube",
    description,
    url: `https://www.youtube.com/watch?v=${id}`,
    thumbnailUrl: safeExternalUrl(thumbnailUrl),
    embedUrl: `https://www.youtube-nocookie.com/embed/${id}`,
    provider: "youtube",
    relevance: "High",
  };
}

export function curatedResources(query: ResourceQuery): LearningResource[] {
  const haystack = `${query.topic} ${query.jobTitle} ${query.skills.join(" ")}`.toLowerCase();
  const matched = docs.filter(([key]) => haystack.includes(key)).slice(0, 4);
  const selected = matched.length ? matched : docs.slice(0, 3);
  const youtubeSearch = safeExternalUrl(`https://www.youtube.com/results?search_query=${encodeURIComponent(`${query.topic} interview tutorial`)}`);

  return [
    ...selected.map(([key, title, url], index) => ({
      id: `docs-${key}`,
      type: "documentation" as const,
      title,
      source: title.split(" ")[0],
      description: `First-party reference for ${query.topic}.`,
      url,
      thumbnailUrl: null,
      embedUrl: null,
      provider: "curated" as const,
      relevance: index === 0 ? "High" as const : "Medium" as const,
    })),
    ...(youtubeSearch ? [{
      id: `youtube-search-${slug(query.topic)}`,
      type: "video" as const,
      title: `Search YouTube for ${query.topic}`,
      source: "YouTube search",
      description: "YouTube Data API is not configured, so this is a safe search link instead of a claimed video.",
      url: youtubeSearch,
      thumbnailUrl: null,
      embedUrl: null,
      provider: "curated" as const,
      relevance: "Medium" as const,
    }] : []),
  ];
}
