import { describe, it, expect, vi, beforeEach } from "vitest";

import { createMockSupabaseClient } from "@/test/mocks/supabase";
import {
  mockRedirect,
  mockRevalidatePath,
  RedirectError,
} from "@/test/mocks/next-navigation";

import type { MockSupabaseClient } from "@/test/mocks/supabase";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));
vi.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}));
vi.mock("next/navigation", () => ({
  redirect: (...args: unknown[]) => mockRedirect(...(args as [string])),
}));

import { createClient } from "@/lib/supabase/server";
import {
  createLetterTemplate,
  updateLetterTemplate,
  deleteLetterTemplate,
  setDefaultLetterTemplate,
} from "./actions";

const mockedCreateClient = vi.mocked(createClient);
const userId = "550e8400-e29b-41d4-a716-446655440000";
const orgId = "660e8400-e29b-41d4-a716-446655440000";
const templateId = "770e8400-e29b-41d4-a716-446655440000";

describe("letter template actions", () => {
  let mockSupabase: MockSupabaseClient;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase = createMockSupabaseClient();
    mockedCreateClient.mockResolvedValue(mockSupabase as never);
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: userId } },
      error: null,
    } as never);
  });

  function makeFormData(data: Record<string, string>): FormData {
    const fd = new FormData();
    for (const [key, val] of Object.entries(data)) {
      fd.set(key, val);
    }
    return fd;
  }

  function validCreateData(overrides: Record<string, string> = {}) {
    return makeFormData({
      organization_id: orgId,
      name: "First Notice",
      heading: "Outstanding Balance Notice",
      body: "Dear {{guardian_name}}, you owe {{balance_due}}.",
      closing: "Sincerely,",
      is_default: "false",
      ...overrides,
    });
  }

  describe("createLetterTemplate", () => {
    it("returns a validation error for an empty name", async () => {
      const result = await createLetterTemplate(null, validCreateData({ name: "" }));
      expect(result?.error).toBeDefined();
    });

    it("returns a validation error for an unknown placeholder", async () => {
      const result = await createLetterTemplate(
        null,
        validCreateData({ body: "You owe {{ballance_due}}." })
      );
      expect(result?.error).toContain("{{ballance_due}}");
    });

    it("returns an error when not signed in", async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      } as never);

      const result = await createLetterTemplate(null, validCreateData());
      expect(result).toEqual({ error: "You must be signed in." });
    });

    it("returns an error when the organization is not found", async () => {
      mockSupabase.mockResult({ data: null, error: null });
      const result = await createLetterTemplate(null, validCreateData());
      expect(result).toEqual({ error: "Organization not found." });
    });

    it("redirects to the template list on success", async () => {
      mockSupabase.mockResult({ data: { id: orgId }, error: null });

      try {
        await createLetterTemplate(null, validCreateData());
        expect.unreachable("expected a redirect");
      } catch (err) {
        expect(err).toBeInstanceOf(RedirectError);
      }

      expect(mockRedirect).toHaveBeenCalledWith(
        `/organizations/${orgId}/letter-templates`
      );
    });

    it("reports a duplicate name clearly", async () => {
      mockSupabase.mockChain().sequence([
        { data: { id: orgId }, error: null },
        { data: null, error: { message: "duplicate key", code: "23505" } },
      ]);

      const result = await createLetterTemplate(null, validCreateData());
      expect(result?.error).toContain("already exists");
    });
  });

  describe("updateLetterTemplate", () => {
    it("requires a template id", async () => {
      const result = await updateLetterTemplate(null, validCreateData());
      expect(result?.error).toBeDefined();
    });

    it("redirects to the template list on success", async () => {
      mockSupabase.mockResult({ data: { id: orgId }, error: null });

      try {
        await updateLetterTemplate(null, validCreateData({ id: templateId }));
        expect.unreachable("expected a redirect");
      } catch (err) {
        expect(err).toBeInstanceOf(RedirectError);
      }

      expect(mockRedirect).toHaveBeenCalledWith(
        `/organizations/${orgId}/letter-templates`
      );
    });
  });

  describe("deleteLetterTemplate", () => {
    it("returns an error for a malformed id", async () => {
      const fd = makeFormData({ id: "nope", organization_id: orgId });
      const result = await deleteLetterTemplate(null, fd);
      expect(result?.error).toBeDefined();
    });

    it("returns an error when not signed in", async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      } as never);

      const fd = makeFormData({ id: templateId, organization_id: orgId });
      const result = await deleteLetterTemplate(null, fd);
      expect(result).toEqual({ error: "You must be signed in." });
    });

    it("revalidates the list after deleting", async () => {
      mockSupabase.mockResult({ data: null, error: null });
      const fd = makeFormData({ id: templateId, organization_id: orgId });

      try {
        await deleteLetterTemplate(null, fd);
      } catch (err) {
        expect(err).toBeInstanceOf(RedirectError);
      }

      expect(mockRevalidatePath).toHaveBeenCalledWith(
        `/organizations/${orgId}/letter-templates`
      );
    });
  });

  describe("setDefaultLetterTemplate", () => {
    it("returns an error when not signed in", async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      } as never);

      const fd = makeFormData({ id: templateId, organization_id: orgId });
      const result = await setDefaultLetterTemplate(null, fd);
      expect(result).toEqual({ error: "You must be signed in." });
    });

    it("clears the previous default before setting the new one", async () => {
      mockSupabase.mockResult({ data: null, error: null });
      const fd = makeFormData({ id: templateId, organization_id: orgId });

      await setDefaultLetterTemplate(null, fd);

      // Two writes: one clearing the old default, one setting the new one.
      expect(mockSupabase.from).toHaveBeenCalledTimes(2);
      expect(mockSupabase.from).toHaveBeenCalledWith("letter_templates");
    });
  });
});
