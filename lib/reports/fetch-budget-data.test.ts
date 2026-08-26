import { describe, expect, it } from "vitest";

import { buildNetLine, collectDescendantIds } from "./fetch-budget-data";

describe("collectDescendantIds", () => {
  it("collects grandchildren, not just direct children", () => {
    const children = new Map([
      ["a", ["b"]],
      ["b", ["c"]],
    ]);
    expect(collectDescendantIds("a", children).sort()).toEqual(["b", "c"]);
  });

  it("terminates on a parent cycle", () => {
    const children = new Map([
      ["a", ["b"]],
      ["b", ["a"]],
    ]);
    expect(collectDescendantIds("a", children)).toEqual(["b"]);
  });

  it("returns an empty array for a leaf", () => {
    expect(collectDescendantIds("a", new Map())).toEqual([]);
  });
});

describe("buildNetLine", () => {
  const noChildren = new Map<string, string[]>();

  it("under-collected income is unfavorable", () => {
    const line = buildNetLine("c", "Dues", 12400, new Map([["c", 8200]]), noChildren);
    expect(line.variance).toBe(-4200);
    expect(line.favorable).toBe(false);
    expect(line.percentOfPlan).toBeCloseTo(66.13, 2);
  });

  it("under-spent expense is favorable", () => {
    const line = buildNetLine("c", "Repairs", -1000, new Map([["c", -430]]), noChildren);
    expect(line.variance).toBe(570);
    expect(line.favorable).toBe(true);
    expect(line.percentOfPlan).toBeCloseTo(43, 2);
  });

  it("beating a net plan is favorable", () => {
    const line = buildNetLine("c", "Poinsettias", 3100, new Map([["c", 3400]]), noChildren);
    expect(line.variance).toBe(300);
    expect(line.favorable).toBe(true);
    expect(line.percentOfPlan).toBeCloseTo(109.68, 2);
  });

  it("reports a negative percent when a planned-positive activity loses money", () => {
    const line = buildNetLine("c", "Poinsettias", 3100, new Map([["c", -200]]), noChildren);
    expect(line.variance).toBe(-3300);
    expect(line.favorable).toBe(false);
    expect(line.percentOfPlan).toBeCloseTo(-6.45, 2);
  });

  it("returns null percent when nothing is budgeted", () => {
    expect(buildNetLine("c", "X", 0, new Map(), noChildren).percentOfPlan).toBeNull();
  });

  it("rolls descendant activity into a parent line", () => {
    const line = buildNetLine(
      "p",
      "Fundraising",
      3000,
      new Map([["p", 100], ["child", 2900]]),
      new Map([["p", ["child"]]])
    );
    expect(line.actual).toBe(3000);
    expect(line.favorable).toBe(true);
  });
});
