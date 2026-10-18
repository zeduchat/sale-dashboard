"use client";

// App shell (Figma 16817:18843, 16842:21692): ZEDU sidebar + top bar around every signed-in page.
// Sidebar: Expanded 248px at ≥1280px, Collapsed 64px rail at 768–1279px (the top-bar toggle overrides
// either), and a drawer below 768px.

import { CircleHelp, Contact, LayoutDashboard, Phone, Search as SearchIcon, Settings, SquareCheck, UserPlus, UserRound, X } from "lucide-react";
import { signOut } from "@/lib/auth/client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { initialsOf } from "@/lib/status";
import { AddContactModal } from "@/components/contacts/AddContactModal";
import { TasksToast } from "@/components/tasks/TasksToast";
import { GlobalSearch, type GlobalSearchHandle } from "./GlobalSearch";
import { NewTaskModal } from "./NewTaskModal";
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

type User = { name: string; email?: string | null; image?: string | null; role?: "ADMIN" | "MEMBER" };

type Props = {
  user: User;
  /** Open tasks due today or overdue, shown on the Tasks nav item. */
  openTaskCount: number;
  /** Pending access requests, shown to admins on Team & invitations. */
  accessRequestCount?: number;
  /** Suppresses action menus when rendering the isolated sample-only Calls preview. */
  previewMode?: boolean;
  /** Active nav item. Defaults to "Dashboard". */
  active?: string;
  children: ReactNode;
};

const NAV = [
  { label: "Dashboard", href: "/", icon: <LayoutDashboard aria-hidden /> },
  { label: "Leads", href: "/leads", icon: <UserRound aria-hidden /> },
  { label: "Calls", href: "/calls", icon: <Phone aria-hidden /> },
  { label: "Tasks", href: "/tasks", icon: <SquareCheck aria-hidden />, tasks: true },
  { label: "Contacts", href: "/contacts", icon: <Contact aria-hidden /> },
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
export function AppShell({ user, openTaskCount, accessRequestCount = 0, active, previewMode = false, children }: Props) {
  const wide = useWideScreen();
  const pathname = usePathname();
  const search = useSearchParams();
  const admin = user.role === "ADMIN";
  // Settings switches tabs in place, so the Admin items follow the ?tab param.
  const onTeam = pathname === "/invites" || (pathname === "/settings" && search.get("tab") === "team");
  const onSettings = pathname === "/settings" && !onTeam;
  const router = useRouter();
  // null = follow the viewport; the top-bar toggle pins it until the viewport class changes.
  const [pinned, setPinned] = useState<boolean | null>(null);
  const [drawer, setDrawer] = useState(false);
  const [addingContact, setAddingContact] = useState(false);
  const [addingTask, setAddingTask] = useState(false);
  const [mobileSearch, setMobileSearch] = useState(false);
  const [toast, setToast] = useState<{ id: number; message: string } | null>(null);
  const searchRef = useRef<GlobalSearchHandle>(null);
  useEffect(() => setMobileSearch(false), [pathname]);

  /** The sidebar search box and icon hand off to the top-bar search (or the mobile search row). */
  const focusSearch = () => {
    if (window.matchMedia("(max-width: 767px)").matches) {
      setDrawer(false);
      setMobileSearch(true);
    } else searchRef.current?.focus();
  };
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
            <IconButton label="Search" className="w-10" onClick={focusSearch}>
              <SearchIcon aria-hidden />
            </IconButton>
          ) : (
            <Search
              size="sm"
              shortcut="/"
              readOnly
              className="w-full shrink-0 cursor-pointer"
              onFocus={(e) => {
                e.currentTarget.blur();
                focusSearch();
              }}
            />
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
            <UserMenu
              name={user.name}
              subtitle={user.email ? `${user.email}${user.role ? ` · ${user.role === "ADMIN" ? "Admin" : "Member"}` : ""}` : undefined}
              onProfile={() => {
                onNavigate?.();
                router.push("/settings?tab=profile");
              }}
              onSettings={() => {
                onNavigate?.();
                router.push("/settings");
              }}
              onTeam={
                user.role === "ADMIN"
                  ? () => {
                      onNavigate?.();
                      router.push("/settings?tab=team");
                    }
                  : undefined
              }
              onLogOut={() => signOut()}
            />
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
      {/* Admins only (Figma "ZEDU · Sidebar", Admin section). Members reach their own settings from the user menu. */}
      {admin && (
        <>
          {rail && <SidebarDivider />}
          <NavSection label="Admin">
            <NavItem
              label="Team & invitations"
              href="/settings?tab=team"
              icon={<UserPlus aria-hidden />}
              active={onTeam}
              count={accessRequestCount > 0 ? accessRequestCount : undefined}
              onClick={onNavigate}
            />
            <NavItem label="Settings" href="/settings" icon={<Settings aria-hidden />} active={onSettings} onClick={onNavigate} />
          </NavSection>
        </>
      )}
    </Sidebar>
  );

  return (
    <div className="zedu flex h-dvh overflow-hidden bg-z-surface">
      <div className="hidden md:block">{sidebar(collapsed)}</div>

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          onToggleSidebar={() => setPinned(!collapsed)}
          onOpenMenu={() => setDrawer(true)}
          search={<GlobalSearch ref={searchRef} />}
          onMobileSearch={() => setMobileSearch((v) => !v)}
          newMenu={previewMode ? undefined :
            <NewMenu
              onLogCall={() => router.push("/calls?log=1")}
              onAddLead={() => router.push("/leads?new=1")}
              onNewTask={() => setAddingTask(true)}
              onAddContact={() => setAddingContact(true)}
              onImport={() => router.push("/contact-import")}
            />
          }
        />
        {mobileSearch && (
          <div className="border-b border-z-line bg-z-surface px-3 py-2 md:hidden">
            <GlobalSearch inputClassName="w-full" autoFocus />
          </div>
        )}
        <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
      </div>

      {/* Opened from the top-bar New menu on any page. */}
      {!previewMode && <AddContactModal open={addingContact} onClose={() => setAddingContact(false)} />}
      {!previewMode && <NewTaskModal
        open={addingTask}
        onClose={() => setAddingTask(false)}
        onCreated={(title) => {
          setToast({ id: Date.now(), message: `"${title}" created` });
          router.refresh();
        }}
      />}
      {toast && (
        <TasksToast
          key={toast.id}
          message={toast.message}
          actionLabel="View tasks"
          onAction={pathname === "/tasks" ? undefined : () => router.push("/tasks")}
          onClose={() => setToast(null)}
        />
      )}

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
