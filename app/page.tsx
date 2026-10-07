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
    <main className="min-h-screen bg-background">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-6 py-8">
        <header className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <Image
                src="/brand/jobpilot-mark.png"
                width={44}
                height={44}
                alt=""
                priority
              />
              <h1 className="text-2xl font-bold tracking-tight">JobPilot</h1>
            </div>
            <p className="text-sm text-muted-foreground">
              AI-powered job search assistant
            </p>
          </div>

          <Link href="/dashboard" className={buttonVariants()}>
            Get Started
          </Link>
        </header>

        <section className="flex flex-1 items-center justify-center py-20">
          <div className="max-w-2xl text-center">
            <p className="mb-4 text-sm font-medium text-muted-foreground">
              FIND YOUR NEXT OPPORTUNITY
            </p>

            <h2 className="text-4xl font-bold tracking-tight sm:text-6xl">
              Your next career move,
              <br />
              <span className="text-muted-foreground">all in one place.</span>
            </h2>

            <p className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground">
              Upload your resume, discover relevant jobs, understand your match
              score, and manage your applications from one place.
            </p>

            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link
                href="/dashboard"
                className={buttonVariants({ size: "lg" })}
              >
                Upload Resume
              </Link>

              <Link
                href="/opportunities"
                className={buttonVariants({ size: "lg", variant: "outline" })}
              >
                Explore Jobs
              </Link>
            </div>
          </div>
        </section>
        <section
          aria-label="Candidate and employer tools"
          className="grid gap-5 border-t py-8 sm:grid-cols-2"
        >
          <div>
            <h2 className="text-xl font-semibold">For candidates</h2>
            <p className="mt-3 text-muted-foreground">
              Browse jobs, save searches, match your resume, prepare
              applications and track interviews. You confirm before any JobPilot
              application is submitted.
            </p>
          </div>
          <div>
            <h2 className="text-xl font-semibold">For employers</h2>
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
          <span>Free first launch · No payment required</span>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/help">Help & support</Link>
        </footer>
      </div>
    </main>
  );
}
