"use client";

import { useEffect, useRef, useState } from "react";
import Script from "next/script";
import { Button } from "@/components/ui/button";
import type { Lesson } from "@/lib/learning/catalog";
import { playbackSeconds, studioVideoUrl, timestamp, type StudioLesson } from "@/lib/learning/studio";

export function LessonReader({ content, lessonKey }: { content: StudioLesson; lessonKey: string }) {
  const [size, setSize] = useState(18);
  const [dark, setDark] = useState(false);
  const [answer, setAnswer] = useState(false);
  const [copied, setCopied] = useState("");
  const [example, setExample] = useState(content.example);
  const reader = useRef<HTMLDivElement>(null);
  const storageKey = `jobpilot:reader:v1:${lessonKey}`;
  useEffect(() => {
    try {
      const ratio = Number(sessionStorage.getItem(storageKey));
      const node = reader.current;
      if (node && Number.isFinite(ratio) && ratio > 0 && ratio <= 1) node.scrollTop = ratio * (node.scrollHeight - node.clientHeight);
    } catch { /* Browser storage is optional; lesson content remains usable. */ }
  }, [storageKey]);

  return <div className="mt-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm font-semibold">Read here · Original Parth Careers mini-lesson</p><div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" aria-label="Decrease reading text size" disabled={size <= 16} onClick={() => setSize(size - 2)}>A−</Button><Button variant="outline" size="sm" aria-label="Increase reading text size" disabled={size >= 24} onClick={() => setSize(size + 2)}>A+</Button><Button variant="outline" size="sm" aria-pressed={dark} onClick={() => setDark(!dark)}>{dark ? "Light reader" : "Dark reader"}</Button></div></div>
    <p className="mt-2 text-xs leading-5 text-muted-foreground">No external page needed. Reading position stays in this browser tab; notes and exercises save to your account separately.</p>
    <div ref={reader} tabIndex={0} role="region" aria-label="Original lesson reading area" style={{ fontSize: size }} onScroll={(event) => {
      const node = event.currentTarget;
      try { sessionStorage.setItem(storageKey, String(node.scrollTop / Math.max(1, node.scrollHeight - node.clientHeight))); } catch { /* Storage can be blocked. */ }
    }} className={`mt-4 max-h-[70vh] overflow-y-auto rounded-2xl border p-5 leading-relaxed sm:p-7 ${dark ? "border-slate-700 bg-slate-950 text-slate-100" : "bg-background text-foreground"}`}>
      <article className="mx-auto max-w-prose space-y-6">
        <section><h3 className="font-bold">What you will be able to do</h3><p className="mt-2">{content.outcome}</p></section>
        <section><h3 className="font-bold">Understand the idea</h3>{content.explanation.map((paragraph) => <p key={paragraph} className="mt-3">{paragraph}</p>)}</section>
        <section><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-bold">Work through an example</h3><Button variant="outline" size="sm" onClick={async () => {
          try { await navigator.clipboard.writeText(example); setCopied("Example copied."); } catch { setCopied("Select the example and copy it manually."); }
        }}>Copy example</Button></div><pre tabIndex={0} aria-label="Illustrative code example" className="mt-3 overflow-x-auto rounded-xl border border-slate-700 bg-slate-950 p-4 text-sm leading-6 text-slate-100"><code>{example}</code></pre><p role="status" className="text-sm">{copied}</p><details className="mt-3"><summary className="cursor-pointer text-sm font-semibold">Edit a temporary scratch example</summary><label className="mt-3 block text-sm">Scratch example<textarea rows={6} maxLength={10000} value={example} onChange={(event) => { setExample(event.target.value); setCopied(""); }} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 p-3 font-mono text-sm text-slate-100" /></label><Button variant="outline" size="sm" className="mt-2" onClick={() => setExample(content.example)}>Reset example</Button><p className="mt-2 text-sm">Temporary only: copy your work before switching formats or lessons. Scratch edits are not saved or executed.</p></details><p className="mt-3">{content.walkthrough}</p><p className="mt-2 text-sm">Illustrative example only. Parth Careers does not execute this code or submit database queries.</p></section>
        <section><h3 className="font-bold">A mistake to avoid</h3><p className="mt-2">{content.mistake}</p></section>
        <section><h3 className="font-bold">Pause and explain</h3><p className="mt-2">{content.reflection}</p><Button variant="outline" className="mt-3" aria-expanded={answer} onClick={() => setAnswer(!answer)}>{answer ? "Hide explanation" : "Compare your reasoning"}</Button>{answer ? <p className="mt-3 rounded-xl border p-4">{content.answer}</p> : null}<p className="mt-3 text-sm">This reflection is not graded and does not change your completion score.</p></section>
        <section><h3 className="font-bold">Take it into your exercise</h3><p className="mt-2">Explain the outcome in your own words, adapt the example to fictional data, then use the practice checklist and notes below. Reading alone does not mark the exercise complete.</p></section>
      </article>
    </div>
  </div>;
}

