"use client";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
type Thread = {
  id: string;
  company_name: string;
  participant?: string;
  blocked: boolean;
  is_candidate: boolean;
  can_send: boolean;
  updated_at: string;
};
type Invitation = {
  id: string;
  job_id: string;
  round: string;
  starts_at: string;
  timezone: string;
  duration_minutes: number;
  location: string;
  notes: string;
  response: string;
  status: string;
  version: number;
};
type Detail = {
  thread: Thread;
  messages: { id: string; mine: boolean; body: string; created_at: string }[];
  has_more: boolean;
  invitations: Invitation[];
};
type Notice = {
  id: string;
  company_name: string;
  kind: string;
  thread_id: string | null;
  read_at: string | null;
  created_at: string;
};
function InvitationCard({row,candidate,disabled,onRespond,onRevise}:{row:Invitation;candidate:boolean;disabled:boolean;onRespond:(row:Invitation,status:string)=>Promise<void>;onRevise:(row:Invitation)=>void}){return (
            <article className="mt-3 rounded-xl border p-4">
              <h4 className="font-semibold">
                {row.round} · {row.status.replaceAll("_", " ")}
              </h4>
              <p className="mt-2 text-sm">
                {new Date(row.starts_at).toLocaleString()} · confirmed zone{" "}
                {row.timezone} · {row.duration_minutes} minutes
              </p>
              <p className="mt-2 whitespace-pre-wrap break-words text-sm">
                {row.location}
              </p>
              <p className="mt-2 whitespace-pre-wrap break-words text-sm">
                {row.notes}
              </p>
              {row.response && (
                <p className="mt-2 whitespace-pre-wrap break-words text-sm">
                  Response: {row.response}
                </p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                {candidate &&
                  ["pending", "reschedule_requested"].includes(row.status) &&
                  ["accepted", "reschedule_requested", "declined"].map(
                    (status) => (
                      <Button
                        key={status}
                        variant="outline"
                        disabled={disabled}
                        onClick={() => void onRespond(row, status)}
                      >
                        {status === "accepted"
                          ? "Accept"
                          : status === "declined"
                            ? "Decline"
                            : "Suggest reschedule"}
                      </Button>
                    ),
                  )}
                {!candidate &&
                  ["pending", "reschedule_requested"].includes(row.status) && (
                    <Button
                      disabled={disabled}
                      variant="outline"
                      onClick={() => onRevise(row)}
                    >
                      Revise invitation
                    </Button>
                  )}
                {!candidate &&
                  ["pending", "reschedule_requested", "accepted"].includes(
                    row.status,
                  ) && (
                    <Button
                      disabled={disabled}
                      variant="outline"
                      onClick={() => {
                        if (
                          window.confirm(
                            "Cancel this invitation? Accepted planner rounds will be marked cancelled.",
                          )
                        )
                          void onRespond(row, "cancelled");
                      }}
                    >
                      Cancel invitation
                    </Button>
                  )}
              </div>
            </article>
  );}
function Inbox() {
  const params = useSearchParams();
  const [threadId, setThreadId] = useState(() => params.get("thread") || ""),
    [threads, setThreads] = useState<Thread[]>([]),
    [detail, setDetail] = useState<Detail | null>(null),
    [notices, setNotices] = useState<Notice[]>([]),
    [offset, setOffset] = useState(0),
    [noticeOffset, setNoticeOffset] = useState(0),
    [messageOffset, setMessageOffset] = useState(0),
    [more, setMore] = useState(false),
    [moreNotices, setMoreNotices] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [draft, setDraft] = useState(""),
    [jobs, setJobs] = useState<
      { id: string; title: string; posting_status: string }[]
    >([]),
    [invite, setInvite] = useState<Invitation | null>(null);
  const lock = useRef(false),
    pending = useRef<{ id: string; body: string; thread: string } | null>(null);
  const [invitationDirty,setInvitationDirty]=useState(false);
  const [invitationId,setInvitationId]=useState("");
  const requestEpoch=useRef(0);
  const load = useCallback(async () => {
    const epoch=++requestEpoch.current;
    const urls = [
      `/api/hiring-messages?offset=${offset}`,
      `/api/hiring-notifications?offset=${noticeOffset}`,
    ];
    if (threadId)
      urls.push(
        `/api/hiring-messages?thread=${threadId}&offset=${messageOffset}`,
      );
    const data = await Promise.all(
      urls.map(async (url) => {
        const response = await fetch(url, { cache: "no-store" }),
          body = await response.json();
        if (!response.ok) throw Error(body.error);
        return body;
      }),
    );
    if(epoch!==requestEpoch.current)return;
    setThreads(data[0].threads);
    setMore(data[0].has_more);
    setNotices(data[1].notifications);
    setMoreNotices(data[1].has_more);
    if (data[2]) setDetail(data[2]);
  }, [offset, noticeOffset, messageOffset, threadId]);
  useEffect(() => {
    let stopped = false;
    void Promise.resolve().then(()=>stopped?undefined:load()).catch((cause) => {
      if (!stopped) setError(cause.message);
    });
    return () => {
      stopped = true;
    };
  }, [load]);
  useEffect(() => {
    const client = createClient();
    let stopped = false;
    let channel: ReturnType<typeof client.channel> | undefined;
    void client.auth
      .getUser()
      .then(({ data }) => {
        if (stopped || !data.user) return;
        channel = client
          .channel("hiring-inbox-notices")
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "hiring_notifications",
              filter: `user_id=eq.${data.user.id}`,
            },
            () => {
              if (!stopped && !lock.current)
                void load().catch((cause) => setError(cause.message));
            },
          )
          .subscribe();
      })
      .catch(() => {});
    return () => {
      stopped = true;
      if (channel) void client.removeChannel(channel);
    };
  }, [load]);
  const employerThreadId=detail&&!detail.thread.is_candidate?detail.thread.id:null;
  useEffect(() => {
    if (!employerThreadId) return;
    let stopped = false;
    void (async () => {
      const response = await fetch("/api/recruiter?offset=0", {
          cache: "no-store",
        }),
        data = await response.json();
      if (!response.ok) throw Error(data.error);
      let rows = data.jobs || [];
      if (data.has_more) {
        const next = await fetch("/api/recruiter?offset=50", {
            cache: "no-store",
          }),
          more = await next.json();
        if (!next.ok) throw Error(more.error);
        rows = [...rows, ...more.jobs];
      }
      if (!stopped)
        setJobs(
          rows.filter(
            (row: { posting_status: string }) =>
              row.posting_status === "published",
          ),
        );
    })().catch((cause) => {
      if (!stopped) setError(cause.message);
    });
    return () => {
      stopped = true;
    };
  }, [employerThreadId]);
  async function mutate(
    url: string,
    body: unknown,
    method = "POST",
    success = "Saved.",
  ) {
    if (lock.current) return false;
    lock.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(url, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
        data = await response.json();
      if (!response.ok) throw Error(data.error);
      setNotice(success);
      await load();
      return true;
    } catch (cause) {
      setError((cause as Error).message);
      return false;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  function select(id: string) {
    if ((draft||invitationDirty) && !window.confirm("Discard your unsent message or invitation draft?")) return;
    requestEpoch.current++;
    setInvitationDirty(false);
    setThreadId(id);
    setDetail(null);
    setDraft("");
    pending.current = null;
    setMessageOffset(0);
    setInvite(null);
    setError("");
  }
  async function send(event: FormEvent) {
    event.preventDefault();
    if (!draft.trim() || !threadId) return;
    if (
      !pending.current ||
      pending.current.body !== draft.trim() ||
      pending.current.thread !== threadId
    )
      pending.current = {
        id: crypto.randomUUID(),
        body: draft.trim(),
        thread: threadId,
      };
    if (
      await mutate(
        "/api/hiring-messages",
        { id: pending.current.id, thread_id: threadId, message: draft },
        "POST",
        "Message sent.",
      )
    ) {
      setDraft("");
      pending.current = null;
    }
  }
  async function inviteCandidate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const requestId=invite?.id||invitationId||crypto.randomUUID();
    setInvitationId(requestId);
    const body = {
      id: requestId,
      thread_id: threadId,
      job_id: form.get("job_id"),
      version: invite?.version || 0,
      round: form.get("round"),
      local_time: form.get("local_time"),
      timezone: form.get("timezone"),
      duration_minutes: Number(form.get("duration_minutes")),
      location: form.get("location"),
      notes: form.get("notes"),
    };
    if (
      await mutate(
        "/api/hiring-invitations",
        body,
        "POST",
        "Interview invitation sent for candidate confirmation.",
      )
    ) {
      setInvite(null);
      setInvitationId("");
      setInvitationDirty(false);
    }
  }
  function revise(row:Invitation){if(invitationDirty&&!window.confirm("Discard the unsent invitation draft?"))return;setInvite(row);setInvitationId("");setInvitationDirty(false);}
  async function respond(row: Invitation, status: string) {
    let response = "";
    if (status === "reschedule_requested") {
      const value = window.prompt(
        "Suggest another time, including timezone (up to 1,000 characters).",
      );
      if (value === null) return;
      response = value;
      if (!response.trim()) {
        setError("Suggest a time and timezone.");
        return;
      }
    }
    if (
      status === "accepted" &&
      !window.confirm(
        `Accept ${row.round} at ${new Date(row.starts_at).toLocaleString()} (${row.timezone})? This adds the round to your private interview planner.`,
      )
    )
      return;
    await mutate(
      "/api/hiring-invitations",
      { id: row.id, version: row.version, status, response },
      "PATCH",
      status === "accepted"
        ? "Interview accepted and added to your planner."
        : "Invitation response saved.",
    );
  }
  const input = "mt-1 w-full rounded-lg border bg-background p-2 text-sm";
  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 p-5 sm:p-8">
      <header>
        <h1 className="text-2xl font-bold">Hiring inbox</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Messages, confirmed interview invitations and profile-view notices. No
          email or browser notification permission is required.
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
      <Button
        variant="outline"
        disabled={busy}
        onClick={() => void load().catch((cause) => setError(cause.message))}
      >
        Refresh inbox
      </Button>
      <div className="inbox-grid grid items-start gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
      <section className="inbox-threads rounded-2xl border bg-card p-5">
        <h2 className="font-semibold">Conversations</h2>
        <div className="mt-3 grid gap-2">
          {threads.map((row) => (
            <Button
              key={row.id}
              aria-pressed={threadId === row.id}
              className="inbox-thread w-full justify-start whitespace-normal text-left"
              disabled={busy}
              variant={threadId === row.id ? "default" : "outline"}
              onClick={() => select(row.id)}
            >
              {row.company_name} · {row.participant}
              {row.blocked ? " · Blocked" : ""}
            </Button>
          ))}
        </div>
        {!threads.length && (
          <p className="mt-3 text-sm text-muted-foreground">
            No conversations on this page. Verified recruiters can contact
            applicants or non-anonymous shortlisted profiles.
          </p>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={busy || offset === 0}
            onClick={() => setOffset(Math.max(0, offset - 50))}
          >
            Previous conversations
          </Button>
          <Button
            variant="outline"
            disabled={busy || !more}
            onClick={() => setOffset(offset + 50)}
          >
            More conversations
          </Button>
        </div>
      </section>
      {detail && (
        <section className="inbox-conversation min-w-0 rounded-2xl border bg-card p-5">
          <h2 className="font-semibold">{detail.thread.company_name}</h2>
          {detail.thread.is_candidate && (
            <Button
              className="mt-3"
              disabled={busy}
              variant="outline"
              onClick={() =>
                void mutate(
                  "/api/hiring-messages",
                  { thread_id: threadId, blocked: !detail.thread.blocked },
                  "PATCH",
                  detail.thread.blocked
                    ? "Contact unblocked."
                    : "Contact blocked. Conversation history remains in your account.",
                )
              }
            >
              {detail.thread.blocked
                ? "Unblock company contact"
                : "Block company contact"}
            </Button>
          )}
          <div className="inbox-message-list mt-4 max-h-[28rem] space-y-3 overflow-y-auto">
            {[...detail.messages].reverse().map((row) => (
              <article key={row.id} data-mine={row.mine} className="inbox-message rounded-xl border p-3">
                <p className="text-xs text-muted-foreground">
                  {row.mine
                    ? "You"
                    : detail.thread.is_candidate
                      ? "Verified recruiter"
                      : "Candidate"}{" "}
                  · {new Date(row.created_at).toLocaleString()}
                </p>
                <p className="mt-1 whitespace-pre-wrap break-words text-sm">
                  {row.body}
                </p>
              </article>
            ))}
            {!detail.messages.length && (
              <p className="text-sm">No messages on this page.</p>
            )}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              variant="outline"
              disabled={busy || messageOffset === 0}
              onClick={() => setMessageOffset(Math.max(0, messageOffset - 50))}
            >
              Newer messages
            </Button>
            <Button
              variant="outline"
              disabled={busy || !detail.has_more}
              onClick={() => setMessageOffset(messageOffset + 50)}
            >
              Older messages
            </Button>
          </div>
          <form className="mt-4 space-y-3" onSubmit={send}>
            <label className="block text-sm">
              Message
              <textarea
                disabled={busy || !detail.thread.can_send}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                maxLength={4000}
                rows={3}
                className={input}
              />
            </label>
            <Button
              type="submit"
              disabled={busy || !detail.thread.can_send || !draft.trim()}
            >
              Send message
            </Button>
            {!detail.thread.can_send && (
              <p className="text-sm text-muted-foreground">
                Contact is blocked or hiring consent/company eligibility
                changed. History remains available to the candidate.
              </p>
            )}
          </form>
          <h3 className="mt-6 font-semibold">Interview invitations</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Latest 50 invitations. Accepting creates a private planner round;
            requesting a reschedule proposes a time and requires a new recruiter
            invitation.
          </p>
          {detail.invitations.map(row=><InvitationCard key={row.id} row={row} candidate={detail.thread.is_candidate} disabled={busy||!detail.thread.can_send} onRespond={respond} onRevise={revise}/>)}
          {detail.thread.is_candidate ? (
            <Link
              href="/applications"
              className="mt-4 inline-block text-sm underline"
            >
              Open your private interview planner
            </Link>
          ) : (
            <form
              key={invite?.id || "new"}
              onSubmit={inviteCandidate}
              onChange={()=>setInvitationDirty(true)}
              className="mt-5 rounded-xl border p-4"
            >
              <h4 className="font-semibold">
                {invite
                  ? "Revise interview time"
                  : "Invite candidate to interview"}
              </h4>
              <fieldset
                disabled={busy || !detail.thread.can_send}
                className="mt-3 space-y-3"
              >
                <label className="block text-sm">
                  Published job
                  <select
                    required
                    name="job_id"
                    defaultValue={invite?.job_id || ""}
                    className={input}
                  >
                    <option value="">Choose your published job</option>
                    {jobs.map((job) => (
                      <option key={job.id} value={job.id}>
                        {job.title}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm">
                  Round
                  <input
                    required
                    name="round"
                    maxLength={120}
                    defaultValue={invite?.round || ""}
                    className={input}
                  />
                </label>
                <label className="block text-sm">
                  Local date and time
                  <input
                    required
                    name="local_time"
                    type="datetime-local"
                    className={input}
                  />
                </label>
                <label className="block text-sm">
                  Timezone
                  <input
                    required
                    name="timezone"
                    defaultValue={
                      invite?.timezone ||
                      Intl.DateTimeFormat().resolvedOptions().timeZone
                    }
                    maxLength={100}
                    className={input}
                  />
                </label>
                <label className="block text-sm">
                  Duration (minutes)
                  <input
                    required
                    name="duration_minutes"
                    type="number"
                    min={5}
                    max={480}
                    defaultValue={invite?.duration_minutes || 30}
                    className={input}
                  />
                </label>
                <label className="block text-sm">
                  Venue or meeting link
                  <input
                    name="location"
                    maxLength={1000}
                    defaultValue={invite?.location || ""}
                    className={input}
                  />
                </label>
                <label className="block text-sm">
                  Candidate-visible notes
                  <textarea
                    name="notes"
                    maxLength={2000}
                    defaultValue={invite?.notes || ""}
                    className={input}
                  />
                </label>
                <Button type="submit">Send invitation for confirmation</Button>
                {invite && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {if(!invitationDirty||window.confirm("Discard the unsent invitation draft?")){setInvite(null);setInvitationDirty(false);setInvitationId("");}}}
                  >
                    Start new invitation
                  </Button>
                )}
              </fieldset>
            </form>
          )}
        </section>
      )}
      {!detail ? <section className="inbox-conversation surface min-w-0 p-8"><p className="section-label">YOUR CONVERSATIONS</p><h2 className="mt-3 text-xl font-semibold">Keep the next step in view.</h2><p className="mt-3 text-sm leading-6 text-muted-foreground">Choose a conversation to read messages and interview invitations. Your message is sent only when you select Send.</p></section> : null}
      </div>
      <section className="rounded-2xl border bg-background p-5">
        <h2 className="font-semibold">Notifications</h2>
        <div className="mt-3 space-y-2">
          {notices.map((row) => (
            <article key={row.id} className="rounded-lg border p-3 text-sm">
              <p>
                {row.company_name} · {row.kind.replaceAll("_", " ")} ·{" "}
                {new Date(row.created_at).toLocaleString()}
                {!row.read_at ? " · New" : ""}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {row.thread_id && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => select(row.thread_id!)}
                  >
                    Open conversation
                  </Button>
                )}
                {!row.read_at && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() =>
                      void mutate(
                        "/api/hiring-notifications",
                        { id: row.id },
                        "PATCH",
                      )
                    }
                  >
                    Mark read
                  </Button>
                )}
              </div>
            </article>
          ))}
          {!notices.length && (
            <p className="text-sm text-muted-foreground">
              No hiring notices on this page. Repeated profile/resume views are
              grouped once per company per UTC day.
            </p>
          )}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={busy || noticeOffset === 0}
            onClick={() => setNoticeOffset(Math.max(0, noticeOffset - 50))}
          >
            Earlier page
          </Button>
          <Button
            variant="outline"
            disabled={busy || !moreNotices}
            onClick={() => setNoticeOffset(noticeOffset + 50)}
          >
            More notices
          </Button>
        </div>
      </section>
    </div>
  );
}
export default function InboxPage() {
  return (
    <Suspense
      fallback={
        <p className="p-5" role="status">
          Loading hiring inbox…
        </p>
      }
    >
      <Inbox />
    </Suspense>
  );
}
