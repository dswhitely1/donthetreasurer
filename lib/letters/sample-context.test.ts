import { describe, it, expect } from "vitest";

import {
  SAMPLE_SEASON_TOKEN_VALUES,
  SAMPLE_SPONSOR_TOKEN_VALUES,
} from "./sample-context";

describe("sample token values", () => {
  it("populates sponsor placeholders with non-empty sample data", () => {
    // Regression guard: before Fix 3, the form's preview was fed only
    // season sample data, so every sponsor token rendered as an empty
    // string regardless of template type.
    expect(SAMPLE_SPONSOR_TOKEN_VALUES.sponsor_name).toBeTruthy();
    expect(SAMPLE_SPONSOR_TOKEN_VALUES.sponsorship_amount).toBeTruthy();
    expect(SAMPLE_SPONSOR_TOKEN_VALUES.term_label).toBeTruthy();
    expect(SAMPLE_SPONSOR_TOKEN_VALUES.level_name).toBeTruthy();
  });

  it("populates season placeholders with non-empty sample data", () => {
    expect(SAMPLE_SEASON_TOKEN_VALUES.season_name).toBeTruthy();
    expect(SAMPLE_SEASON_TOKEN_VALUES.balance_due).toBeTruthy();
    expect(SAMPLE_SEASON_TOKEN_VALUES.guardian_name).toBeTruthy();
  });

  it("shares the same organization/director values across both sample sets", () => {
    expect(SAMPLE_SPONSOR_TOKEN_VALUES.organization_name).toBe(
      SAMPLE_SEASON_TOKEN_VALUES.organization_name
    );
    expect(SAMPLE_SPONSOR_TOKEN_VALUES.director_name).toBe(
      SAMPLE_SEASON_TOKEN_VALUES.director_name
    );
  });
});
