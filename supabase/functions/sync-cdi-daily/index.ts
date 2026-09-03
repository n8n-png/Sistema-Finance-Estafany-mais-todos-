import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

// Sincroniza a série 12 do BCB (CDI diário, % ao dia) na tabela public.cdi_daily.
// Idempotente: só busca datas a partir do último registro existente.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  try {
    // último dia armazenado
    const { data: last } = await supabase
      .from('cdi_daily')
      .select('date')
      .order('date', { ascending: false })
      .limit(1)
      .maybeSingle();

    // começa 1 dia após o último ou em 2020-01-01 na primeira carga
    const startDate = last?.date
      ? new Date(new Date(last.date).getTime() + 86400000)
      : new Date('2020-01-01');
    const endDate = new Date();

    if (startDate > endDate) {
      return new Response(JSON.stringify({ inserted: 0, status: 'up-to-date' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const fmt = (d: Date) =>
      `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;

    // BCB API é instável: buscar por janelas anuais + retry com backoff.
    const fetchWithRetry = async (url: string, attempts = 4): Promise<Response> => {
      let lastErr = '';
      for (let i = 0; i < attempts; i++) {
        try {
          const r = await fetch(url, { headers: { Accept: 'application/json' } });
          if (r.ok) return r;
          lastErr = `BCB ${r.status}`;
          // 4xx (exceto 429) não adianta retentar
          if (r.status >= 400 && r.status < 500 && r.status !== 429) break;
        } catch (e) {
          lastErr = String(e);
        }
        await new Promise((res) => setTimeout(res, 500 * Math.pow(2, i)));
      }
      throw new Error(lastErr || 'BCB fetch failed');
    };

    const rows: { data: string; valor: string }[] = [];
    let cursor = new Date(startDate);
    while (cursor <= endDate) {
      const windowEnd = new Date(Math.min(
        new Date(cursor.getFullYear(), 11, 31).getTime(),
        endDate.getTime(),
      ));
      const url = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.12/dados?formato=json&dataInicial=${fmt(cursor)}&dataFinal=${fmt(windowEnd)}`;
      try {
        const resp = await fetchWithRetry(url);
        const chunk = (await resp.json()) as { data: string; valor: string }[];
        rows.push(...chunk);
      } catch (e) {
        console.warn(`skip window ${fmt(cursor)}-${fmt(windowEnd)}: ${e}`);
        // Se ainda não temos nenhum dado e a primeira janela falhou, aborta com 503 leve.
        if (rows.length === 0 && cursor.getTime() === startDate.getTime()) {
          return new Response(
            JSON.stringify({ inserted: 0, status: 'bcb-unavailable', detail: String(e) }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
          );
        }
      }
      cursor = new Date(windowEnd.getTime() + 86400000);
    }

    const records = rows.map((r) => {
      const [d, m, y] = r.data.split('/');
      const rate = Number(r.valor) / 100;
      return {
        date: `${y}-${m}-${d}`,
        rate,
        factor: 1 + rate,
      };
    });

    if (records.length === 0) {
      return new Response(JSON.stringify({ inserted: 0, status: 'no-new-data' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // upsert em lote
    const { error } = await supabase.from('cdi_daily').upsert(records, { onConflict: 'date' });
    if (error) throw error;

    return new Response(
      JSON.stringify({ inserted: records.length, from: records[0].date, to: records[records.length - 1].date }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('sync-cdi-daily error:', err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
