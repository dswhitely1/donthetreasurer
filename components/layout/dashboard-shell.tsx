"use client";

import { useState } from "react";
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
  const pathname = usePathname();

  const orgIdMatch = pathname.match(ORG_ID_PATTERN);
  const currentOrgId = orgIdMatch?.[1] ?? null;

  const { data: organizations } = useOrganizations();
  const currentOrg = organizations?.find((org) => org.id === currentOrgId);

  const showSidebar = currentOrgId !== null;

  return (
    <div className="min-h-screen bg-background">
      <Header
        displayName={displayName}
        currentOrgId={currentOrgId}
        onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
        showSidebarToggle={showSidebar}
      />
      <div className="flex flex-1">
        {showSidebar && (
          <Sidebar
            orgId={currentOrgId}
            orgName={currentOrg?.name ?? ""}
            seasonsEnabled={currentOrg?.seasons_enabled ?? false}
            isOpen={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
          />
        )}
        <main
          className={
            showSidebar
              ? "flex-1 px-4 py-8 sm:px-6 lg:px-8"
              : "mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8"
          }
        >
          {children}
        </main>
      </div>
    </div>
  );
}
