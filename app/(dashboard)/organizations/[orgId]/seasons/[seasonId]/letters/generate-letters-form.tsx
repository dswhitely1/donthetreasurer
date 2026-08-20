"use client";

import { useState } from "react";

import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface LetterCandidate {
  enrollmentId: string;
  studentName: string;
  feeAmount: number;
  totalPaid: number;
  balanceDue: number;
}

interface TemplateOption {
  id: string;
  name: string;
}

function filenameFromResponse(response: Response): string | null {
  const disposition = response.headers.get("Content-Disposition");
  const match = disposition?.match(/filename="([^"]+)"/);
  return match ? match[1] : null;
}

export function GenerateLettersForm({
  orgId,
  seasonId,
  candidates,
  templates,
  defaultTemplateId,
}: Readonly<{
  orgId: string;
  seasonId: string;
  candidates: LetterCandidate[];
  templates: TemplateOption[];
  defaultTemplateId: string;
}>) {
  const [templateId, setTemplateId] = useState(defaultTemplateId);
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(candidates.map((candidate) => candidate.enrollmentId))
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allSelected = selected.size === candidates.length;

  function toggleOne(enrollmentId: string, checked: boolean): void {
    setSelected((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(enrollmentId);
      } else {
        next.delete(enrollmentId);
      }
      return next;
    });
  }

  function toggleAll(checked: boolean): void {
    setSelected(
      checked
        ? new Set(candidates.map((candidate) => candidate.enrollmentId))
        : new Set()
    );
  }

  async function handleGenerate(): Promise<void> {
    setError(null);
    setIsGenerating(true);

    try {
      const response = await fetch(
        `/api/organizations/${orgId}/seasons/${seasonId}/letters`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            template_id: templateId,
            enrollment_ids: Array.from(selected),
          }),
        }
      );

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(payload?.error ?? "Failed to generate letters.");
        return;
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filenameFromResponse(response) ?? "letters.pdf";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError("Failed to generate letters.");
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="flex flex-col gap-1.5 sm:max-w-sm">
        <Label htmlFor="letter-template">Letter Template</Label>
        <Select value={templateId} onValueChange={setTemplateId}>
          <SelectTrigger id="letter-template">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {templates.map((template) => (
              <SelectItem key={template.id} value={template.id}>
                {template.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-2 text-left">
                <Checkbox
                  aria-label="Select all recipients"
                  checked={allSelected}
                  onCheckedChange={(checked) => toggleAll(checked === true)}
                />
              </th>
              <th className="px-4 py-2 text-left font-medium">Student</th>
              <th className="px-4 py-2 text-right font-medium">Fee</th>
              <th className="px-4 py-2 text-right font-medium">Paid</th>
              <th className="px-4 py-2 text-right font-medium">Balance Due</th>
            </tr>
          </thead>
          <tbody>
            {candidates.map((candidate) => (
              <tr key={candidate.enrollmentId} className="border-t border-border">
                <td className="px-4 py-2">
                  <Checkbox
                    aria-label={`Include ${candidate.studentName}`}
                    checked={selected.has(candidate.enrollmentId)}
                    onCheckedChange={(checked) =>
                      toggleOne(candidate.enrollmentId, checked === true)
                    }
                  />
                </td>
                <td className="px-4 py-2">{candidate.studentName}</td>
                <td className="px-4 py-2 text-right tabular-nums">
                  {formatCurrency(candidate.feeAmount)}
                </td>
                <td className="px-4 py-2 text-right tabular-nums">
                  {formatCurrency(candidate.totalPaid)}
                </td>
                <td className="px-4 py-2 text-right font-medium tabular-nums">
                  {formatCurrency(candidate.balanceDue)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          onClick={handleGenerate}
          disabled={isGenerating || selected.size === 0}
        >
          {isGenerating
            ? "Generating…"
            : `Generate ${selected.size} Letter${selected.size === 1 ? "" : "s"}`}
        </Button>
        <span className="text-sm text-muted-foreground">
          {selected.size} of {candidates.length} selected
        </span>
      </div>
    </div>
  );
}
