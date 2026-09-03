import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ClienteLimite {
  id: string;
  socios: string | null;
  cnpj: string;
  unidade: string | null;
  grupo: string | null;
  status_operacoes: string | null;
  total_com_carencia: number | null;
  total_sem_carencia: number | null;
}

export const useLimites = () =>
  useQuery({
    queryKey: ["clientes_limites"],
    // Base muda apenas em importações mensais — mantém em cache por bastante tempo
    // para evitar refetch a cada navegação/foco de janela.
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    queryFn: async (): Promise<ClienteLimite[]> => {
      const PAGE = 1000;
      const all: ClienteLimite[] = [];
      let from = 0;
      // Paginate to bypass PostgREST's default 1000-row cap
      while (true) {
        const { data, error } = await supabase
          .from("clientes_limites")
          .select("id, socios, cnpj, unidade, grupo, status_operacoes, total_com_carencia, total_sem_carencia")
          .order("unidade", { ascending: true })
          .range(from, from + PAGE - 1);
        if (error) throw error;
        const batch = (data ?? []) as ClienteLimite[];
        all.push(...batch);
        if (batch.length < PAGE) break;
        from += PAGE;
      }
      return all;
    },
  });
