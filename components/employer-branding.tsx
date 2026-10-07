"use client";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
type Branding = {
  tagline: string;
  about: string;
  culture: string;
  perks: string[];
  tech_stack: string[];
  leadership: { name: string; role: string }[];
  banner_style: string;
  published: boolean;
  version: number;
};
export function EmployerBranding({
  companyId,
  verified,
}: {
  companyId: string;
  verified: boolean;
}) {
  const [branding, setBranding] = useState<Branding | null>(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  const lock = useRef(false);
  useEffect(() => {
    if (!verified) return;
    let stopped = false;
    void fetch("/api/recruiter/branding", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw Error(data.error);
        if (!stopped) setBranding(data.branding);
      })
      .catch((cause) => {
        if (!stopped) setError(cause.message);
      });
    return () => {
      stopped = true;
    };
  }, [verified, companyId]);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!branding || lock.current) return;
    const form = new FormData(event.currentTarget),
      lines = (key: string) =>
        String(form.get(key) || "")
          .split("\n")
          .map((value) => value.trim())
          .filter(Boolean);
    const leadership = lines("leadership").map((line) => {
      const index = line.indexOf("|");
      return {
        name: index < 0 ? line : line.slice(0, index).trim(),
        role: index < 0 ? "" : line.slice(index + 1).trim(),
      };
    });
    const value = {
      version: branding.version,
      tagline: form.get("tagline"),
      about: form.get("about"),
      culture: form.get("culture"),
      perks: lines("perks"),
      tech_stack: lines("tech_stack"),
      leadership,
      banner_style: form.get("banner_style"),
      published: form.get("published") === "on",
    };
    lock.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/recruiter/branding", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(value),
        }),
        data = await response.json();
      if (!response.ok) throw Error(data.error);
      setBranding({
        ...value,
        tagline: String(value.tagline),
        about: String(value.about),
        culture: String(value.culture),
        banner_style: String(value.banner_style),
        version: branding.version + 1,
      });
      setNotice(
        value.published
          ? "Employer page published."
          : "Employer page saved privately.",
      );
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  if (!verified) return null;
  const input = "mt-1 w-full rounded-lg border bg-background p-2 text-sm";
  return (
    <section className="rounded-2xl border bg-background p-5 sm:p-6">
      <h2 className="text-lg font-semibold">Employer branding</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Build your verified company page with a cover banner, culture, perks,
        tech stack and leadership. Publish only content you are authorized to
        share.
      </p>
      {error && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="mt-3 text-sm">
          {notice}
        </p>
      )}
      {branding && (
        <form onSubmit={save} className="mt-4">
          <fieldset disabled={busy} className="space-y-3">
            <label className="block text-sm">
              Cover headline
              <input
                name="tagline"
                defaultValue={branding.tagline}
                maxLength={240}
                className={input}
              />
            </label>
            <label className="block text-sm">
              Cover palette
              <select
                name="banner_style"
                defaultValue={branding.banner_style}
                className={input}
              >
                {["blue", "green", "violet", "slate"].map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              About
              <textarea
                name="about"
                defaultValue={branding.about}
                maxLength={4000}
                rows={4}
                className={input}
              />
            </label>
            <label className="block text-sm">
              Culture
              <textarea
                name="culture"
                defaultValue={branding.culture}
                maxLength={2000}
                rows={3}
                className={input}
              />
            </label>
            <label className="block text-sm">
              Perks (one per line, up to 20)
              <textarea
                name="perks"
                defaultValue={branding.perks.join("\n")}
                maxLength={2020}
                rows={3}
                className={input}
              />
            </label>
            <label className="block text-sm">
              Tech stack (one per line, up to 30)
              <textarea
                name="tech_stack"
                defaultValue={branding.tech_stack.join("\n")}
                maxLength={3030}
                rows={3}
                className={input}
              />
            </label>
            <label className="block text-sm">
              Leadership (Name | Role, one per line, up to 10)
              <textarea
                name="leadership"
                defaultValue={branding.leadership
                  .map((row) => `${row.name} | ${row.role}`)
                  .join("\n")}
                maxLength={2050}
                rows={3}
                className={input}
              />
            </label>
            <label className="flex min-h-11 items-center gap-2 text-sm">
              <input
                name="published"
                type="checkbox"
                defaultChecked={branding.published}
              />
              Publish my verified employer page
            </label>
            <div className="flex flex-wrap gap-3">
              <Button type="submit">Save employer page</Button>
              {branding.published && (
                <Link
                  className="self-center text-sm underline"
                  href={`/employers/${companyId}`}
                >
                  View employer page
                </Link>
              )}
            </div>
          </fieldset>
        </form>
      )}
    </section>
  );
}
