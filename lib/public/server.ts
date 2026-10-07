import { createClient } from "@supabase/supabase-js";
import DOMPurify from "isomorphic-dompurify";
import { cache } from "react";
import "server-only";
import { likeLiteral, type PublicJob } from "./discovery";
export function publicClient() {
  if (!process.env.SUPABASE_SECRET_KEY)
    throw Error("Public discovery unavailable");
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY,
    { auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(10_000) }) },
    },
  );
}
export function descriptionText(value: string | null) {
  return DOMPurify.sanitize((value || "").replace(/<\/(?:p|div|li|h[1-6])>|<br\s*\/?>/gi, "$&\n"), {
    ALLOWED_TAGS: [], ALLOWED_ATTR: [], RETURN_DOM: true,
  }).textContent || "";
}
export async function publicJobs(
  q = "",
  location = "",
  page = 1,
  company?: string,
) {
  let query = publicClient()
    .from("public_discovery_jobs")
    .select("*")
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("id")
    .range((page - 1) * 24, page * 24);
  if (q) query = query.ilike("title", `%${likeLiteral(q)}%`);
  if (location) query = query.ilike("location", `%${likeLiteral(location)}%`);
  if (company) query = query.eq("recruiter_company_id", company);
  const r = await query;
  if (r.error) throw Error("Public discovery unavailable");
  return {
    jobs: (r.data || []).slice(0, 24) as PublicJob[],
    more: (r.data?.length || 0) > 24,
  };
}
export const publicJob = cache(async (id: string) => {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  )
    return null;
  const r = await publicClient()
    .from("public_discovery_jobs")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (r.error) throw Error("Public discovery unavailable");
  return r.data as PublicJob | null;
});
export const publicEmployer = cache(async (id: string) => {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  )
    return null;
  const r = await publicClient().rpc("get_employer_branding", {
    p_company: id,
  });
  if (r.error) throw Error("Employer discovery unavailable");
  return r.data;
});
