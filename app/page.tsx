import { CareerPreview } from "@/components/career-preview";
import { ArrowRight, Compass, BriefcaseBusiness, ShieldCheck } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ code?: string; error?: string }>;
}) {
  const { code, error } = await searchParams;

  if (code) redirect(`/auth/callback?code=${encodeURIComponent(code)}`);
  if (error) redirect(`/auth/callback?error=${encodeURIComponent(error)}`);

  return (
    <main className="landing-page min-h-screen bg-background">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-6 py-8">
        <header className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <Image
                src="/brand/parth-careers.svg"
                width={44}
                height={44}
                alt=""
                priority
              />
              <h1 className="text-2xl font-bold tracking-tight">Parth Careers</h1>
            </div>
            <p className="text-sm text-muted-foreground">
              AI-powered job search assistant
            </p>
          </div>

          <nav aria-label="Main navigation" className="flex items-center gap-4"><Link href="/plans" className="inline-flex min-h-11 items-center text-sm font-medium">Plans</Link><Link href="/dashboard" className={buttonVariants()}>
            Get started
          </Link></nav>
        </header>

        <section className="grid flex-1 items-center gap-12 py-16 lg:grid-cols-2 lg:gap-16 lg:py-24">
          <div className="animate-float-in">
            <p className="mb-6 inline-flex items-center gap-2 rounded-full border bg-card px-4 py-2 text-xs font-semibold text-primary"><Compass aria-hidden="true" className="size-4" /> YOUR NEXT CHAPTER STARTS HERE</p>
            <h2 className="text-4xl font-bold leading-tight tracking-tight sm:text-6xl">Big ambitions.<br /><span className="text-primary">Clear next steps.</span></h2>
            <p className="mt-6 max-w-xl text-lg leading-8 text-muted-foreground">A job search has enough moving parts. Bring your resume, opportunities and applications together—and make your next move with confidence.</p>
            <div className="mt-8 flex flex-wrap gap-3"><Link href="/auth/login?next=/resume" className={buttonVariants({ size: "lg" })}>Start with your resume<ArrowRight aria-hidden="true" className="size-4" /></Link><Link href="/opportunities" className={buttonVariants({ size: "lg", variant: "outline" })}>Explore jobs</Link></div>
            <p className="mt-5 text-sm text-muted-foreground">Start with basic tools. Choose a paid plan when it fits your needs.</p>
            <p className="mt-6 flex items-center gap-2 text-sm text-muted-foreground"><ShieldCheck aria-hidden="true" className="size-4 shrink-0 text-primary" /> You confirm before an application is submitted.</p>
          </div>
          <CareerPreview />
        </section>
        <section
          aria-label="Candidate and employer tools"
          className="grid gap-5 pb-10 sm:grid-cols-2"
        >
          <div className="interactive-card rounded-2xl border bg-card p-6">
            <Compass aria-hidden="true" className="mb-3 size-6 text-primary" /><h2 className="text-xl font-semibold">Your search, at your pace.</h2>
            <p className="mt-3 text-muted-foreground">
              Browse jobs, save searches, match your resume, prepare
              applications and track interviews. You confirm before any Parth Careers
              application is submitted.
            </p>
          </div>
          <div className="interactive-card rounded-2xl border bg-card p-6">
            <BriefcaseBusiness aria-hidden="true" className="mb-3 size-6 text-primary" /><h2 className="text-xl font-semibold">Build your next great team.</h2>
            <p className="mt-3 text-muted-foreground">
              Verify your company, publish openings, review applicants and
              invite candidates to interviews.
            </p>
            <Link
              href="/auth/login?next=/recruiter"
              className="mt-3 inline-block underline"
            >
              Start hiring
            </Link>
          </div>
        </section>
        <footer className="flex flex-wrap gap-5 border-t py-6 text-sm">
          <span>Parth Careers · Your next step, together.</span>
          <Link href="/plans">Plans & pricing</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/help">Help & support</Link>
        </footer>
      </div>
    </main>
  );
}
