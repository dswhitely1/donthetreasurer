import { describe, it, expect, vi, afterEach, beforeAll } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

// jsdom has no ResizeObserver; @radix-ui/react-checkbox (used for the
// "Make this the default" toggle) relies on it via @radix-ui/react-use-size.
beforeAll(() => {
  if (!("ResizeObserver" in globalThis)) {
    class MockResizeObserver {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    }
    globalThis.ResizeObserver = MockResizeObserver;
  }
});

vi.mock("./actions", () => ({
  createLetterTemplate: vi.fn(),
  updateLetterTemplate: vi.fn(),
}));

// Same idiom as direction-select.test.tsx: swap the Radix primitive for a
// plain native <select> so every option is present in the DOM without
// needing to open a Radix popover in jsdom, which relies on pointer-capture
// APIs jsdom doesn't implement.
vi.mock("@/components/ui/select", () => {
  function Select({
    value,
    onValueChange,
    disabled,
    children,
  }: {
    value: string;
    onValueChange: (value: string) => void;
    disabled?: boolean;
    children: React.ReactNode;
  }) {
    return (
      <select
        aria-label="Template Type"
        value={value}
        disabled={disabled}
        onChange={(e) => onValueChange(e.target.value)}
      >
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

import { LetterTemplateForm } from "./letter-template-form";

describe("LetterTemplateForm preview (Fix 3: sponsor tokens no longer render blank)", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders sponsor placeholders with sample sponsor data when editing a sponsor_acknowledgment template", () => {
    render(
      <LetterTemplateForm
        mode="edit"
        orgId="org-1"
        seasonsEnabled={true}
        sponsorsEnabled={true}
        defaultValues={{
          id: "template-1",
          name: "Acknowledgment",
          template_type: "sponsor_acknowledgment",
          heading: null,
          body: "Dear {{contact_name}}, thank you for your {{level_name}} sponsorship of {{sponsorship_amount}} for {{term_label}}.",
          closing: null,
          is_default: false,
        }}
      />
    );

    // Previously these tokens rendered as empty strings because the preview
    // was always fed SAMPLE_TOKEN_VALUES built only from season data.
    expect(
      screen.getByText(
        "Dear Sam Rivera, thank you for your Gold sponsorship of $500.00 for 2026–27."
      )
    ).toBeInTheDocument();
  });

  it("still renders season placeholders with sample season data when editing a season_balance template", () => {
    render(
      <LetterTemplateForm
        mode="edit"
        orgId="org-1"
        seasonsEnabled={true}
        sponsorsEnabled={true}
        defaultValues={{
          id: "template-2",
          name: "Balance Notice",
          template_type: "season_balance",
          heading: null,
          body: "Dear {{guardian_name}}, balance due is {{balance_due}}.",
          closing: null,
          is_default: false,
        }}
      />
    );

    expect(
      screen.getByText("Dear Maria Rivera, balance due is $250.00.")
    ).toBeInTheDocument();
  });
});

describe("LetterTemplateForm type defaults and options (Fix 4: form no longer assumes seasons)", () => {
  afterEach(() => {
    cleanup();
  });

  it("defaults a new template to sponsor_acknowledgment for a sponsors-only org", () => {
    render(
      <LetterTemplateForm
        mode="create"
        orgId="org-1"
        seasonsEnabled={false}
        sponsorsEnabled={true}
      />
    );

    const hidden = document.querySelector(
      'input[name="template_type"]'
    ) as HTMLInputElement;
    expect(hidden.value).toBe("sponsor_acknowledgment");
  });

  it("defaults a new template to season_balance for a seasons-only org", () => {
    render(
      <LetterTemplateForm
        mode="create"
        orgId="org-1"
        seasonsEnabled={true}
        sponsorsEnabled={false}
      />
    );

    const hidden = document.querySelector(
      'input[name="template_type"]'
    ) as HTMLInputElement;
    expect(hidden.value).toBe("season_balance");
  });

  it("defaults a new template to season_balance when both are enabled", () => {
    render(
      <LetterTemplateForm
        mode="create"
        orgId="org-1"
        seasonsEnabled={true}
        sponsorsEnabled={true}
      />
    );

    const hidden = document.querySelector(
      'input[name="template_type"]'
    ) as HTMLInputElement;
    expect(hidden.value).toBe("season_balance");
  });

  it("offers only the Sponsor Acknowledgment type for a sponsors-only org", () => {
    render(
      <LetterTemplateForm
        mode="create"
        orgId="org-1"
        seasonsEnabled={false}
        sponsorsEnabled={true}
      />
    );

    expect(screen.getByText("Sponsor Acknowledgment")).toBeInTheDocument();
    expect(screen.queryByText("Season Balance Notice")).not.toBeInTheDocument();
  });

  it("offers only the Season Balance Notice type for a seasons-only org", () => {
    render(
      <LetterTemplateForm
        mode="create"
        orgId="org-1"
        seasonsEnabled={true}
        sponsorsEnabled={false}
      />
    );

    expect(screen.getByText("Season Balance Notice")).toBeInTheDocument();
    expect(
      screen.queryByText("Sponsor Acknowledgment")
    ).not.toBeInTheDocument();
  });
});
