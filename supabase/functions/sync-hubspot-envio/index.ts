/**
 * Sincronização Painel → HubSpot — Story 4.2.
 *
 * Fecha o ciclo: o que avança no painel volta para o HubSpot, para o time
 * comercial acompanhar o SLA da esteira sem ninguém atualizar duas ferramentas
 * na mão — que era exatamente a dor descrita na reunião de 28/08.
 *
 * > *"O mundo perfeito seria se a gente atualizasse alguma coisa que atualizasse
 * > lá também."* — Estefany
 *
 * ## A defesa contra loop
 *
 * Dois sistemas que se atualizam mutuamente entram em ping-pong: A escreve em B,
 * B percebe a mudança e escreve em A, que percebe e escreve em B de novo.
 *
 * A proteção aqui tem três camadas, e cada uma sozinha seria insuficiente:
 *
 * 1. **Só sobem alterações de origem `painel`.** O que o próprio sync de entrada
 *    gravou fica marcado como `hubspot` e é ignorado por esta função.
 * 2. **Só sobem as etapas que o painel governa** (formalização em diante). As
 *    etapas iniciais pertencem ao HubSpot e nunca são escritas daqui.
 * 3. **`sincronizado_em` marca o envio.** Alteração já enviada não é reenviada
 *    enquanto não houver mudança nova.
 *
 * Idempotente: rodar duas vezes seguidas não produz efeito na segunda.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders, exigirAdmin, json } from "../_shared/auth.ts";
import { PROP } from "../_shared/hubspot.ts";

const HUBSPOT_API = "https://api.hubapi.com";

/**
 * Etapa do painel → etapa do HubSpot.
 *
 * Confirmado pela área em 04/09. Note que o painel detalha em três o que o
 * HubSpot resolve em uma só ("Formalização") — esse é o ganho de visibilidade
 * que a área pediu. Na volta, as três convergem: o HubSpot fica com a visão
 * macro, o painel guarda o detalhe.
 */
const ETAPA_PARA_HUBSPOT: Record<string, string> = {
  aguardando_contrato: "233641653", // Formalização
  contrato_emitido: "233641653", // Formalização (mesma etapa — sem mudança)
  contrato_assinado: "1420321874", // Aguardando desembolso
  desembolsado: "233844036", // Crédito concedido
};

/** Etapas governadas pelo painel. As demais nunca são escritas no HubSpot. */
const ETAPAS_DO_PAINEL = Object.keys(ETAPA_PARA_HUBSPOT);

interface Resumo {
  candidatas: number;
  enviadas: number;
  semMudanca: number;
  erros: string[];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);

  const auth = await exigirAdmin(req);
  if (!auth.ok) return auth.response;

  const HUBSPOT_TOKEN = Deno.env.get("HUBSPOT_TOKEN");
  if (!HUBSPOT_TOKEN) {
    console.error("[sync-hubspot-envio] HUBSPOT_TOKEN ausente no ambiente");
    return json({ error: "Integração não configurada" }, 500);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const resumo: Resumo = { candidatas: 0, enviadas: 0, semMudanca: 0, erros: [] };

  try {
    // Camadas 1 e 2 da proteção contra loop, aplicadas já na consulta.
    const { data: operacoes, error } = await supabase
      .from("operacoes_formalizacao")
      .select(
        "id, etapa, hubspot_deal_id, hubspot_stage_id, id_operacao, updated_at, sincronizado_em, origem_ultima_alteracao",
      )
      .eq("origem_ultima_alteracao", "painel")
      .in("etapa", ETAPAS_DO_PAINEL)
      .not("hubspot_deal_id", "is", null)
      .eq("arquivada", false);

    if (error) throw error;

    resumo.candidatas = operacoes?.length ?? 0;

    for (const operacao of operacoes ?? []) {
      try {
        const destino = ETAPA_PARA_HUBSPOT[operacao.etapa];

        // Camada 3: nada mudou desde o último envio.
        const jaEnviada =
          operacao.sincronizado_em &&
          new Date(operacao.sincronizado_em) >= new Date(operacao.updated_at);

        // O HubSpot já está na etapa certa: escrever de novo só geraria ruído no
        // histórico de lá e uma notificação inútil para o time comercial.
        const etapaJaCorreta = operacao.hubspot_stage_id === destino;

        if (jaEnviada && etapaJaCorreta) {
          resumo.semMudanca++;
          continue;
        }

        const propriedades: Record<string, string> = { dealstage: destino };

        // O ID da operação é gerado no painel a partir do desembolso (Story 3.8)
        // e sobe junto — hoje a área digita isso à mão no HubSpot.
        if (operacao.id_operacao) {
          propriedades[PROP.idOperacao] = operacao.id_operacao;
        }

        const res = await fetch(
          `${HUBSPOT_API}/crm/v3/objects/deals/${operacao.hubspot_deal_id}`,
          {
            method: "PATCH",
            headers: {
              Authorization: `Bearer ${HUBSPOT_TOKEN}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ properties: propriedades }),
          },
        );

        if (!res.ok) {
          const corpo = await res.text();
          throw new Error(`HubSpot ${res.status}: ${corpo.slice(0, 200)}`);
        }

        // `origem_ultima_alteracao` permanece 'painel' de propósito: mudá-la
        // aqui faria o sync de entrada tratar a operação como se o HubSpot
        // fosse a origem, e a etapa poderia ser puxada de volta.
        const { error: erroMarca } = await supabase
          .from("operacoes_formalizacao")
          .update({
            hubspot_stage_id: destino,
            sincronizado_em: new Date().toISOString(),
          })
          .eq("id", operacao.id);

        if (erroMarca) throw erroMarca;

        resumo.enviadas++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[sync-hubspot-envio] falha na operação ${operacao.id}`, err);
        resumo.erros.push(`${operacao.id}: ${msg}`);
      }
    }

    console.info("[sync-hubspot-envio] concluído", resumo);
    return json({ ok: true, ...resumo });
  } catch (err) {
    console.error("[sync-hubspot-envio] erro geral", err);
    return json({ error: "Falha na sincronização", detalhe: String(err) }, 502);
  }
});
