-- Migration: Update merge_categories RPC to also reassign budget line items
-- When merging categories, budget_line_items with the source category must be
-- reassigned to the target. If the target already has a line item in the same
-- budget, their amounts are summed and the duplicate is deleted.

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
  v_budget_reassigned INTEGER;
  v_budget_merged INTEGER;
BEGIN
  -- Validate source exists, is active, and belongs to org
  SELECT id, category_type, is_active, parent_id
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
  SELECT id, category_type, is_active, parent_id
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

  -- Must be same type
  IF v_source.category_type <> v_target.category_type THEN
    RAISE EXCEPTION 'Categories must be the same type (income/expense).';
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
    'merged_budget_line_items', v_budget_merged
  );
END;
$$;
