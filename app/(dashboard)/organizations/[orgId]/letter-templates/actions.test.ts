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

/**
 * Shape of the chain object each `mockSupabase.from()` call returns, narrow
 * enough to assert on the query-builder methods a given write invoked.
 */
type MockChain = {
  update: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  neq: ReturnType<typeof vi.fn>;
};

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

    it("returns a distinct error when clearing the previous default fails, not a duplicate-name error", async () => {
      mockSupabase.mockChain().sequence([
        { data: { id: orgId }, error: null }, // organization lookup
        { data: null, error: { message: "update failed" } }, // clearDefault write fails
      ]);

      const result = await createLetterTemplate(
        null,
        validCreateData({ is_default: "true" })
      );

      expect(result?.error).toBeDefined();
      expect(result?.error).not.toContain("already exists");
    });
  });

  describe("updateLetterTemplate", () => {
    it("requires a template id", async () => {
      const result = await updateLetterTemplate(null, validCreateData());
      expect(result?.error).toBeDefined();
    });

    it("returns an error when not signed in", async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      } as never);

      const result = await updateLetterTemplate(
        null,
        validCreateData({ id: templateId })
      );
      expect(result).toEqual({ error: "You must be signed in." });
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

    it("reports a duplicate name clearly", async () => {
      mockSupabase.mockResult({
        data: null,
        error: { message: "duplicate key", code: "23505" },
      });

      const result = await updateLetterTemplate(
        null,
        validCreateData({ id: templateId })
      );
      expect(result?.error).toContain("already exists");
    });

    it("returns a distinct error when clearing the previous default fails, not a duplicate-name error", async () => {
      mockSupabase.mockChain().sequence([
        { data: null, error: { message: "update failed" } }, // clearDefault write fails
      ]);

      const result = await updateLetterTemplate(
        null,
        validCreateData({ id: templateId, is_default: "true" })
      );

      expect(result?.error).toBeDefined();
      expect(result?.error).not.toContain("already exists");
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
      expect(mockSupabase.from).toHaveBeenNthCalledWith(1, "letter_templates");
      expect(mockSupabase.from).toHaveBeenNthCalledWith(2, "letter_templates");

      // `mock.results` reflects call order, so results[0] is necessarily the
      // first write the action performed and results[1] the second. Asserting
      // on which payload each one carries proves the clear genuinely ran
      // before the promote, not merely that two writes happened.
      const [firstChain, secondChain] = mockSupabase.from.mock.results.map(
        (call) => call.value as MockChain
      );

      // The clearing write flips the old default off, excludes the row being
      // promoted (so it isn't wiped out along with the old default), and
      // happens first.
      expect(firstChain.update).toHaveBeenCalledWith({ is_default: false });
      expect(firstChain.neq).toHaveBeenCalledWith("id", templateId);

      // The promoting write sets the target row's default flag on, and
      // happens second.
      expect(secondChain.update).toHaveBeenCalledWith({ is_default: true });
      expect(secondChain.eq).toHaveBeenCalledWith("id", templateId);
    });

    it("returns a distinct error when clearing the previous default fails, not a duplicate-name error", async () => {
      mockSupabase.mockChain().sequence([
        { data: null, error: { message: "update failed" } }, // clearDefault write fails
      ]);

      const fd = makeFormData({ id: templateId, organization_id: orgId });
      const result = await setDefaultLetterTemplate(null, fd);

      expect(result?.error).toBeDefined();
      expect(result?.error).not.toContain("already exists");
    });
  });
});
