"use client";

import { Button } from "@/components/ui/button";
import { SUPPORT_CATEGORIES, SUPPORT_STATUSES } from "@/lib/help/content";
import Link from "next/link";
import { type FormEvent, useEffect, useRef, useState } from "react";

type Ticket = {
  id: string;
  category: keyof typeof SUPPORT_CATEGORIES;
  subject: string;
  details: string;
  status: keyof typeof SUPPORT_STATUSES;
  response: string | null;
  version: number;
  created_at: string;
  updated_at: string;
};
const inputClass =
  "mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";

export function SupportTickets({
  initialQueue = false,
}: { initialQueue?: boolean } = {}) {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [queue, setQueue] = useState(initialQueue);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [revision, setRevision] = useState(0);
  const lock = useRef(false);
  useEffect(() => {
    let ignore = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(
          `/api/support?page=${page}${queue ? "&queue=1" : ""}`,
          { cache: "no-store" },
        );
        const data = await response.json();
        if (ignore) return;
        if (response.status === 401) {
          setSignedIn(false);
          setTickets([]);
          setIsAdmin(false);
          return;
        }
        setSignedIn(true);
        if (!response.ok)
          throw new Error(data.error || "Unable to load tickets.");
        setTickets(data.tickets);
        setHasMore(data.hasMore);
        setIsAdmin(data.isAdmin);
      } catch (cause) {
        if (!ignore)
          setError(
            cause instanceof Error ? cause.message : "Unable to load tickets.",
          );
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    void load();
    return () => {
      ignore = true;
    };
  }, [page, queue, revision]);

  async function submit(event: FormEvent<HTMLFormElement>, ticket?: Ticket) {
    event.preventDefault();
    if (lock.current) return;
    const form = event.currentTarget;
    const fields = Object.fromEntries(new FormData(form));
    lock.current = true;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const body = ticket
        ? {
            id: ticket.id,
            version: ticket.version,
            status: fields.status,
            response: fields.response,
          }
        : fields;
      const response = await fetch("/api/support", {
        method: ticket ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Unable to save the ticket.");
      if (!ticket) {
        form.reset();
        setPage(0);
      }
      setRevision((value) => value + 1);
      setNotice(
        ticket
          ? "Reply saved. The requester can see it in the help centre."
          : "Ticket saved. You can track its status and support response below.",
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to save the ticket.",
      );
    } finally {
      lock.current = false;
      setSaving(false);
    }
  }

  return (
    <section
      id="support"
      className="space-y-4 rounded-2xl border bg-background p-5"
      aria-labelledby="support-title"
    >
      <header>
        <h2 id="support-title" className="text-xl font-bold">
          Contact support
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Explain the issue and what you expected. Do not include passwords,
          payment details or identity documents. Replies appear here.
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
      {signedIn === false && (
        <p className="text-sm">
          <Link
            href="/auth/login?next=%2Fhelp%23support"
            className="text-primary underline"
          >
            Sign in
          </Link>{" "}
          to submit a ticket and view your replies.
        </p>
      )}
      {signedIn && !queue && (
        <form onSubmit={(event) => void submit(event)} className="space-y-3">
          <label className="block text-sm font-semibold">
            Category
            <select
              name="category"
              required
              disabled={saving}
              className={inputClass}
            >
              {Object.entries(SUPPORT_CATEGORIES).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-semibold">
            Subject
            <input
              name="subject"
              required
              minLength={5}
              maxLength={160}
              disabled={saving}
              className={inputClass}
            />
          </label>
          <label className="block text-sm font-semibold">
            What happened?
            <textarea
              name="details"
              required
              minLength={20}
              maxLength={4000}
              rows={5}
              disabled={saving}
              className={inputClass}
            />
          </label>
          <p className="text-xs text-muted-foreground">
            Up to five requests per 24 hours. You can check replies here; no
            response time is guaranteed.
          </p>
          <Button type="submit" disabled={loading || saving}>
            {saving ? "Saving…" : "Submit support ticket"}
          </Button>
        </form>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={loading || saving}
          onClick={() => setRevision((value) => value + 1)}
        >
          Refresh tickets
        </Button>
        {isAdmin && (
          <Button
            variant="outline"
            size="sm"
            disabled={loading || saving}
            onClick={() => {
              setQueue((value) => !value);
              setPage(0);
              setNotice("");
            }}
          >
            {queue ? "View my tickets" : "Review all tickets"}
          </Button>
        )}
      </div>
      {loading ? (
        <p role="status" className="text-sm">
          Loading tickets…
        </p>
      ) : (
        signedIn &&
        !error && (
          <>
            <h3 className="text-sm font-bold">
              {queue ? "Support queue" : "Your support tickets"}
            </h3>
            {!tickets.length && (
              <p className="text-sm text-muted-foreground">
                No tickets on this page.
              </p>
            )}
            {tickets.map((ticket) => (
              <article
                key={`${ticket.id}:${ticket.version}`}
                className="space-y-3 rounded-xl border p-4"
              >
                <h4 className="text-sm font-semibold">{ticket.subject}</h4>
                <p className="text-xs text-muted-foreground">
                  {SUPPORT_STATUSES[ticket.status]} ·{" "}
                  {SUPPORT_CATEGORIES[ticket.category]} ·{" "}
                  <time dateTime={ticket.created_at}>
                    {new Date(ticket.created_at).toLocaleString()}
                  </time>
                </p>
                <details>
                  <summary className="cursor-pointer text-xs font-semibold">
                    Request details
                  </summary>
                  <p className="mt-2 whitespace-pre-wrap break-words text-sm text-muted-foreground">
                    {ticket.details}
                  </p>
                  <p className="mt-2 break-all text-xs text-muted-foreground">
                    Reference: {ticket.id}
                  </p>
                </details>
                {ticket.response && (
                  <div className="rounded-lg bg-muted/40 p-3">
                    <p className="text-xs font-semibold">
                      Latest support response ·{" "}
                      <time dateTime={ticket.updated_at}>
                        {new Date(ticket.updated_at).toLocaleString()}
                      </time>
                    </p>
                    <p className="mt-2 whitespace-pre-wrap break-words text-sm">
                      {ticket.response}
                    </p>
                  </div>
                )}
                {queue && isAdmin && (
                  <form
                    onSubmit={(event) => void submit(event, ticket)}
                    className="space-y-3 border-t pt-3"
                  >
                    <label className="block text-xs font-semibold">
                      Status
                      <select
                        name="status"
                        defaultValue={ticket.status}
                        disabled={saving}
                        className={inputClass}
                      >
                        {Object.entries(SUPPORT_STATUSES).map(
                          ([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ),
                        )}
                      </select>
                    </label>
                    <label className="block text-xs font-semibold">
                      Support response
                      <textarea
                        name="response"
                        defaultValue={ticket.response || ""}
                        required
                        minLength={10}
                        maxLength={4000}
                        rows={3}
                        disabled={saving}
                        className={inputClass}
                      />
                    </label>
                    <Button
                      size="sm"
                      disabled={saving || loading}
                      type="submit"
                    >
                      Save response
                    </Button>
                  </form>
                )}
              </article>
            ))}
            {(page > 0 || hasMore) && (
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 0 || saving || loading}
                  onClick={() => setPage((value) => value - 1)}
                >
                  Previous
                </Button>
                <span className="text-xs">Page {page + 1}</span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!hasMore || saving || loading}
                  onClick={() => setPage((value) => value + 1)}
                >
                  Next
                </Button>
              </div>
            )}
          </>
        )
      )}
    </section>
  );
}
