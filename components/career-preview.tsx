"use client";

import { CareerScene } from "@/components/career-scene";
import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, FileText, CalendarDays, Search } from "lucide-react";

const steps = [
  { title: "Your resume", icon: FileText, heading: "Start with your story.", text: "Bring your experience, projects and skills together. Your resume stays private until you choose to share it.", action: "Add your resume", href: "/auth/login?next=/resume", items: ["Experience and projects", "Skills you want to use", "Your preferred next step"] },
  { title: "Your next role", icon: Search, heading: "Find a role worth your time.", text: "Explore openings, compare the fit and save the ones you care about. You decide which applications to send.", action: "Explore openings", href: "/opportunities", items: ["Location and work preferences", "Resume and role comparison", "Saved jobs in one place"] },
  { title: "Your progress", icon: CalendarDays, heading: "Know what comes next.", text: "Keep applications, interview preparation and follow-ups together, so the next step feels manageable.", action: "Open your workspace", href: "/dashboard", items: ["Application activity", "Interview preparation", "Follow-ups and reminders"] },
];

export function CareerPreview() {
  const [selected, setSelected] = useState(0);
  const step = steps[selected];
  const Icon = step.icon;
  return <section aria-label="Interactive product preview" className="career-preview relative rounded-3xl border bg-card p-5 shadow-xl sm:p-7">
    <div className="mb-6 flex items-center justify-between gap-3"><span className="text-sm font-semibold">A little less job-search chaos.</span><span className="rounded-full bg-secondary px-3 py-1 text-xs text-muted-foreground">Product preview</span></div>
    <div role="group" aria-label="Explore your job search steps" className="mb-6 grid grid-cols-3 gap-2">{steps.map((item, index) => <button type="button" key={item.title} aria-pressed={selected === index} onClick={() => setSelected(index)} className="career-step min-h-12 rounded-xl border px-2 py-3 text-xs font-semibold sm:text-sm"><span className="mb-1 block text-xs opacity-70">0{index + 1}</span>{item.title}</button>)}</div>
    <div className="landing-art"><CareerScene /></div>
    <div aria-live="polite" aria-atomic="true" className="min-h-80"><div key={selected} className="career-response"><span className="mb-5 grid size-14 place-items-center rounded-2xl bg-accent text-primary"><Icon aria-hidden="true" className="size-7" /></span><h3 className="text-2xl font-semibold tracking-tight">{step.heading}</h3><p className="mt-3 text-sm leading-6 text-muted-foreground">{step.text}</p><ul className="my-5 space-y-3">{step.items.map(item => <li key={item} className="flex items-center gap-3 text-sm"><Check aria-hidden="true" className="size-4 shrink-0 text-primary" />{item}</li>)}</ul><Link href={step.href} className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary">{step.action}<ArrowRight aria-hidden="true" className="size-4" /></Link></div></div>
    <p className="border-t pt-4 text-xs leading-5 text-muted-foreground">Explore the steps above. This preview contains no personal data or sample job offers.</p>
  </section>;
}
