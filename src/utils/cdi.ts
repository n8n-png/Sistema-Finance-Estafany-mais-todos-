import { supabase } from "@/integrations/supabase/client";

const FALLBACK_CDI = 0.1465;
let currentCDI = FALLBACK_CDI;
let initPromise: Promise<number> | null = null;

export const getCDI = () => currentCDI;

export const initCDI = async (): Promise<number> => {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    try {
      const { data, error } = await supabase.functions.invoke("fetch-cdi");
      if (error) throw error;
      if (data && typeof data.rate === "number" && data.rate > 0) {
        currentCDI = data.rate;
      }
    } catch (err) {
      console.warn("CDI: usando fallback", err);
      currentCDI = FALLBACK_CDI;
    }
    return currentCDI;
  })();
  return initPromise;
};
