import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ChecklistType } from "@/utils/checklistSchema";
import { toast } from "@/hooks/use-toast";

interface Params<T> {
  cnpj: string;
  operacaoId?: string | null;
  checklistType: ChecklistType;
  empty: () => T;
}

// Hook genérico de auto-save (500ms debounce) para qualquer forma de items_state.
export function useChecklist<T extends object>({
  cnpj,
  operacaoId,
  checklistType,
  empty,
}: Params<T>) {
  const [state, setState] = useState<T>(empty);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const rowIdRef = useRef<string | null>(null);
  const initialized = useRef(false);
  const key = useMemo(
    () => `${cnpj}::${operacaoId ?? ""}::${checklistType}`,
    [cnpj, operacaoId, checklistType]
  );

  useEffect(() => {
    let cancelled = false;
    initialized.current = false;
    setLoading(true);
    (async () => {
      const { data, error } = await supabase
        .from("operacoes_checklists")
        .select("id, items_state")
        .eq("estabelecimento_cnpj", cnpj)
        .eq("checklist_type", checklistType)
        .eq("operacao_id", operacaoId ?? "")
        .maybeSingle();
      if (cancelled) return;
      if (error && error.code !== "PGRST116") console.warn("checklist load", error);
      rowIdRef.current = data?.id ?? null;
      const loaded = (data?.items_state as T | null) ?? null;
      setState(loaded ? { ...empty(), ...loaded } : empty());
      setLoading(false);
      setTimeout(() => {
        initialized.current = true;
      }, 0);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    if (!initialized.current) return;
    setSaving(true);
    const handle = setTimeout(async () => {
      const { data: session } = await supabase.auth.getUser();
      const payload = state as unknown as Record<string, never>;
      let error;
      if (rowIdRef.current) {
        const res = await supabase
          .from("operacoes_checklists")
          .update({ items_state: payload as never })
          .eq("id", rowIdRef.current);
        error = res.error;
      } else {
        const res = await supabase
          .from("operacoes_checklists")
          .insert({
            estabelecimento_cnpj: cnpj,
            operacao_id: operacaoId ?? "",
            checklist_type: checklistType,
            items_state: payload as never,
            created_by: session.user?.id ?? null,
          } as never)
          .select("id")
          .single();
        error = res.error;
        if (res.data) rowIdRef.current = res.data.id;
      }
      if (error) {
        console.warn("checklist save", error);
        toast({
          title: "Erro ao salvar",
          description: error.message,
          variant: "destructive",
        });
      }
      setSaving(false);
    }, 500);
    return () => clearTimeout(handle);
  }, [state, key]);

  const patch = (partial: Partial<T>) => setState((prev) => ({ ...prev, ...partial }));

  return { state, setState, patch, loading, saving };
}
