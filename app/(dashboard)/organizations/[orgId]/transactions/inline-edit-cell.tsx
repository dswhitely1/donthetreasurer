"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Loader2, AlertCircle } from "lucide-react";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import type { ReactNode } from "react";

export interface SelectOption {
  value: string;
  label: string;
}

interface InlineEditCellProps {
  transactionId: string;
  field: string;
  value: string;
  displayValue: ReactNode;
  fieldType: "text" | "date" | "number" | "select";
  isEditable: boolean;
  isEditing: boolean;
  onStartEdit: () => void;
  onEndEdit: () => void;
  onSave: (value: string) => Promise<void>;
  selectOptions?: SelectOption[];
  className?: string;
}

export function InlineEditCell({
  value,
  displayValue,
  fieldType,
  isEditable,
  isEditing,
  onStartEdit,
  onEndEdit,
  onSave,
  selectOptions,
  className = "",
}: Readonly<InlineEditCellProps>) {
  const [editValue, setEditValue] = useState(value);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | HTMLSelectElement>(null);
  const savingRef = useRef(false);

  // Reset edit value when entering edit mode
  useEffect(() => {
    if (isEditing) {
      setEditValue(value);
      setError(null);
    }
  }, [isEditing, value]);

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      if (
        inputRef.current instanceof HTMLInputElement &&
        fieldType !== "date"
      ) {
        inputRef.current.select();
      }
    }
  }, [isEditing, fieldType]);

  const handleSave = useCallback(
    async (newValue: string) => {
      if (savingRef.current) return;
      if (newValue === value) {
        onEndEdit();
        return;
      }

      savingRef.current = true;
      setIsSaving(true);
      setError(null);

      try {
        await onSave(newValue);
        onEndEdit();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Save failed.");
      } finally {
        setIsSaving(false);
        savingRef.current = false;
      }
    },
    [value, onSave, onEndEdit]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleSave(editValue);
      } else if (e.key === "Escape") {
        e.preventDefault();
        setError(null);
        onEndEdit();
      }
    },
    [editValue, handleSave, onEndEdit]
  );

  const handleBlur = useCallback(() => {
    if (!savingRef.current) {
      handleSave(editValue);
    }
  }, [editValue, handleSave]);

  const handleSelectChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const newVal = e.target.value;
      setEditValue(newVal);
      handleSave(newVal);
    },
    [handleSave]
  );

  // Display mode
  if (!isEditing) {
    return (
      <td
        className={`${className} ${
          isEditable
            ? "cursor-pointer hover:bg-muted/50 transition-colors"
            : ""
        }`}
        onClick={isEditable ? onStartEdit : undefined}
      >
        <span className="inline-flex items-center gap-1.5">
          {displayValue}
          {isSaving && (
            <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
          )}
          {error && (
            <Tooltip>
              <TooltipTrigger asChild>
                <AlertCircle className="h-3.5 w-3.5 text-destructive" />
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">{error}</p>
              </TooltipContent>
            </Tooltip>
          )}
        </span>
      </td>
    );
  }

  // Edit mode
  if (fieldType === "select" && selectOptions) {
    return (
      <td className={className}>
        <select
          ref={inputRef as React.RefObject<HTMLSelectElement>}
          value={editValue}
          onChange={handleSelectChange}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          disabled={isSaving}
          className="w-full rounded border border-input bg-background px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-ring"
        >
          {selectOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </td>
    );
  }

  return (
    <td className={className}>
      <input
        ref={inputRef as React.RefObject<HTMLInputElement>}
        type={fieldType === "number" ? "number" : fieldType === "date" ? "date" : "text"}
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        disabled={isSaving}
        step={fieldType === "number" ? "0.01" : undefined}
        min={fieldType === "number" ? "0.01" : undefined}
        className="w-full rounded border border-input bg-background px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-ring"
      />
    </td>
  );
}
