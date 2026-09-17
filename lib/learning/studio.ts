export type StudioLesson = {
  outcome: string;
  explanation: string[];
  example: string;
  walkthrough: string;
  mistake: string;
  reflection: string;
  answer: string;
};

export function studioVideoUrl(embedUrl: string, origin: string) {
  const url = new URL(embedUrl);
  if (url.protocol !== "https:" || url.host !== "www.youtube-nocookie.com" || url.username || url.password || !/^\/embed\/[a-zA-Z0-9_-]{11}$/.test(url.pathname)) throw Error("Unsupported learning player");
  const parent = new URL(origin);
  if (!["http:", "https:"].includes(parent.protocol) || parent.username || parent.password) throw Error("Invalid player origin");
  url.search = "";
  url.searchParams.set("enablejsapi", "1");
  url.searchParams.set("origin", parent.origin);
  url.searchParams.set("playsinline", "1");
  return url.toString();
}

export const playbackSeconds = (value: unknown) => typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 86400 ? Math.floor(value) : 0;
export const timestamp = (seconds: number) => `${Math.floor(playbackSeconds(seconds) / 60)}:${String(playbackSeconds(seconds) % 60).padStart(2, "0")}`;
