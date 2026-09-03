import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { normalizeCnpj } from "@/utils/cnpj";

export interface PreAprovado {
  cnpj: string;
  produto: string | null;
  limite: number;
}

// Uma única query traz toda a base de pré-aprovados; o cruzamento por CNPJ
// acontece em memória para não disparar uma consulta por card.
export const usePreAprovados = () =>
  useQuery({
    queryKey: ["clientes-pre-aprovados"],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<Map<string, PreAprovado>> => {
      const { data, error } = await supabase
        .from("clientes_pre_aprovados")
        .select("cnpj, produto, limite");
      if (error) throw error;

      const map = new Map<string, PreAprovado>();
      for (const row of data ?? []) {
        map.set(normalizeCnpj(row.cnpj), {
          cnpj: normalizeCnpj(row.cnpj),
          produto: row.produto,
          limite: Number(row.limite ?? 0),
        });
      }
      return map;
    },
  });

export const usePreAprovado = (cnpj: string | null | undefined) => {
  const { data } = usePreAprovados();
  if (!cnpj) return undefined;
  return data?.get(normalizeCnpj(cnpj));
};
