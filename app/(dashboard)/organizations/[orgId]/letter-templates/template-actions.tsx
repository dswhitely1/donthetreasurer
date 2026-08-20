"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";

import { deleteLetterTemplate, setDefaultLetterTemplate } from "./actions";

export function TemplateActions({
  templateId,
  orgId,
  isDefault,
}: Readonly<{
  templateId: string;
  orgId: string;
  isDefault: boolean;
}>) {
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  const [defaultState, defaultAction, defaultPending] = useActionState(
    setDefaultLetterTemplate,
    null
  );
  const [deleteState, deleteAction, deletePending] = useActionState(
    deleteLetterTemplate,
    null
  );

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {!isDefault && (
        <form action={defaultAction}>
          <input type="hidden" name="id" value={templateId} />
          <input type="hidden" name="organization_id" value={orgId} />
          <Button
            type="submit"
            variant="outline"
            size="sm"
            disabled={defaultPending}
          >
            {defaultPending ? "Setting…" : "Make Default"}
          </Button>
        </form>
      )}

      {isConfirmingDelete ? (
        <>
          <form action={deleteAction}>
            <input type="hidden" name="id" value={templateId} />
            <input type="hidden" name="organization_id" value={orgId} />
            <Button
              type="submit"
              variant="destructive"
              size="sm"
              disabled={deletePending}
            >
              {deletePending ? "Deleting…" : "Confirm Delete"}
            </Button>
          </form>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsConfirmingDelete(false)}
          >
            Cancel
          </Button>
        </>
      ) : (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsConfirmingDelete(true)}
        >
          Delete
        </Button>
      )}

      {(defaultState?.error || deleteState?.error) && (
        <span className="text-sm text-destructive">
          {defaultState?.error ?? deleteState?.error}
        </span>
      )}
    </div>
  );
}
