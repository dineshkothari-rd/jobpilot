import { getSiteUrl } from "@/lib/site-url";
import type { MetadataRoute } from "next";
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: [
        "/",
        "/opportunities/",
        "/employers/",
        "/help",
        "/privacy",
        "/terms",
      ],
      disallow: [
        "/api/",
        "/auth/",
        "/dashboard",
        "/profile",
        "/resumes",
        "/applications",
        "/recruiter",
        "/admin",
        "/inbox",
        "/moderation",
        "/jobs",
        "/companies",
        "/saved-jobs",
        "/my-day",
        "/autopilot",
        "/learning",
        "/interview",
        "/portfolio",
      ],
    },
    sitemap: `${getSiteUrl()}/sitemap.xml`,
  };
}
