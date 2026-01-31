import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/(auth)/actions";
import { Providers } from "@/components/providers";

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
      <div className="min-h-screen bg-background">
        <header className="border-b border-border bg-card">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
            <div className="flex items-center gap-6">
              <Link href="/dashboard" className="text-lg font-semibold text-foreground">
                Treasurer
              </Link>
              <nav className="flex items-center gap-4">
                <Link
                  href="/organizations"
                  className="text-sm font-medium text-muted-foreground hover:text-foreground"
                >
                  Organizations
                </Link>
              </nav>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground">{displayName}</span>
              <form action={signOut}>
                <button
                  type="submit"
                  className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
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
    </Providers>
  );
}
