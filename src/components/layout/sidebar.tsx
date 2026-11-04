"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Code2, History, LayoutDashboard, LineChart, ScrollText, Server, Settings, Shield, Users, Layers } from "lucide-react";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/learn", label: "Learn", icon: BookOpen },
  { href: "/problems", label: "Problems", icon: Code2 },
  { href: "/submissions", label: "Submissions", icon: History },
  { href: "/progress", label: "Progress", icon: LineChart },
  { href: "/settings", label: "Settings", icon: Settings },
];

const adminNav = [
  { href: "/admin", label: "Admin Dashboard", icon: Shield, exact: true },
  { href: "/admin/lessons", label: "Manage Lessons", icon: Layers },
  { href: "/admin/problems", label: "Manage Problems", icon: Code2 },
  { href: "/admin/users", label: "Manage Users", icon: Users },
  { href: "/admin/audit", label: "Audit Log", icon: ScrollText },
  { href: "/admin/system", label: "System", icon: Server },
];

type NavItem = { href: string; label: string; icon: typeof Shield; exact?: boolean };

export function Sidebar({
  username,
  isAdmin,
  logout,
}: {
  username: string;
  isAdmin: boolean;
  logout: () => Promise<void>;
}) {
  const pathname = usePathname();
  const renderItem = (n: NavItem) => {
    const active = n.exact ? pathname === n.href : pathname === n.href || pathname.startsWith(n.href + "/");
    return (
      <Link
        key={n.href}
        href={n.href}
        className={cn(
          "flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm text-muted hover:bg-border/50 hover:text-foreground",
          active && "bg-border/60 font-medium text-foreground",
        )}
      >
        <n.icon className="h-4 w-4" />
        {n.label}
      </Link>
    );
  };
  return (
    <aside className="flex w-56 shrink-0 flex-col border-r bg-surface p-3">
      <div className="px-2.5 py-2 text-sm font-semibold tracking-tight">C Practice</div>
      <nav className="mt-2 flex flex-1 flex-col gap-0.5">
        {nav.map(renderItem)}
        {isAdmin && (
          <>
            <div className="mt-4 px-2.5 text-xs uppercase tracking-wide text-muted">Admin</div>
            {adminNav.map(renderItem)}
          </>
        )}
      </nav>
      <form action={logout} className="border-t pt-3">
        <div className="truncate px-2.5 text-xs text-muted">{username}</div>
        <button className="mt-1 w-full rounded-md px-2.5 py-1.5 text-left text-sm text-muted hover:bg-border/50 hover:text-foreground">
          Sign out
        </button>
      </form>
    </aside>
  );
}
