import { publicEmployer, publicJobs } from "@/lib/public/server";
import { safeExternalUrl } from "@/lib/utils";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
export const dynamic = "force-dynamic";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params,
    c = await publicEmployer(id);
  if (!c) notFound();
  return {
    title: `${c.name} — employer profile`,
    description: c.tagline || c.about?.slice(0, 160),
    alternates: { canonical: `/employers/${id}` },
  };
}
export default async function Employer({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params,
    c = await publicEmployer(id);
  if (!c) notFound();
  const { jobs, more } = await publicJobs("", "", 1, id);
  const palettes: Record<string, string> = {
    blue: "bg-blue-700",
    green: "bg-emerald-700",
    violet: "bg-violet-700",
    slate: "bg-slate-800",
  };
  return (
    <article className="space-y-6">
      <header
        className={`rounded-2xl p-6 text-white ${palettes[c.banner_style] || palettes.blue}`}
      >
        <p>Verified JobPilot employer</p>
        <h1 className="mt-3 break-words text-3xl font-bold">{c.name}</h1>
        <p className="mt-3 break-words">{c.tagline}</p>
      </header>
      <section>
        <h2 className="text-xl font-semibold">About</h2>
        <p className="mt-3 whitespace-pre-wrap break-words">{c.about}</p>
        {safeExternalUrl(c.website) && (
          <a
            href={safeExternalUrl(c.website)!}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-block underline"
          >
            Company website
          </a>
        )}
      </section>
      <section>
        <h2 className="text-xl font-semibold">Culture & perks</h2>
        <p className="mt-3 whitespace-pre-wrap break-words">{c.culture}</p>
        <ul className="mt-3 list-inside list-disc">
          {c.perks.map((v: string) => (
            <li key={v}>{v}</li>
          ))}
        </ul>
        <h3 className="mt-5 font-semibold">Tech stack</h3>
        <p className="mt-2 break-words">{c.tech_stack.join(" · ")}</p>
        <h3 className="mt-5 font-semibold">Leadership</h3>
        {c.leadership.map((r: { name: string; role: string }, i: number) => (
          <p key={i} className="mt-2 break-words">
            {r.name} · {r.role}
          </p>
        ))}
      </section>
      <p className="text-sm text-muted-foreground">
        Branding is supplied by the employer. Verification confirms hiring
        authority, not every culture or perks claim.
      </p>
      <section>
        <h2 className="text-xl font-semibold">Current openings</h2>
        {jobs.map((j) => (
          <Link
            key={j.id}
            href={`/opportunities/${j.id}`}
            className="mt-3 block break-words rounded-xl border p-4 underline"
          >
            {j.title} · {j.location}
          </Link>
        ))}
        {!jobs.length && <p className="mt-3">No current openings.</p>}
        {more && (
          <p className="mt-3 text-sm">Showing the latest 24 openings.</p>
        )}
      </section>
    </article>
  );
}
