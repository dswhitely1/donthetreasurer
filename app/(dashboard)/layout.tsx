import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/(auth)/actions";

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
    <div className="min-h-screen bg-zinc-50">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <h1 className="text-lg font-semibold text-zinc-900">Treasurer</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-zinc-600">{displayName}</span>
            <form action={signOut}>
              <button
                type="submit"
                className="rounded-md px-3 py-1.5 text-sm font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
}
