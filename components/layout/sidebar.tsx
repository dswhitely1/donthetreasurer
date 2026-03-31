"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Landmark,
  Tags,
  ArrowLeftRight,
  Repeat,
  PiggyBank,
  FileBarChart,
  Calendar,
  Users,
  X,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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
  { label: "Templates", href: "/templates", icon: Repeat, exact: false },
  { label: "Budgets", href: "/budgets", icon: PiggyBank, exact: false },
  { label: "Reports", href: "/reports", icon: FileBarChart, exact: false },
];

const seasonNavItems = [
  { label: "Seasons", href: "/seasons", icon: Calendar, exact: false },
  { label: "Students", href: "/students", icon: Users, exact: false },
];

interface SidebarProps {
  orgId: string;
  orgName: string;
  seasonsEnabled: boolean;
  isOpen: boolean;
  onClose: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

function SidebarContent({
  orgId,
  orgName,
  seasonsEnabled,
  collapsed,
}: Readonly<{
  orgId: string;
  orgName: string;
  seasonsEnabled: boolean;
  collapsed: boolean;
}>) {
  const pathname = usePathname();
  const basePath = `/organizations/${orgId}`;

  const allItems = seasonsEnabled
    ? [...navItems, ...seasonNavItems]
    : navItems;

  return (
    <div className="flex h-full flex-col">
      {!collapsed && (
        <div className="border-b border-sidebar-border px-4 py-3">
          <p className="truncate text-sm font-semibold text-sidebar-foreground">
            {orgName}
          </p>
        </div>
      )}
      <nav
        className={cn(
          "flex-1 space-y-1 overflow-y-auto py-3",
          collapsed ? "px-1" : "px-2"
        )}
      >
        {allItems.map((item) => {
          const fullHref = basePath + item.href;
          const isActive = item.exact
            ? pathname === fullHref
            : pathname.startsWith(fullHref) && item.href !== "";

          const linkContent = (
            <Link
              key={item.label}
              href={fullHref}
              className={cn(
                "flex items-center rounded-md text-sm font-medium transition-colors",
                collapsed
                  ? "justify-center px-2 py-2"
                  : "gap-3 px-3 py-3 lg:py-2",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              )}
            >
              <item.icon className="size-4 shrink-0" />
              {!collapsed && item.label}
            </Link>
          );

          if (collapsed) {
            return (
              <Tooltip key={item.label}>
                <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
                <TooltipContent side="right">{item.label}</TooltipContent>
              </Tooltip>
            );
          }

          return linkContent;
        })}
      </nav>
    </div>
  );
}

export function Sidebar({
  orgId,
  orgName,
  seasonsEnabled,
  isOpen,
  onClose,
  collapsed,
  onToggleCollapse,
}: Readonly<SidebarProps>) {
  const pathname = usePathname();
  const prevPathname = useRef(pathname);

  // Auto-close mobile sidebar on route change
  useEffect(() => {
    if (prevPathname.current !== pathname && isOpen) {
      onClose();
    }
    prevPathname.current = pathname;
  }, [pathname, isOpen, onClose]);

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "hidden lg:flex lg:shrink-0 lg:flex-col border-r border-sidebar-border bg-sidebar transition-all duration-200 lg:sticky lg:top-0 lg:h-screen",
          collapsed ? "lg:w-16" : "lg:w-64"
        )}
      >
        <SidebarContent
          orgId={orgId}
          orgName={orgName}
          seasonsEnabled={seasonsEnabled}
          collapsed={collapsed}
        />
        <div
          className={cn(
            "border-t border-sidebar-border p-2",
            collapsed && "flex justify-center"
          )}
        >
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={onToggleCollapse}
                aria-label={
                  collapsed ? "Expand sidebar" : "Collapse sidebar"
                }
                className="text-sidebar-foreground/50 hover:text-sidebar-foreground"
              >
                {collapsed ? (
                  <ChevronsRight className="size-4" />
                ) : (
                  <ChevronsLeft className="size-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">
              {collapsed ? "Expand sidebar" : "Collapse sidebar"}
            </TooltipContent>
          </Tooltip>
        </div>
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
            <SidebarContent
              orgId={orgId}
              orgName={orgName}
              seasonsEnabled={seasonsEnabled}
              collapsed={false}
            />
          </aside>
        </>
      )}
    </>
  );
}
