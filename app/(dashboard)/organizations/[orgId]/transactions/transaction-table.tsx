"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import {
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  ChevronRight,
  ChevronDown,
  Circle,
  CircleCheck,
  Lock,
  GitBranch,
  Download,
  ExternalLink,
} from "lucide-react";

import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  useBulkUpdateStatus,
  useBulkDeleteTransactions,
  useInlineUpdateTransaction,
} from "@/hooks/use-transactions";
import { InlineEditCell } from "./inline-edit-cell";

import type { SelectOption } from "./inline-edit-cell";

interface LineItem {
  id: string;
  amount: number;
  category_id: string;
  memo: string | null;
  categories: {
    id: string;
    name: string;
    parent_id: string | null;
    category_type: string;
  } | null;
}

interface Transaction {
  id: string;
  transaction_date: string;
  created_at: string | null;
  amount: number;
  transaction_type: string;
  description: string;
  check_number: string | null;
  vendor: string | null;
  status: string;
  cleared_at: string | null;
  account_id: string;
  accounts: { id: string; name: string } | null;
  transaction_line_items: LineItem[];
}

interface TransactionTableProps {
  transactions: Transaction[];
  orgId: string;
  categoryNameMap: Record<string, string>;
  runningBalanceMap: Record<string, number> | null;
  showRunningBalance: boolean;
  currentSort: string;
  currentOrder: string;
  accounts: { id: string; name: string }[];
}

type SortField =
  | "transaction_date"
  | "created_at"
  | "amount"
  | "description"
  | "status";

interface EditingCell {
  transactionId: string;
  field: string;
}

const STATUS_OPTIONS: SelectOption[] = [
  { value: "uncleared", label: "Uncleared" },
  { value: "cleared", label: "Cleared" },
  { value: "reconciled", label: "Reconciled" },
];

function StatusIcon({ status }: Readonly<{ status: string }>) {
  switch (status) {
    case "cleared":
      return (
        <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400">
          <CircleCheck className="h-4 w-4" />
          <span>Cleared</span>
        </span>
      );
    case "reconciled":
      return (
        <span className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400">
          <Lock className="h-4 w-4" />
          <span>Reconciled</span>
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 text-yellow-600 dark:text-yellow-400">
          <Circle className="h-4 w-4" />
          <span>Uncleared</span>
        </span>
      );
  }
}

function buildCategoryDisplay(
  lineItems: LineItem[],
  categoryNameMap: Record<string, string>
): { text: string; isSplit: boolean; tooltipLines: string[] } {
  if (lineItems.length === 0) {
    return { text: "Uncategorized", isSplit: false, tooltipLines: [] };
  }

  if (lineItems.length === 1) {
    const li = lineItems[0];
    const cat = li.categories;
    let text: string;
    if (cat && cat.parent_id) {
      const parentName = categoryNameMap[cat.parent_id] ?? "";
      text = parentName ? `${parentName} \u2192 ${cat.name}` : cat.name;
    } else if (cat) {
      text = cat.name;
    } else {
      text = "Unknown";
    }
    return { text, isSplit: false, tooltipLines: [] };
  }

  const tooltipLines = lineItems.map((li) => {
    const cat = li.categories;
    let catName: string;
    if (cat && cat.parent_id) {
      const parentName = categoryNameMap[cat.parent_id] ?? "";
      catName = parentName ? `${parentName} \u2192 ${cat.name}` : cat.name;
    } else if (cat) {
      catName = cat.name;
    } else {
      catName = "Unknown";
    }
    return `${catName}: ${formatCurrency(li.amount)}`;
  });

  return {
    text: `Multiple (${lineItems.length})`,
    isSplit: true,
    tooltipLines,
  };
}

