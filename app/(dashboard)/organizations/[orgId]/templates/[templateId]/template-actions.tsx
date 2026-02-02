"use client";

import { useActionState, useState } from "react";
import Link from "next/link";

import {
  deleteTemplate,
  pauseTemplate,
  resumeTemplate,
  generateFromTemplate,
} from "../actions";
import { TemplateForm } from "../template-form";
import { Button } from "@/components/ui/button";

import type { Tables } from "@/types/database";

type Account = Pick<Tables<"accounts">, "id" | "name" | "account_type">;
type Category = Pick<
  Tables<"categories">,
  "id" | "name" | "category_type" | "parent_id"
>;

interface TemplateData {
  id: string;
  account_id: string;
  transaction_type: string;
  amount: number;
  description: string;
  vendor: string | null;
  check_number: string | null;
  recurrence_rule: string;
  start_date: string;
  end_date: string | null;
  is_active: boolean;
  next_occurrence_date: string | null;
}

interface LineItemData {
  category_id: string;
  amount: number;
  memo: string | null;
}

// Full detail page actions (with edit form)
export function TemplateDetailActions({
  template,
  lineItems,
  orgId,
  accounts,
  categories,
}: Readonly<{
  template: TemplateData;
  lineItems: LineItemData[];
  orgId: string;
  accounts: Account[];
  categories: Category[];
}>) {
  const [isEditing, setIsEditing] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  const [deleteState, deleteAction, deletePending] = useActionState(
    deleteTemplate,
    null
  );
  const [pauseState, pauseAction, pausePending] = useActionState(
    pauseTemplate,
    null
  );
  const [resumeState, resumeAction, resumePending] = useActionState(
    resumeTemplate,
    null
  );
  const [generateState, generateAction, generatePending] = useActionState(
    generateFromTemplate,
    null
  );

  if (isEditing) {
    return (
      <div className="mt-6 border-t border-border pt-6">
        <TemplateForm
          mode="edit"
          accounts={accounts}
          categories={categories}
          orgId={orgId}
          defaultValues={{
            id: template.id,
            account_id: template.account_id,
            transaction_type: template.transaction_type,
            amount: template.amount,
            description: template.description,
            vendor: template.vendor,
            check_number: template.check_number,
            recurrence_rule: template.recurrence_rule,
            start_date: template.start_date,
            end_date: template.end_date,
            line_items: lineItems,
          }}
        />
      </div>
    );
  }

  return (
    <div className="mt-6 border-t border-border pt-6">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-3">
          {/* Generate Now */}
          {template.is_active && template.next_occurrence_date && (
            <form action={generateAction}>
              <input type="hidden" name="template_id" value={template.id} />
              <input type="hidden" name="organization_id" value={orgId} />
              <Button type="submit" disabled={generatePending}>
                {generatePending ? "Generating\u2026" : "Generate Now"}
              </Button>
            </form>
          )}

          {/* Edit */}
          <Button variant="outline" onClick={() => setIsEditing(true)}>
            Edit
          </Button>

          {/* Pause / Resume */}
          {template.is_active ? (
            <form action={pauseAction}>
              <input type="hidden" name="id" value={template.id} />
              <input type="hidden" name="organization_id" value={orgId} />
              <Button
                type="submit"
                variant="outline"
                disabled={pausePending}
              >
                {pausePending ? "Pausing\u2026" : "Pause"}
              </Button>
            </form>
          ) : (
            <form action={resumeAction}>
              <input type="hidden" name="id" value={template.id} />
              <input type="hidden" name="organization_id" value={orgId} />
              <Button
                type="submit"
                variant="outline"
                disabled={resumePending}
              >
                {resumePending ? "Resuming\u2026" : "Resume"}
              </Button>
            </form>
          )}

          {/* Delete */}
          {isConfirmingDelete ? (
            <>
              <form action={deleteAction}>
                <input type="hidden" name="id" value={template.id} />
                <input type="hidden" name="organization_id" value={orgId} />
                <Button
                  type="submit"
                  variant="destructive"
                  disabled={deletePending}
                >
                  {deletePending ? "Deleting\u2026" : "Confirm Delete"}
                </Button>
              </form>
              <Button
                variant="outline"
                onClick={() => setIsConfirmingDelete(false)}
              >
                Cancel
              </Button>
            </>
          ) : (
            <Button
              variant="outline"
              onClick={() => setIsConfirmingDelete(true)}
            >
              Delete
            </Button>
          )}
        </div>

        {/* Error messages */}
        {generateState?.error && (
          <span className="text-sm text-destructive">
            {generateState.error}
          </span>
        )}
        {pauseState?.error && (
          <span className="text-sm text-destructive">{pauseState.error}</span>
        )}
        {resumeState?.error && (
          <span className="text-sm text-destructive">
            {resumeState.error}
          </span>
        )}
        {deleteState?.error && (
          <span className="text-sm text-destructive">
            {deleteState.error}
          </span>
        )}
      </div>
    </div>
  );
}

// Row-level actions for list table
export function TemplateRowActions({
  templateId,
  orgId,
  isActive,
  hasNextOccurrence,
}: Readonly<{
  templateId: string;
  orgId: string;
  isActive: boolean;
  hasNextOccurrence: boolean;
}>) {
  const [generateState, generateAction, generatePending] = useActionState(
    generateFromTemplate,
    null
  );
  const [pauseState, pauseAction, pausePending] = useActionState(
    pauseTemplate,
    null
  );
  const [resumeState, resumeAction, resumePending] = useActionState(
    resumeTemplate,
    null
  );

  return (
    <div className="flex items-center justify-end gap-1">
      {/* Generate Now */}
      {isActive && hasNextOccurrence && (
        <form action={generateAction}>
          <input type="hidden" name="template_id" value={templateId} />
          <input type="hidden" name="organization_id" value={orgId} />
          <Button
            type="submit"
            variant="ghost"
            size="sm"
            disabled={generatePending}
          >
            {generatePending ? "..." : "Generate"}
          </Button>
        </form>
      )}

      {/* Pause / Resume */}
      {isActive ? (
        <form action={pauseAction}>
          <input type="hidden" name="id" value={templateId} />
          <input type="hidden" name="organization_id" value={orgId} />
          <Button
            type="submit"
            variant="ghost"
            size="sm"
            disabled={pausePending}
          >
            {pausePending ? "..." : "Pause"}
          </Button>
        </form>
      ) : (
        <form action={resumeAction}>
          <input type="hidden" name="id" value={templateId} />
          <input type="hidden" name="organization_id" value={orgId} />
          <Button
            type="submit"
            variant="ghost"
            size="sm"
            disabled={resumePending}
          >
            {resumePending ? "..." : "Resume"}
          </Button>
        </form>
      )}

      {/* View detail link */}
      <Button variant="ghost" size="sm" asChild>
        <Link href={`/organizations/${orgId}/templates/${templateId}`}>
          View
        </Link>
      </Button>

      {/* Error display */}
      {(generateState?.error || pauseState?.error || resumeState?.error) && (
        <span className="text-xs text-destructive">
          {generateState?.error || pauseState?.error || resumeState?.error}
        </span>
      )}
    </div>
  );
}
