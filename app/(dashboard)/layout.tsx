import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { Providers } from "@/components/providers";
import { DashboardShell } from "@/components/layout/dashboard-shell";

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
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

  const displayName = treasurer?.name ?? user.email ?? "User";

  return (
    <Providers>
      <DashboardShell displayName={displayName}>
        {children}
      </DashboardShell>
    </Providers>
  );
}
