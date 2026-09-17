"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { pageGuide, searchGoals } from "@/lib/page-guide";

export function PageGuide() {
  const pathname = usePathname();
  return <RouteGuide key={pathname} pathname={pathname} />;
}

function RouteGuide({ pathname }: { pathname: string }) {
  const guide = pageGuide(pathname);
  const [goal, setGoal] = useState<number | null>(null);
  const selected = goal === null ? null : searchGoals[goal];
  return <details className="mx-4 mt-4 rounded-xl border bg-background sm:mx-6 lg:mx-8">
    <summary className="min-h-11 cursor-pointer px-4 py-3 text-sm font-semibold">Need a hand? Choose your next step</summary>
    <div className="space-y-4 border-t p-4">
      <div><h2 className="font-semibold">{guide.title}</h2><p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">{guide.text}</p><Link href={guide.href} className="mt-2 inline-flex min-h-11 items-center text-sm font-semibold text-primary underline">{guide.action} →</Link></div>
      <fieldset><legend className="text-sm font-semibold">What would you like to work on?</legend><div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{searchGoals.map((item, index) => <button key={item.href} type="button" aria-pressed={goal === index} onClick={() => setGoal(index)} className={`min-h-11 rounded-xl border px-3 py-3 text-left text-sm font-medium hover:bg-muted focus-visible:outline-2 focus-visible:outline-primary ${goal === index ? "border-primary bg-primary/5 text-primary" : ""}`}>{item.title}</button>)}</div></fieldset>
      <div aria-live="polite" aria-atomic="true">{selected ? <div className="rounded-xl bg-muted/40 p-3"><p className="text-sm">{selected.text}</p><Link href={selected.href} className="mt-2 inline-flex min-h-11 items-center text-sm font-semibold text-primary underline">{selected.action} →</Link></div> : <p className="text-xs text-muted-foreground">Choose a goal for a shortcut. This won’t change your saved preferences or leave this page until you follow a link.</p>}</div>
    </div>
  </details>;
}
