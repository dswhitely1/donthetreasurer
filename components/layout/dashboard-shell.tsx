"use client";

import { useState, useCallback, useEffect } from "react";
import { usePathname } from "next/navigation";

import { useOrganizations } from "@/hooks/use-organizations";
import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";

const ORG_ID_PATTERN = /^\/organizations\/([0-9a-f-]{36})/;

export function DashboardShell({
  displayName,
  children,
}: Readonly<{ displayName: string; children: React.ReactNode }>) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const pathname = usePathname();

  // Sync collapsed state with localStorage after mount (SSR-safe)
  useEffect(() => {
    try {
      const stored = localStorage.getItem("sidebar-collapsed");
      if (stored === "true") {
        setSidebarCollapsed(true);
      }
    } catch {
      // localStorage unavailable (private browsing, etc.)
    }
  }, []);

  const orgIdMatch = pathname.match(ORG_ID_PATTERN);
  const currentOrgId = orgIdMatch?.[1] ?? null;

  const { data: organizations } = useOrganizations();
  const currentOrg = organizations?.find((org) => org.id === currentOrgId);

  const showSidebar = currentOrgId !== null;

  const handleToggleSidebar = useCallback(
    () => setSidebarOpen((prev) => !prev),
    []
  );
  const handleCloseSidebar = useCallback(() => setSidebarOpen(false), []);

  const handleToggleCollapse = useCallback(() => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("sidebar-collapsed", String(next));
      } catch {
        // localStorage unavailable
      }
      return next;
    });
  }, []);

  return (
    <div className="flex h-screen flex-col bg-background">
      <Header
        displayName={displayName}
        currentOrgId={currentOrgId}
        onToggleSidebar={handleToggleSidebar}
        showSidebarToggle={showSidebar}
      />
      <div className="flex min-h-0 flex-1">
        {showSidebar && (
          <Sidebar
            orgId={currentOrgId}
            orgName={currentOrg?.name ?? ""}
            seasonsEnabled={currentOrg?.seasons_enabled ?? false}
            isOpen={sidebarOpen}
            onClose={handleCloseSidebar}
            collapsed={sidebarCollapsed}
            onToggleCollapse={handleToggleCollapse}
          />
        )}
        <main
          className={
            showSidebar
              ? "flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8"
              : "mx-auto w-full max-w-7xl overflow-y-auto px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8"
          }
        >
          {children}
        </main>
      </div>
    </div>
  );
}
