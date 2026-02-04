"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { archiveSeason, deleteSeason } from "../actions";

import type { Tables } from "@/types/database";

export function SeasonActions({
  season,
  orgId,
  hasEnrollments,
}: Readonly<{
  season: Tables<"seasons">;
  orgId: string;
  hasEnrollments: boolean;
}>) {
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  const [archiveState, archiveAction, archivePending] = useActionState(
    archiveSeason,
    null
  );
  const [deleteState, deleteAction, deletePending] = useActionState(
    deleteSeason,
    null
  );

  return (
    <div className="flex flex-wrap gap-3">
      <form action={archiveAction}>
        <input type="hidden" name="id" value={season.id} />
        <input type="hidden" name="current_status" value={season.status} />
        <Button type="submit" variant="outline" disabled={archivePending}>
          {archivePending
            ? "Updating\u2026"
            : season.status === "archived"
              ? "Unarchive"
              : "Archive"}
        </Button>
      </form>

      {!hasEnrollments &&
        (isConfirmingDelete ? (
          <>
            <form action={deleteAction}>
              <input type="hidden" name="id" value={season.id} />
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
        ))}

      {archiveState?.error && (
        <span className="self-center text-sm text-destructive">
          {archiveState.error}
        </span>
      )}
      {deleteState?.error && (
        <span className="self-center text-sm text-destructive">
          {deleteState.error}
        </span>
      )}
    </div>
  );
}