export function TransactionTable({
  transactions,
  orgId,
  categoryNameMap,
  runningBalanceMap,
  showRunningBalance,
  currentSort,
  currentOrder,
  accounts,
}: Readonly<TransactionTableProps>) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const bulkUpdateMutation = useBulkUpdateStatus(orgId);
  const bulkDeleteMutation = useBulkDeleteTransactions(orgId);
  const inlineUpdateMutation = useInlineUpdateTransaction(orgId);
  const isMutating = bulkUpdateMutation.isPending || bulkDeleteMutation.isPending;

  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);

  const accountOptions: SelectOption[] = accounts.map((a) => ({
    value: a.id,
    label: a.name,
  }));

  const selectableTransactions = transactions.filter(
    (t) => t.status !== "reconciled"
  );
  const allSelectableSelected =
    selectableTransactions.length > 0 &&
    selectableTransactions.every((t) => selectedIds.has(t.id));

  const toggleExpand = useCallback((id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (allSelectableSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(selectableTransactions.map((t) => t.id)));
    }
  }, [allSelectableSelected, selectableTransactions]);

  const handleStartEdit = useCallback(
    (transactionId: string, field: string) => {
      setEditingCell({ transactionId, field });
    },
    []
  );

  const handleEndEdit = useCallback(() => {
    setEditingCell(null);
  }, []);

  const handleSave = useCallback(
    async (transactionId: string, field: string, value: string) => {
      await inlineUpdateMutation.mutateAsync({
        id: transactionId,
        field,
        value,
      });
    },
    [inlineUpdateMutation]
  );

  function handleSort(field: SortField) {
    const params = new URLSearchParams(searchParams.toString());
    if (currentSort === field) {
      params.set("order", currentOrder === "asc" ? "desc" : "asc");
    } else {
      params.set("sort", field);
      params.set("order", "asc");
    }
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  }

  function getSortIcon(field: SortField) {
    if (currentSort !== field) {
      return <ArrowUpDown className="ml-1 h-3 w-3 opacity-50" />;
    }
    return currentOrder === "asc" ? (
      <ArrowUp className="ml-1 h-3 w-3" />
    ) : (
      <ArrowDown className="ml-1 h-3 w-3" />
    );
  }

  async function handleBulkAction(action: "cleared" | "reconciled" | "delete") {
    setBulkError(null);
    const ids = Array.from(selectedIds);

    try {
      if (action === "delete") {
        await bulkDeleteMutation.mutateAsync({ ids });
      } else {
        await bulkUpdateMutation.mutateAsync({ ids, status: action });
      }
      setSelectedIds(new Set());
    } catch (err) {
      setBulkError(
        err instanceof Error ? err.message : "An error occurred."
      );
    }
  }

  return (
    <TooltipProvider>
      <div>
        {/* Bulk action bar */}
        {selectedIds.size > 0 && (
          <div className="mb-2 flex items-center gap-3 rounded-lg border border-border bg-muted/50 p-3">
            <span className="text-sm font-medium">
              {selectedIds.size} selected
            </span>
            <Button
              size="sm"
              variant="outline"
              disabled={isMutating}
              onClick={() => handleBulkAction("cleared")}
            >
              Mark as Cleared
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={isMutating}
              onClick={() => handleBulkAction("reconciled")}
            >
              Mark as Reconciled
            </Button>
            <Button
              size="sm"
              variant="destructive"
              disabled={isMutating}
              onClick={() => handleBulkAction("delete")}
            >
              Delete Selected
            </Button>
            {bulkError && (
              <span className="text-sm text-destructive">{bulkError}</span>
            )}
          </div>
        )}

        {/* Toolbar */}
        <div className="mb-2 flex items-center justify-end">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              const params = new URLSearchParams(searchParams.toString());
              params.delete("page");
              params.delete("limit");
              router.push(
                `/organizations/${orgId}/reports?${params.toString()}`
              );
            }}
          >
            <Download className="mr-1 h-4 w-4" />
            Export
          </Button>
        </div>

        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                {/* Expand toggle spacer */}
                <th className="w-8 px-2 py-3" />
                {/* Select all checkbox */}
                <th className="w-8 px-2 py-3">
                  <Checkbox
                    checked={allSelectableSelected && selectableTransactions.length > 0}
                    onCheckedChange={toggleSelectAll}
                    aria-label="Select all"
                  />
                </th>
                {/* Sortable: Txn Date */}
                <th className="px-3 py-3 text-left">
                  <button
                    className="inline-flex items-center font-medium text-muted-foreground hover:text-foreground"
                    onClick={() => handleSort("transaction_date")}
                  >
                    Txn Date
                    {getSortIcon("transaction_date")}
                  </button>
                </th>
                {/* Sortable: Created */}
                <th className="px-3 py-3 text-left">
                  <button
                    className="inline-flex items-center font-medium text-muted-foreground hover:text-foreground"
                    onClick={() => handleSort("created_at")}
                  >
                    Created
                    {getSortIcon("created_at")}
                  </button>
                </th>
                {/* Account */}
                <th className="px-3 py-3 text-left font-medium text-muted-foreground">
                  Account
                </th>
                {/* Check # */}
                <th className="px-3 py-3 text-left font-medium text-muted-foreground">
                  Check #
                </th>
                {/* Vendor */}
                <th className="px-3 py-3 text-left font-medium text-muted-foreground">
                  Vendor
                </th>
                {/* Sortable: Description */}
                <th className="px-3 py-3 text-left">
                  <button
                    className="inline-flex items-center font-medium text-muted-foreground hover:text-foreground"
                    onClick={() => handleSort("description")}
                  >
                    Description
                    {getSortIcon("description")}
                  </button>
                </th>
                {/* Categories */}
                <th className="px-3 py-3 text-left font-medium text-muted-foreground">
                  Categories
                </th>
                {/* Sortable: Amount */}
                <th className="px-3 py-3 text-right">
                  <button
                    className="inline-flex items-center font-medium text-muted-foreground hover:text-foreground"
                    onClick={() => handleSort("amount")}
                  >
                    Amount
                    {getSortIcon("amount")}
                  </button>
                </th>
                {/* Sortable: Status */}
                <th className="px-3 py-3 text-left">
                  <button
                    className="inline-flex items-center font-medium text-muted-foreground hover:text-foreground"
                    onClick={() => handleSort("status")}
                  >
                    Status
                    {getSortIcon("status")}
                  </button>
                </th>
                {/* Cleared Date */}
                <th className="px-3 py-3 text-left font-medium text-muted-foreground">
                  Cleared
                </th>
                {/* Running Balance */}
                {showRunningBalance && (
                  <th className="px-3 py-3 text-right font-medium text-muted-foreground">
                    Balance
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {transactions.map((txn) => {
                const lineItems = txn.transaction_line_items ?? [];
                const isIncome = txn.transaction_type === "income";
                const isReconciled = txn.status === "reconciled";
                const isExpanded = expandedRows.has(txn.id);
                const isSelected = selectedIds.has(txn.id);
                const hasSplit = lineItems.length > 1;

                const { text: categoryText, isSplit, tooltipLines } =
                  buildCategoryDisplay(lineItems, categoryNameMap);

                return (
                  <TransactionRow
                    key={txn.id}
                    txn={txn}
                    orgId={orgId}
                    lineItems={lineItems}
                    isIncome={isIncome}
                    isReconciled={isReconciled}
                    isExpanded={isExpanded}
                    isSelected={isSelected}
                    hasSplit={hasSplit}
                    categoryText={categoryText}
                    isSplit={isSplit}
                    tooltipLines={tooltipLines}
                    showRunningBalance={showRunningBalance}
                    runningBalance={runningBalanceMap?.[txn.id] ?? null}
                    categoryNameMap={categoryNameMap}
                    onToggleExpand={toggleExpand}
                    onToggleSelect={toggleSelect}
                    editingCell={editingCell}
                    onStartEdit={handleStartEdit}
                    onEndEdit={handleEndEdit}
                    onSave={handleSave}
                    accountOptions={accountOptions}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </TooltipProvider>
  );
}

function TransactionRow({
  txn,
  orgId,
  lineItems,
  isIncome,
  isReconciled,
  isExpanded,
  isSelected,
  hasSplit,
  categoryText,
  isSplit,
  tooltipLines,
  showRunningBalance,
  runningBalance,
  categoryNameMap,
  onToggleExpand,
  onToggleSelect,
  editingCell,
  onStartEdit,
  onEndEdit,
  onSave,
  accountOptions,
}: Readonly<{
  txn: Transaction;
  orgId: string;
  lineItems: LineItem[];
  isIncome: boolean;
  isReconciled: boolean;
  isExpanded: boolean;
  isSelected: boolean;
  hasSplit: boolean;
  categoryText: string;
  isSplit: boolean;
  tooltipLines: string[];
  showRunningBalance: boolean;
  runningBalance: number | null;
  categoryNameMap: Record<string, string>;
  onToggleExpand: (id: string) => void;
  onToggleSelect: (id: string) => void;
  editingCell: EditingCell | null;
  onStartEdit: (transactionId: string, field: string) => void;
  onEndEdit: () => void;
  onSave: (transactionId: string, field: string, value: string) => Promise<void>;
  accountOptions: SelectOption[];
}>) {
  // Count total columns for expanded row colspan
  const totalCols = showRunningBalance ? 13 : 12;

  const isEditingField = (field: string) =>
    editingCell?.transactionId === txn.id && editingCell?.field === field;

  return (
    <>
      <tr className="border-b border-border last:border-b-0 hover:bg-muted/30">
        {/* Expand toggle */}
        <td className="px-2 py-3">
          {hasSplit ? (
            <button
              onClick={() => onToggleExpand(txn.id)}
              className="text-muted-foreground hover:text-foreground"
              aria-label={isExpanded ? "Collapse line items" : "Expand line items"}
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>
          ) : null}
        </td>
        {/* Checkbox */}
        <td className="px-2 py-3">
          <Checkbox
            checked={isSelected}
            onCheckedChange={() => onToggleSelect(txn.id)}
            disabled={isReconciled}
            aria-label={`Select transaction ${txn.description}`}
          />
        </td>
        {/* Txn Date - inline editable */}
        <InlineEditCell
          transactionId={txn.id}
          field="transaction_date"
          value={txn.transaction_date}
          displayValue={formatDate(txn.transaction_date)}
          fieldType="date"
          isEditable={!isReconciled}
          isEditing={isEditingField("transaction_date")}
          onStartEdit={() => onStartEdit(txn.id, "transaction_date")}
          onEndEdit={onEndEdit}
          onSave={(val) => onSave(txn.id, "transaction_date", val)}
          className="px-3 py-3 whitespace-nowrap"
        />
        {/* Created Date - not editable */}
        <td className="px-3 py-3 whitespace-nowrap text-muted-foreground">
          {txn.created_at ? formatDateTime(txn.created_at) : "\u2014"}
        </td>
        {/* Account - inline editable */}
        <InlineEditCell
          transactionId={txn.id}
          field="account_id"
          value={txn.account_id}
          displayValue={
            <span className="text-muted-foreground">
              {txn.accounts?.name ?? "Unknown"}
            </span>
          }
          fieldType="select"
          isEditable={!isReconciled}
          isEditing={isEditingField("account_id")}
          onStartEdit={() => onStartEdit(txn.id, "account_id")}
          onEndEdit={onEndEdit}
          onSave={(val) => onSave(txn.id, "account_id", val)}
          selectOptions={accountOptions}
          className="px-3 py-3 whitespace-nowrap"
        />
        {/* Check # - inline editable */}
        <InlineEditCell
          transactionId={txn.id}
          field="check_number"
          value={txn.check_number ?? ""}
          displayValue={
            <span className="text-muted-foreground">
              {txn.check_number || "\u2014"}
            </span>
          }
          fieldType="text"
          isEditable={!isReconciled}
          isEditing={isEditingField("check_number")}
          onStartEdit={() => onStartEdit(txn.id, "check_number")}
          onEndEdit={onEndEdit}
          onSave={(val) => onSave(txn.id, "check_number", val)}
          className="px-3 py-3 whitespace-nowrap"
        />
        {/* Vendor - inline editable */}
        <InlineEditCell
          transactionId={txn.id}
          field="vendor"
          value={txn.vendor ?? ""}
          displayValue={
            <span className="text-muted-foreground">
              {txn.vendor || "\u2014"}
            </span>
          }
          fieldType="text"
          isEditable={!isReconciled}
          isEditing={isEditingField("vendor")}
          onStartEdit={() => onStartEdit(txn.id, "vendor")}
          onEndEdit={onEndEdit}
          onSave={(val) => onSave(txn.id, "vendor", val)}
          className="px-3 py-3 whitespace-nowrap"
        />
        {/* Description - inline editable */}
        <InlineEditCell
          transactionId={txn.id}
          field="description"
          value={txn.description}
          displayValue={
            <span className="inline-flex items-center gap-1.5">
              <span className="font-medium">{txn.description}</span>
              <Link
                href={`/organizations/${orgId}/transactions/${txn.id}`}
                className="text-muted-foreground hover:text-foreground"
                onClick={(e) => e.stopPropagation()}
              >
                <ExternalLink className="h-3 w-3" />
              </Link>
            </span>
          }
          fieldType="text"
          isEditable={!isReconciled}
          isEditing={isEditingField("description")}
          onStartEdit={() => onStartEdit(txn.id, "description")}
          onEndEdit={onEndEdit}
          onSave={(val) => onSave(txn.id, "description", val)}
          className="px-3 py-3"
        />
        {/* Categories - not editable */}
        <td className="px-3 py-3 whitespace-nowrap text-muted-foreground">
          {isSplit ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex items-center gap-1 cursor-default">
                  <GitBranch className="h-3.5 w-3.5" />
                  {categoryText}
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <div className="space-y-0.5 text-xs">
                  {tooltipLines.map((line, i) => (
                    <div key={i}>{line}</div>
                  ))}
                </div>
              </TooltipContent>
            </Tooltip>
          ) : (
            categoryText
          )}
        </td>
        {/* Amount - inline editable (only for single line item) */}
        <InlineEditCell
          transactionId={txn.id}
          field="amount"
          value={String(txn.amount)}
          displayValue={
            <span
              className={`font-medium tabular-nums ${
                isIncome
                  ? "text-green-600 dark:text-green-400"
                  : "text-red-600 dark:text-red-400"
              }`}
            >
              {isIncome ? "+" : "-"}
              {formatCurrency(txn.amount)}
            </span>
          }
          fieldType="number"
          isEditable={!isReconciled && !hasSplit}
          isEditing={isEditingField("amount")}
          onStartEdit={() => onStartEdit(txn.id, "amount")}
          onEndEdit={onEndEdit}
          onSave={(val) => onSave(txn.id, "amount", val)}
          className="px-3 py-3 whitespace-nowrap text-right"
        />
        {/* Status - inline editable */}
        <InlineEditCell
          transactionId={txn.id}
          field="status"
          value={txn.status}
          displayValue={<StatusIcon status={txn.status} />}
          fieldType="select"
          isEditable={!isReconciled}
          isEditing={isEditingField("status")}
          onStartEdit={() => onStartEdit(txn.id, "status")}
          onEndEdit={onEndEdit}
          onSave={(val) => onSave(txn.id, "status", val)}
          selectOptions={STATUS_OPTIONS}
          className="px-3 py-3 whitespace-nowrap"
        />
        {/* Cleared Date - not editable */}
        <td className="px-3 py-3 whitespace-nowrap text-muted-foreground">
          {txn.cleared_at ? formatDateTime(txn.cleared_at) : "\u2014"}
        </td>
        {/* Running Balance */}
        {showRunningBalance && (
          <td className="px-3 py-3 whitespace-nowrap text-right tabular-nums font-medium">
            {runningBalance !== null ? formatCurrency(runningBalance) : ""}
          </td>
        )}
      </tr>
      {/* Expanded line item rows */}
      {isExpanded &&
        lineItems.map((li) => {
          const cat = li.categories;
          let catName: string;
          if (cat && cat.parent_id) {
            const parentName = categoryNameMap[cat.parent_id] ?? "";
            catName = parentName
              ? `${parentName} \u2192 ${cat.name}`
              : cat.name;
          } else if (cat) {
            catName = cat.name;
          } else {
            catName = "Unknown";
          }

          return (
            <tr
              key={li.id}
              className="border-b border-border bg-muted/20 last:border-b-0"
            >
              <td colSpan={8} className="px-3 py-2">
                <div className="pl-12 text-xs text-muted-foreground">
                  {catName}
                  {li.memo && (
                    <span className="ml-2 italic">&mdash; {li.memo}</span>
                  )}
                </div>
              </td>
              <td className="px-3 py-2" />
              <td className="px-3 py-2 text-right text-xs tabular-nums text-muted-foreground">
                {formatCurrency(li.amount)}
              </td>
              <td colSpan={totalCols - 10} className="px-3 py-2" />
            </tr>
          );
        })}
    </>
  );
}
