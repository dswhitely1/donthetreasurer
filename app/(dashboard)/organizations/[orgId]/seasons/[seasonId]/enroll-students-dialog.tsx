"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { enrollStudents } from "../actions";

import type { Tables } from "@/types/database";

interface EnrollStudentsDialogProps {
  seasonId: string;
  defaultFee: number;
  availableStudents: Tables<"students">[];
}

interface EnrollmentEntry {
  studentId: string;
  feeAmount: string;
  feeOverrideReason: string;
}

export function EnrollStudentsDialog({
  seasonId,
  defaultFee,
  availableStudents,
}: Readonly<EnrollStudentsDialogProps>) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Map<string, EnrollmentEntry>>(
    new Map()
  );
  const [state, formAction, pending] = useActionState(
    async (_prev: { error: string } | null, formData: FormData) => {
      const result = await enrollStudents(_prev, formData);
      if (!result?.error) {
        setOpen(false);
        setSelected(new Map());
      }
      return result;
    },
    null
  );

  function toggleStudent(studentId: string) {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(studentId)) {
        next.delete(studentId);
      } else {
        next.set(studentId, {
          studentId,
          feeAmount: String(defaultFee),
          feeOverrideReason: "",
        });
      }
      return next;
    });
  }

  function updateEntry(
    studentId: string,
    field: "feeAmount" | "feeOverrideReason",
    value: string
  ) {
    setSelected((prev) => {
      const next = new Map(prev);
      const entry = next.get(studentId);
      if (entry) {
        next.set(studentId, { ...entry, [field]: value });
      }
      return next;
    });
  }

  const enrollmentsJson = JSON.stringify(
    Array.from(selected.values()).map((e) => ({
      student_id: e.studentId,
      fee_amount: parseFloat(e.feeAmount) || 0,
      fee_override_reason: e.feeOverrideReason,
    }))
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Enroll Students</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Enroll Students</DialogTitle>
        </DialogHeader>

        {availableStudents.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            All active students are already enrolled in this season.
          </p>
        ) : (
          <form action={formAction} className="flex flex-col gap-4">
            <input type="hidden" name="season_id" value={seasonId} />
            <input type="hidden" name="enrollments" value={enrollmentsJson} />

            {state?.error && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {state.error}
              </div>
            )}

            <div className="flex flex-col gap-3">
              {availableStudents.map((student) => {
                const isSelected = selected.has(student.id);
                const entry = selected.get(student.id);

                return (
                  <div
                    key={student.id}
                    className="rounded-md border border-border p-3"
                  >
                    <div className="flex items-center gap-3">
                      <Checkbox
                        id={`student-${student.id}`}
                        checked={isSelected}
                        onCheckedChange={() => toggleStudent(student.id)}
                      />
                      <Label
                        htmlFor={`student-${student.id}`}
                        className="flex-1 cursor-pointer"
                      >
                        {student.last_name}, {student.first_name}
                      </Label>
                    </div>
                    {isSelected && (
                      <div className="mt-2 grid gap-2 pl-7 sm:grid-cols-2">
                        <div className="flex flex-col gap-1">
                          <Label className="text-xs">Fee</Label>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={entry?.feeAmount ?? ""}
                            onChange={(e) =>
                              updateEntry(
                                student.id,
                                "feeAmount",
                                e.target.value
                              )
                            }
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <Label className="text-xs">
                            Override Reason (optional)
                          </Label>
                          <Input
                            value={entry?.feeOverrideReason ?? ""}
                            onChange={(e) =>
                              updateEntry(
                                student.id,
                                "feeOverrideReason",
                                e.target.value
                              )
                            }
                            maxLength={255}
                            placeholder="e.g. Sibling discount"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <Button
              type="submit"
              disabled={pending || selected.size === 0}
            >
              {pending
                ? "Enrolling\u2026"
                : `Enroll ${selected.size} Student${selected.size !== 1 ? "s" : ""}`}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
