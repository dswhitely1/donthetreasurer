import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export interface SponsorsOrg {
  id: string;
  name: string;
  fiscal_year_start_month: number;
}

/**
 * Resolves an organization only when sponsor tracking is switched on for it.
 * Hiding the nav link is presentation; this is the boundary. RLS already
 * restricts rows to the signed-in treasurer, so a null here means "off or
 * not yours" and both answers are a 404 to the caller.
 */
export async function fetchSponsorsOrg(
  supabase: SupabaseClient<Database>,
  orgId: string
): Promise<SponsorsOrg | null> {
  const { data } = await supabase
    .from("organizations")
    .select("id, name, fiscal_year_start_month, sponsors_enabled")
    .eq("id", orgId)
    .single();

  if (!data || !data.sponsors_enabled) return null;

  return {
    id: data.id,
    name: data.name,
    fiscal_year_start_month: data.fiscal_year_start_month ?? 1,
  };
}
