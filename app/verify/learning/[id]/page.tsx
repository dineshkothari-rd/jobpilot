import { learningAdmin } from "@/lib/learning/server";
import { credentialIdValid } from "@/lib/learning/model";
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Parth Careers completion verification", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function Verification({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!credentialIdValid(id)) notFound();
  const result = await (async () => {
    try {
      return await learningAdmin().from("skillpath_credentials").select("id,title,issuer,issued_on,public_name")
        .eq("id", id).eq("kind", "jobpilot").eq("is_public", true).is("revoked_at", null).maybeSingle();
    } catch { return { data: null, error: true }; }
  })();
  if (result.error) return <main className="mx-auto max-w-xl p-8"><h1 className="text-2xl font-bold">Verification temporarily unavailable</h1><p className="mt-4">Try again later. This is not a verification of the submitted record.</p></main>;
  if (!result.data) notFound();
  const row = result.data;
  return <main className="mx-auto max-w-2xl p-6 sm:p-12">
    <Link href="/" className="text-sm font-semibold text-primary">Parth Careers</Link>
    <section className="surface mt-8 p-6 sm:p-10">
      <p className="section-label">Publicly shared completion record</p><h1 className="mt-3 text-3xl font-bold">{row.title}</h1>
      <p className="mt-6 text-xl font-semibold">{row.public_name}</p><p className="mt-2">Issued by {row.issuer} · {row.issued_on}</p>
      <p className="mt-6 leading-7 text-muted-foreground">Parth Careers confirms that this completion record was issued through its learning workflow: self-reported lesson exercises, a passed three-question knowledge check and a self-reported project submission.</p>
      <p className="mt-4 text-sm leading-6 text-muted-foreground">Not accredited, not identity-verified, not an external provider certificate or proof of independently assessed project quality. Resource providers do not endorse this record.</p>
      <p className="mt-6 break-all text-xs text-muted-foreground">Record ID: {row.id}</p>
    </section>
  </main>;
}
