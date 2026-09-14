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
    <div className="flex h-screen overflow-hidden bg-muted/30">
      <AppSidebar />

      <main className="min-w-0 flex-1 overflow-y-auto pb-24 md:pb-0">
        {children}
      </main>
    </div>
  );
}
