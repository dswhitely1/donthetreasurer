"use client";

import { useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Download, FileText, SlidersHorizontal } from "lucide-react";

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
import { PRESET_OPTIONS, getPresetDateRange } from "@/lib/fiscal-year";

import type { PresetKey } from "@/lib/fiscal-year";

interface Account {
  id: string;
  name: string;
}

export interface CategoryOption {
  id: string;
  label: string;
}

export interface BudgetOption {
  id: string;
  name: string;
}

interface ReportFiltersProps {
  orgId: string;
  accounts: Account[];
  categories: CategoryOption[];
  budgets: BudgetOption[];
  fiscalYearStartMonth: number;
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
  budgets,
  fiscalYearStartMonth,
}: Readonly<ReportFiltersProps>) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [filtersOpen, setFiltersOpen] = useState(false);

  const currentDateMode = searchParams.get("date_mode") ?? "cleared_date";
  const currentAccountId = searchParams.get("account_id") ?? "all";
  const currentStatus = searchParams.get("status") ?? "all";
  const currentCategoryId = searchParams.get("category_id") ?? "all";
  const currentBudgetId = searchParams.get("budget_id") ?? "none";
  const currentStartDate = searchParams.get("start_date") ?? "";
  const currentEndDate = searchParams.get("end_date") ?? "";
  const currentPreset = (searchParams.get("preset") ?? "custom") as PresetKey;

  const hasDateRange = currentStartDate !== "" && currentEndDate !== "";

  // Compute the label for the active preset
  const presetRange =
    currentPreset !== "custom"
      ? getPresetDateRange(currentPreset, fiscalYearStartMonth)
      : null;
  const presetLabel = presetRange?.label ?? null;

  function updateParams(updates: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value === "all" || value === "") {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    }
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  function updateParam(key: string, value: string) {
    updateParams({ [key]: value });
  }

  function handlePresetChange(preset: string) {
    if (preset === "custom") {
      updateParam("preset", "");
      return;
    }

    const range = getPresetDateRange(preset, fiscalYearStartMonth);
    if (range) {
      updateParams({
        preset,
        start_date: range.start,
        end_date: range.end,
      });
    }
  }

  function handleDateChange(key: string, value: string) {
    updateParams({ [key]: value, preset: "" });
  }

  function clearFilters() {
    router.push(pathname);
  }

  function buildExportParams(): URLSearchParams {
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
    if (currentPreset !== "custom") {
      params.set("preset", currentPreset);
    }
    if (currentBudgetId !== "none") {
      params.set("budget_id", currentBudgetId);
    }
    if (currentDateMode !== "cleared_date") {
      params.set("date_mode", currentDateMode);
    }
    return params;
  }

  function handleExport() {
    if (!hasDateRange) return;
    window.location.href = `/api/organizations/${orgId}/reports/export?${buildExportParams().toString()}`;
  }

  function handleExportPdf() {
    if (!hasDateRange) return;
    window.location.href = `/api/organizations/${orgId}/reports/export-pdf?${buildExportParams().toString()}`;
  }

  const hasActiveFilters =
    currentDateMode !== "cleared_date" ||
    currentAccountId !== "all" ||
    currentStatus !== "all" ||
    currentCategoryId !== "all" ||
    currentStartDate !== "" ||
    currentEndDate !== "" ||
    currentPreset !== "custom";

  const activeFilterCount = [
    currentDateMode !== "cleared_date",
    currentPreset !== "custom",
    currentStartDate !== "",
    currentEndDate !== "",
    currentAccountId !== "all",
    currentStatus !== "all",
    currentCategoryId !== "all",
    currentBudgetId !== "none",
  ].filter(Boolean).length;

  const filterControls = (
    <>
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Date Basis</Label>
        <Select
          value={currentDateMode}
          onValueChange={(v) => updateParam("date_mode", v === "cleared_date" ? "" : v)}
        >
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="cleared_date">Cleared Date</SelectItem>
            <SelectItem value="transaction_date">Transaction Date</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Date Preset</Label>
        <Select value={currentPreset} onValueChange={handlePresetChange}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Custom Range" />
          </SelectTrigger>
          <SelectContent>
            {PRESET_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">
          {currentDateMode === "transaction_date" ? "From" : "Cleared From"} <span className="text-destructive">*</span>
        </Label>
        <Input
          type="date"
          className="w-full sm:w-[160px]"
          value={currentStartDate}
          onChange={(e) => handleDateChange("start_date", e.target.value)}
        />
      </div>

      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">
          {currentDateMode === "transaction_date" ? "To" : "Cleared To"} <span className="text-destructive">*</span>
        </Label>
        <Input
          type="date"
          className="w-full sm:w-[160px]"
          value={currentEndDate}
          onChange={(e) => handleDateChange("end_date", e.target.value)}
        />
      </div>

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

      {budgets.length > 0 && (
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Budget</Label>
          <Select
            value={currentBudgetId}
            onValueChange={(v) => updateParam("budget_id", v === "none" ? "" : v)}
          >
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="No Budget" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No Budget</SelectItem>
              {budgets.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {hasActiveFilters && (
        <Button variant="ghost" size="sm" onClick={clearFilters} className="self-end">
          Clear Filters
        </Button>
      )}
    </>
  );

  return (
    <div className="space-y-3">
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

      {presetLabel && (
        <p className="text-sm text-muted-foreground">{presetLabel}</p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={handleExport} disabled={!hasDateRange}>
          <Download className="mr-2 h-4 w-4" />
          Export Excel
        </Button>
        <Button variant="outline" onClick={handleExportPdf} disabled={!hasDateRange}>
          <FileText className="mr-2 h-4 w-4" />
          Export PDF
        </Button>
      </div>
    </div>
  );
}
