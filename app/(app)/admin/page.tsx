"use client";
import { AdminRoleControl } from "@/components/admin-role-control";
import { LaunchReadiness } from "@/components/launch-readiness";
import { SupportTickets } from "@/app/help/support-tickets";
import { Button } from "@/components/ui/button";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import CompanyVerifications from "../company-verifications/page";
import Moderation from "../moderation/page";
type Account = {
  id: string;
  full_name: string;
  email: string;
  target_role: string;
  deletion_pending: boolean;
  case_status: string;
  case_notes: string;
  case_version: number;
  access_role: "member" | "admin";
};
type Operations = {
  counts: Record<string, number>;
  accounts: Account[];
  has_more: boolean;
};
export default function AdminPage() {
  const [tab, setTab] = useState("overview"),
    [data, setData] = useState<Operations | null>(null),
    [query, setQuery] = useState(""),
    [offset, setOffset] = useState(0),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [selected, setSelected] = useState<Account | null>(null);
  const lock = useRef(false);
  const url = useCallback(
    () =>
      `/api/admin/operations?${new URLSearchParams({ q: query, offset: String(offset) })}`,
    [query, offset],
  );
  const load = useCallback(async () => {
    const response = await fetch(url(), { cache: "no-store" }),
      value = await response.json();
    if (!response.ok) throw Error(value.error);
    setData(value);
  }, [url]);
  useEffect(() => {
    let stopped = false;
    void fetch(url(), { cache: "no-store" })
      .then(async (response) => {
        const value = await response.json();
        if (!response.ok) throw Error(value.error);
        if (!stopped) {
          setData(value);
          setError("");
        }
      })
      .catch((cause) => {
        if (!stopped) {
          setData(null);
          setError(cause.message);
        }
      });
    return () => {
      stopped = true;
    };
  }, [url]);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || lock.current) return;
    const form = new FormData(event.currentTarget);
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin/operations", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id: selected.id,
            version: selected.case_version,
            status: form.get("status"),
            notes: form.get("notes"),
          }),
        }),
        value = await response.json();
      if (!response.ok) throw Error(value.error);
      setNotice("Account review saved with admin audit history.");
      setSelected(null);
      await load();
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  const roleAccount = selected && data?.accounts.find(row => row.id === selected.id);
  return (
    <div className="mx-auto max-w-6xl space-y-5 p-5 sm:p-8">
      <header>
        <h1 className="text-2xl font-bold">Admin operations</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Platform counts, verification, job moderation, support and account
          reviews. Admin authorization is checked on every request.
        </p>
      </header>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="text-sm">
          {notice}
        </p>
      )}
      {data && (
        <>
          <nav aria-label="Admin sections" className="flex flex-wrap gap-2">
            {[
              "overview",
              "readiness",
              "verifications",
              "moderation",
              "support",
              "accounts",
            ].map((value) => (
              <Button
                key={value}
                variant={tab === value ? "default" : "outline"}
                disabled={busy}
                onClick={() => {if(!selected||window.confirm("Leave this review and discard unsaved changes?")){setSelected(null);setTab(value);}}}
              >
                {value}
              </Button>
            ))}
            <Button
              variant="outline"
              disabled={busy}
              onClick={() =>
                void load().catch((cause) => setError(cause.message))
              }
            >
              Refresh counts
            </Button>
          </nav>
          {tab === "overview" && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {Object.entries(data.counts).map(([key, value]) => (
                <article
                  key={key}
                  className="rounded-xl border bg-background p-4"
                >
                  <p className="text-sm capitalize">
                    {key.replaceAll("_", " ")}
                  </p>
                  <p className="mt-2 text-2xl font-bold">{value}</p>
                </article>
              ))}
            </div>
          )}
          {tab === "readiness" && <LaunchReadiness />}
          {tab === "verifications" && <CompanyVerifications />}
          {tab === "moderation" && <Moderation />}
          {tab === "support" && <SupportTickets initialQueue />}
          {tab === "accounts" && (
            <section className="rounded-2xl border bg-background p-5">
              <h2 className="font-semibold">Account reviews</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Find accounts and maintain private support/moderation review
                notes. Review flags do not suspend users. Access role changes
                are separate and require an audit reason.
              </p>
              <form
                className="mt-3 flex flex-wrap gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  setOffset(0);
                  setQuery(
                    String(
                      new FormData(event.currentTarget).get("q") || "",
                    ).trim(),
                  );
                }}
              >
                <label className="text-sm">
                  Name, email or account ID
                  <input
                    name="q"
                    maxLength={200}
                    defaultValue={query}
                    className="ml-2 rounded-lg border bg-background p-2"
                  />
                </label>
                <Button type="submit">Find account</Button>
              </form>
              <div className="mt-4 space-y-3">
                {data.accounts.map((row) => (
                  <article key={row.id} className="rounded-xl border p-4">
                    <h3 className="font-semibold">
                      {row.full_name || "Unnamed account"}
                    </h3>
                    <p className="mt-1 break-all text-sm">
                      {row.email} · {row.target_role} ·{" "}
                      {row.case_status.replaceAll("_", " ")}
                      {row.deletion_pending ? " · Deletion pending" : ""}
                    </p>
                    <Button
                      variant="outline"
                      disabled={busy || row.deletion_pending}
                      className="mt-3"
                      onClick={() => {if(!selected||window.confirm("Discard unsaved account review changes?"))setSelected(row);}}
                    >
                      Review account
                    </Button>
                  </article>
                ))}
                {!data.accounts.length && <p>No matching accounts.</p>}
              </div>
              {selected && (
                <form
                  key={selected.id}
                  onSubmit={save}
                  className="mt-4 space-y-3 rounded-xl border p-4"
                >
                  <h3 className="font-semibold">
                    Review {selected.full_name || selected.email}
                  </h3>
                  <fieldset disabled={busy} className="space-y-3">
                    <label className="block text-sm">
                      Review flag
                      <select
                        name="status"
                        defaultValue={selected.case_status}
                        className="ml-2 rounded-lg border bg-background p-2"
                      >
                        {["clear", "review_needed", "resolved"].map((value) => (
                          <option key={value} value={value}>
                            {value.replaceAll("_", " ")}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block text-sm">
                      Private admin notes
                      <textarea
                        name="notes"
                        defaultValue={selected.case_notes}
                        rows={3}
                        maxLength={4000}
                        className="mt-1 w-full rounded-lg border bg-background p-2"
                      />
                    </label>
                    <Button type="submit">Save account review</Button>
                    <Button
                      className="ml-2"
                      variant="outline"
                      type="button"
                      onClick={() => {
                        if (
                          window.confirm(
                            "Close this review and discard unsaved changes?",
                          )
                        )
                          setSelected(null);
                      }}
                    >
                      Close
                    </Button>
                  </fieldset>
                </form>
              )}
              {roleAccount && <AdminRoleControl key={roleAccount.id} account={roleAccount} onSaved={load} />}
              <div className="mt-4 flex gap-2">
                <Button
                  variant="outline"
                  disabled={busy || offset === 0}
                  onClick={() => setOffset(Math.max(0, offset - 50))}
                >
                  Previous accounts
                </Button>
                <Button
                  variant="outline"
                  disabled={busy || !data.has_more}
                  onClick={() => setOffset(offset + 50)}
                >
                  More accounts
                </Button>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
