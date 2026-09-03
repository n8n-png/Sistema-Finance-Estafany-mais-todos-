import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CdiDailyRow {
  date: string; // ISO yyyy-mm-dd
  rate: number;
  factor: number;
}

export interface HolidayRow {
  date: string;
}

export interface CdiDailyData {
  cdi: Map<string, number>; // date -> factor
  lastCdiDate: string | null;
  lastCdiFactor: number; // usado para projeção futura
  holidays: Set<string>;
}

let syncedThisSession = false;

const fetchAll = async (): Promise<CdiDailyData> => {
  // 1) dispara sync uma vez por sessão (idempotente no backend)
  if (!syncedThisSession) {
    syncedThisSession = true;
    try {
      await supabase.functions.invoke("sync-cdi-daily");
    } catch (err) {
      console.warn("sync-cdi-daily falhou (segue com o que houver no banco)", err);
    }
  }

  const [cdiRes, holRes] = await Promise.all([
    supabase.from("cdi_daily").select("date, rate, factor").order("date", { ascending: true }),
    supabase.from("holidays").select("date"),
  ]);

  const cdi = new Map<string, number>();
  let lastCdiDate: string | null = null;
  let lastCdiFactor = 1.00055131; // fallback ~14,65% a.a. em base 252
  for (const row of (cdiRes.data ?? []) as CdiDailyRow[]) {
    cdi.set(row.date, Number(row.factor));
    lastCdiDate = row.date;
    lastCdiFactor = Number(row.factor);
  }

  const holidays = new Set<string>();
  for (const row of (holRes.data ?? []) as HolidayRow[]) holidays.add(row.date);

  return { cdi, lastCdiDate, lastCdiFactor, holidays };
};

export const useCdiDaily = () =>
  useQuery({
    queryKey: ["cdi-daily"],
    queryFn: fetchAll,
    staleTime: 1000 * 60 * 60, // 1h
  });
