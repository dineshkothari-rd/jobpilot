import { curatedResources } from "./provider.ts";
import { YouTubeResourceProvider } from "./youtube-provider.ts";
import type { LearningResourceProvider, ResourceProviderResult, ResourceQuery } from "./types.ts";

type Env = Record<string, string | undefined>;

const cache = new Map<string, { expires: number; result: ResourceProviderResult }>();

class CuratedProvider implements LearningResourceProvider {
  status = {
    mode: "not-configured" as const,
    provider: "curated" as const,
    reason: "YOUTUBE_API_KEY is not configured; using first-party docs and safe search links.",
  };

  async search(query: ResourceQuery) {
    return { status: this.status, resources: curatedResources(query) };
  }
}

export function getLearningResourceProvider(env: Env = process.env, fetcher?: typeof fetch): LearningResourceProvider {
  return env.YOUTUBE_API_KEY ? new YouTubeResourceProvider(env.YOUTUBE_API_KEY, fetcher) : new CuratedProvider();
}

export async function searchLearningResources(query: ResourceQuery, env: Env = process.env, fetcher?: typeof fetch) {
  const key = JSON.stringify([query.topic, query.jobTitle, query.skills.slice(0, 8), Boolean(env.YOUTUBE_API_KEY)]);
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.result;

  const provider = getLearningResourceProvider(env, fetcher);
  try {
    const result = await provider.search(query);
    cache.set(key, { expires: Date.now() + 10 * 60 * 1000, result });
    return result;
  } catch {
    return {
      status: {
        mode: "fallback" as const,
        provider: "curated" as const,
        reason: "Video provider failed; using first-party docs and safe search links.",
      },
      resources: curatedResources(query),
    };
  }
}

export const getResourceProviderStatus = (env: Env = process.env) => getLearningResourceProvider(env).status;