type Player = { getCurrentTime: () => number; getPlayerState: () => number; seekTo: (seconds: number, allowSeekAhead: boolean) => void; destroy: () => void };
type YoutubeWindow = Window & {
  YT?: { Player: new (element: HTMLIFrameElement, options: { events: { onReady: () => void; onStateChange: () => void; onError: () => void } }) => Player };
  onYouTubeIframeAPIReady?: () => void;
};

export function LessonVideo({ lesson, lessonKey, canNote, addNote, readInstead }: { lesson: Lesson; lessonKey: string; canNote: boolean; addNote: (text: string) => void; readInstead: () => void }) {
  const container = useRef<HTMLDivElement>(null);
  const player = useRef<Player | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [resumeAt, setResumeAt] = useState(0);
  const storageKey = `jobpilot:video:v1:${lessonKey}`;

  useEffect(() => {
    const host = window as YoutubeWindow;
    const node = container.current;
    if (!node || !lesson.embedUrl) return;
    let active = true;
    let initialized = false;
    const remember = () => {
      if (!player.current) return;
      try {
        const seconds = playbackSeconds(player.current.getCurrentTime());
        // Opening and closing a cued player must not erase an existing resume point.
        if (seconds > 0) sessionStorage.setItem(storageKey, String(seconds));
      } catch { /* Resume is optional. */ }
    };
    const initialize = () => {
      if (!active || initialized || !host.YT?.Player) return;
      initialized = true;
      try {
        const iframe = document.createElement("iframe");
        iframe.src = studioVideoUrl(lesson.embedUrl!, window.location.origin);
        iframe.title = lesson.title;
        iframe.className = "h-full min-h-[202px] w-full rounded-xl border";
        iframe.allow = "encrypted-media; picture-in-picture; fullscreen";
        iframe.allowFullscreen = true;
        iframe.referrerPolicy = "strict-origin-when-cross-origin";
        node.replaceChildren(iframe);
        player.current = new host.YT.Player(iframe, { events: {
          onReady: () => {
            if (!active) return;
            clearTimeout(timeout); setReady(true); setError("");
            try { setResumeAt(playbackSeconds(Number(sessionStorage.getItem(storageKey)))); } catch { /* Storage can be blocked. */ }
          },
          onStateChange: remember,
          onError: () => { if (active) { clearTimeout(timeout); setError("This video cannot play here right now. Continue with the complete in-app reading route."); } },
        } });
      } catch { if (active) setError("Player unavailable. Your in-app lesson is still available."); }
    };
    const previous = host.onYouTubeIframeAPIReady;
    const callback = () => { previous?.(); initialize(); };
    host.onYouTubeIframeAPIReady = callback;
    const timeout = setTimeout(() => { if (active) setError("The player is taking too long to load. Read the lesson here instead, or try video again later."); }, 15000);
    initialize();
    const interval = setInterval(() => { initialize(); if (player.current?.getPlayerState() === 1) remember(); }, 5000);
    return () => {
      active = false; remember(); clearTimeout(timeout); clearInterval(interval);
      if (host.onYouTubeIframeAPIReady === callback) host.onYouTubeIframeAPIReady = previous;
      player.current?.destroy(); player.current = null; node.replaceChildren();
    };
  }, [lesson.embedUrl, lesson.title, storageKey]);

  return <div className="mt-4">
    <Script src="https://www.youtube.com/iframe_api" strategy="afterInteractive" onError={() => setError("The video provider is blocked. Continue with the in-app reading lesson.")} />
    {!ready && !error ? <p role="status" className="mb-3 text-sm">Loading official YouTube player…</p> : null}
    <div ref={container} className="aspect-video min-h-[202px] w-full rounded-xl bg-muted" />
    {error ? <p role="alert" className="mt-3 text-sm leading-6">{error}</p> : null}
    <div className="mt-3 flex flex-wrap gap-2">{ready && resumeAt > 0 ? <Button variant="outline" onClick={() => { player.current?.seekTo(resumeAt, true); setResumeAt(0); }}>Resume at {timestamp(resumeAt)}</Button> : null}<Button variant="outline" disabled={!ready || !canNote} onClick={() => { if (player.current) addNote(`[${timestamp(player.current.getCurrentTime())}] `); }}>Add timestamp to notes</Button><Button variant="outline" onClick={readInstead}>Read here instead</Button></div>
    <p className="mt-3 text-xs leading-5 text-muted-foreground">Official provider controls and captions remain available. Playback position stays in this browser tab, not your account. Watching never marks an exercise complete. YouTube receives player requests only after you choose video.</p>
  </div>;
}
