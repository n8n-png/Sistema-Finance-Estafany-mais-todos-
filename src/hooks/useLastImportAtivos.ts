import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useLastImportAtivos = () => {
  return useQuery({
    queryKey: ["last_import_ativos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("operacoes_import_history")
        .select("created_at, row_count, imported_by_email")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
};
