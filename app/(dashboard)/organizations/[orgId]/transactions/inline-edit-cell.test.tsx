import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/components/ui/tooltip", () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  TooltipTrigger: ({ children, asChild, ...props }: {
    children: React.ReactNode;
    asChild?: boolean;
  }) => <span {...props}>{children}</span>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => (
    <div role="tooltip">{children}</div>
  ),
}));

import { InlineEditCell } from "./inline-edit-cell";

import type { SelectOption } from "./inline-edit-cell";

function renderCell(overrides: Partial<Parameters<typeof InlineEditCell>[0]> = {}) {
  const defaults = {
    transactionId: "txn-1",
    field: "description",
    value: "Office Supplies",
    displayValue: <span>Office Supplies</span>,
    fieldType: "text" as const,
    isEditable: true,
    isEditing: false,
    onStartEdit: vi.fn(),
    onEndEdit: vi.fn(),
    onSave: vi.fn().mockResolvedValue(undefined),
  };

  const props = { ...defaults, ...overrides };

  const { rerender } = render(
    <table>
      <tbody>
        <tr>
          <InlineEditCell {...props} />
        </tr>
      </tbody>
    </table>
  );

  return {
    props,
    rerender: (newOverrides: Partial<Parameters<typeof InlineEditCell>[0]> = {}) => {
      const newProps = { ...props, ...newOverrides };
      rerender(
        <table>
          <tbody>
            <tr>
              <InlineEditCell {...newProps} />
            </tr>
          </tbody>
        </table>
      );
      return newProps;
    },
  };
}

