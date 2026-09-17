"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ArrowRight, BookOpen, BriefcaseBusiness, Check, ChevronDown, FileText, MessageSquareText, Sparkles } from "lucide-react";
import { pageGuide, searchGoals } from "@/lib/page-guide";

const goalIcons = [BriefcaseBusiness, FileText, BookOpen, MessageSquareText];

export function PageGuide({ home = false }: { home?: boolean }) {
  const pathname = usePathname();
  if (pathname === "/dashboard" && !home) return null;
  return <RouteGuide key={pathname} pathname={pathname} home={home} />;
}

function RouteGuide({ pathname, home }: { pathname: string; home: boolean }) {
  const guide = pageGuide(pathname);
  const [open, setOpen] = useState(false);
  const [goal, setGoal] = useState<number | null>(null);
  const selected = goal === null ? null : searchGoals[goal];
  return <details open={open} onToggle={event => setOpen(event.currentTarget.open)} data-section={pathname.split("/")[1]} className={`page-guide ${home ? "mt-6" : "mx-4 mt-2 sm:mx-6 lg:mx-8"}`}>
    <summary className="flex min-h-11 cursor-pointer items-center gap-2 py-2 text-xs font-semibold text-muted-foreground"><Sparkles aria-hidden="true" className="size-3.5 text-primary" /><span className="flex-1">{home ? "Want to work on something else?" : "Help with this page"}</span><span aria-hidden="true" className="guide-chevron shrink-0"><ChevronDown className="size-4" /></span></summary>
    <div className="space-y-4 border-t p-4">
      {!home ? <div><h2 className="font-semibold">{guide.title}</h2><p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">{guide.text}</p><Link href={guide.href} className="mt-2 inline-flex min-h-11 items-center text-sm font-semibold text-primary underline">{guide.action} →</Link></div> : null}
      <fieldset><legend className="text-sm font-semibold">Choose what you want to work on</legend><div className="mt-3 grid gap-2 grid-cols-2 lg:grid-cols-4">{searchGoals.map((item, index) => {
        const Icon = goalIcons[index];
        return <button key={item.href} type="button" data-goal={index} aria-pressed={goal === index} onClick={() => setGoal(index)} className="goal-card relative flex min-h-16 items-center gap-2 rounded-xl border px-3 py-3 pr-7 text-left text-xs font-semibold"><span className="goal-icon grid size-7 shrink-0 place-items-center rounded-lg"><Icon aria-hidden="true" className="size-3.5" /></span><span>{item.title}</span>{goal === index ? <Check aria-hidden="true" className="absolute right-2 top-3 size-3.5" /> : null}</button>;
      })}</div></fieldset>
      <div aria-live="polite" aria-atomic="true">{selected ? <div key={goal} className="goal-response flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4"><p className="text-sm">{selected.text}</p><Link href={selected.href} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground">{selected.action}<ArrowRight aria-hidden="true" className="size-4" /></Link></div> : <p className="text-xs text-muted-foreground">Choose a goal for a shortcut. Your saved preferences stay the same.</p>}</div>
    </div>
  </details>;
}
