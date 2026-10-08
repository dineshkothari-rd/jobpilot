"use client";
import { Button } from "@/components/ui/button";
import { useEffect, useRef, useState } from "react";
type Billing = {
  configuration: { ready: boolean; mode: "test" | "live" | null };
  products: {
    id: string;
    name: string;
    kind: string;
    amount_minor: number;
    credits: number;
  }[];
  plan: { name: string; expires_at: string | null };
  balances: { mode: string; balance: number }[];
  intents: {
    id: string;
    product_id: string;
    mode: string;
    status: string;
    disputed: boolean;
  }[];
  payments: {
    id: string;
    amount_minor: number;
    refunded_minor: number;
    paid_at: string;
    invoice_url: string | null;
    billing_intents: { mode: string };
  }[];
};
export default function BillingPage() {
  const [data, setData] = useState<Billing | null>(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [revision, setRevision] = useState(0),
    [references, setReferences] = useState<Record<string, string>>({});
  const lock = useRef(false),
    requestId = useRef<Record<string, string>>({});
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/billing", { cache: "no-store", signal: controller.signal })
      .then(async (r) => {
        const v = await r.json();
        if (!r.ok) throw Error(v.error);
        setData(v);
        setError("");
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [revision]);
  async function action(product?: string, intent?: string, kind?: string) {
    if (lock.current || !data) return;
    if (
      product &&
      !window.confirm(
        data.configuration.mode === "test"
          ? "Open a test checkout? Use provider test credentials only. Test purchases never grant live access."
          : "Open hosted checkout? Monthly plans authorize up to 12 recurring charges. Posting packs are one-time purchases. Review the provider's final amount before confirming.",
      )
    )
      return;
    if (
      kind === "cancel" &&
      !window.confirm(
        "Cancel future subscription renewals at the end of the current paid cycle?",
      )
    )
      return;
    if(kind==="cancel_now"&&!window.confirm("Stop the provider subscription now? Already verified paid-period access remains until expiry. This does not refund earlier payments."))return;
    lock.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (product && !requestId.current[product])
        requestId.current[product] = crypto.randomUUID();
      const r = await fetch(
        product ? "/api/billing/checkout" : "/api/billing",
        {
          method: product ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            product
              ? { id: requestId.current[product], product }
              : {
                  id: intent,
                  action: kind,
                  ...(kind === "recover"
                    ? { reference: references[intent!] }
                    : {}),
                },
          ),
        },
      );
      const v = await r.json();
      if (!r.ok) throw Error(v.error);
      if (v.url) window.location.assign(v.url);
      else {
        setNotice(
          kind === "cancel"
            ? "Cancellation requested. Provider state controls when it takes effect."
            : "Billing refreshed from the provider.",
        );
        setRevision((v) => v + 1);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <main className="mx-auto max-w-4xl space-y-6 p-5">
      <header><p className="section-label">Your account · Your choices</p><h1 className="mt-2 text-2xl font-bold">Plans & billing</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">Compare your plan, review payments and manage renewals in one place. Check provider setup and mode before making a purchase.</p></header>
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      <Button
        variant="outline"
        disabled={busy}
        onClick={() => setRevision((v) => v + 1)}
      >
        Reload billing
      </Button>
      {!data && !error && <p role="status">Loading billing…</p>}
      {data && (
        <>
          <section className="rounded-xl border p-5">
            <h2 className="font-semibold">{data.plan.name}</h2>
            <p>
              {data.plan.expires_at
                ? `Access through ${new Date(data.plan.expires_at).toLocaleString()}`
                : "Free plan access; no subscription or renewal."}
            </p>
            {!data.configuration.ready && (
              <p className="mt-3">
                Secure checkout setup is pending. Subscription plans and posting
                packages are listed below; no purchase can be made until
                checkout is connected.
              </p>
            )}
            {data.configuration.mode === "test" && (
              <p className="mt-3">
                Test mode — no live entitlement or spendable live posting
                credits.
              </p>
            )}
            <ul className="mt-3">
              {data.balances.map((b) => (
                <li key={b.mode}>
                  {b.mode} posting credits: {b.balance}
                  {b.balance < 0
                    ? " (refunded spent credits; purchases first offset this balance)"
                    : ""}
                </li>
              ))}
            </ul>
          </section>
          <section className="grid gap-4 sm:grid-cols-2">
            {data.products.map((p) => (
              <article key={p.id} className="rounded-xl border p-5">
                <h2 className="font-semibold">{p.name}</h2>
                <p className="mt-2">
                  INR {(p.amount_minor / 100).toFixed(2)}{" "}
                  {p.kind === "subscription"
                    ? "per month · up to 12 cycles"
                    : "one time"}
                </p>
                {p.credits > 0 && (
                  <p>
                    {p.credits} first-publication credits. Pausing/resuming the
                    same posting does not spend twice; closing/deleting does not
                    refund a spent credit.
                  </p>
                )}
                <Button
                  className="mt-3"
                  disabled={busy || !data.configuration.ready}
                  onClick={() => void action(p.id)}
                >
                  Open {data.configuration.mode === "test" ? "test " : ""}
                  checkout
                </Button>
              </article>
            ))}
          </section>
          <section className="rounded-xl border p-5">
            <h2 className="font-semibold">Checkouts & subscriptions</h2>
            <p className="mt-2 text-sm">
              A checkout return URL grants no access. Provider verification
              controls payments, refunds and renewal state.
            </p>
            <ul className="mt-3 space-y-3">
              {data.intents.map((i) => (
                <li key={i.id} className="break-words border-b pb-3">
                  {i.product_id} · {i.mode} · {i.status}
                  {i.disputed && (
                    <p role="status">
                      Access is on hold while a payment dispute is unresolved.
                    </p>
                  )}
                  {i.status === "creating" && (
                    <label className="mt-2 block">
                      Recovery reference supplied by support
                      <input
                        className="mt-1 w-full rounded border p-2"
                        value={references[i.id] || ""}
                        maxLength={110}
                        onChange={(e) =>
                          setReferences({
                            ...references,
                            [i.id]: e.target.value,
                          })
                        }
                      />
                      <Button
                        disabled={
                          busy || !data.configuration.ready || !references[i.id]
                        }
                        onClick={() => void action(undefined, i.id, "recover")}
                      >
                        Recover existing checkout
                      </Button>
                    </label>
                  )}
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      disabled={busy || !data.configuration.ready}
                      onClick={() => void action(undefined, i.id, "refresh")}
                    >
                      Verify status
                    </Button>
                    {!i.product_id.startsWith("posting_") &&
                      !["cancelled", "completed", "expired"].includes(
                        i.status,
                      ) && (
                        <Button
                          variant="outline"
                          disabled={busy || !data.configuration.ready}
                          onClick={() => void action(undefined, i.id, "cancel")}
                        >
                          Cancel renewal
                        </Button>
                      )}
                    {!i.product_id.startsWith("posting_")&&!['cancelled','completed','expired'].includes(i.status)&&<Button variant="outline" disabled={busy||!data.configuration.ready} onClick={()=>void action(undefined,i.id,"cancel_now")}>Stop subscription now</Button>}
                  </div>
                </li>
              ))}
            </ul>
          </section>
          <section className="rounded-xl border p-5">
            <h2 className="font-semibold">Payment history & receipts</h2>
            {!data.payments.length && (
              <p className="mt-3">No verified payments yet.</p>
            )}
            <ul className="mt-3 space-y-3">
              {data.payments.map((p) => (
                <li key={p.id} className="break-words">
                  {p.billing_intents.mode} · INR{" "}
                  {(p.amount_minor / 100).toFixed(2)} ·{" "}
                  {new Date(p.paid_at).toLocaleString()} · refunded INR{" "}
                  {(p.refunded_minor / 100).toFixed(2)}
                  <div className="flex flex-wrap gap-3">
                    <a
                      className="underline"
                      href={`/api/billing/receipts?id=${p.id}`}
                    >
                      Download receipt PDF
                    </a>
                    {p.invoice_url && (
                      <a
                        className="underline"
                        href={p.invoice_url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Provider invoice
                      </a>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-sm">
              JobPilot receipts are not tax invoices. Official invoices are
              issued by the configured provider/merchant.
            </p>
          </section>
        </>
      )}
    </main>
  );
}
