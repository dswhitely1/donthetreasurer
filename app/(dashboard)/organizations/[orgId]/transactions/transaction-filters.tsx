"use client";

import { useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { SlidersHorizontal } from "lucide-react";

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

interface TransactionFiltersProps {
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

export function TransactionFilters({
  accounts,
  categories,
}: Readonly<TransactionFiltersProps>) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentAccountId = searchParams.get("account_id") ?? "all";
  const currentStatus = searchParams.get("status") ?? "all";
  const currentCategoryId = searchParams.get("category_id") ?? "all";
  const currentStartDate = searchParams.get("start_date") ?? "";
  const currentEndDate = searchParams.get("end_date") ?? "";

  const hasActiveFilters =
    currentAccountId !== "all" ||
    currentStatus !== "all" ||
    currentCategoryId !== "all" ||
    currentStartDate !== "" ||
    currentEndDate !== "";

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "all" || value === "") {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    params.delete("page");
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  function clearFilters() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("account_id");
    params.delete("status");
    params.delete("category_id");
    params.delete("start_date");
    params.delete("end_date");
    params.delete("page");
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  const [filtersOpen, setFiltersOpen] = useState(false);

  const activeFilterCount = [
    currentAccountId !== "all",
    currentStatus !== "all",
    currentCategoryId !== "all",
    currentStartDate !== "",
    currentEndDate !== "",
  ].filter(Boolean).length;

  const filterControls = (
    <>
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Account</Label>
        <Select
          value={currentAccountId}
          onValueChange={(v) => updateParam("account_id", v)}
        >
          <SelectTrigger className="w-full sm:w-[180px]">
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
          <SelectTrigger className="w-full sm:w-[180px]">
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
          <SelectTrigger className="w-full sm:w-[220px]">
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

      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Start Date</Label>
        <Input
          type="date"
          className="w-full sm:w-[160px]"
          value={currentStartDate}
          onChange={(e) => updateParam("start_date", e.target.value)}
        />
      </div>

      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">End Date</Label>
        <Input
          type="date"
          className="w-full sm:w-[160px]"
          value={currentEndDate}
          onChange={(e) => updateParam("end_date", e.target.value)}
        />
      </div>

      {hasActiveFilters && (
        <Button variant="ghost" size="sm" onClick={clearFilters}>
          Clear Filters
        </Button>
      )}
    </>
  );

  return (
    <div>
      {/* Mobile: collapsible filter toggle */}
      <div className="sm:hidden">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setFiltersOpen((prev) => !prev)}
        >
          <SlidersHorizontal className="mr-1.5 h-4 w-4" />
          Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
        </Button>
        {filtersOpen && (
          <div className="mt-3 space-y-3">{filterControls}</div>
        )}
      </div>

      {/* Desktop: inline flex-wrap */}
      <div className="hidden sm:flex sm:flex-wrap sm:items-end sm:gap-3">
        {filterControls}
      </div>
    </div>
  );
}
