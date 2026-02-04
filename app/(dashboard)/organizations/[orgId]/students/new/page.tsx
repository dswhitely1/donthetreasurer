import { notFound, redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { StudentForm } from "../student-form";

export default async function NewStudentPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const { orgId } = await params;
  const { saved } = await searchParams;
  const supabase = await createClient();

  const { data: org } = await supabase
    .from("organizations")
    .select("id, seasons_enabled")
    .eq("id", orgId)
    .single();

  if (!org) notFound();
  if (!org.seasons_enabled) redirect(`/organizations/${orgId}`);

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Add Student</h1>
      <div className="mt-6 max-w-2xl">
        <StudentForm mode="create" orgId={orgId} showSaved={saved === "true"} />
      </div>
    </div>
  );
}
