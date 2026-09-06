import type { BudgetNetLine } from "@/lib/reports/fetch-budget-data";

/** A parent category and the budget lines that sit under it. */
export interface BudgetGroup {
  parentName: string;
  /** The budget line on the parent category itself, if the budget has one. */
  parentLine: BudgetNetLine | null;
  /** Child lines, labelled with the child segment only. */
  children: { label: string; line: BudgetNetLine }[];
}

/** Roll-up figures shown on a group header row. */
export interface BudgetRollUp {
  budgeted: number;
  actual: number;
  variance: number;
}

const LABEL_SEPARATOR = " → ";

function roundToCents(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

/**
 * Splits a `Parent → Child` category label. A label with no separator belongs
 * to a top-level category and has no child segment.
 */
export function splitCategoryLabel(name: string): {
  parent: string;
  child: string | null;
} {
  const i = name.indexOf(LABEL_SEPARATOR);
  return i === -1
    ? { parent: name, child: null }
    : { parent: name.slice(0, i), child: name.slice(i + LABEL_SEPARATOR.length) };
}

/**
 * Groups budget lines under their parent category, alphabetically by parent and
 * then by child. Budget line items are stored in insertion order, which
 * interleaves parents down a report and forces every row to repeat its
 * `Parent → Child` prefix.
 */
export function groupBudgetLines(
  lines: readonly BudgetNetLine[]
): BudgetGroup[] {
  const groups = new Map<string, BudgetGroup>();

  for (const line of lines) {
    const { parent, child } = splitCategoryLabel(line.categoryName);
    const group = groups.get(parent) ?? {
      parentName: parent,
      parentLine: null,
      children: [],
    };
    if (child === null) {
      group.parentLine = line;
    } else {
      group.children.push({ label: child, line });
    }
    groups.set(parent, group);
  }

  const sorted = [...groups.values()].sort((a, b) =>
    a.parentName.localeCompare(b.parentName)
  );
  for (const group of sorted) {
    group.children.sort((a, b) => a.label.localeCompare(b.label));
  }
  return sorted;
}

/**
 * Roll-up for a group. When the budget carries a line on the parent category
 * itself that line is already the roll-up — `buildNetLine` folds every
 * descendant into a parent's actual — so summing it together with the child
 * rows would double count.
 */
export function rollUpGroup(group: BudgetGroup): BudgetRollUp {
  if (group.parentLine) {
    const { budgeted, actual, variance } = group.parentLine;
    return { budgeted, actual, variance };
  }
  let budgeted = 0;
  let actual = 0;
  for (const { line } of group.children) {
    budgeted += line.budgeted;
    actual += line.actual;
  }
  budgeted = roundToCents(budgeted);
  actual = roundToCents(actual);
  return { budgeted, actual, variance: roundToCents(actual - budgeted) };
}

/**
 * Percent of plan for a roll-up, as a percentage to match `BudgetNetLine`.
 * Null when there is no budget to measure against.
 */
export function rollUpPercentOfPlan(rollUp: BudgetRollUp): number | null {
  return rollUp.budgeted === 0 ? null : (rollUp.actual / rollUp.budgeted) * 100;
}

/**
 * Whether a line is worth flagging as over budget.
 *
 * `favorable` alone flags far too much: at the start of a fiscal year every
 * income line still sits at zero collected, so it reads as behind plan purely
 * because nothing has happened yet. A line with no activity is not news, so it
 * takes no emphasis until there is something to compare.
 */
export function isOverBudget(favorable: boolean, actual: number): boolean {
  return !favorable && actual !== 0;
}
