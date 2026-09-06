import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Radix's <Select> relies on pointer-capture/scroll APIs jsdom doesn't
// implement, so — same idiom as inline-edit-cell.test.tsx's Tooltip mock —
// the primitive is swapped for a plain native <select>. This exercises the
// actual bug from Finding 1 (a value could be selected but never returned to
// unset) without fighting jsdom over Radix internals.
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
      <select
        aria-label="Direction (optional)"
        value={value}
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

import { DirectionSelect } from "./direction-select";

describe("DirectionSelect", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders a hidden input named primary_direction", () => {
    render(<DirectionSelect value="" onValueChange={vi.fn()} />);
    const hidden = document.querySelector('input[type="hidden"]');
    expect(hidden).toHaveAttribute("name", "primary_direction");
  });

  it("carries the required helper text verbatim", () => {
    render(<DirectionSelect value="" onValueChange={vi.fn()} />);
    expect(
      screen.getByText(
        "Groups this category on the categories page. It does not limit which transactions can use it — any category can take both income and expenses."
      )
    ).toBeInTheDocument();
  });

  it("defaults the hidden input to empty string when unset", () => {
    render(<DirectionSelect value="" onValueChange={vi.fn()} />);
    const hidden = document.querySelector(
      'input[type="hidden"]'
    ) as HTMLInputElement;
    expect(hidden.value).toBe("");
  });

  it("seeds from an existing value (edit dialog does not silently blank a set label)", () => {
    render(<DirectionSelect value="income" onValueChange={vi.fn()} />);
    const hidden = document.querySelector(
      'input[type="hidden"]'
    ) as HTMLInputElement;
    expect(hidden.value).toBe("income");
  });

  it("offers a 'Not set' option alongside Income / Expense / Neither", () => {
    render(<DirectionSelect value="" onValueChange={vi.fn()} />);
    expect(screen.getByText("Not set")).toBeInTheDocument();
    expect(screen.getByText("Income")).toBeInTheDocument();
    expect(screen.getByText("Expense")).toBeInTheDocument();
    expect(
      screen.getByText("Neither (transfers between your accounts)")
    ).toBeInTheDocument();
  });

  it("calls onValueChange with 'income' when Income is selected", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<DirectionSelect value="" onValueChange={onValueChange} />);

    await user.selectOptions(screen.getByRole("combobox"), "Income");

    expect(onValueChange).toHaveBeenCalledWith("income");
  });

  it("can be returned to unset after a value was picked, with the hidden input carrying ''", async () => {
    // This is the regression case for Finding 1: once set, a direction
    // could never be driven back to unset because Radix's onValueChange
    // never emits "". Selecting "Not set" must map back to the empty
    // sentinel the server action's "" -> null normalisation expects.
    const user = userEvent.setup();
    let value = "income";
    const onValueChange = vi.fn((next: string) => {
      value = next;
    });

    const { rerender } = render(
      <DirectionSelect value={value} onValueChange={onValueChange} />
    );

    await user.selectOptions(screen.getByRole("combobox"), "Not set");

    expect(onValueChange).toHaveBeenCalledWith("");

    rerender(<DirectionSelect value={value} onValueChange={onValueChange} />);
    const hidden = document.querySelector(
      'input[type="hidden"]'
    ) as HTMLInputElement;
    expect(hidden.value).toBe("");
  });

  it("uses the given id on the trigger label association", () => {
    render(
      <DirectionSelect
        id="edit-primary_direction"
        value=""
        onValueChange={vi.fn()}
      />
    );
    expect(screen.getByText("Direction (optional)")).toHaveAttribute(
      "for",
      "edit-primary_direction"
    );
  });
});
