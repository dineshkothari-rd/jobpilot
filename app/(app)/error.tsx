"use client";

import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="grid min-h-full place-items-center px-4 py-12">
      <section className="surface w-full max-w-lg p-7 text-center" role="alert">
        <h1 className="text-xl font-bold">This workspace hit a problem</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Your data was not changed. Retry this view, or use the navigation to continue elsewhere.
        </p>
        <Button className="mt-6" onClick={reset}><RotateCcw />Try again</Button>
      </section>
    </main>
  );
}
