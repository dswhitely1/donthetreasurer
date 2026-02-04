"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { deleteStudent, toggleStudentActive } from "../../actions";

import type { Tables } from "@/types/database";

export function StudentEditActions({
  student,
  orgId,
}: Readonly<{
  student: Tables<"students">;
  orgId: string;
}>) {
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  const [toggleState, toggleAction, togglePending] = useActionState(
    toggleStudentActive,
    null
  );
  const [deleteState, deleteAction, deletePending] = useActionState(
    deleteStudent,
    null
  );

  return (
    <div className="mt-6 border-t border-border pt-6">
      <div className="flex flex-wrap gap-3">
        <form action={toggleAction}>
          <input type="hidden" name="id" value={student.id} />
          <input
            type="hidden"
            name="is_active"
            value={String(student.is_active)}
          />
          <Button type="submit" variant="outline" disabled={togglePending}>
            {togglePending
              ? "Updating\u2026"
              : student.is_active
                ? "Deactivate"
                : "Activate"}
          </Button>
        </form>

        {isConfirmingDelete ? (
          <>
            <form action={deleteAction}>
              <input type="hidden" name="id" value={student.id} />
              <input
                type="hidden"
                name="organization_id"
                value={orgId}
              />
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

      {toggleState?.error && (
        <p className="mt-2 text-sm text-destructive">{toggleState.error}</p>
      )}
      {deleteState?.error && (
        <p className="mt-2 text-sm text-destructive">{deleteState.error}</p>
      )}
    </div>
  );
}
