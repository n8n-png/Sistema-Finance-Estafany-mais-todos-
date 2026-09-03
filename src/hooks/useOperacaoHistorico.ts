import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SnapshotHist {
  id: string;
  import_id: string;
  parcela_atual: number | null;
  valor_parcela: number | null;
  saldo_devedor: number | null;
  data_vencimento_atual: string | null;
  taxa_op: number | null;
  created_at: string;
}

export interface DivergenciaRow {
  id: string;
  month: number;
  due_date: string | null;
  projected_payment: number;
  actual_payment: number;
  diff: number;
  diff_pct: number | null;
  detected_at: string;
}

/**
 * Busca o histórico de snapshots e as divergências de uma operação.
 * Match: id_valora se existir, senão cnpj + seu_numero.
 */
export const useOperacaoHistorico = (params: {
  cnpj: string;
  id_valora: string | null;
  seu_numero: string | null;
}) => {
  const { cnpj, id_valora, seu_numero } = params;
  return useQuery({
    queryKey: ["operacao_historico", id_valora ?? `${cnpj}|${seu_numero ?? ""}`],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      // Snapshots
      let snapQ = supabase
        .from("operacoes_snapshots")
        .select("id, import_id, parcela_atual, valor_parcela, saldo_devedor, data_vencimento_atual, taxa_op, created_at")
        .order("created_at", { ascending: true });
      if (id_valora) snapQ = snapQ.eq("id_valora", id_valora);
      else snapQ = snapQ.eq("cnpj", cnpj).eq("seu_numero", seu_numero ?? "");

      // Divergências
      let divQ = supabase
        .from("operacoes_divergencias")
        .select("id, month, due_date, projected_payment, actual_payment, diff, diff_pct, detected_at")
        .order("month", { ascending: true });
      if (id_valora) divQ = divQ.eq("id_valora", id_valora);
      else divQ = divQ.eq("cnpj", cnpj).eq("seu_numero", seu_numero ?? "");

      const [snapRes, divRes] = await Promise.all([snapQ, divQ]);
      if (snapRes.error) throw snapRes.error;
      if (divRes.error) throw divRes.error;

      return {
        snapshots: (snapRes.data ?? []) as SnapshotHist[],
        divergencias: (divRes.data ?? []) as DivergenciaRow[],
      };
    },
  });
};
