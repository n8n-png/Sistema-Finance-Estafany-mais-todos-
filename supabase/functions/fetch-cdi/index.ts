import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const FALLBACK_CDI = 0.1465;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const today = new Date().toISOString().slice(0, 10);

  try {
    // Retorna cache se já foi buscado hoje
    const { data: cached } = await supabase
      .from('cdi_cache')
      .select('rate, reference_date, fetched_at')
      .order('fetched_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (cached && cached.fetched_at?.slice(0, 10) === today) {
      return new Response(
        JSON.stringify({ rate: Number(cached.rate), source: 'cache', reference_date: cached.reference_date }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Busca CDI anualizado do BCB (série 4389 = CDI anualizada base 252)
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 10);
    const fmt = (d: Date) =>
      `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;

    const url = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.4389/dados?formato=json&dataInicial=${fmt(start)}&dataFinal=${fmt(end)}`;
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`BCB ${resp.status}`);
    const rows = (await resp.json()) as { data: string; valor: string }[];
    if (!rows.length) throw new Error('BCB vazio');

    const last = rows[rows.length - 1];
    const rate = Number(last.valor) / 100; // ex: 14.65 -> 0.1465
    const [d, m, y] = last.data.split('/');
    const referenceDate = `${y}-${m}-${d}`;

    await supabase.from('cdi_cache').insert({ rate, reference_date: referenceDate });

    return new Response(
      JSON.stringify({ rate, source: 'bcb', reference_date: referenceDate }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('fetch-cdi error:', err);
    // Fallback: cache mais recente ou constante
    const { data: cached } = await supabase
      .from('cdi_cache')
      .select('rate, reference_date')
      .order('fetched_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (cached) {
      return new Response(
        JSON.stringify({ rate: Number(cached.rate), source: 'stale_cache', reference_date: cached.reference_date }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    return new Response(
      JSON.stringify({ rate: FALLBACK_CDI, source: 'fallback' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
