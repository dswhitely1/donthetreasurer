-- Migration: Untyped categories and signed budget amounts
-- Direction now comes from transactions.transaction_type, not the category.
-- NOT REVERSIBLE. Snapshot before applying.
--
-- Step order is load-bearing:
--   * The amount > 0 CHECK must go FIRST. Step 1 writes negative amounts and
--     the merge loop can produce negative or zero sums; the constraint is not
--     deferrable, so leaving it in place aborts the very first UPDATE.
--   * The signing in step 1 reads category_type, which the final ALTER drops.
--     Reverse them and every expense budget line silently keeps a positive
--     sign -- data corruption with no error.

-- Step 0: release the positive-only guard before writing signed amounts.
ALTER TABLE public.budget_line_items
  DROP CONSTRAINT budget_line_items_amount_check;

-- Step 1: sign budget amounts while category_type still exists.
UPDATE public.budget_line_items AS bli
   SET amount = -bli.amount
  FROM public.categories AS c
 WHERE c.id = bli.category_id
   AND c.category_type = 'expense';

-- Steps 2-4: merge duplicate-name categories, repeating until none remain.
-- Merging a parent repoints its children, which can create new duplicate
-- siblings, so a single pass is not enough.
DO $$
DECLARE
  r RECORD;
  v_found BOOLEAN;
  v_fee_before INTEGER;
  v_fee_after INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_fee_before
    FROM public.accounts WHERE fee_category_id IS NOT NULL;

  LOOP
    v_found := FALSE;

    FOR r IN
      SELECT id AS dup_id, survivor_id
        FROM (
          SELECT id,
                 first_value(id) OVER (
                   PARTITION BY organization_id, parent_id, lower(trim(name))
                   ORDER BY created_at, id
                 ) AS survivor_id
            FROM public.categories
        ) s
       WHERE id <> survivor_id
    LOOP
      v_found := TRUE;

      -- Survivor stays active if any member of the group was active.
      UPDATE public.categories SET is_active = TRUE
       WHERE id = r.survivor_id
         AND EXISTS (
           SELECT 1 FROM public.categories d
            WHERE d.id = r.dup_id AND d.is_active
         );

      UPDATE public.transaction_line_items
         SET category_id = r.survivor_id WHERE category_id = r.dup_id;

      UPDATE public.recurring_template_line_items
         SET category_id = r.survivor_id WHERE category_id = r.dup_id;

      UPDATE public.categories
         SET parent_id = r.survivor_id WHERE parent_id = r.dup_id;

      -- ON DELETE SET NULL, so a miss here fails silently. Asserted below.
      UPDATE public.accounts
         SET fee_category_id = r.survivor_id WHERE fee_category_id = r.dup_id;

      -- Budget lines: sum signed amounts into the survivor's row.
      UPDATE public.budget_line_items AS tgt
         SET amount = tgt.amount + src.amount,
             notes = CASE
               WHEN tgt.notes IS NULL OR tgt.notes = '' THEN src.notes
               WHEN src.notes IS NULL OR src.notes = '' THEN tgt.notes
               ELSE tgt.notes || '; ' || src.notes
             END
        FROM public.budget_line_items AS src
       WHERE src.category_id = r.dup_id
         AND tgt.category_id = r.survivor_id
         AND src.budget_id = tgt.budget_id;

      DELETE FROM public.budget_line_items AS src
       USING public.budget_line_items AS tgt
       WHERE src.category_id = r.dup_id
         AND tgt.category_id = r.survivor_id
         AND src.budget_id = tgt.budget_id;

      UPDATE public.budget_line_items
         SET category_id = r.survivor_id WHERE category_id = r.dup_id;

      DELETE FROM public.categories WHERE id = r.dup_id;
    END LOOP;

    EXIT WHEN NOT v_found;
  END LOOP;

  SELECT COUNT(*) INTO v_fee_after
    FROM public.accounts WHERE fee_category_id IS NOT NULL;

  IF v_fee_after <> v_fee_before THEN
    RAISE EXCEPTION
      'Migration would orphan fee configuration on % account(s).',
      v_fee_before - v_fee_after;
  END IF;
END $$;

-- A merged pair can net to exactly zero (income 5000 + expense -5000).
-- Such a line carries no information and would violate the constraint below.
DELETE FROM public.budget_line_items WHERE amount = 0;

-- Step 5: drop the column and apply the new constraints.
ALTER TABLE public.categories DROP COLUMN category_type;

ALTER TABLE public.budget_line_items
  ADD CONSTRAINT budget_line_items_amount_nonzero CHECK (amount <> 0);

