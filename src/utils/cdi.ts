import { supabase } from "@/integrations/supabase/client";

const FALLBACK_CDI = 0.1465;
let currentCDI = FALLBACK_CDI;
let initPromise: Promise<number> | null = null;

export const getCDI = () => currentCDI;

/**
 * Carrega a taxa CDI. Chamada quando a sessão é estabelecida (ver `useAuth`).
 *
 * A função `fetch-cdi` exige usuário autenticado (Story 2.7). Por isso a
 * promessa **não é cacheada em caso de falha**: se a primeira tentativa ocorrer
 * sem sessão válida, uma nova chamada precisa poder buscar de novo. Sem isso, o
 * painel ficaria com a taxa de fallback fixa até o usuário recarregar a página —
 * e simulação de crédito com taxa errada é pior do que erro visível.
 */
export const initCDI = async (): Promise<number> => {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    try {
      const { data, error } = await supabase.functions.invoke("fetch-cdi");
      if (error) throw error;
      if (data && typeof data.rate === "number" && data.rate > 0) {
        currentCDI = data.rate;
      }
      return currentCDI;
    } catch (err) {
      console.warn("CDI: usando fallback", err);
      currentCDI = FALLBACK_CDI;
      initPromise = null; // permite nova tentativa depois do login
      return currentCDI;
    }
  })();
  return initPromise;
};
