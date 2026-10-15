"use client";

// App shell (Figma 16817:18843, 16842:21692): ZEDU sidebar + top bar around every signed-in page.
// Sidebar: Expanded 248px at ≥1280px, Collapsed 64px rail at 768–1279px (the top-bar toggle overrides
// either), and a drawer below 768px.

import { CircleHelp, Contact, LayoutDashboard, Phone, Search as SearchIcon, SquareCheck, UserRound, X } from "lucide-react";
import { signOut } from "@/lib/auth/client";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { initialsOf } from "@/lib/status";
import {
  Dropdown,
  IconButton,
  NavItem,
  NavSection,
  NewMenu,
  Search,
  Sidebar,
  SidebarDivider,
  TopBar,
  UserMenu,
  UserTrigger,
  WorkspaceSwitcher,
} from "@/components/zedu";

type User = { name: string; email?: string | null; image?: string | null };

type Props = {
  user: User;
  /** Open tasks due today or overdue, shown on the Tasks nav item. */
  openTaskCount: number;
  /** Shows the red dot on the notifications bell. */
  unread: boolean;
  /** Active nav item. Defaults to "Dashboard". */
  active?: string;
  children: ReactNode;
};

// Calls and Contacts pages aren't built yet, so those items don't navigate.
const NAV = [
  { label: "Dashboard", href: "/", icon: <LayoutDashboard aria-hidden /> },
  { label: "Leads", href: "/leads", icon: <UserRound aria-hidden /> },
  { label: "Calls", href: "#", icon: <Phone aria-hidden /> },
  { label: "Tasks", href: "/tasks", icon: <SquareCheck aria-hidden />, tasks: true },
  { label: "Contacts", href: "#", icon: <Contact aria-hidden /> },
];

function useWideScreen() {
  const [wide, setWide] = useState(true);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1280px)");
    const sync = () => setWide(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return wide;
}

const isActive = (href: string, pathname: string) =>
  href !== "#" && (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`));

/** `active` (a nav label) overrides the URL-based active item. */
export function AppShell({ user, openTaskCount, unread, active, children }: Props) {
  const wide = useWideScreen();
  const pathname = usePathname();
  const router = useRouter();
  // null = follow the viewport; the top-bar toggle pins it until the viewport class changes.
  const [pinned, setPinned] = useState<boolean | null>(null);
  const [drawer, setDrawer] = useState(false);
  useEffect(() => setPinned(null), [wide]);
  const collapsed = pinned ?? !wide;

  useEffect(() => {
    if (!drawer) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setDrawer(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [drawer]);

  const initials = initialsOf(user.name);

  const sidebar = (rail: boolean, onNavigate?: () => void) => (
    <Sidebar
      collapsed={rail}
      className="h-full"
      header={
        <>
          <WorkspaceSwitcher workspace="Zedu" subtitle="Marketing dashboard" collapsed={rail} />
          {rail ? (
            <IconButton label="Search" className="w-10" onClick={() => document.querySelector<HTMLInputElement>('input[name="q"]')?.focus()}>
              <SearchIcon aria-hidden />
            </IconButton>
          ) : (
            <Search size="sm" shortcut="/" className="w-full shrink-0" />
          )}
        </>
      }
      footer={
        <>
          <NavItem label="Help center" href="#" icon={<CircleHelp aria-hidden />} />
          <SidebarDivider />
          <Dropdown
            side="top"
            className={rail ? undefined : "w-full"}
            trigger={(p) => (
              <UserTrigger name={user.name} email={user.email} initials={initials} image={user.image} collapsed={rail} {...p} />
            )}
          >
            <UserMenu name={user.name} subtitle={user.email ?? undefined} onLogOut={() => signOut()} />
          </Dropdown>
        </>
      }
    >
      <NavSection label="Sales">
        {NAV.map((n) => (
          <NavItem
            key={n.label}
            label={n.label}
            href={n.href}
            icon={n.icon}
            active={active ? n.label === active : isActive(n.href, pathname)}
            count={n.tasks && openTaskCount > 0 ? openTaskCount : undefined}
            onClick={onNavigate}
          />
        ))}
      </NavSection>
    </Sidebar>
  );

  return (
    <div className="zedu flex h-dvh overflow-hidden bg-z-surface">
      <div className="hidden md:block">{sidebar(collapsed)}</div>

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          unread={unread}
          onToggleSidebar={() => setPinned(!collapsed)}
          onOpenMenu={() => setDrawer(true)}
          newMenu={<NewMenu onAddLead={() => router.push("/leads?new=1")} onImport={() => {}} />}
        />
        <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
      </div>

      {/* Mobile drawer */}
      <div className={`fixed inset-0 z-50 md:hidden ${drawer ? "" : "pointer-events-none"}`} aria-hidden={!drawer}>
        <div
          onClick={() => setDrawer(false)}
          className={`absolute inset-0 bg-z-inverse/40 transition-opacity duration-200 ${drawer ? "opacity-100" : "opacity-0"}`}
        />
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
          className={`absolute inset-y-0 left-0 shadow-z-lg transition-transform duration-200 ease-out ${drawer ? "translate-x-0" : "-translate-x-full"}`}
        >
          {drawer && (
            <>
              <IconButton label="Close menu" className="absolute right-2 top-2 z-10" onClick={() => setDrawer(false)}>
                <X aria-hidden />
              </IconButton>
              {sidebar(false, () => setDrawer(false))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
