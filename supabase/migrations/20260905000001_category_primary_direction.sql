-- Migration: category primary_direction (a label, not a constraint)
--
-- Adds a treasurer-controlled label saying what a category IS. It does not
-- restrict which transactions may use the category -- direction of money
-- still comes from transactions.transaction_type. See
-- docs/superpowers/specs/2026-09-05-category-primary-direction-design.md
--
-- Safe to re-run: the column add is IF NOT EXISTS and every backfill
-- statement is guarded on primary_direction IS NULL, so a second run will
-- not overwrite labels a treasurer has since corrected by hand.

BEGIN;

ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS primary_direction TEXT
  CHECK (primary_direction IN ('income', 'expense', 'neither'));

COMMENT ON COLUMN public.categories.primary_direction IS
  'Treasurer-set label: income | expense | neither | NULL (undecided). '
  'A label only -- never filters category selection and never restricts '
  'which transactions may use this category.';

-- Backfill from actual usage.
--
-- Roll-up is load-bearing: transactions attach to CHILD categories, so a
-- parent''s own line items are usually empty. Classifying parents on their
-- own activity alone leaves ~20 of 29 parents NULL -- exactly the level the
-- categories page groups by. A category''s totals are its own activity plus
-- its direct children''s.
--
-- The 40% abstention is the point of this backfill. Amount dominance is a
-- weak signal near parity (real data has 164.51 vs 162.99, and an exact
-- 11000.00 vs 11000.00). Breaking those ties by comparison operator yields
-- labels that are wrong and silently so. An unset label is visible in the
-- UI as "Unclassified"; an incorrect one is not.
WITH leaf AS (
  SELECT c.id,
         c.parent_id,
         COALESCE(SUM(li.amount) FILTER (WHERE t.transaction_type = 'income'), 0)  AS in_amt,
         COALESCE(SUM(li.amount) FILTER (WHERE t.transaction_type = 'expense'), 0) AS out_amt
    FROM public.categories c
    LEFT JOIN public.transaction_line_items li ON li.category_id = c.id
    LEFT JOIN public.transactions t ON t.id = li.transaction_id
   GROUP BY c.id, c.parent_id
), rolled AS (
  SELECT c.id,
         l.in_amt  + COALESCE(SUM(ch.in_amt), 0)  AS in_amt,
         l.out_amt + COALESCE(SUM(ch.out_amt), 0) AS out_amt
    FROM public.categories c
    JOIN leaf l ON l.id = c.id
    LEFT JOIN leaf ch ON ch.parent_id = c.id
   GROUP BY c.id, l.in_amt, l.out_amt
)
UPDATE public.categories AS cat
   SET primary_direction = CASE
         WHEN r.in_amt = 0 AND r.out_amt = 0 THEN NULL
         WHEN LEAST(r.in_amt, r.out_amt) >= 0.40 * GREATEST(r.in_amt, r.out_amt) THEN NULL
         WHEN r.in_amt > r.out_amt THEN 'income'
         ELSE 'expense'
       END
  FROM rolled r
 WHERE r.id = cat.id
   AND cat.primary_direction IS NULL;

-- Explicit overrides, decided by the treasurer while reviewing the full
-- 138-row proposed assignment.
--
-- A fundraiser IS a revenue activity; its costs are cost-of-goods, which is
-- the exact two-sided case untyped categories exists to serve. Both of these
-- abstained above (minority side 52% and 60%) but net strongly positive.
-- Name-scoped rather than id-scoped so the migration carries no environment
-- specific UUIDs; the IS NULL guard means it cannot disturb an org whose
-- "Fundraisers" already classified by dominance.
UPDATE public.categories
   SET primary_direction = 'income'
 WHERE parent_id IS NULL
   AND lower(trim(name)) = 'fundraisers'
   AND primary_direction IS NULL;

-- Transfers between accounts the org owns are neither income nor expense.
-- The schema cannot detect this: transaction_type is CHECK (income, expense)
-- with no counterpart-account or linked-transaction column, so nothing
-- records whether the far side is org-owned. The label carries that
-- knowledge. Transfers leaving to an outside account stay NULL for the
-- treasurer to decide case by case.
UPDATE public.categories
   SET primary_direction = 'neither'
 WHERE primary_direction IS NULL
   AND (
     (parent_id IS NULL AND lower(trim(name)) = 'transfer')
     OR parent_id IN (
       SELECT id FROM public.categories
        WHERE parent_id IS NULL AND lower(trim(name)) = 'transfer'
     )
   );

COMMIT;
