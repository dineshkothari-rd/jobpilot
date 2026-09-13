import { buttonVariants } from "@/components/ui/button";
import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-6 py-8">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">JobPilot</h1>
            <p className="text-sm text-muted-foreground">
              AI-powered job search assistant
            </p>
          </div>

          <Link href="/dashboard" className={buttonVariants()}>Get Started</Link>
        </header>

        <section className="flex flex-1 items-center justify-center py-20">
          <div className="max-w-2xl text-center">
            <p className="mb-4 text-sm font-medium text-muted-foreground">
              FIND YOUR NEXT OPPORTUNITY
            </p>

            <h2 className="text-4xl font-bold tracking-tight sm:text-6xl">
              Your next job search,
              <br />
              <span className="text-muted-foreground">on autopilot.</span>
            </h2>

            <p className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground">
              Upload your resume, discover relevant jobs, understand your match
              score, and manage your applications from one place.
            </p>

            <div className="mt-8 flex justify-center gap-3">
              <Link href="/dashboard" className={buttonVariants({ size: "lg" })}>Upload Resume</Link>

              <Link href="/jobs" className={buttonVariants({ size: "lg", variant: "outline" })}>Explore Jobs</Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
