import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default async function StudentsPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  const supabase = await createClient();

  const { data: org } = await supabase
    .from("organizations")
    .select("id, seasons_enabled")
    .eq("id", orgId)
    .single();

  if (!org) notFound();
  if (!org.seasons_enabled) redirect(`/organizations/${orgId}`);

  const { data: students } = await supabase
    .from("students")
    .select("*, season_enrollments(id)")
    .eq("organization_id", orgId)
    .order("last_name")
    .order("first_name");

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Students</h1>
        <Button asChild>
          <Link href={`/organizations/${orgId}/students/new`}>
            Add Student
          </Link>
        </Button>
      </div>

      {!students || students.length === 0 ? (
        <div className="mt-8 rounded-lg border border-dashed border-border p-8 text-center">
          <p className="text-muted-foreground">
            No students yet. Add your first student to start tracking season
            enrollment.
          </p>
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-3 py-2.5 text-left font-medium">Name</th>
                <th className="px-3 py-2.5 text-left font-medium">Guardian</th>
                <th className="hidden px-3 py-2.5 text-left font-medium sm:table-cell">
                  Email
                </th>
                <th className="hidden px-3 py-2.5 text-left font-medium md:table-cell">
                  Phone
                </th>
                <th className="px-3 py-2.5 text-center font-medium">
                  Seasons
                </th>
                <th className="px-3 py-2.5 text-center font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {students.map((student) => (
                <tr
                  key={student.id}
                  className="border-b border-border last:border-b-0"
                >
                  <td className="px-3 py-2.5">
                    <Link
                      href={`/organizations/${orgId}/students/${student.id}/edit`}
                      className="font-medium text-primary hover:underline"
                    >
                      {student.last_name}, {student.first_name}
                    </Link>
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground">
                    {student.guardian_name || "\u2014"}
                  </td>
                  <td className="hidden px-3 py-2.5 text-muted-foreground sm:table-cell">
                    {student.email || student.guardian_email || "\u2014"}
                  </td>
                  <td className="hidden px-3 py-2.5 text-muted-foreground md:table-cell">
                    {student.phone || student.guardian_phone || "\u2014"}
                  </td>
                  <td className="px-3 py-2.5 text-center tabular-nums">
                    {student.season_enrollments?.length ?? 0}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <Badge
                      variant={student.is_active ? "default" : "secondary"}
                    >
                      {student.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