-- UNIQUE treats NULLs as distinct, which would let two top-level categories
-- share a name; NULLS NOT DISTINCT (PG15+) closes that. Scoped to active rows
-- so a deactivated category can keep its name.
CREATE UNIQUE INDEX idx_categories_unique_active_name
  ON public.categories (organization_id, parent_id, lower(trim(name)))
  NULLS NOT DISTINCT
  WHERE is_active;

-- Step 6: rewrite merge_categories for untyped categories.
-- Based on 20260203000002_update_merge_categories_for_budgets.sql with four
-- changes: category_type dropped from both SELECT ... INTO lists; the
-- same-type guard deleted; the accounts.fee_category_id repoint added (the
-- previous version omitted it entirely, silently blanking fee configuration);
-- reassigned_fee_accounts added to the returned JSON.

CREATE OR REPLACE FUNCTION public.merge_categories(
  p_source_id UUID,
  p_target_id UUID,
  p_organization_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_source RECORD;
  v_target RECORD;
  v_child_count INTEGER;
  v_reassigned INTEGER;
  v_template_reassigned INTEGER;
  v_fee_reassigned INTEGER;
  v_budget_reassigned INTEGER;
  v_budget_merged INTEGER;
BEGIN
  -- Validate source exists, is active, and belongs to org
  SELECT id, is_active, parent_id
    INTO v_source
    FROM public.categories
   WHERE id = p_source_id
     AND organization_id = p_organization_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Source category not found.';
  END IF;

  IF NOT v_source.is_active THEN
    RAISE EXCEPTION 'Source category is already inactive.';
  END IF;

  -- Validate target exists, is active, and belongs to org
  SELECT id, is_active, parent_id
    INTO v_target
    FROM public.categories
   WHERE id = p_target_id
     AND organization_id = p_organization_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Target category not found.';
  END IF;

  IF NOT v_target.is_active THEN
    RAISE EXCEPTION 'Target category is inactive.';
  END IF;

  -- Block merge if source has active subcategories (CMG-007)
  SELECT COUNT(*)
    INTO v_child_count
    FROM public.categories
   WHERE parent_id = p_source_id
     AND is_active = TRUE;

  IF v_child_count > 0 THEN
    RAISE EXCEPTION 'Cannot merge a parent category that has active subcategories. Deactivate or merge its subcategories first.';
  END IF;

  -- Reassign all transaction line items from source to target
  UPDATE public.transaction_line_items
     SET category_id = p_target_id
   WHERE category_id = p_source_id;

  GET DIAGNOSTICS v_reassigned = ROW_COUNT;

  -- Reassign all recurring template line items from source to target
  UPDATE public.recurring_template_line_items
     SET category_id = p_target_id
   WHERE category_id = p_source_id;

  GET DIAGNOSTICS v_template_reassigned = ROW_COUNT;

  -- Repoint processing-fee configuration. The FK is ON DELETE SET NULL, so
  -- skipping this silently blanks the account's fee category and the next
  -- income transaction stops generating its companion fee expense.
  UPDATE public.accounts
     SET fee_category_id = p_target_id
   WHERE fee_category_id = p_source_id;

  GET DIAGNOSTICS v_fee_reassigned = ROW_COUNT;

  -- Handle budget line items: merge amounts where target already exists in same budget
  -- First, sum amounts into existing target line items
  UPDATE public.budget_line_items AS target
     SET amount = target.amount + source.amount,
         notes = CASE
           WHEN target.notes IS NULL OR target.notes = '' THEN source.notes
           WHEN source.notes IS NULL OR source.notes = '' THEN target.notes
           ELSE target.notes || '; ' || source.notes
         END
    FROM public.budget_line_items AS source
   WHERE source.category_id = p_source_id
     AND target.category_id = p_target_id
     AND source.budget_id = target.budget_id;

  GET DIAGNOSTICS v_budget_merged = ROW_COUNT;

  -- Delete source line items that were merged into existing targets
  DELETE FROM public.budget_line_items AS source
   USING public.budget_line_items AS target
   WHERE source.category_id = p_source_id
     AND target.category_id = p_target_id
     AND source.budget_id = target.budget_id;

  -- Reassign remaining source line items (no conflict) to target
  UPDATE public.budget_line_items
     SET category_id = p_target_id
   WHERE category_id = p_source_id;

  GET DIAGNOSTICS v_budget_reassigned = ROW_COUNT;

  -- Hard-delete source category
  DELETE FROM public.categories WHERE id = p_source_id;

  RETURN json_build_object(
    'reassigned_line_items', v_reassigned,
    'reassigned_template_line_items', v_template_reassigned,
    'reassigned_budget_line_items', v_budget_reassigned,
    'merged_budget_line_items', v_budget_merged,
    'reassigned_fee_accounts', v_fee_reassigned
  );
END;
$$;
