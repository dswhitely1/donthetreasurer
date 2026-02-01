"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Landmark,
  Tags,
  ArrowLeftRight,
  FileBarChart,
  X,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const navItems = [
  { label: "Overview", href: "", icon: LayoutDashboard, exact: true },
  { label: "Accounts", href: "/accounts", icon: Landmark, exact: false },
  { label: "Categories", href: "/categories", icon: Tags, exact: false },
  {
    label: "Transactions",
    href: "/transactions",
    icon: ArrowLeftRight,
    exact: false,
  },
  { label: "Reports", href: "/reports", icon: FileBarChart, exact: false },
];

interface SidebarProps {
  orgId: string;
  orgName: string;
  isOpen: boolean;
  onClose: () => void;
}

function SidebarContent({
  orgId,
  orgName,
}: Readonly<{ orgId: string; orgName: string }>) {
  const pathname = usePathname();
  const basePath = `/organizations/${orgId}`;

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-sidebar-border px-4 py-3">
        <p className="truncate text-sm font-semibold text-sidebar-foreground">
          {orgName}
        </p>
      </div>
      <nav className="flex-1 space-y-1 px-2 py-3">
        {navItems.map((item) => {
          const fullHref = basePath + item.href;
          const isActive = item.exact
            ? pathname === fullHref
            : pathname.startsWith(fullHref) && item.href !== "";

          return (
            <Link
              key={item.label}
              href={fullHref}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              )}
            >
              <item.icon className="size-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

export function Sidebar({ orgId, orgName, isOpen, onClose }: Readonly<SidebarProps>) {
  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:w-64 lg:shrink-0 lg:flex-col border-r border-sidebar-border bg-sidebar">
        <SidebarContent orgId={orgId} orgName={orgName} />
      </aside>

      {/* Mobile sidebar overlay */}
      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50 lg:hidden"
            onClick={onClose}
            onKeyDown={(e) => {
              if (e.key === "Escape") onClose();
            }}
            role="button"
            tabIndex={-1}
            aria-label="Close sidebar"
          />
          <aside className="fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-sidebar shadow-lg lg:hidden">
            <div className="flex items-center justify-end px-2 py-2">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={onClose}
                aria-label="Close sidebar"
              >
                <X className="size-4" />
              </Button>
            </div>
            <SidebarContent orgId={orgId} orgName={orgName} />
          </aside>
        </>
      )}
    </>
  );
}
