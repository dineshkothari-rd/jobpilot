"use client";

import { disconnectPushBrowser } from "@/lib/notifications/browser";

import { createClient } from "@/lib/supabase/client";
import { Dialog } from "@base-ui/react/dialog";
import {
  BookOpen,
  BriefcaseBusiness,
  Building2,
  ChartNoAxesCombined,
  ChevronRight,
  CircleHelp,
  Coins,
  FileText,
  FolderKanban,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquareText,
  Sparkles,
  UserRound,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Fragment, useEffect,useState } from "react";

const primaryNavigation = [
  {
    name: "Today",
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
  {
    name: "Application prep",
    mobileName: "Prepare",
    href: "/autopilot",
    icon: Sparkles,
  },
];

const careerNavigation = [
  { name: "Resume", href: "/resume", icon: FileText, group: "Your story" },
  { name: "Profile", href: "/profile", icon: UserRound, group: "Your story" },
  { name: "Saved jobs", href: "/saved-jobs", icon: BriefcaseBusiness, group: "Your story" },
  { name: "Evidence portfolio", href: "/portfolio", icon: FolderKanban, group: "Your story" },
  { name: "Career plan", href: "/career", icon: ChartNoAxesCombined, group: "Explore & grow" },
  { name: "Learning", href: "/learn", icon: BookOpen, group: "Explore & grow" },
  { name: "Interview practice", href: "/practice", icon: MessageSquareText, group: "Explore & grow" },
  { name: "Companies", href: "/companies", icon: Building2, group: "Explore & grow" },
  { name: "Salary insights", href: "/salaries", icon: Coins, group: "Explore & grow" },
  { name: "Internships & freshers", href: "/internships", icon: GraduationCap, group: "Explore & grow" },
  { name: "Hiring inbox", href: "/inbox", icon: MessageSquareText, group: "Hiring & account" },
  { name: "Hiring workspace", href: "/recruiter", icon: Building2, group: "Hiring & account" },
  { name: "Plans & billing", href: "/billing", icon: Coins, group: "Hiring & account" },
  { name: "Help & support", href: "/help", icon: CircleHelp, group: "Hiring & account" },
  { name: "Admin operations", href: "/admin", icon: Building2, group: "Hiring & account" },
];

const mobileNavigation = primaryNavigation;
const mobileMoreNavigation = careerNavigation;

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [isAdmin,setIsAdmin]=useState(false);
  useEffect(()=>{let stopped=false;void createClient().auth.getUser().then(({data})=>{if(!stopped)setIsAdmin(data.user?.app_metadata?.role==='admin');}).catch(()=>{});return()=>{stopped=true;};},[]);
  const visibleCareerNavigation=careerNavigation.filter(item=>item.href!=='/admin'||isAdmin);
  const visibleMobileMoreNavigation=mobileMoreNavigation.filter(item=>item.href!=='/admin'||isAdmin);
  const [signingOut, setSigningOut] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);
  const signOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    await disconnectPushBrowser().catch(() => {});
    await createClient().auth.signOut();
    try {
      // Do not leave private interview drafts behind on a shared browser tab.
      const draftKeys = Array.from(
        { length: sessionStorage.length },
        (_, index) => sessionStorage.key(index),
      );
      draftKeys.forEach((key) => {
        if (key?.startsWith("jobpilot:practice:"))
          sessionStorage.removeItem(key);
      });
    } catch {
      /* Disabled browser storage must not prevent sign-out. */
    }
    router.replace("/auth/login");
    router.refresh();
  };

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="workspace-sidebar sticky top-0 hidden h-dvh w-[224px] shrink-0 flex-col border-r border-border/70 bg-background md:flex">
        {/* Brand */}
        <div className="flex h-[72px] shrink-0 items-center border-b border-border/60 px-5">
          <Link
            href="/dashboard"
            className="group flex min-w-0 items-center gap-3 rounded-xl"
          >
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-105">
              <Image
                src="/brand/parth-careers.svg"
                width={36}
                height={36}
                alt=""
                priority
                className="rounded-xl"
              />
            </div>

            <div className="min-w-0">
              <p className="truncate text-[15px] font-bold tracking-tight text-foreground">
                Parth Careers
              </p>

              <p className="truncate text-[11px] font-medium text-muted-foreground">
                CAREER WORKSPACE
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

          <nav
            aria-label="Your information and tools"
            className="mt-7 space-y-1"
          >
            {Array.from(new Set(visibleCareerNavigation.map(item => item.group))).map(group => <details key={group} className="sidebar-group" open={group === "Your story" || visibleCareerNavigation.some(item => item.group === group && isActive(item.href))}>
              <summary>{group}<ChevronRight aria-hidden="true" className="size-3.5" /></summary>
            {visibleCareerNavigation.filter(item => item.group === group).map((item) => {
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
            </details>)}
          </nav>
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-border/60 p-3">
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
            className="fixed inset-x-3 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-50 max-h-[calc(100dvh-8rem)] overflow-y-auto rounded-2xl border bg-background p-3 shadow-2xl md:hidden"
          >
            <div className="flex items-center justify-between px-2 pb-2">
              <Dialog.Title className="text-sm font-bold">
                Your tools
              </Dialog.Title>
              <button
                type="button"
                aria-label="Close navigation menu"
                onClick={() => setMobileMenuOpen(false)}
                className="flex size-11 items-center justify-center rounded-xl hover:bg-muted"
              >
                <X className="size-4" />
              </button>
            </div>
            <Dialog.Description className="px-2 pb-3 text-xs text-muted-foreground">
              Your story, learning, hiring and account tools—all within reach.
            </Dialog.Description>
            <div className="grid grid-cols-2 gap-2">
              {visibleMobileMoreNavigation.map((item, index) => {
                const Icon = item.icon;
                return (
                  <Fragment key={item.href}>
                    {(index === 0 || item.group !== visibleMobileMoreNavigation[index - 1].group) && <p className="col-span-2 px-2 pt-3 text-xs font-semibold text-muted-foreground">{item.group}</p>}
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
                  </Fragment>
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
      <nav
        aria-label="Mobile navigation"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border/70 bg-background/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-8px_30px_-24px_rgba(0,0,0,0.35)] backdrop-blur-xl md:hidden"
      >
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
