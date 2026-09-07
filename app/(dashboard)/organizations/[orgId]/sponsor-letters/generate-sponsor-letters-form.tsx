"use client";

import { useMemo, useState } from "react";

import { formatCurrency } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
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

interface SponsorshipTermOption {
  startDate: string;
  endDate: string;
  label: string;
}

interface SponsorshipCandidate {
  sponsorshipId: string;
  sponsorName: string;
  levelName: string | null;
  amount: number;
  isDeposited: boolean;
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

function termKey(term: SponsorshipTermOption): string {
  return `${term.startDate}|${term.endDate}`;
}

export function GenerateSponsorLettersForm({
  orgId,
  terms,
  defaultTermKey,
  candidatesByTerm,
  templates,
  defaultTemplateId,
}: Readonly<{
  orgId: string;
  terms: SponsorshipTermOption[];
  /** The org's current term when a sponsorship exists for it, otherwise the
   * newest term present — computed by the server so client and server never
   * disagree on which term is "current". */
  defaultTermKey: string;
  candidatesByTerm: Record<string, SponsorshipCandidate[]>;
  templates: TemplateOption[];
  defaultTemplateId: string;
}>) {
  const [selectedTermKey, setSelectedTermKey] = useState(
    defaultTermKey || termKey(terms[0])
  );
  const [templateId, setTemplateId] = useState(defaultTemplateId);
  const candidates = useMemo(
    () => candidatesByTerm[selectedTermKey] ?? [],
    [candidatesByTerm, selectedTermKey]
  );
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(candidates.map((candidate) => candidate.sponsorshipId))
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allSelected =
    candidates.length > 0 && selected.size === candidates.length;

  function selectTerm(key: string): void {
    setSelectedTermKey(key);
    // Every sponsorship in the newly chosen term starts selected — deposit
    // state marks a row, it never removes it from the list.
    setSelected(
      new Set((candidatesByTerm[key] ?? []).map((c) => c.sponsorshipId))
    );
  }

  function toggleOne(sponsorshipId: string, checked: boolean): void {
    setSelected((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(sponsorshipId);
      } else {
        next.delete(sponsorshipId);
      }
      return next;
    });
  }

  function toggleAll(checked: boolean): void {
    setSelected(
      checked
        ? new Set(candidates.map((candidate) => candidate.sponsorshipId))
        : new Set()
    );
  }

  async function handleGenerate(): Promise<void> {
    setError(null);
    setIsGenerating(true);

    try {
      const response = await fetch(
        `/api/organizations/${orgId}/sponsor-letters`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            template_id: templateId,
            sponsorship_ids: Array.from(selected),
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
      anchor.download = filenameFromResponse(response) ?? "sponsor-letters.pdf";
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

      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="flex flex-col gap-1.5 sm:max-w-sm sm:flex-1">
          <Label htmlFor="sponsorship-term">Sponsorship Year</Label>
          <Select value={selectedTermKey} onValueChange={selectTerm}>
            <SelectTrigger id="sponsorship-term">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {terms.map((term) => (
                <SelectItem key={termKey(term)} value={termKey(term)}>
                  {term.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5 sm:max-w-sm sm:flex-1">
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
      </div>

      {candidates.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No sponsorships recorded for this sponsorship year.
        </p>
      ) : (
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
                <th className="px-4 py-2 text-left font-medium">Sponsor</th>
                <th className="px-4 py-2 text-left font-medium">Level</th>
                <th className="px-4 py-2 text-right font-medium">Amount</th>
                <th className="px-4 py-2 text-left font-medium">Deposit</th>
              </tr>
            </thead>
            <tbody>
              {candidates.map((candidate) => (
                <tr
                  key={candidate.sponsorshipId}
                  className="border-t border-border"
                >
                  <td className="px-4 py-2">
                    <Checkbox
                      aria-label={`Include ${candidate.sponsorName}`}
                      checked={selected.has(candidate.sponsorshipId)}
                      onCheckedChange={(checked) =>
                        toggleOne(candidate.sponsorshipId, checked === true)
                      }
                    />
                  </td>
                  <td className="px-4 py-2">{candidate.sponsorName}</td>
                  <td className="px-4 py-2">{candidate.levelName ?? "—"}</td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {formatCurrency(candidate.amount)}
                  </td>
                  <td className="px-4 py-2">
                    <Badge variant={candidate.isDeposited ? "secondary" : "outline"}>
                      {candidate.isDeposited ? "Deposited" : "In queue"}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

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
