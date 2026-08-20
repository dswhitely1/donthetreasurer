import { describe, it, expect } from "vitest";

import {
  createLetterTemplateSchema,
  updateLetterTemplateSchema,
  letterTemplateIdSchema,
} from "./letter-template";

const orgId = "660e8400-e29b-41d4-a716-446655440000";
const templateId = "770e8400-e29b-41d4-a716-446655440000";

function validInput(overrides: Record<string, unknown> = {}) {
  return {
    organization_id: orgId,
    name: "First Notice",
    heading: "Outstanding Balance Notice",
    body: "Dear {{guardian_name}}, you owe {{balance_due}}.",
    closing: "Sincerely,",
    is_default: "false",
    ...overrides,
  };
}

describe("createLetterTemplateSchema", () => {
  it("accepts a valid template", () => {
    expect(createLetterTemplateSchema.safeParse(validInput()).success).toBe(true);
  });

  it("accepts empty heading and closing", () => {
    const result = createLetterTemplateSchema.safeParse(
      validInput({ heading: "", closing: "" })
    );
    expect(result.success).toBe(true);
  });

  it("rejects an empty name", () => {
    const result = createLetterTemplateSchema.safeParse(validInput({ name: "" }));
    expect(result.success).toBe(false);
  });

  it("rejects an empty body", () => {
    const result = createLetterTemplateSchema.safeParse(validInput({ body: "" }));
    expect(result.success).toBe(false);
  });

  it("rejects a body longer than 5000 characters", () => {
    const result = createLetterTemplateSchema.safeParse(
      validInput({ body: "x".repeat(5001) })
    );
    expect(result.success).toBe(false);
  });

  it("rejects an unknown placeholder in the body", () => {
    const result = createLetterTemplateSchema.safeParse(
      validInput({ body: "You owe {{ballance_due}}." })
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain("{{ballance_due}}");
      expect(result.error.issues[0].path).toEqual(["body"]);
    }
  });

  it("rejects an unknown placeholder in the heading", () => {
    const result = createLetterTemplateSchema.safeParse(
      validInput({ heading: "Notice for {{stdent_name}}" })
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual(["heading"]);
    }
  });

  it("rejects an unknown placeholder in the closing", () => {
    const result = createLetterTemplateSchema.safeParse(
      validInput({ closing: "Regards, {{signer}}" })
    );
    expect(result.success).toBe(false);
  });

  it("lists every unknown token in one message", () => {
    const result = createLetterTemplateSchema.safeParse(
      validInput({ body: "{{alpha}} and {{beta}}" })
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain("{{alpha}}");
      expect(result.error.issues[0].message).toContain("{{beta}}");
    }
  });

  it("coerces the is_default checkbox string to a boolean", () => {
    const result = createLetterTemplateSchema.safeParse(
      validInput({ is_default: "true" })
    );
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.is_default).toBe(true);
    }
  });
});

describe("updateLetterTemplateSchema", () => {
  it("requires a template id", () => {
    expect(updateLetterTemplateSchema.safeParse(validInput()).success).toBe(false);
  });

  it("accepts a valid update", () => {
    const result = updateLetterTemplateSchema.safeParse(
      validInput({ id: templateId })
    );
    expect(result.success).toBe(true);
  });

  it("still rejects unknown placeholders", () => {
    const result = updateLetterTemplateSchema.safeParse(
      validInput({ id: templateId, body: "{{nope}}" })
    );
    expect(result.success).toBe(false);
  });
});

describe("letterTemplateIdSchema", () => {
  it("accepts a valid id pair", () => {
    const result = letterTemplateIdSchema.safeParse({
      id: templateId,
      organization_id: orgId,
    });
    expect(result.success).toBe(true);
  });

  it("rejects a non-uuid id", () => {
    const result = letterTemplateIdSchema.safeParse({
      id: "not-a-uuid",
      organization_id: orgId,
    });
    expect(result.success).toBe(false);
  });
});
