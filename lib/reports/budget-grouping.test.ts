import { describe, it, expect } from "vitest";

import {
  groupBudgetLines,
  isOverBudget,
  rollUpGroup,
  rollUpPercentOfPlan,
  splitCategoryLabel,
} from "./budget-grouping";

import type { BudgetNetLine } from "@/lib/reports/fetch-budget-data";

function line(
  categoryName: string,
  budgeted: number,
  actual: number
): BudgetNetLine {
  return {
    categoryId: categoryName,
    categoryName,
    budgeted,
    actual,
    variance: actual - budgeted,
    favorable: actual >= budgeted,
    percentOfPlan: budgeted === 0 ? null : (actual / budgeted) * 100,
  };
}

describe("splitCategoryLabel", () => {
  it("splits a parent and child on the arrow separator", () => {
    expect(splitCategoryLabel("Fundraisers → Coin Wars")).toEqual({
      parent: "Fundraisers",
      child: "Coin Wars",
    });
  });

  it("treats a label with no separator as a top-level category", () => {
    expect(splitCategoryLabel("Fundraisers")).toEqual({
      parent: "Fundraisers",
      child: null,
    });
  });

  it("splits on the first separator only", () => {
    expect(splitCategoryLabel("A → B → C")).toEqual({
      parent: "A",
      child: "B → C",
    });
  });
});

describe("groupBudgetLines", () => {
  it("groups by parent, sorting parents and children alphabetically", () => {
    const groups = groupBudgetLines([
      line("Zebra → Stripes", 100, 50),
      line("Alpha → Delta", 200, 100),
      line("Zebra → Hooves", 300, 150),
      line("Alpha → Beta", 400, 200),
    ]);

    expect(groups.map((g) => g.parentName)).toEqual(["Alpha", "Zebra"]);
    expect(groups[0].children.map((c) => c.label)).toEqual(["Beta", "Delta"]);
    expect(groups[1].children.map((c) => c.label)).toEqual([
      "Hooves",
      "Stripes",
    ]);
  });

  it("keeps a top-level line as the group's parent line, not a child", () => {
    const groups = groupBudgetLines([
      line("Fundraisers", 1000, 650),
      line("Fundraisers → Coin Wars", 400, 250),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].parentLine?.categoryName).toBe("Fundraisers");
    expect(groups[0].children.map((c) => c.label)).toEqual(["Coin Wars"]);
  });

  it("returns no groups for no lines", () => {
    expect(groupBudgetLines([])).toEqual([]);
  });
});

describe("rollUpGroup", () => {
  it("sums the children when the budget has no line on the parent", () => {
    const [group] = groupBudgetLines([
      line("Ops → Supplies", 200, 150),
      line("Ops → Travel", 300, 90),
    ]);

    expect(rollUpGroup(group)).toEqual({
      budgeted: 500,
      actual: 240,
      variance: -260,
    });
  });

  it("uses the parent's own line rather than summing, to avoid double counting", () => {
    // buildNetLine already folds every descendant into a parent's actual.
    const [group] = groupBudgetLines([
      line("Fundraisers", 1000, 650),
      line("Fundraisers → Coin Wars", 400, 250),
      line("Fundraisers → Kona Ice", 600, 650),
    ]);

    expect(rollUpGroup(group)).toEqual({
      budgeted: 1000,
      actual: 650,
      variance: -350,
    });
  });

  it("rounds a summed roll-up to cents", () => {
    const [group] = groupBudgetLines([
      line("Ops → A", 0.1, 0.1),
      line("Ops → B", 0.2, 0.2),
    ]);

    const rollUp = rollUpGroup(group);
    expect(rollUp.budgeted).toBe(0.3);
    expect(rollUp.actual).toBe(0.3);
    expect(rollUp.variance).toBe(0);
  });
});

describe("rollUpPercentOfPlan", () => {
  it("returns the percentage of budget spent", () => {
    expect(
      rollUpPercentOfPlan({ budgeted: 500, actual: 240, variance: -260 })
    ).toBeCloseTo(48, 5);
  });

  it("returns null when there is no budget to measure against", () => {
    expect(
      rollUpPercentOfPlan({ budgeted: 0, actual: -72, variance: -72 })
    ).toBeNull();
  });
});

describe("isOverBudget", () => {
  it("flags an unfavorable line that has activity", () => {
    expect(isOverBudget(false, 926.97)).toBe(true);
  });

  it("does not flag an unfavorable line with no activity", () => {
    // An income line still at zero collected is behind plan only because
    // nothing has happened yet — not news worth emphasising.
    expect(isOverBudget(false, 0)).toBe(false);
  });

  it("never flags a favorable line", () => {
    expect(isOverBudget(true, 500)).toBe(false);
    expect(isOverBudget(true, 0)).toBe(false);
  });
});
