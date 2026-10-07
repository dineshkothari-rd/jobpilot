import { publicClient } from "@/lib/public/server";
import { getSiteUrl } from "@/lib/site-url";
import type { MetadataRoute } from "next";
export const dynamic = "force-dynamic";
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = getSiteUrl();
  // ponytail: latest 1000 listings bound crawl cost; shard when public inventory exceeds this launch window.
  const r = await publicClient()
    .from("public_discovery_jobs")
    .select("id,recruiter_company_id")
    .eq("source", "jobpilot")
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("id")
    .limit(1000);
  if (r.error) throw Error("Sitemap unavailable");
  const ids = [
    ...new Set(
      (r.data || []).map((j) => j.recruiter_company_id).filter(Boolean),
    ),
  ];
  const entries: MetadataRoute.Sitemap = [
    "/",
    "/help",
    "/plans",
    "/privacy",
    "/terms",
  ].map((path) => ({ url: origin + path }));
  for (const j of r.data || [])
    entries.push({ url: `${origin}/opportunities/${j.id}` });
  // Draft/unpublished branding must not be advertised merely because a company has a live job.
  if (ids.length) {
    const b = await publicClient()
      .from("employer_branding")
      .select("company_id")
      .eq("published", true)
      .in("company_id", ids);
    if (b.error) throw Error("Sitemap unavailable");
    for (const c of b.data || [])
      entries.push({ url: `${origin}/employers/${c.company_id}` });
  }
  return entries;
}
