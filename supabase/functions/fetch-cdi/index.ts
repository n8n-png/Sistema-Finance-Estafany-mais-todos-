/**
 * Taxa CDI anualizada (série 4389 do BCB), com cache diário.
 *
 * Story 2.7 — passou a exigir usuário autenticado.
 *
 * Antes: sem verificação nenhuma, usando `service_role`. Qualquer pessoa com a
 * URL podia disparar chamadas ao BCB em rajada e escrever no `cdi_cache` — não
 * há dado sensível em jogo (CDI é público), mas é consumo de recurso nosso e de
 * um serviço externo, em nome da MaisTODOS, por quem não deveria.
 *
 * O `service_role` continua sendo usado para gravar no cache: a tabela é
 * fechada para escrita por `authenticated`, e é a function que decide quando
 * atualizar. A diferença é que agora só quem está logado chega até aqui.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders, exigirUsuario, json } from "../_shared/auth.ts";

const FALLBACK_CDI = 0.1465;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const auth = await exigirUsuario(req);
  if (!auth.ok) return auth.response;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const today = new Date().toISOString().slice(0, 10);

  try {
    // Retorna o cache se já foi buscado hoje.
    const { data: cached } = await supabase
      .from("cdi_cache")
      .select("rate, reference_date, fetched_at")
      .order("fetched_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (cached && cached.fetched_at?.slice(0, 10) === today) {
      return json({
        rate: Number(cached.rate),
        source: "cache",
        reference_date: cached.reference_date,
      });
    }

    // CDI anualizado do BCB (série 4389, base 252).
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 10);
    const fmt = (d: Date) =>
      `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;

    const url =
      `https://api.bcb.gov.br/dados/serie/bcdata.sgs.4389/dados?formato=json` +
      `&dataInicial=${fmt(start)}&dataFinal=${fmt(end)}`;

    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`BCB ${resp.status}`);
    const rows = (await resp.json()) as { data: string; valor: string }[];
    if (!rows.length) throw new Error("BCB vazio");

    const ultima = rows[rows.length - 1];
    const rate = Number(ultima.valor) / 100;
    if (!Number.isFinite(rate) || rate <= 0) throw new Error("BCB devolveu valor inválido");

    const [dia, mes, ano] = ultima.data.split("/");
    const referenceDate = `${ano}-${mes}-${dia}`;

    await supabase.from("cdi_cache").insert({
      rate,
      reference_date: referenceDate,
      fetched_at: new Date().toISOString(),
    });

    return json({ rate, source: "bcb", reference_date: referenceDate });
  } catch (err) {
    console.error("[fetch-cdi] falha ao obter o CDI", err);
    // O CDI alimenta simulações na tela: devolver o último valor conhecido é
    // melhor do que devolver erro e deixar o cálculo sem taxa.
    const { data: ultimo } = await supabase
      .from("cdi_cache")
      .select("rate, reference_date")
      .order("fetched_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return json({
      rate: ultimo ? Number(ultimo.rate) : FALLBACK_CDI,
      source: ultimo ? "stale_cache" : "fallback",
      reference_date: ultimo?.reference_date ?? null,
    });
  }
});
