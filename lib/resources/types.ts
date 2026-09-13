export type ResourceProviderStatus = {
  mode: "connected" | "not-configured" | "fallback";
  provider: "youtube" | "curated";
  reason: string;
};

export type LearningResource = {
  id: string;
  type: "video" | "documentation" | "practice";
  title: string;
  source: string;
  description: string;
  url: string;
  thumbnailUrl: string | null;
  embedUrl: string | null;
  provider: "youtube" | "curated";
  relevance: "High" | "Medium" | "Low";
};

export type ResourceQuery = {
  topic: string;
  jobTitle: string;
  skills: string[];
};

export type ResourceProviderResult = {
  status: ResourceProviderStatus;
  resources: LearningResource[];
};

export type LearningResourceProvider = {
  status: ResourceProviderStatus;
  search(query: ResourceQuery): Promise<ResourceProviderResult>;
};
