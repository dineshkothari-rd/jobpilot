"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

type Recognition = {
  lang: string; continuous: boolean; interimResults: boolean;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null; onend: (() => void) | null; start(): void; abort(): void;
};
type SpeechWindow = Window & { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };

export function VoiceAnswer({ onTranscript, disabled }: { onTranscript: (text: string) => void; disabled: boolean }) {
  const [recording, setRecording] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [audio, setAudio] = useState("");
  const [error, setError] = useState("");
  const recorder = useRef<MediaRecorder | null>(null);
  const recognition = useRef<Recognition | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const url = useRef("");
  const alive = useRef(false);
  const blocked = useRef(disabled);
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      if (timeout.current) clearTimeout(timeout.current);
      recognition.current?.abort();
      if (recorder.current?.state === "recording") recorder.current.stop();
      stream.current?.getTracks().forEach(track => track.stop());
      if (url.current) URL.revokeObjectURL(url.current);
    };
  }, []);
  useEffect(() => {
    blocked.current = disabled;
    if (!disabled) return;
    if (recognition.current) { recognition.current.onresult = null; recognition.current.abort(); }
    if (recorder.current?.state === "recording") recorder.current.stop();
  }, [disabled]);
  const start = async () => {
    if (requesting || recording || disabled) return;
    setError("");
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") { setError("Recording is unavailable in this browser. Type your answer instead."); return; }
    setRequesting(true);
    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!alive.current || blocked.current) { media.getTracks().forEach(t => t.stop()); return; }
      stream.current = media;
      const instance = new MediaRecorder(media); recorder.current = instance;
      const chunks: Blob[] = []; let size = 0;
      instance.ondataavailable = event => { size += event.data.size; if (size <= 20_000_000) chunks.push(event.data); else if (instance.state === "recording") instance.stop(); };
      instance.onstop = () => {
        media.getTracks().forEach(t => t.stop());
        if (timeout.current) clearTimeout(timeout.current);
        if (!alive.current) return;
        if (url.current) URL.revokeObjectURL(url.current);
        url.current = URL.createObjectURL(new Blob(chunks, { type: instance.mimeType }));
        setAudio(url.current); setRecording(false);
      };
      instance.onerror = () => { media.getTracks().forEach(t => t.stop()); if (alive.current) { setRecording(false); setError("Recording failed. Your typed answer is unchanged."); } };
      instance.start(1000); setRecording(true);
      timeout.current = setTimeout(() => { if (instance.state === "recording") instance.stop(); }, 300000);
    } catch { stream.current?.getTracks().forEach(t => t.stop()); if (alive.current) setError("Microphone access was not available. You can still type your answer."); }
    finally { if (alive.current) setRequesting(false); }
  };
  const transcribe = () => {
    setError("");
    const Constructor = (window as SpeechWindow).SpeechRecognition || (window as SpeechWindow).webkitSpeechRecognition;
    if (!Constructor) { setError("Speech transcription is unsupported here. Type your answer or use local recording."); return; }
    const instance = new Constructor(); recognition.current = instance;
    instance.lang = "en-IN"; instance.continuous = false; instance.interimResults = false;
    instance.onresult = event => { if (alive.current) onTranscript(Array.from(event.results).map(r => r[0]?.transcript || "").join(" ")); };
    instance.onerror = () => { if (alive.current) setError("Transcription failed. Your typed answer is unchanged."); };
    instance.onend = () => { if (alive.current) setTranscribing(false); };
    try { instance.start(); setTranscribing(true); } catch { setError("Could not start speech transcription. Type instead."); }
  };
  return <details className="mt-4 rounded-xl border p-4">
    <summary className="cursor-pointer text-sm font-semibold">Optional voice practice</summary>
    <p className="mt-3 text-xs leading-5 text-muted-foreground">Local recordings stay on this page, are never uploaded and disappear when you leave the question. Recording stops after 5 minutes. Save a typed answer for your review.</p>
    <div className="mt-3 flex flex-wrap gap-2">
      <Button variant="outline" disabled={disabled || requesting || transcribing} onClick={() => recording ? recorder.current?.stop() : void start()}>{requesting ? "Requesting microphone…" : recording ? "Stop recording" : "Record locally"}</Button>
      <Button variant="outline" disabled={disabled || recording || requesting} onClick={() => transcribing ? recognition.current?.abort() : transcribe()}>{transcribing ? "Stop transcription" : "Start browser transcription"}</Button>
    </div>
    <p className="mt-2 text-xs leading-5 text-muted-foreground">Transcription is optional and browser-dependent. Your browser may send audio to its external speech service; JobPilot cannot guarantee it is processed locally. Starting transcription requests microphone access.</p>
    {audio && <audio controls src={audio} className="mt-3 max-w-full" aria-label="Your local practice recording" />}
    {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
    {(recording || transcribing) && <p role="status" className="mt-2 text-xs">Microphone active. Stop it before saving or switching questions.</p>}
  </details>;
}
