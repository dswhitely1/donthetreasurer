"use client";

import Link from "next/link";
import { Menu, Settings } from "lucide-react";

import { signOut } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { OrgSwitcher } from "@/components/layout/org-switcher";

interface HeaderProps {
  displayName: string;
  currentOrgId: string | null;
  onToggleSidebar: () => void;
  showSidebarToggle: boolean;
}

export function Header({
  displayName,
  currentOrgId,
  onToggleSidebar,
  showSidebarToggle,
}: Readonly<HeaderProps>) {
  return (
    <header className="border-b border-border bg-card">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2 sm:gap-4">
          {showSidebarToggle && (
            <Button
              variant="ghost"
              size="icon-sm"
              className="lg:hidden"
              onClick={onToggleSidebar}
              aria-label="Toggle sidebar"
            >
              <Menu className="size-5" />
            </Button>
          )}
          <Link
            href="/dashboard"
            className="text-lg font-semibold text-foreground"
          >
            Treasurer
          </Link>
          <OrgSwitcher currentOrgId={currentOrgId} />
        </div>
        <div className="flex items-center gap-4">
          <span className="hidden text-sm text-muted-foreground sm:inline">
            {displayName}
          </span>
          <Button variant="ghost" size="icon-sm" asChild>
            <Link href="/settings" aria-label="Settings">
              <Settings className="size-4" />
            </Link>
          </Button>
          <form action={signOut}>
            <Button variant="ghost" size="sm" type="submit">
              Sign out
            </Button>
          </form>
        </div>
      </div>
    </header>
  );
}
