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
  insert: ReturnType<typeof vi.fn>;
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
        { data: { id: orgId }, error: null }, // organization lookup
        {
          data: null,
          error: {
            message:
              'duplicate key value violates unique constraint "letter_templates_organization_id_name_key"',
            code: "23505",
          },
        }, // insert fails on the name uniqueness constraint
      ]);

      const result = await createLetterTemplate(null, validCreateData());
      expect(result?.error).toContain("already exists");
    });

    it("does not touch the previous default when the insert fails (regression: default must not be cleared before a write that can fail)", async () => {
      mockSupabase.mockChain().sequence([
        { data: { id: orgId }, error: null }, // organization lookup
        {
          data: null,
          error: {
            message:
              'duplicate key value violates unique constraint "letter_templates_organization_id_name_key"',
            code: "23505",
          },
        }, // insert fails — e.g. the treasurer reused an existing name
      ]);

      const result = await createLetterTemplate(
        null,
        validCreateData({ is_default: "true" })
      );

      expect(result?.error).toContain("already exists");
      expect(mockSupabase.from).toHaveBeenCalledTimes(2);

      // The second call must be the insert itself, never clearDefault.
      // Against the pre-fix code — which cleared the default before
      // inserting — this second chain would be clearDefault instead: its
      // `update` would already have wiped the org's real default before the
      // insert, which then fails, ever ran.
      const secondChain = mockSupabase.from.mock.results[1]
        .value as MockChain;
      expect(secondChain.insert).toHaveBeenCalled();
      expect(secondChain.update).not.toHaveBeenCalled();
    });

    it("reports a generic conflict, not a duplicate-name error, when the 23505 is the one-default index", async () => {
      mockSupabase.mockChain().sequence([
        { data: { id: orgId }, error: null }, // organization lookup
        {
          data: null,
          error: {
            message:
              'duplicate key value violates unique constraint "idx_letter_templates_one_default"',
            code: "23505",
          },
        }, // insert fails on the partial default index, not the name
      ]);

      const result = await createLetterTemplate(
        null,
        validCreateData({ is_default: "true" })
      );

      expect(result?.error).toBeDefined();
      expect(result?.error).not.toContain("already exists");
    });

    it("returns a distinct error when clearing the previous default fails, not a duplicate-name error", async () => {
      mockSupabase.mockChain().sequence([
        { data: { id: orgId }, error: null }, // organization lookup
        { data: { id: templateId }, error: null }, // insert succeeds (is_default: false)
        { data: null, error: { message: "update failed" } }, // clearDefault write fails
      ]);

      const result = await createLetterTemplate(
        null,
        validCreateData({ is_default: "true" })
      );

      expect(result?.error).toBeDefined();
      expect(result?.error).not.toContain("already exists");
    });

    it("stores heading and closing as null when left blank", async () => {
      mockSupabase.mockChain().sequence([
        { data: { id: orgId }, error: null }, // organization lookup
        { data: { id: templateId }, error: null }, // insert
      ]);

      try {
        await createLetterTemplate(
          null,
          validCreateData({ heading: "", closing: "" })
        );
        expect.unreachable("expected a redirect");
      } catch (err) {
        expect(err).toBeInstanceOf(RedirectError);
      }

      const insertChain = mockSupabase.from.mock.results[1]
        .value as MockChain;
      expect(insertChain.insert).toHaveBeenCalledWith(
        expect.objectContaining({ heading: null, closing: null })
      );
    });

    it("inserts as non-default, then clears the previous default and promotes the new template", async () => {
      mockSupabase.mockChain().sequence([
        { data: { id: orgId }, error: null }, // organization lookup
        { data: { id: templateId }, error: null }, // insert (forced is_default: false)
        { data: null, error: null }, // clearDefault write
        { data: null, error: null }, // promote write
      ]);

      try {
        await createLetterTemplate(
          null,
          validCreateData({ is_default: "true" })
        );
        expect.unreachable("expected a redirect");
      } catch (err) {
        expect(err).toBeInstanceOf(RedirectError);
      }

      const [, insertChain, clearChain, promoteChain] =
        mockSupabase.from.mock.results.map(
          (call) => call.value as MockChain
        );

      // The insert never carries the requested is_default straight through —
      // it always writes false first.
      expect(insertChain.insert).toHaveBeenCalledWith(
        expect.objectContaining({ is_default: false })
      );

      // Clearing the old default excludes the newly created row, is scoped
      // to the template's own type, and happens before the row is promoted.
      expect(clearChain.update).toHaveBeenCalledWith({ is_default: false });
      expect(clearChain.eq).toHaveBeenCalledWith("template_type", "season_balance");
      expect(clearChain.neq).toHaveBeenCalledWith("id", templateId);

      // Promotion sets the new row's default flag on, after the clear.
      expect(promoteChain.update).toHaveBeenCalledWith({ is_default: true });
      expect(promoteChain.eq).toHaveBeenCalledWith("id", templateId);
    });

    it("scopes the cleared default to the SPONSOR type when promoting a sponsor template (regression: an unscoped clear would silently un-default the org's season template instead)", async () => {
      mockSupabase.mockChain().sequence([
        { data: { id: orgId }, error: null }, // organization lookup
        { data: { id: templateId }, error: null }, // insert (forced is_default: false)
        { data: null, error: null }, // clearDefault write
        { data: null, error: null }, // promote write
      ]);

      try {
        await createLetterTemplate(
          null,
          validCreateData({
            template_type: "sponsor_acknowledgment",
            body: "Thank you {{sponsor_name}} for your generous support.",
            is_default: "true",
          })
        );
        expect.unreachable("expected a redirect");
      } catch (err) {
        expect(err).toBeInstanceOf(RedirectError);
      }

      const [, , clearChain] = mockSupabase.from.mock.results.map(
        (call) => call.value as MockChain
      );

      expect(clearChain.eq).toHaveBeenCalledWith(
        "template_type",
        "sponsor_acknowledgment"
      );
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

    it("returns an error when the organization is not found", async () => {
      mockSupabase.mockResult({ data: null, error: null });
      const result = await updateLetterTemplate(
        null,
        validCreateData({ id: templateId })
      );
      expect(result).toEqual({ error: "Organization not found." });
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
      mockSupabase.mockChain().sequence([
        { data: { id: orgId }, error: null }, // template fetch (stored type; no template_type field -> defaults to season_balance)
        {
          data: null,
          error: {
            message:
              'duplicate key value violates unique constraint "letter_templates_organization_id_name_key"',
            code: "23505",
          },
        }, // main update fails on the name uniqueness constraint
      ]);

      const result = await updateLetterTemplate(
        null,
        validCreateData({ id: templateId })
      );
      expect(result?.error).toContain("already exists");
    });

    it("reports a generic conflict, not a duplicate-name error, when the 23505 is the one-default index", async () => {
      mockSupabase.mockChain().sequence([
        { data: { id: orgId }, error: null }, // template fetch (stored type; no template_type field -> defaults to season_balance)
        {
          data: null,
          error: {
            message:
              'duplicate key value violates unique constraint "idx_letter_templates_one_default"',
            code: "23505",
          },
        }, // main update fails on the partial default index, not the name
      ]);

      const result = await updateLetterTemplate(
        null,
        validCreateData({ id: templateId, is_default: "true" })
      );

      expect(result?.error).toBeDefined();
      expect(result?.error).not.toContain("already exists");
    });

    it("returns a distinct error when clearing the previous default fails, not a duplicate-name error", async () => {
      mockSupabase.mockChain().sequence([
        { data: { id: orgId }, error: null }, // template fetch (stored type; no template_type field -> defaults to season_balance)
        { data: null, error: null }, // main update succeeds (is_default forced false)
        { data: null, error: { message: "update failed" } }, // clearDefault write fails
      ]);

      const result = await updateLetterTemplate(
        null,
        validCreateData({ id: templateId, is_default: "true" })
      );

      expect(result?.error).toBeDefined();
      expect(result?.error).not.toContain("already exists");
    });

    it("stores heading and closing as null when left blank", async () => {
      mockSupabase.mockChain().sequence([
        { data: { id: orgId }, error: null }, // template fetch (stored type; no template_type field -> defaults to season_balance)
        { data: null, error: null }, // main update
      ]);

      try {
        await updateLetterTemplate(
          null,
          validCreateData({ id: templateId, heading: "", closing: "" })
        );
        expect.unreachable("expected a redirect");
      } catch (err) {
        expect(err).toBeInstanceOf(RedirectError);
      }

      const updateChain = mockSupabase.from.mock.results[1]
        .value as MockChain;
      expect(updateChain.update).toHaveBeenCalledWith(
        expect.objectContaining({ heading: null, closing: null })
      );
    });

    it("does not touch the previous default when the update fails (regression: default must not be cleared before a write that can fail)", async () => {
      mockSupabase.mockChain().sequence([
        { data: { id: orgId }, error: null }, // template fetch (stored type; no template_type field -> defaults to season_balance)
        {
          data: null,
          error: {
            message:
              'duplicate key value violates unique constraint "letter_templates_organization_id_name_key"',
            code: "23505",
          },
        }, // main update fails — e.g. the treasurer reused an existing name
      ]);

      const result = await updateLetterTemplate(
        null,
        validCreateData({ id: templateId, is_default: "true" })
      );

      expect(result?.error).toContain("already exists");
      expect(mockSupabase.from).toHaveBeenCalledTimes(2);

      // The first call must be the template fetch (`select`), never
      // clearDefault (`update`). Against the pre-fix code — which had no
      // pre-write guard and cleared the default before writing — this
      // first chain would be clearDefault instead: its `update` would already
      // have wiped the org's real default before the row's own write, which
      // then fails, ever ran.
      const firstChain = mockSupabase.from.mock.results[0].value as Record<
        string,
        ReturnType<typeof vi.fn>
      >;
      expect(firstChain.select).toHaveBeenCalled();
      expect(firstChain.update).not.toHaveBeenCalled();
    });

    it("writes the non-default fields first, then clears the previous default and promotes on the happy path", async () => {
      mockSupabase.mockChain().sequence([
        { data: { id: orgId }, error: null }, // template fetch (stored type; no template_type field -> defaults to season_balance)
        { data: null, error: null }, // main update (forced is_default: false)
        { data: null, error: null }, // clearDefault write
        { data: null, error: null }, // promote write
      ]);

      try {
        await updateLetterTemplate(
          null,
          validCreateData({ id: templateId, is_default: "true" })
        );
        expect.unreachable("expected a redirect");
      } catch (err) {
        expect(err).toBeInstanceOf(RedirectError);
      }

      const [, mainChain, clearChain, promoteChain] =
        mockSupabase.from.mock.results.map(
          (call) => call.value as MockChain
        );

      expect(mainChain.update).toHaveBeenCalledWith(
        expect.objectContaining({ is_default: false })
      );
      expect(clearChain.update).toHaveBeenCalledWith({ is_default: false });
      expect(clearChain.eq).toHaveBeenCalledWith("template_type", "season_balance");
      expect(clearChain.neq).toHaveBeenCalledWith("id", templateId);
      expect(promoteChain.update).toHaveBeenCalledWith({ is_default: true });
      expect(promoteChain.eq).toHaveBeenCalledWith("id", templateId);
    });

    it("validates placeholders against the template's STORED type, ignoring a mismatched submitted type (regression: a tampered request must not persist a token that renders blank under the real vocabulary)", async () => {
      mockSupabase.mockChain().sequence([
        { data: { template_type: "season_balance" }, error: null }, // template fetch: stored type
      ]);

      const result = await updateLetterTemplate(
        null,
        validCreateData({
          id: templateId,
          // Attacker/tampered submission claims sponsor_acknowledgment so
          // {{sponsor_name}} looks valid — the action must validate against
          // the row's real stored type (season_balance) instead.
          template_type: "sponsor_acknowledgment",
          body: "Thank you {{sponsor_name}}.",
        })
      );

      expect(result?.error).toBeDefined();
      expect(result?.error).toContain("{{sponsor_name}}");
      // Only the template-fetch ran; validation failed before the write.
      expect(mockSupabase.from).toHaveBeenCalledTimes(1);
    });

    it("accepts a body valid for the stored type even when a mismatched type is submitted (proves the submitted value is ignored, not merely stricter)", async () => {
      mockSupabase.mockChain().sequence([
        { data: { template_type: "season_balance" }, error: null }, // template fetch: stored type
        { data: null, error: null }, // main update
      ]);

      try {
        await updateLetterTemplate(
          null,
          validCreateData({
            id: templateId,
            template_type: "sponsor_acknowledgment", // ignored — stored type wins
            body: "Dear {{guardian_name}}, you owe {{balance_due}}.",
          })
        );
        expect.unreachable("expected a redirect");
      } catch (err) {
        expect(err).toBeInstanceOf(RedirectError);
      }

      expect(mockRedirect).toHaveBeenCalledWith(
        `/organizations/${orgId}/letter-templates`
      );
    });

    it("returns an error when the template can't be found in this organization", async () => {
      mockSupabase.mockChain().sequence([
        { data: null, error: null }, // template fetch finds nothing
      ]);

      const result = await updateLetterTemplate(
        null,
        validCreateData({ id: templateId })
      );

      expect(result).toEqual({ error: "Organization not found." });
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
      mockSupabase.mockChain().sequence([
        { data: { template_type: "season_balance" }, error: null }, // template fetch (stored type)
        { data: null, error: null }, // clearDefault write
        { data: null, error: null }, // promote write
      ]);
      const fd = makeFormData({ id: templateId, organization_id: orgId });

      await setDefaultLetterTemplate(null, fd);

      // Three calls: look up the template's stored type, clear the old
      // default OF THAT TYPE, then set the new one.
      expect(mockSupabase.from).toHaveBeenCalledTimes(3);
      expect(mockSupabase.from).toHaveBeenNthCalledWith(1, "letter_templates");
      expect(mockSupabase.from).toHaveBeenNthCalledWith(2, "letter_templates");
      expect(mockSupabase.from).toHaveBeenNthCalledWith(3, "letter_templates");

      // `mock.results` reflects call order, so results[1] is necessarily the
      // clearing write and results[2] the promoting write. Asserting on
      // which payload each one carries proves the clear genuinely ran
      // before the promote, not merely that two writes happened.
      const [, clearChain, promoteChain] = mockSupabase.from.mock.results.map(
        (call) => call.value as MockChain
      );

      // The clearing write flips the old default off, is scoped to the
      // template's own type, excludes the row being promoted (so it isn't
      // wiped out along with the old default), and happens first.
      expect(clearChain.update).toHaveBeenCalledWith({ is_default: false });
      expect(clearChain.eq).toHaveBeenCalledWith("template_type", "season_balance");
      expect(clearChain.neq).toHaveBeenCalledWith("id", templateId);

      // The promoting write sets the target row's default flag on, and
      // happens second (third overall).
      expect(promoteChain.update).toHaveBeenCalledWith({ is_default: true });
      expect(promoteChain.eq).toHaveBeenCalledWith("id", templateId);
    });

    it("scopes the cleared default to the template's own SPONSOR type, never the org's season type (regression: an unscoped clear would silently un-default the other type)", async () => {
      mockSupabase.mockChain().sequence([
        { data: { template_type: "sponsor_acknowledgment" }, error: null }, // template fetch
        { data: null, error: null }, // clearDefault write
        { data: null, error: null }, // promote write
      ]);
      const fd = makeFormData({ id: templateId, organization_id: orgId });

      await setDefaultLetterTemplate(null, fd);

      const [, clearChain] = mockSupabase.from.mock.results.map(
        (call) => call.value as MockChain
      );
      expect(clearChain.eq).toHaveBeenCalledWith(
        "template_type",
        "sponsor_acknowledgment"
      );
    });

    it("returns a distinct error when clearing the previous default fails, not a duplicate-name error", async () => {
      mockSupabase.mockChain().sequence([
        { data: { template_type: "season_balance" }, error: null }, // template fetch
        { data: null, error: { message: "update failed" } }, // clearDefault write fails
      ]);

      const fd = makeFormData({ id: templateId, organization_id: orgId });
      const result = await setDefaultLetterTemplate(null, fd);

      expect(result?.error).toBeDefined();
      expect(result?.error).not.toContain("already exists");
    });

    it("returns a distinct error when the template can't be found", async () => {
      mockSupabase.mockChain().sequence([
        { data: null, error: null }, // template fetch finds nothing
      ]);

      const fd = makeFormData({ id: templateId, organization_id: orgId });
      const result = await setDefaultLetterTemplate(null, fd);

      expect(result).toEqual({ error: "Letter template not found." });
    });
  });
});
