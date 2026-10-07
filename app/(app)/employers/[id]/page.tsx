"use client";
import { safeExternalUrl } from "@/lib/utils";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
type Company = {
  name: string;
  website: string;
  tagline: string;
  about: string;
  culture: string;
  perks: string[];
  tech_stack: string[];
  leadership: { name: string; role: string }[];
  banner_style: string;
};
const palettes: Record<string, string> = {
  blue: "bg-blue-700",
  green: "bg-emerald-700",
  violet: "bg-violet-700",
  slate: "bg-slate-800",
};
export default function EmployerPage() {
  const params = useParams(),
    id = String(params.id || "");
  const [data, setData] = useState<{
      company: Company;
      jobs: { id: string; title: string; location: string }[];
    } | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    let stopped = false;
    void fetch(`/api/employers/${id}`, { cache: "no-store" })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw Error(result.error);
        if (!stopped) setData(result);
      })
      .catch((cause) => {
        if (!stopped) setError(cause.message);
      });
    return () => {
      stopped = true;
    };
  }, [id]);
  return (
    <div className="mx-auto max-w-4xl space-y-5 p-5 sm:p-8">
      <Link href="/companies" className="text-sm underline">
        Explore companies
      </Link>
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      {!data && !error && <p role="status">Loading employer page…</p>}
      {data && (
        <>
          <header
            className={`rounded-2xl p-6 text-white sm:p-10 ${palettes[data.company.banner_style] || palettes.blue}`}
          >
            <p className="text-sm">Verified JobPilot employer</p>
            <h1 className="mt-2 text-3xl font-bold">{data.company.name}</h1>
            <p className="mt-3 text-lg">{data.company.tagline}</p>
          </header>
          <section className="rounded-2xl border bg-background p-5">
            <h2 className="font-semibold">About</h2>
            <p className="mt-3 whitespace-pre-wrap break-words text-sm">
              {data.company.about || "Company description not provided."}
            </p>
            {safeExternalUrl(data.company.website) && (
              <a
                href={safeExternalUrl(data.company.website)!}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-block text-sm underline"
              >
                Company website
              </a>
            )}
          </section>
          <section className="rounded-2xl border bg-background p-5">
            <h2 className="font-semibold">Culture & perks</h2>
            <p className="mt-3 whitespace-pre-wrap break-words text-sm">
              {data.company.culture}
            </p>
            <ul className="mt-3 list-inside list-disc text-sm">
              {data.company.perks.map((value) => (
                <li key={value}>{value}</li>
              ))}
            </ul>
            <h3 className="mt-5 font-semibold">Tech stack</h3>
            <p className="mt-2 text-sm">
              {data.company.tech_stack.join(" · ") || "Not provided"}
            </p>
            <h3 className="mt-5 font-semibold">Leadership</h3>
            {data.company.leadership.map((row, index) => (
              <p key={index} className="mt-2 text-sm">
                {row.name} · {row.role}
              </p>
            ))}
            <p className="mt-4 text-xs text-muted-foreground">
              Branding content is supplied by this employer. Verification
              confirms hiring authority, not every culture or perks claim.
            </p>
          </section>
          <section className="rounded-2xl border bg-background p-5">
            <h2 className="font-semibold">Current openings</h2>
            {data.jobs.map((job) => (
              <Link
                key={job.id}
                href={`/jobs/${job.id}`}
                className="mt-3 block rounded-lg border p-3 text-sm underline"
              >
                {job.title} · {job.location}
              </Link>
            ))}
            {!data.jobs.length && (
              <p className="mt-3 text-sm">No current openings.</p>
            )}
            {data.jobs.length === 100 && (
              <p className="mt-3 text-xs">Showing the latest 100 openings.</p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
