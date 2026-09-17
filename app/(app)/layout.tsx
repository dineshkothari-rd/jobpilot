import { AppSidebar } from "@/components/layout/app-sidebar";
import type { Metadata } from "next";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex h-dvh overflow-hidden bg-muted/30">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-xl focus:bg-background focus:p-3 focus:text-primary">Skip to page content</a>
      <AppSidebar />

      <main id="main-content" tabIndex={-1} className="min-w-0 flex-1 overflow-y-auto pb-24 md:pb-0">
        {children}
      </main>
    </div>
  );
}
