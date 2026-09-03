import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type CarenciaTipo = "principal" | "total";

export interface OperacaoOverride {
  id: string;
  cnpj: string;
  id_valora: string | null;
  seu_numero: string | null;
  carencia_meses: number;
  carencia_tipo: CarenciaTipo;
}

interface Key {
  cnpj: string;
  id_valora: string | null;
  seu_numero: string | null;
}

const applyKey = (q: any, k: Key) => {
  q = q.eq("cnpj", k.cnpj);
  q = k.id_valora ? q.eq("id_valora", k.id_valora) : q.is("id_valora", null);
  q = k.seu_numero ? q.eq("seu_numero", k.seu_numero) : q.is("seu_numero", null);
  return q;
};

export const useOperacaoOverride = (key: Key) => {
  const qc = useQueryClient();
  const queryKey = ["operacao_override", key.cnpj, key.id_valora ?? "", key.seu_numero ?? ""];

  const query = useQuery({
    queryKey,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await applyKey(
        supabase.from("operacoes_overrides").select("*"),
        key,
      ).maybeSingle();
      if (error) throw error;
      return (data as OperacaoOverride | null) ?? null;
    },
  });

  const save = useMutation({
    mutationFn: async (payload: { carencia_meses: number; carencia_tipo: CarenciaTipo }) => {
      const user = (await supabase.auth.getUser()).data.user;
      const row = {
        cnpj: key.cnpj,
        id_valora: key.id_valora,
        seu_numero: key.seu_numero,
        carencia_meses: payload.carencia_meses,
        carencia_tipo: payload.carencia_tipo,
        updated_by: user?.id ?? null,
      };
      if (query.data?.id) {
        const { error } = await supabase
          .from("operacoes_overrides")
          .update(row)
          .eq("id", query.data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("operacoes_overrides").insert(row);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  });

  return { data: query.data ?? null, isLoading: query.isLoading, save };
};
