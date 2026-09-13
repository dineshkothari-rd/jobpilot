import assert from "node:assert/strict";
import test from "node:test";

import { curatedResources, safeYoutubeResource } from "./provider.ts";
import { searchLearningResources } from "./resource-provider-factory.ts";

const query = {
  topic: "React performance",
  jobTitle: "Frontend Engineer",
  skills: ["React", "TypeScript"],
};

test("rejects unsafe YouTube video IDs", () => {
  assert.equal(safeYoutubeResource("not-a-valid-id<script>", "Bad", "", null), null);
});

test("curated fallback exposes first-party docs and safe search only", () => {
  const resources = curatedResources(query);

  assert.ok(resources.some((resource) => resource.url === "https://react.dev/learn"));
  assert.ok(resources.some((resource) => resource.url.startsWith("https://www.youtube.com/results?search_query=")));
  assert.equal(resources.some((resource) => resource.embedUrl), false);
});

test("normalizes YouTube API videos to nocookie embeds", async () => {
  const fetcher = async () => new Response(JSON.stringify({
    items: [{
      id: { videoId: "abcDEF12345" },
      snippet: {
        title: "React interview tutorial",
        description: "Learn React.",
        thumbnails: { medium: { url: "https://i.ytimg.com/vi/abcDEF12345/mqdefault.jpg" } },
      },
    }],
  }));

  const result = await searchLearningResources(query, { YOUTUBE_API_KEY: "test" }, fetcher);

  assert.equal(result.status.provider, "youtube");
  assert.ok(result.resources.some((resource) => resource.embedUrl === "https://www.youtube-nocookie.com/embed/abcDEF12345"));
});
