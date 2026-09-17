import { createClient } from "@/lib/supabase/server";
import { completionHtml } from "@/lib/learning/certificate";
import { credentialIdValid, type Credential } from "@/lib/learning/model";
import { getSiteUrl } from "@/lib/site-url";

export async function GET(request: Request) {
  try {
    const client = await createClient();
    const { data: { user }, error: authError } = await client.auth.getUser();
    if (authError || !user) return Response.json({ error: "You must be logged in." }, { status: 401 });
    const params = new URL(request.url).searchParams;
    const id = params.get("id");
    if (!credentialIdValid(id)) return Response.json({ error: "Invalid record." }, { status: 400 });
    const { data, error } = await client.from("skillpath_credentials").select("id,kind,path_id,title,issuer,issued_on,expires_on,verification_url,credential_ref,public_name,is_public,revoked_at")
      .eq("id", id).eq("user_id", user.id).eq("kind", "jobpilot").is("revoked_at", null).maybeSingle();
    if (error) return Response.json({ error: "Could not load the completion record." }, { status: 503 });
    if (!data) return Response.json({ error: "Record unavailable." }, { status: 404 });
    const profile = await client.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
    const name = data.is_public ? data.public_name : profile.data?.full_name || "JobPilot learner";
    return new Response(completionHtml(data as Credential, name, `${getSiteUrl(new URL(request.url).origin)}/verify/learning/${id}`), {
      headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'",
        "Content-Disposition": `${params.get("download") === "1" ? "attachment" : "inline"}; filename="jobpilot-completion-${id}.html"` },
    });
  } catch { return Response.json({ error: "Could not load the completion record. Retry." }, { status: 500 }); }
}
