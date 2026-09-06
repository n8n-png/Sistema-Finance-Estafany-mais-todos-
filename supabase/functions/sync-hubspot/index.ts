/**
 * Sincronização HubSpot → Painel — Story 4.1.
 *
 * Traz para o funil as operações do pipeline "MaisTODOS - Comercial Crédito PJ"
 * que estão nas etapas operacionais. Roda por polling (a cada 1–2 h): o volume é
 * de ~5 operações por semana, então tempo real seria custo sem ganho.
 *
 * Três decisões que governam esta função:
 *
 * 1. **Fonte da verdade por etapa.** O HubSpot manda enquanto a operação está em
 *    "recolhimento" ou "análise". A partir de "aguardando contrato" quem manda é
 *    o painel — mover a operação de volta apagaria o trabalho de formalização,
 *    que é exatamente o que o HubSpot não enxerga. Acordado em 03/09.
 *
 * 2. **Só QIA e Amor Saúde.** Os outros produtos do pipeline são de outro fundo.
 *    São ignorados, não importados com uma linha inventada — linha errada gera
 *    checklist documental errado.
 *
 * 3. **Nada é apagado.** Operação perdida no HubSpot é arquivada: sai do quadro,
 *    o registro permanece.
 *
 * Idempotente: pode rodar quantas vezes for, o resultado é o mesmo.
 * Somente leitura no HubSpot — esta função não escreve lá (isso é a Story 4.2).
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders, exigirAdmin, json } from "../_shared/auth.ts";
import {
  cnpj as normalizarCnpj,
  data as normalizarData,
  ETAPA_HUBSPOT,
  ETAPA_PERDIDA,
  ETAPAS_GOVERNADAS_PELO_HUBSPOT,
  ETAPAS_MONITORADAS,
  inteiro,
  mapearLinhaCredito,
  montarRotuloTaxa,
  normalizarTipoTaxa,
  numero,
  PIPELINE_CREDITO_PJ,
  PROP,
  PROPRIEDADES,
} from "../_shared/hubspot.ts";

const HUBSPOT_API = "https://api.hubapi.com";
const LOTE = 100;

interface Negocio {
  id: string;
  properties: Record<string, string | null>;
}

interface Resumo {
  lidos: number;
  criados: number;
  atualizados: number;
  arquivados: number;
  ignorados: number;
  erros: string[];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);

  // Sincronização altera dados de todas as operações: privilégio de admin.
  // Quando virar rotina agendada, o agendador chama com a chave de serviço.
  const auth = await exigirAdmin(req);
  if (!auth.ok) return auth.response;

  const HUBSPOT_TOKEN = Deno.env.get("HUBSPOT_TOKEN");
  if (!HUBSPOT_TOKEN) {
    console.error("[sync-hubspot] HUBSPOT_TOKEN ausente no ambiente");
    return json({ error: "Integração não configurada" }, 500);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const resumo: Resumo = {
    lidos: 0,
    criados: 0,
    atualizados: 0,
    arquivados: 0,
    ignorados: 0,
    erros: [],
  };

  try {
    const negocios = await buscarNegocios(HUBSPOT_TOKEN);
    resumo.lidos = negocios.length;

    for (const negocio of negocios) {
      try {
        await processar(supabase, negocio, resumo);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[sync-hubspot] falha no negócio ${negocio.id}`, err);
        resumo.erros.push(`${negocio.id}: ${msg}`);
      }
    }

    console.info("[sync-hubspot] concluído", resumo);
    return json({ ok: true, ...resumo });
  } catch (err) {
    console.error("[sync-hubspot] erro geral", err);
    return json({ error: "Falha na sincronização", detalhe: String(err) }, 502);
  }
});

// ---------------------------------------------------------------------------
// HubSpot
// ---------------------------------------------------------------------------

async function buscarNegocios(token: string): Promise<Negocio[]> {
  const encontrados: Negocio[] = [];
  let after: string | undefined;

  do {
    const res = await fetch(`${HUBSPOT_API}/crm/v3/objects/deals/search`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        filterGroups: [
          {
            filters: [
              { propertyName: "pipeline", operator: "EQ", value: PIPELINE_CREDITO_PJ },
              { propertyName: "dealstage", operator: "IN", values: ETAPAS_MONITORADAS },
            ],
          },
        ],
        properties: PROPRIEDADES,
        limit: LOTE,
        ...(after ? { after } : {}),
      }),
    });

    if (!res.ok) {
      const corpo = await res.text();
      throw new Error(`HubSpot ${res.status}: ${corpo.slice(0, 300)}`);
    }

    const dados = await res.json();
    encontrados.push(...(dados.results ?? []));
    after = dados.paging?.next?.after;
  } while (after);

  return encontrados;
}

// ---------------------------------------------------------------------------
// Processamento
// ---------------------------------------------------------------------------

// deno-lint-ignore no-explicit-any
async function processar(supabase: any, negocio: Negocio, resumo: Resumo) {
  const p = negocio.properties ?? {};
  const etapaHubspot = String(p[PROP.etapa] ?? "");

  const { data: existente } = await supabase
    .from("operacoes_formalizacao")
    .select("id, etapa, arquivada")
    .eq("hubspot_deal_id", negocio.id)
    .maybeSingle();

  // --- perdida: arquiva, nunca apaga ---------------------------------------
  if (etapaHubspot === ETAPA_PERDIDA) {
    if (!existente || existente.arquivada) {
      resumo.ignorados++;
      return;
    }
    const { error } = await supabase
      .from("operacoes_formalizacao")
      .update({
        arquivada: true,
        arquivada_em: new Date().toISOString(),
        arquivada_motivo: "Negociação perdida no HubSpot",
        origem_ultima_alteracao: "hubspot",
        sincronizado_em: new Date().toISOString(),
      })
      .eq("id", existente.id);
    if (error) throw error;
    resumo.arquivados++;
    return;
  }

  // --- linha de crédito decide se a operação é deste painel -----------------
  const linha = mapearLinhaCredito(p[PROP.linhaCredito]);
  if (!linha) {
    resumo.ignorados++;
    return;
  }

  const etapaPainel = ETAPA_HUBSPOT[etapaHubspot];
  if (!etapaPainel) {
    resumo.ignorados++;
    return;
  }

  const taxaPercentual = numero(p[PROP.taxaPercentual]);
  const taxaTipo = normalizarTipoTaxa(p[PROP.taxaTipo]);
  const valorBruto = numero(p[PROP.valorBruto]);

  // Sem valor não há operação: importar com zero produziria número errado em
  // documento que vai para o fundo.
  if (valorBruto === null || valorBruto <= 0) {
    resumo.ignorados++;
    resumo.erros.push(`${negocio.id}: sem valor de contrato`);
    return;
  }

  const comuns = {
    unidade: String(p[PROP.nome] ?? "").trim() || "Sem nome",
    cnpj: normalizarCnpj(p[PROP.cnpj]),
    linha,
    valor_bruto: valorBruto,
    valor_tac: numero(p[PROP.valorTac]) ?? 0,
    taxa: montarRotuloTaxa(taxaPercentual, taxaTipo),
    taxa_percentual: taxaPercentual,
    taxa_tipo: taxaTipo,
    prazo_meses: inteiro(p[PROP.prazoMeses]) ?? 0,
    numero_parcelas: inteiro(p[PROP.numeroParcelas]),
    carencia_principal_meses: inteiro(p[PROP.carenciaPrincipal]),
    id_operacao: p[PROP.idOperacao] || null,
    hubspot_stage_id: etapaHubspot,
    data_analise_fundo: normalizarData(p[PROP.dataAnaliseFundo]),
    data_formalizacao: normalizarData(p[PROP.dataFormalizacao]),
    data_credito_concedido: normalizarData(p[PROP.dataCreditoConcedido]),
    origem_ultima_alteracao: "hubspot" as const,
    sincronizado_em: new Date().toISOString(),
  };

  // --- criação --------------------------------------------------------------
  if (!existente) {
    if (comuns.prazo_meses <= 0) {
      resumo.ignorados++;
      resumo.erros.push(`${negocio.id}: sem prazo`);
      return;
    }

    const { data: criada, error } = await supabase
      .from("operacoes_formalizacao")
      .insert({
        ...comuns,
        etapa: etapaPainel,
        hubspot_deal_id: negocio.id,
        fundo: "FIDC MaisTODOS",
        // O aging precisa nascer da data real da etapa, não da data da
        // importação — senão uma operação parada há semanas apareceria em dia.
        data_entrada_etapa:
          comuns.data_analise_fundo ?? comuns.data_formalizacao ?? new Date().toISOString(),
      })
      .select("id")
      .single();

    if (error) throw error;
    resumo.criados++;

    await criarChecklist(supabase, criada.id, linha);
    return;
  }

  // --- atualização ----------------------------------------------------------
  if (existente.arquivada) {
    // Voltou a ser negócio ativo no HubSpot: desarquiva.
    await supabase
      .from("operacoes_formalizacao")
      .update({ arquivada: false, arquivada_em: null, arquivada_motivo: null })
      .eq("id", existente.id);
  }

  // A etapa só é movida enquanto o HubSpot for a fonte da verdade dela.
  // Nas etapas de formalização em diante, o painel tem informação que o HubSpot
  // não tem — sobrescrever seria perder trabalho.
  const podeMoverEtapa = ETAPAS_GOVERNADAS_PELO_HUBSPOT.has(existente.etapa);

  const { error } = await supabase
    .from("operacoes_formalizacao")
    .update(podeMoverEtapa ? { ...comuns, etapa: etapaPainel } : comuns)
    .eq("id", existente.id);

  if (error) throw error;
  resumo.atualizados++;
}

/**
 * Cria o checklist documental da operação nova.
 *
 * A lista depende da linha de crédito — é por isso que importar com a linha
 * errada seria pior do que não importar.
 */
// deno-lint-ignore no-explicit-any
async function criarChecklist(supabase: any, operacaoId: string, linha: string) {
  const { data: modelo, error: erroModelo } = await supabase
    .from("operacoes_formalizacao_checklist_modelo")
    .select("ordem, label")
    .eq("linha", linha)
    .order("ordem", { ascending: true });

  if (erroModelo) {
    console.warn("[sync-hubspot] modelo de checklist indisponível", erroModelo.message);
    return;
  }
  if (!modelo?.length) return;

  const { error } = await supabase.from("operacoes_formalizacao_checklist").insert(
    // deno-lint-ignore no-explicit-any
    modelo.map((item: any) => ({
      operacao_id: operacaoId,
      ordem: item.ordem,
      label: item.label,
    })),
  );
  if (error) console.warn("[sync-hubspot] falha ao criar checklist", error.message);
}
