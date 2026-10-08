"use client";

import Link from "next/link";
import { useState } from "react";
import { searchHelp } from "@/lib/help/content";
import { SupportTickets } from "./support-tickets";

export default function HelpPage() {
  const [query, setQuery] = useState("");
  const articles = searchHelp(query);
  return <main className="public-shell mx-auto min-h-screen w-full max-w-4xl space-y-6 px-5 py-8 sm:px-8">
    <nav className="flex flex-wrap gap-4 text-sm" aria-label="Help navigation"><Link href="/" className="font-semibold">JobPilot</Link><Link href="/dashboard" className="text-primary underline">Dashboard</Link><Link href="/auth/login" className="text-primary underline">Sign in</Link><a href="#support" className="text-primary underline">Contact support</a></nav>
    <header className="surface rounded-3xl p-6 sm:p-8"><p className="eyebrow mb-3">SUPPORT & GUIDES</p><h1 className="text-3xl font-bold">Help centre</h1><p className="mt-2 text-sm text-muted-foreground">Guides for your job search, applications, resume and account.</p></header>
    <label className="block text-sm font-semibold" htmlFor="help-search">Search guides and FAQs</label>
    <input id="help-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Try password reset, interview, salary or delete account" className="w-full rounded-xl border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
    <p role="status" className="text-xs text-muted-foreground">{articles.length} {articles.length === 1 ? "guide" : "guides"} found</p>
    {!articles.length && <p className="rounded-xl border p-4 text-sm">No matching guides. Try fewer words, or contact support below.</p>}
    <div className="space-y-3">{articles.map(article => <details key={article.id} id={article.id} className="surface rounded-2xl p-5">
      <summary className="min-h-11 cursor-pointer text-sm font-semibold"><span className="mb-1 block text-xs font-normal text-muted-foreground">{article.category}</span>{article.title}</summary>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">{article.text}</p>
      <Link href={article.href} className="mt-3 inline-block text-sm font-medium text-primary underline">{article.label}</Link>
    </details>)}</div>
    <p className="text-sm">Cannot sign in, or have a privacy request? Email <a href="mailto:dineshkothari2021@gmail.com" className="underline">dineshkothari2021@gmail.com</a>. Never send passwords or verification codes.</p>
    <SupportTickets />
  </main>;
}
