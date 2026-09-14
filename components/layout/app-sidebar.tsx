"use client";

import {
  BriefcaseBusiness,
  ChartNoAxesCombined,
  ChevronRight,
  FileText,
  LayoutDashboard,
  LogOut,
  Settings2,
  Sparkles,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useState } from "react";

const primaryNavigation = [
  {
    name: "Dashboard",
    mobileName: "Home",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    name: "Career",
    mobileName: "Career",
    href: "/career",
    icon: ChartNoAxesCombined,
  },
  {
    name: "Jobs",
    mobileName: "Jobs",
    href: "/jobs",
    icon: BriefcaseBusiness,
  },
  {
    name: "Saved Jobs",
    mobileName: "Saved",
    href: "/saved-jobs",
    icon: Sparkles,
  },
  {
    name: "Applications",
    mobileName: "Apps",
    href: "/applications",
    icon: FileText,
  },
];

const careerNavigation = [
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
];

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);
  const signOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    await createClient().auth.signOut();
    router.replace("/auth/login");
    router.refresh();
  };

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden h-screen w-[272px] shrink-0 flex-col border-r border-border/70 bg-background/90 backdrop-blur-xl md:flex">
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
                AI Career Copilot
              </p>
            </div>
          </Link>
        </div>

        {/* Navigation */}
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-3 py-5">
          <nav className="space-y-1">
            <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/70">
              Workspace
            </p>

            {primaryNavigation.map((item) => {
              const active = isActive(item.href);
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
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

          <nav className="mt-7 space-y-1">
            <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/70">
              Career Setup
            </p>

            {careerNavigation.map((item) => {
              const active = isActive(item.href);
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
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
                Career Copilot
              </span>
            </div>

            <p className="text-xs leading-5 text-muted-foreground">
              Your jobs, applications and career preparation — all in one place.
            </p>

            <Link
              href="/career"
              className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
            >
              View your next step
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
                  Career workspace
                </p>
              </div>
            </div>

            <span className="rounded-full border border-border bg-muted/50 px-2 py-0.5 text-[9px] font-semibold text-muted-foreground">
              MVP
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
      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-border/70 bg-background/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-8px_30px_-24px_rgba(0,0,0,0.35)] backdrop-blur-xl md:hidden">
        <div className="mx-auto flex max-w-md items-center justify-around">
          {primaryNavigation.map((item) => {
            const active = isActive(item.href);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={[
                  "flex min-w-0 flex-1 flex-col items-center gap-1 rounded-xl px-2 py-1.5",
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
            onClick={() => void signOut()}
            disabled={signingOut}
            className="flex min-w-0 flex-1 flex-col items-center gap-1 rounded-xl px-2 py-1.5 text-[10px] font-semibold text-muted-foreground transition-colors hover:text-foreground disabled:opacity-60"
          >
            <div className="flex size-8 items-center justify-center rounded-xl">
              <LogOut className="size-[17px]" />
            </div>
            <span className="max-w-full truncate">Logout</span>
          </button>
        </div>
      </nav>
    </>
  );
}
