import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface OperacaoAtiva {
  id: string;
  franquia: string | null;
  cnpj: string;
  data_aquisicao: string | null;
  data_emissao: string | null;
  valor_operacao: number | null;
  primeiro_vencimento: string | null;
  ultimo_vencimento: string | null;
  total_parcelas: number | null;
  parcela_atual: number | null;
  valor_parcela: number | null;
  data_vencimento_atual: string | null;
  total_pago: number | null;
  saldo_devedor: number | null;
  seu_numero: string | null;
  id_valora: string | null;
  nosso_numero: string | null;
  tipo_op: string | null;
  taxa_op: number | null;
  taxa_op_raw: string | null;
  refin_aditivo: string | null;
  carencia_principal: number | null;
}

export const useOperacoesAtivas = () =>
  useQuery({
    queryKey: ["operacoes_ativas"],
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    queryFn: async (): Promise<OperacaoAtiva[]> => {
      const PAGE = 1000;
      const all: OperacaoAtiva[] = [];
      let from = 0;
      while (true) {
        const { data, error } = await supabase
          .from("operacoes_ativas")
          .select(
            "id, franquia, cnpj, data_aquisicao, data_emissao, valor_operacao, primeiro_vencimento, ultimo_vencimento, total_parcelas, parcela_atual, valor_parcela, data_vencimento_atual, total_pago, saldo_devedor, seu_numero, id_valora, nosso_numero, tipo_op, taxa_op, taxa_op_raw, refin_aditivo, carencia_principal"
          )
          .order("data_vencimento_atual", { ascending: true, nullsFirst: false })
          .range(from, from + PAGE - 1);
        if (error) throw error;
        const batch = (data ?? []) as OperacaoAtiva[];
        all.push(...batch);
        if (batch.length < PAGE) break;
        from += PAGE;
      }
      return all;
    },
  });
