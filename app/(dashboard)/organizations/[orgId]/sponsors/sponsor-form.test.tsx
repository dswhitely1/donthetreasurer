import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mockDeleteSponsor = vi.fn();

vi.mock("./actions", () => ({
  createSponsor: vi.fn(),
  updateSponsor: vi.fn(),
  deleteSponsor: (...args: unknown[]) => mockDeleteSponsor(...args),
}));

import { DeleteSponsorButton } from "./sponsor-form";

const sponsorId = "770e8400-e29b-41d4-a716-446655440000";
const orgId = "660e8400-e29b-41d4-a716-446655440000";

describe("DeleteSponsorButton", () => {
  afterEach(() => {
    cleanup();
    mockDeleteSponsor.mockReset();
  });

  it("renders a single Delete Sponsor button before confirmation", () => {
    render(<DeleteSponsorButton sponsorId={sponsorId} orgId={orgId} />);

    expect(
      screen.getByRole("button", { name: "Delete Sponsor" })
    ).toBeInTheDocument();
  });

  it("requires a second confirming click before submitting", async () => {
    const user = userEvent.setup();
    render(<DeleteSponsorButton sponsorId={sponsorId} orgId={orgId} />);

    await user.click(screen.getByRole("button", { name: "Delete Sponsor" }));

    expect(
      screen.getByRole("button", { name: "Confirm Delete" })
    ).toBeInTheDocument();
    expect(mockDeleteSponsor).not.toHaveBeenCalled();
  });

  it("surfaces the refusal message returned by deleteSponsor (sponsorship history)", async () => {
    mockDeleteSponsor.mockResolvedValue({
      error:
        "This sponsor has sponsorship history and cannot be deleted. Mark them inactive instead.",
    });
    const user = userEvent.setup();
    render(<DeleteSponsorButton sponsorId={sponsorId} orgId={orgId} />);

    await user.click(screen.getByRole("button", { name: "Delete Sponsor" }));
    await user.click(screen.getByRole("button", { name: "Confirm Delete" }));

    expect(
      await screen.findByText(/sponsorship history/i)
    ).toBeInTheDocument();
  });
});