describe("InlineEditCell", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  describe("display mode", () => {
    it("renders display value", () => {
      renderCell({ displayValue: <span>Office Supplies</span> });
      expect(screen.getByText("Office Supplies")).toBeInTheDocument();
    });

    it("renders as a td element", () => {
      renderCell();
      const td = screen.getByText("Office Supplies").closest("td");
      expect(td).toBeInTheDocument();
    });

    it("applies className to td", () => {
      renderCell({ className: "px-4 py-2" });
      const td = screen.getByText("Office Supplies").closest("td");
      expect(td?.className).toContain("px-4 py-2");
    });

    it("calls onStartEdit when editable cell is clicked", async () => {
      const user = userEvent.setup();
      const { props } = renderCell();

      const td = screen.getByText("Office Supplies").closest("td")!;
      await user.click(td);

      expect(props.onStartEdit).toHaveBeenCalledTimes(1);
    });

    it("does not call onStartEdit when non-editable cell is clicked", async () => {
      const user = userEvent.setup();
      const { props } = renderCell({ isEditable: false });

      const td = screen.getByText("Office Supplies").closest("td")!;
      await user.click(td);

      expect(props.onStartEdit).not.toHaveBeenCalled();
    });

    it("has cursor-pointer class when editable", () => {
      renderCell({ isEditable: true });
      const td = screen.getByText("Office Supplies").closest("td");
      expect(td?.className).toContain("cursor-pointer");
    });

    it("does not have cursor-pointer class when not editable", () => {
      renderCell({ isEditable: false });
      const td = screen.getByText("Office Supplies").closest("td");
      expect(td?.className).not.toContain("cursor-pointer");
    });
  });

  describe("text edit mode", () => {
    it("renders an input when isEditing is true", () => {
      renderCell({ isEditing: true, fieldType: "text" });
      const input = screen.getByRole("textbox");
      expect(input).toBeInTheDocument();
    });

    it("input has current value", () => {
      renderCell({ isEditing: true, value: "Office Supplies" });
      const input = screen.getByRole("textbox");
      expect(input).toHaveValue("Office Supplies");
    });

    it("saves on Enter key", async () => {
      const user = userEvent.setup();
      const { props } = renderCell({ isEditing: true, value: "Office Supplies" });

      const input = screen.getByRole("textbox");
      await user.clear(input);
      await user.type(input, "New Value{Enter}");

      expect(props.onSave).toHaveBeenCalledWith("New Value");
    });

    it("cancels on Escape key without saving", async () => {
      const user = userEvent.setup();
      const { props } = renderCell({ isEditing: true, value: "Office Supplies" });

      const input = screen.getByRole("textbox");
      await user.type(input, " extra");
      await user.keyboard("{Escape}");

      expect(props.onSave).not.toHaveBeenCalled();
      expect(props.onEndEdit).toHaveBeenCalled();
    });

    it("saves on blur", async () => {
      const user = userEvent.setup();
      const { props } = renderCell({ isEditing: true, value: "Office Supplies" });

      const input = screen.getByRole("textbox");
      await user.clear(input);
      await user.type(input, "Updated");
      await user.tab();

      expect(props.onSave).toHaveBeenCalledWith("Updated");
    });

    it("does not save if value is unchanged", async () => {
      const user = userEvent.setup();
      const { props } = renderCell({ isEditing: true, value: "Office Supplies" });

      screen.getByRole("textbox"); // ensure input is rendered
      await user.keyboard("{Enter}");

      expect(props.onSave).not.toHaveBeenCalled();
      expect(props.onEndEdit).toHaveBeenCalled();
    });
  });

  describe("date edit mode", () => {
    it("renders a date input", () => {
      renderCell({ isEditing: true, fieldType: "date", value: "2025-01-15" });
      const input = document.querySelector('input[type="date"]');
      expect(input).toBeInTheDocument();
      expect(input).toHaveValue("2025-01-15");
    });
  });

  describe("number edit mode", () => {
    it("renders a number input with step", () => {
      renderCell({ isEditing: true, fieldType: "number", value: "500.00" });
      const input = document.querySelector('input[type="number"]');
      expect(input).toBeInTheDocument();
      expect(input).toHaveAttribute("step", "0.01");
      expect(input).toHaveAttribute("min", "0.01");
    });
  });

  describe("select edit mode", () => {
    const selectOptions: SelectOption[] = [
      { value: "uncleared", label: "Uncleared" },
      { value: "cleared", label: "Cleared" },
      { value: "reconciled", label: "Reconciled" },
    ];

    it("renders a select with options", () => {
      renderCell({
        isEditing: true,
        fieldType: "select",
        value: "uncleared",
        selectOptions,
      });

      const select = screen.getByRole("combobox");
      expect(select).toBeInTheDocument();
      expect(screen.getByText("Uncleared")).toBeInTheDocument();
      expect(screen.getByText("Cleared")).toBeInTheDocument();
      expect(screen.getByText("Reconciled")).toBeInTheDocument();
    });

    it("saves immediately on change", async () => {
      const user = userEvent.setup();
      const { props } = renderCell({
        isEditing: true,
        fieldType: "select",
        value: "uncleared",
        selectOptions,
      });

      const select = screen.getByRole("combobox");
      await user.selectOptions(select, "cleared");

      expect(props.onSave).toHaveBeenCalledWith("cleared");
    });
  });

  describe("saving state", () => {
    it("disables input while saving", async () => {
      let resolveSave: () => void;
      const saveFn = vi.fn(
        () => new Promise<void>((resolve) => { resolveSave = resolve; })
      );

      const user = userEvent.setup();
      renderCell({
        isEditing: true,
        value: "Old",
        onSave: saveFn,
      });

      const input = screen.getByRole("textbox");
      await user.clear(input);
      await user.type(input, "New{Enter}");

      expect(input).toBeDisabled();

      resolveSave!();
      await waitFor(() => {
        expect(saveFn).toHaveBeenCalled();
      });
    });
  });

  describe("error handling", () => {
    it("shows error message after save failure", async () => {
      const saveFn = vi.fn().mockRejectedValue(new Error("Validation failed"));
      const onEndEdit = vi.fn();

      const user = userEvent.setup();
      const { rerender } = renderCell({
        isEditing: true,
        value: "Old",
        onSave: saveFn,
        onEndEdit,
      });

      const input = screen.getByRole("textbox");
      await user.clear(input);
      await user.type(input, "Bad value{Enter}");

      await waitFor(() => {
        expect(saveFn).toHaveBeenCalled();
      });

      // After error, onEndEdit should NOT have been called
      expect(onEndEdit).not.toHaveBeenCalled();

      // Switch back to display mode to see error indicator
      rerender({ isEditing: false });

      // Error tooltip content should be present
      expect(screen.getByText("Validation failed")).toBeInTheDocument();
    });

    it("shows generic message for non-Error throws", async () => {
      const saveFn = vi.fn().mockRejectedValue("unknown error");
      const onEndEdit = vi.fn();

      const user = userEvent.setup();
      const { rerender } = renderCell({
        isEditing: true,
        value: "Old",
        onSave: saveFn,
        onEndEdit,
      });

      const input = screen.getByRole("textbox");
      await user.clear(input);
      await user.type(input, "Bad{Enter}");

      await waitFor(() => {
        expect(saveFn).toHaveBeenCalled();
      });

      rerender({ isEditing: false });

      expect(screen.getByText("Save failed.")).toBeInTheDocument();
    });

    it("clears error when entering edit mode again", async () => {
      const saveFn = vi.fn().mockRejectedValue(new Error("Error!"));
      const onEndEdit = vi.fn();

      const user = userEvent.setup();
      const { rerender } = renderCell({
        isEditing: true,
        value: "Old",
        onSave: saveFn,
        onEndEdit,
      });

      const input = screen.getByRole("textbox");
      await user.clear(input);
      await user.type(input, "Bad{Enter}");

      await waitFor(() => {
        expect(saveFn).toHaveBeenCalled();
      });

      // Show display mode with error
      rerender({ isEditing: false });
      expect(screen.getByText("Error!")).toBeInTheDocument();

      // Re-enter edit mode - error should be cleared
      rerender({ isEditing: true, onSave: vi.fn().mockResolvedValue(undefined) });
      expect(screen.queryByText("Error!")).not.toBeInTheDocument();
    });
  });
});
