import { useQuery } from "@tanstack/react-query";

import { createClient } from "@/lib/supabase/client";
import { organizationKeys } from "./query-keys";

import type { Tables } from "@/types/database";

type Organization = Tables<"organizations">;

export function useOrganizations() {
  return useQuery({
    queryKey: organizationKeys.list(),
    queryFn: async (): Promise<Organization[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("organizations")
        .select("*")
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      return data;
    },
  });
}
