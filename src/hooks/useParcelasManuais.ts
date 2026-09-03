import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ParcelaManual {
  id: string;
  cnpj: string;
  id_valora: string | null;
  seu_numero: string | null;
  month: number;
  due_date: string | null;
  actual_payment: number;
  note: string | null;
}

interface Key {
  cnpj: string;
  id_valora: string | null;
  seu_numero: string | null;
  numeros?: string[]; // todos os identificadores possíveis (seu_numero + nosso_numero)
}

const onlyDigits = (v: string | null | undefined) => String(v ?? "").replace(/\D/g, "");

// Match: prioriza id_valora (estável); fallback cnpj (só dígitos) + seu_numero IN (identificadores possíveis)
const applyKey = (q: any, k: Key) => {
  if (k.id_valora) return q.eq("id_valora", k.id_valora);
  q = q.eq("cnpj", onlyDigits(k.cnpj));
  const nums = (k.numeros ?? [k.seu_numero]).filter(Boolean) as string[];
  if (nums.length > 0) {
    q = q.in("seu_numero", nums);
  } else {
    q = q.is("seu_numero", null);
  }
  return q;
};


export const useParcelasManuais = (key: Key) => {
  const qc = useQueryClient();
  const queryKey = [
    "parcelas_manuais",
    key.id_valora ?? `${onlyDigits(key.cnpj)}|${(key.numeros ?? [key.seu_numero ?? ""]).join("|")}`,
  ];

  const query = useQuery({
    queryKey,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await applyKey(
        supabase.from("operacoes_parcelas_manuais").select("*").order("month", { ascending: true }),
        key,
      );
      if (error) throw error;
      return (data ?? []) as ParcelaManual[];
    },
  });

  const upsertMany = useMutation({
    mutationFn: async (
      items: { month: number; due_date: string | null; actual_payment: number; note?: string | null }[],
    ) => {
      const user = (await supabase.auth.getUser()).data.user;
      const rows = items.map((it) => ({
        cnpj: onlyDigits(key.cnpj),
        id_valora: key.id_valora,
        seu_numero: key.seu_numero,
        month: it.month,
        due_date: it.due_date,
        actual_payment: it.actual_payment,
        note: it.note ?? null,
        created_by: user?.id ?? null,
      }));

      // Read existing to decide insert vs update (unique key uses COALESCE, so upsert is tricky).
      const existing = query.data ?? [];
      const byMonth = new Map(existing.map((e) => [e.month, e]));
      for (const r of rows) {
        const prev = byMonth.get(r.month);
        if (prev) {
          const { error } = await supabase
            .from("operacoes_parcelas_manuais")
            .update({
              due_date: r.due_date,
              actual_payment: r.actual_payment,
              note: r.note,
            })
            .eq("id", prev.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from("operacoes_parcelas_manuais").insert(r);
          if (error) throw error;
        }
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("operacoes_parcelas_manuais").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  });

  return { data: query.data ?? [], isLoading: query.isLoading, upsertMany, remove };
};
