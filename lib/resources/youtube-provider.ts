import { curatedResources, safeYoutubeResource } from "./provider.ts";
import type { LearningResourceProvider, ResourceProviderResult, ResourceQuery } from "./types.ts";

export class YouTubeResourceProvider implements LearningResourceProvider {
  status = {
    mode: "connected" as const,
    provider: "youtube" as const,
    reason: "YouTube Data API key configured.",
  };

  private apiKey: string;

  private fetcher: typeof fetch;

  constructor(apiKey: string, fetcher: typeof fetch = fetch) {
    this.apiKey = apiKey;
    this.fetcher = fetcher;
  }

  async search(query: ResourceQuery): Promise<ResourceProviderResult> {
    const params = new URLSearchParams({
      part: "snippet",
      type: "video",
      maxResults: "5",
      q: `${query.topic} ${query.jobTitle} interview tutorial`,
      key: this.apiKey,
    });
    const response = await this.fetcher(`https://www.googleapis.com/youtube/v3/search?${params}`, {
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) throw new Error("YouTube request failed.");

    const json = await response.json() as {
      items?: {
        id?: { videoId?: string };
        snippet?: { title?: string; description?: string; thumbnails?: { medium?: { url?: string } } };
      }[];
    };
    const videos = (json.items || [])
      .map((item) => safeYoutubeResource(
        item.id?.videoId || "",
        item.snippet?.title || "",
        item.snippet?.description || "",
        item.snippet?.thumbnails?.medium?.url || null,
      ))
      .filter((item): item is NonNullable<typeof item> => Boolean(item));

    return {
      status: this.status,
      resources: [...videos, ...curatedResources(query)].slice(0, 8),
    };
  }
}
