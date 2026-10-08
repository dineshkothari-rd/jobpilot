import Image from "next/image";
import Link from "next/link";
export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="public-shell min-h-screen bg-background">
      <a
        href="#public-content"
        className="sr-only focus:not-sr-only focus:fixed focus:z-50 focus:bg-background focus:p-3"
      >
        Skip to content
      </a>
      <header className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-5 py-5">
        <Link href="/" className="flex items-center gap-2 font-bold">
          <Image src="/brand/jobpilot-mark.png" width={36} height={36} alt="" />
          JobPilot
        </Link>
        <nav
          aria-label="Public navigation"
          className="flex flex-wrap gap-4 text-sm"
        >
          <Link href="/opportunities">Browse jobs</Link>
          <Link href="/plans">Plans</Link>
          <Link href="/help">Help</Link>
          <Link href="/auth/login">Sign in</Link>
        </nav>
      </header>
      <main id="public-content" className="mx-auto max-w-5xl px-5 py-8">
        {children}
      </main>
      <footer className="mx-auto flex max-w-5xl flex-wrap gap-5 border-t px-5 py-6 text-sm">
        <Link href="/privacy">Privacy</Link>
        <Link href="/terms">Terms</Link>
        <Link href="/help">Help & support</Link>
        <span>Basic tools + optional paid plans</span>
      </footer>
    </div>
  );
}
