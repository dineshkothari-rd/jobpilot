"use client";

import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="grid min-h-full place-items-center px-4 py-12">
      <section className="surface w-full max-w-lg p-7 text-center" role="alert">
        <h1 className="text-xl font-bold">This workspace hit a problem</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Retry this view, or use the navigation to continue elsewhere. Check
          the current state before repeating a save.
        </p>
        {error.digest && (
          <p className="mt-3 text-xs">Support reference: {error.digest}</p>
        )}
        <Button className="mt-6" onClick={reset}>
          <RotateCcw />
          Try again
        </Button>
      </section>
    </main>
  );
}
