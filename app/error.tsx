"use client";
import Link from "next/link";
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto max-w-xl px-5 py-20" role="alert">
      <h1 className="text-2xl font-bold">This page could not load</h1>
      <p className="mt-3">
        Please retry. If the problem continues, contact support through Help.
      </p>
      {error.digest && (
        <p className="mt-3 text-sm">Support reference: {error.digest}</p>
      )}
      <div className="mt-6 flex flex-wrap gap-4">
        <button onClick={reset} className="rounded-lg border px-4 py-2">
          Try again
        </button>
        <Link href="/help" className="underline">
          Help & support
        </Link>
        <Link href="/" className="underline">
          Home
        </Link>
      </div>
    </main>
  );
}
