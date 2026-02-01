import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { SettingsForm } from "./settings-form";

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
      <h2 className="text-2xl font-bold tracking-tight text-foreground">
        Settings
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Manage your account profile and preferences.
      </p>
      <div className="mt-6">
        <SettingsForm
          name={treasurer?.name ?? ""}
          email={user.email ?? ""}
        />
      </div>
    </div>
  );
}
