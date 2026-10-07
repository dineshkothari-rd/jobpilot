import Link from "next/link";
export default function NotFound() {
  return (
    <main className="mx-auto max-w-xl px-5 py-20">
      <h1 className="text-2xl font-bold">Page or listing unavailable</h1>
      <p className="mt-3">
        The link may be incorrect, or this listing is no longer available.
      </p>
      <Link href="/opportunities" className="mt-6 inline-block underline">
        Browse current jobs
      </Link>
    </main>
  );
}
