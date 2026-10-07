"use client";
import { Button } from "@/components/ui/button";
import { useEffect, useRef, useState, type FormEvent } from "react";
export function AdminSuspensionControl({
  account,
  onSaved,
}: {
  account: { id: string; email: string; account_suspended: boolean };
  onSaved: () => Promise<void>;
}) {
  const [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<
      { status: string; reason: string; created_at: string }[]
    >([]),
    [historyError, setHistoryError] = useState(""),
    [revision, setRevision] = useState(0);
  const lock = useRef(false);
  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/admin/suspensions?user_id=${account.id}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const value = await response.json();
        if (!response.ok)
          throw Error(value.error || "Unable to load role history.");
        setHistory(value.events);
        setHistoryError("");
      })
      .catch((cause) => {
        if (!controller.signal.aborted) setHistoryError(cause.message);
      });
    return () => controller.abort();
  }, [account.id, revision]);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current) return;
    const form = new FormData(event.currentTarget),
      suspended = !account.account_suspended;
    if (
      !window.confirm(
        `${suspended ? "Suspend" : "Restore"} ${account.email || account.id}? Suspension blocks sign-in, private data and background delivery; existing data is retained.`,
      )
    )
      return;
    lock.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/admin/suspensions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: account.id,
          expected_suspended: account.account_suspended,
          suspended,
          reason: form.get("reason"),
        }),
      });
      const value = await response.json();
      if (!response.ok)
        throw Error(value.error || "Unable to save account access.");
      setNotice(
        value.changed
          ? "Account access changed and recorded in audit history."
          : "Account access already matches.",
      );
      setRevision((value) => value + 1);
      await onSaved();
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <form onSubmit={save} className="mt-4 rounded-xl border p-4">
      <h3 className="font-semibold">Account suspension</h3>
      <p className="mt-2 text-sm text-muted-foreground">
        Currently {account.account_suspended ? "suspended" : "active"}. Self
        suspension and suspension of an admin are blocked. Restore access
        without deleting data.
      </p>
      {error && (
        <p role="alert" className="mt-2 text-destructive">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="mt-2">
          {notice}
        </p>
      )}
      <fieldset disabled={busy} className="mt-3 space-y-3">
        <label className="block text-sm">
          Reason
          <textarea
            name="reason"
            required
            minLength={10}
            maxLength={1000}
            rows={2}
            className="mt-1 w-full rounded-lg border bg-background p-2"
          />
        </label>
        <Button type="submit">
          {account.account_suspended ? "Restore access" : "Suspend account"}
        </Button>
      </fieldset>
      <h4 className="mt-4 text-sm font-semibold">Recent access changes</h4>
      {historyError && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {historyError}
        </p>
      )}
      <ul className="mt-2 space-y-2 text-sm">
        {history.map((event, index) => (
          <li key={`${event.created_at}/${index}`}>
            {new Date(event.created_at).toLocaleString()} ·{" "}
            {event.status.replaceAll("_", " ")} · {event.reason}
          </li>
        ))}
      </ul>
    </form>
  );
}
