"use client";

import {
  BriefcaseBusiness,
  BookOpen,
  ChartNoAxesCombined,
  ChevronRight,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquareText,
  Settings2,
  Sparkles,
  UserRound,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useState } from "react";
import { Dialog } from "@base-ui/react/dialog";

const primaryNavigation = [
  {
    name: "Home",
    mobileName: "Home",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    name: "Find jobs",
    mobileName: "Jobs",
    href: "/jobs",
    icon: BriefcaseBusiness,
  },
  {
    name: "Applications",
    mobileName: "Applications",
    href: "/applications",
    icon: FileText,
  },
  { name: "Autopilot", mobileName: "Autopilot", href: "/autopilot", icon: Sparkles },
];

const careerNavigation = [
  { name: "Learn & Certify", href: "/learn", icon: BookOpen },
  { name: "Interview Practice", href: "/practice", icon: MessageSquareText },
  { name: "Saved jobs", href: "/saved-jobs", icon: BriefcaseBusiness },
  {
    name: "Resume",
    href: "/resume",
    icon: FileText,
  },
  {
    name: "Profile",
    href: "/profile",
    icon: UserRound,
  },
  { name: "Career plan", href: "/career", icon: ChartNoAxesCombined },
];

const mobileNavigation = primaryNavigation;
const mobileMoreNavigation = careerNavigation;

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);
  const signOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    await createClient().auth.signOut();
    try {
      // Do not leave private interview drafts behind on a shared browser tab.
      const draftKeys = Array.from({ length: sessionStorage.length }, (_, index) => sessionStorage.key(index));
      draftKeys.forEach(key => { if (key?.startsWith("jobpilot:practice:")) sessionStorage.removeItem(key); });
    } catch { /* Disabled browser storage must not prevent sign-out. */ }
    router.replace("/auth/login");
    router.refresh();
  };

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-[272px] shrink-0 flex-col border-r border-border/70 bg-background/90 backdrop-blur-xl md:flex">
        {/* Brand */}
        <div className="flex h-[72px] shrink-0 items-center border-b border-border/60 px-5">
          <Link
            href="/dashboard"
            className="group flex min-w-0 items-center gap-3 rounded-xl"
          >
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm transition-transform duration-200 group-hover:scale-105">
              <Sparkles className="size-[18px]" />
            </div>

            <div className="min-w-0">
              <p className="truncate text-[15px] font-bold tracking-tight text-foreground">
                JobPilot
              </p>

              <p className="truncate text-[11px] font-medium text-muted-foreground">
                Your job search assistant
              </p>
            </div>
          </Link>
        </div>

        {/* Navigation */}
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-3 py-5">
          <nav aria-label="Main navigation" className="space-y-1">
            <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/70">
              Your job search
            </p>

            {primaryNavigation.map((item) => {
              const active = isActive(item.href);
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={[
                    "group relative flex h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium",
                    "transition-all duration-200",
                    active
                      ? "bg-primary/[0.09] text-primary"
                      : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
                  ].join(" ")}
                >
                  {active && (
                    <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-primary" />
                  )}

                  <Icon
                    className={[
                      "size-[17px] shrink-0 transition-transform duration-200",
                      active
                        ? "text-primary"
                        : "text-muted-foreground group-hover:text-foreground",
                    ].join(" ")}
                  />

                  <span className="truncate">{item.name}</span>

                  {active && (
                    <ChevronRight className="ml-auto size-3.5 opacity-60" />
                  )}
                </Link>
              );
            })}
          </nav>

          <nav aria-label="Your information and tools" className="mt-7 space-y-1">
            <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/70">
              Your information & tools
            </p>

            {careerNavigation.map((item) => {
              const active = isActive(item.href);
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={[
                    "group relative flex h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium",
                    "transition-all duration-200",
                    active
                      ? "bg-primary/[0.09] text-primary"
                      : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
                  ].join(" ")}
                >
                  {active && (
                    <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-primary" />
                  )}

                  <Icon
                    className={[
                      "size-[17px] shrink-0",
                      active
                        ? "text-primary"
                        : "text-muted-foreground group-hover:text-foreground",
                    ].join(" ")}
                  />

                  <span className="truncate">{item.name}</span>

                  {active && (
                    <ChevronRight className="ml-auto size-3.5 opacity-60" />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* AI Career Card */}
          <div className="ai-surface interactive-card mt-auto rounded-2xl border border-primary/10 p-4">
            <div className="mb-3 flex items-center gap-2">
              <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Sparkles className="size-3.5" />
              </div>

              <span className="text-xs font-bold text-foreground">
                One step at a time
              </span>
            </div>

            <p className="text-xs leading-5 text-muted-foreground">
              Find a role, build a skill or practise an answer. Open the guide at the top of any page when you need a hand.
            </p>

            <Link
              href="/dashboard"
              className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
            >
              Go to your next step
              <ChevronRight className="size-3" />
            </Link>
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-border/60 p-3">
          <div className="flex items-center justify-between rounded-xl px-3 py-2.5">
            <div className="flex items-center gap-2.5">
              <div className="flex size-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <Settings2 className="size-4" />
              </div>

              <div>
                <p className="text-xs font-semibold text-foreground">
                  JobPilot
                </p>

                <p className="text-[10px] text-muted-foreground">
                  Your career, at your pace
                </p>
              </div>
            </div>

            <span className="rounded-full border border-border bg-muted/50 px-2 py-0.5 text-[9px] font-semibold text-muted-foreground">
              Free
            </span>
          </div>
          <button
            type="button"
            onClick={() => void signOut()}
            disabled={signingOut}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-60"
          >
            <LogOut className="size-3.5" />
            {signingOut ? "Signing out..." : "Sign out"}
          </button>
        </div>
      </aside>

      {/* Mobile Bottom Navigation */}
      <Dialog.Root open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-[2px] md:hidden" />
          <Dialog.Popup
            id="mobile-more-navigation"
            className="fixed inset-x-3 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-50 rounded-2xl border bg-background p-3 shadow-2xl md:hidden"
          >
            <div className="flex items-center justify-between px-2 pb-2">
              <Dialog.Title className="text-sm font-bold">Your information & tools</Dialog.Title>
              <button
                type="button"
                aria-label="Close navigation menu"
                onClick={() => setMobileMenuOpen(false)}
                className="flex size-11 items-center justify-center rounded-xl hover:bg-muted"
              >
                <X className="size-4" />
              </button>
            </div>
            <Dialog.Description className="px-2 pb-3 text-xs text-muted-foreground">Manage your resume, profile and saved jobs, or explore your career plan.</Dialog.Description>
            <div className="grid grid-cols-2 gap-2">
              {mobileMoreNavigation.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={isActive(item.href) ? "page" : undefined}
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex min-h-12 items-center gap-3 rounded-xl border px-3 text-sm font-semibold hover:bg-muted"
                  >
                    <Icon className="size-4 text-primary" />
                    {item.name}
                  </Link>
                );
              })}
              <button
                type="button"
                onClick={() => void signOut()}
                disabled={signingOut}
                className="flex min-h-12 items-center gap-3 rounded-xl border px-3 text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-60"
              >
                <LogOut className="size-4" />
                {signingOut ? "Signing out…" : "Sign out"}
              </button>
            </div>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
      <nav aria-label="Mobile navigation" className="fixed inset-x-0 bottom-0 z-30 border-t border-border/70 bg-background/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-8px_30px_-24px_rgba(0,0,0,0.35)] backdrop-blur-xl md:hidden">
        <div className="mx-auto flex max-w-md items-center justify-around">
          {mobileNavigation.map((item) => {
            const active = isActive(item.href);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                onClick={() => setMobileMenuOpen(false)}
                className={[
                  "flex min-h-12 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1",
                  "text-[10px] font-semibold transition-colors",
                  active
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground",
                ].join(" ")}
              >
                <div
                  className={[
                    "flex size-8 items-center justify-center rounded-xl transition-colors",
                    active ? "bg-primary/10" : "bg-transparent",
                  ].join(" ")}
                >
                  <Icon className="size-[17px]" />
                </div>

                <span className="max-w-full truncate">{item.mobileName}</span>
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setMobileMenuOpen((open) => !open)}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-more-navigation"
            className="flex min-h-12 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1 text-[10px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
          >
            <div className="flex size-8 items-center justify-center rounded-xl">
              <Menu className="size-[17px]" />
            </div>
            <span className="max-w-full truncate">More</span>
          </button>
        </div>
      </nav>
    </>
  );
}
