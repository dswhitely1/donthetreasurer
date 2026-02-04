"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { removeEnrollment, withdrawEnrollment } from "../actions";

interface EnrollmentActionsProps {
  enrollmentId: string;
  enrollmentStatus: string;
  hasPayments: boolean;
}

export function EnrollmentActions({
  enrollmentId,
  enrollmentStatus,
  hasPayments,
}: Readonly<EnrollmentActionsProps>) {
  const [isConfirming, setIsConfirming] = useState(false);

  const [removeState, removeAction, removePending] = useActionState(
    removeEnrollment,
    null
  );
  const [withdrawState, withdrawAction, withdrawPending] = useActionState(
    withdrawEnrollment,
    null
  );

  if (enrollmentStatus === "withdrawn") {
    return null;
  }

  return (
    <div className="flex gap-1">
      {isConfirming ? (
        <>
          {hasPayments ? (
            <form action={withdrawAction}>
              <input type="hidden" name="id" value={enrollmentId} />
              <Button
                type="submit"
                variant="destructive"
                size="sm"
                disabled={withdrawPending}
              >
                {withdrawPending ? "Withdrawing\u2026" : "Withdraw"}
              </Button>
            </form>
          ) : (
            <form action={removeAction}>
              <input type="hidden" name="id" value={enrollmentId} />
              <Button
                type="submit"
                variant="destructive"
                size="sm"
                disabled={removePending}
              >
                {removePending ? "Removing\u2026" : "Remove"}
              </Button>
            </form>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsConfirming(false)}
          >
            Cancel
          </Button>
        </>
      ) : (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsConfirming(true)}
        >
          {hasPayments ? "Withdraw" : "Remove"}
        </Button>
      )}

      {removeState?.error && (
        <span className="self-center text-xs text-destructive">
          {removeState.error}
        </span>
      )}
      {withdrawState?.error && (
        <span className="self-center text-xs text-destructive">
          {withdrawState.error}
        </span>
      )}
    </div>
  );
}
