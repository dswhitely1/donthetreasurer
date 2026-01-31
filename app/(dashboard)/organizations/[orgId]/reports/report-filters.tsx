"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Account {
  id: string;
  name: string;
}

export interface CategoryOption {
  id: string;
  label: string;
}

interface ReportFiltersProps {
  orgId: string;
  accounts: Account[];
  categories: CategoryOption[];
}

const STATUS_OPTIONS = [
  { value: "all", label: "All Statuses" },
  { value: "uncleared", label: "Uncleared" },
  { value: "cleared", label: "Cleared" },
  { value: "reconciled", label: "Reconciled" },
  { value: "uncleared,cleared", label: "Uncleared + Cleared" },
] as const;

export function ReportFilters({
  orgId,
  accounts,
  categories,
}: Readonly<ReportFiltersProps>) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentAccountId = searchParams.get("account_id") ?? "all";
  const currentStatus = searchParams.get("status") ?? "all";
  const currentCategoryId = searchParams.get("category_id") ?? "all";
  const currentStartDate = searchParams.get("start_date") ?? "";
  const currentEndDate = searchParams.get("end_date") ?? "";

  const hasDateRange = currentStartDate !== "" && currentEndDate !== "";

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "all" || value === "") {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  function clearFilters() {
    router.push(pathname);
  }

  function handleExport() {
    if (!hasDateRange) return;

    const params = new URLSearchParams();
    params.set("start_date", currentStartDate);
    params.set("end_date", currentEndDate);
    if (currentAccountId !== "all") {
      params.set("account_id", currentAccountId);
    }
    if (currentStatus !== "all") {
      params.set("status", currentStatus);
    }
    if (currentCategoryId !== "all") {
      params.set("category_id", currentCategoryId);
    }

    window.location.href = `/api/organizations/${orgId}/reports/export?${params.toString()}`;
  }

  const hasActiveFilters =
    currentAccountId !== "all" ||
    currentStatus !== "all" ||
    currentCategoryId !== "all" ||
    currentStartDate !== "" ||
    currentEndDate !== "";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">
            Cleared From <span className="text-destructive">*</span>
          </Label>
          <Input
            type="date"
            className="w-[160px]"
            value={currentStartDate}
            onChange={(e) => updateParam("start_date", e.target.value)}
          />
        </div>

        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">
            Cleared To <span className="text-destructive">*</span>
          </Label>
          <Input
            type="date"
            className="w-[160px]"
            value={currentEndDate}
            onChange={(e) => updateParam("end_date", e.target.value)}
          />
        </div>

        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Account</Label>
          <Select
            value={currentAccountId}
            onValueChange={(v) => updateParam("account_id", v)}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Accounts" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Accounts</SelectItem>
              {accounts.map((account) => (
                <SelectItem key={account.id} value={account.id}>
                  {account.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Status</Label>
          <Select
            value={currentStatus}
            onValueChange={(v) => updateParam("status", v)}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Category</Label>
          <Select
            value={currentCategoryId}
            onValueChange={(v) => updateParam("category_id", v)}
          >
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>
                  {cat.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={handleExport} disabled={!hasDateRange}>
          <Download className="mr-2 h-4 w-4" />
          Export to Excel
        </Button>
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            Clear Filters
          </Button>
        )}
      </div>
    </div>
  );
}
