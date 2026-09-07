import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

// Same idiom as direction-select.test.tsx: swap the Radix primitive for a
// plain native <select> so jsdom doesn't need Radix's pointer-capture APIs.
vi.mock("@/components/ui/select", () => {
  function Select({
    value,
    onValueChange,
    children,
  }: {
    value: string;
    onValueChange: (value: string) => void;
    children: React.ReactNode;
  }) {
    return (
      <select value={value} onChange={(e) => onValueChange(e.target.value)}>
        {children}
      </select>
    );
  }
  function SelectTrigger({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
  }
  function SelectValue() {
    return null;
  }
  function SelectContent({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
  }
  function SelectItem({
    value,
    children,
  }: {
    value: string;
    children: React.ReactNode;
  }) {
    return <option value={value}>{children}</option>;
  }
  return { Select, SelectTrigger, SelectValue, SelectContent, SelectItem };
});

import { GenerateSponsorLettersForm } from "./generate-sponsor-letters-form";

const newestTerm = {
  startDate: "2027-07-01",
  endDate: "2028-06-30",
  label: "2027–28",
};
const currentTerm = {
  startDate: "2026-07-01",
  endDate: "2027-06-30",
  label: "2026–27",
};

function key(term: { startDate: string; endDate: string }): string {
  return `${term.startDate}|${term.endDate}`;
}

const candidatesByTerm = {
  [key(newestTerm)]: [
    {
      sponsorshipId: "future-sponsorship",
      sponsorName: "Future Sponsor Inc",
      levelName: "Gold",
      amount: 500,
      isDeposited: false,
    },
  ],
  [key(currentTerm)]: [
    {
      sponsorshipId: "current-sponsorship",
      sponsorName: "Current Sponsor Inc",
      levelName: "Silver",
      amount: 250,
      isDeposited: false,
    },
  ],
};

describe("GenerateSponsorLettersForm (Fix 8: defaults to the org's current term)", () => {
  afterEach(() => {
    cleanup();
  });

  it("selects the org's current term by default, not merely the newest term present", () => {
    // A future term already logged ahead of time is newest, but the org's
    // current term is what the treasurer actually wants to work from.
    render(
      <GenerateSponsorLettersForm
        orgId="org-1"
        terms={[newestTerm, currentTerm]}
        defaultTermKey={key(currentTerm)}
        candidatesByTerm={candidatesByTerm}
        templates={[]}
        defaultTemplateId=""
      />
    );

    expect(screen.getByText("Current Sponsor Inc")).toBeInTheDocument();
    expect(screen.queryByText("Future Sponsor Inc")).not.toBeInTheDocument();
  });

  it("falls back to the newest term when no current-term sponsorship exists", () => {
    render(
      <GenerateSponsorLettersForm
        orgId="org-1"
        terms={[newestTerm, currentTerm]}
        defaultTermKey=""
        candidatesByTerm={candidatesByTerm}
        templates={[]}
        defaultTemplateId=""
      />
    );

    expect(screen.getByText("Future Sponsor Inc")).toBeInTheDocument();
  });
});
