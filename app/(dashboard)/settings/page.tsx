import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { SettingsForm } from "./settings-form";
import { PageHeader } from "@/components/layout/page-header";

export default async function SettingsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: treasurer } = await supabase
    .from("treasurers")
    .select("name")
    .eq("id", user.id)
    .single();

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Settings" description="Manage your account profile and preferences." />
      <div className="mt-6">
        <SettingsForm
          name={treasurer?.name ?? ""}
          email={user.email ?? ""}
        />
      </div>
    </div>
  );
}
