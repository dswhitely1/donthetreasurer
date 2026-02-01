"use client";

import { useRouter } from "next/navigation";
import { ChevronsUpDown, Building2, LayoutGrid } from "lucide-react";

import { useOrganizations } from "@/hooks/use-organizations";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function OrgSwitcher({
  currentOrgId,
}: Readonly<{ currentOrgId: string | null }>) {
  const router = useRouter();
  const { data: organizations } = useOrganizations();

  const currentOrg = organizations?.find((org) => org.id === currentOrgId);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="max-w-[200px] gap-1.5 text-muted-foreground hover:text-foreground"
        >
          <Building2 className="size-4 shrink-0" />
          <span className="truncate">
            {currentOrg?.name ?? "Select Organization"}
          </span>
          <ChevronsUpDown className="size-3.5 shrink-0 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel>Organizations</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {organizations?.map((org) => (
          <DropdownMenuItem
            key={org.id}
            onSelect={() => router.push(`/organizations/${org.id}`)}
            className={org.id === currentOrgId ? "bg-accent" : ""}
          >
            <Building2 className="size-4" />
            <span className="truncate">{org.name}</span>
          </DropdownMenuItem>
        ))}
        {organizations && organizations.length > 0 && (
          <DropdownMenuSeparator />
        )}
        <DropdownMenuItem onSelect={() => router.push("/organizations")}>
          <LayoutGrid className="size-4" />
          All Organizations
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
