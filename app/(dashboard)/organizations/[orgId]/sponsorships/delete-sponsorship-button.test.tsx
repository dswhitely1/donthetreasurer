import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mockDeleteSponsorship = vi.fn();

vi.mock("./actions", () => ({
  deleteSponsorship: (...args: unknown[]) => mockDeleteSponsorship(...args),
}));

import { DeleteSponsorshipButton } from "./delete-sponsorship-button";

const sponsorshipId = "aa0e8400-e29b-41d4-a716-446655440000";
const orgId = "660e8400-e29b-41d4-a716-446655440000";

describe("DeleteSponsorshipButton", () => {
  afterEach(() => {
    cleanup();
    mockDeleteSponsorship.mockReset();
  });

  it("renders a single Delete button before confirmation", () => {
    render(
      <DeleteSponsorshipButton sponsorshipId={sponsorshipId} orgId={orgId} />
    );

    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Confirm Delete" })
    ).not.toBeInTheDocument();
  });

  it("requires a second confirming click before submitting", async () => {
    const user = userEvent.setup();
    render(
      <DeleteSponsorshipButton sponsorshipId={sponsorshipId} orgId={orgId} />
    );

    await user.click(screen.getByRole("button", { name: "Delete" }));

    expect(
      screen.getByRole("button", { name: "Confirm Delete" })
    ).toBeInTheDocument();
    expect(mockDeleteSponsorship).not.toHaveBeenCalled();
  });

  it("returns to the initial state when Cancel is clicked", async () => {
    const user = userEvent.setup();
    render(
      <DeleteSponsorshipButton sponsorshipId={sponsorshipId} orgId={orgId} />
    );

    await user.click(screen.getByRole("button", { name: "Delete" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Confirm Delete" })
    ).not.toBeInTheDocument();
  });

  it("calls deleteSponsorship with the sponsorship and organization ids on confirm", async () => {
    mockDeleteSponsorship.mockResolvedValue(null);
    const user = userEvent.setup();
    render(
      <DeleteSponsorshipButton sponsorshipId={sponsorshipId} orgId={orgId} />
    );

    await user.click(screen.getByRole("button", { name: "Delete" }));
    await user.click(screen.getByRole("button", { name: "Confirm Delete" }));

    await waitFor(() => expect(mockDeleteSponsorship).toHaveBeenCalled());
    const formData = mockDeleteSponsorship.mock.calls[0][1] as FormData;
    expect(formData.get("id")).toBe(sponsorshipId);
    expect(formData.get("organization_id")).toBe(orgId);
  });

  it("surfaces the refusal message returned by deleteSponsorship (e.g. part of a deposit)", async () => {
    mockDeleteSponsorship.mockResolvedValue({
      error:
        "This sponsorship is part of a deposit. Delete the deposit transaction first — that returns its payments to the queue.",
    });
    const user = userEvent.setup();
    render(
      <DeleteSponsorshipButton sponsorshipId={sponsorshipId} orgId={orgId} />
    );

    await user.click(screen.getByRole("button", { name: "Delete" }));
    await user.click(screen.getByRole("button", { name: "Confirm Delete" }));

    expect(
      await screen.findByText(/part of a deposit/i)
    ).toBeInTheDocument();
  });
});
