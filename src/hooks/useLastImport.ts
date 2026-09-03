import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useLastImport = () => {
  return useQuery({
    queryKey: ["last_import"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("import_history")
        .select("created_at, row_count, imported_by_email")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
};
