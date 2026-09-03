import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export const PAGE_KEYS = [
  { key: "qia", label: "QIA como Garantia - Cartão de TODOS" },
  { key: "recebiveis", label: "Recebíveis como Garantia - Visão de TODOS" },
  { key: "amor_saude", label: "Recebíveis como Garantia - Amor Saúde" },
  { key: "expansao_amor_saude", label: "Recebíveis como Garantia - Expansão Amor Saúde" },
  { key: "limites", label: "Consultar Limites" },
  { key: "ativos", label: "Operações Ativas" },
  { key: "central_documentos", label: "Central de Documentos" },
  { key: "operacoes_valora", label: "Operações em Formalização" },
  {
    key: "operacoes_valora_editar",
    label: "Operações em Formalização — Editar Recolhimento",
    parent: "operacoes_valora",
  },
  { key: "indicadores_home", label: "Painel Home (indicadores)" },
] as const satisfies readonly { key: string; label: string; parent?: string }[];

export type PageKey = (typeof PAGE_KEYS)[number]["key"];


/** Conjunto de page_keys liberadas para o usuário logado (admin: todas). */
export const useMyPageAccess = () => {
  const { user, isAdmin, adminLoading } = useAuth();

  const query = useQuery({
    queryKey: ["my-page-access", user?.id],
    enabled: !!user && !isAdmin && !adminLoading,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_page_access")
        .select("page_key")
        .eq("user_id", user!.id);
      if (error) throw error;
      return new Set((data ?? []).map((r) => r.page_key));
    },
  });

  if (isAdmin) {
    return { keys: new Set<string>(PAGE_KEYS.map((p) => p.key)), loading: false, isAdmin: true };
  }

  return {
    keys: query.data ?? new Set<string>(),
    loading: adminLoading || query.isLoading,
    isAdmin: false,
  };
};

export const usePageAccess = (pageKey: string) => {
  const { keys, loading } = useMyPageAccess();
  return { hasAccess: keys.has(pageKey), loading };
};
