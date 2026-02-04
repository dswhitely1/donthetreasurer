import { notFound, redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { StudentForm } from "../../student-form";
import { StudentEditActions } from "./student-edit-actions";

export default async function EditStudentPage({
  params,
}: {
  params: Promise<{ orgId: string; studentId: string }>;
}) {
  const { orgId, studentId } = await params;
  const supabase = await createClient();

  const { data: org } = await supabase
    .from("organizations")
    .select("id, seasons_enabled")
    .eq("id", orgId)
    .single();

  if (!org) notFound();
  if (!org.seasons_enabled) redirect(`/organizations/${orgId}`);

  const { data: student } = await supabase
    .from("students")
    .select("*")
    .eq("id", studentId)
    .single();

  if (!student) notFound();

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Edit Student</h1>
      <div className="mt-6 max-w-2xl">
        <StudentForm mode="edit" orgId={orgId} defaultValues={student} />
        <StudentEditActions student={student} orgId={orgId} />
      </div>
    </div>
  );
}
