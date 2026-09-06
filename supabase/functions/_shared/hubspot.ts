/**
 * Mapeamento do HubSpot para o funil do painel.
 *
 * Todos os valores abaixo foram levantados na API (03/09) e confirmados com a
 * Estefany e a Lavínia (04/09). Ver `docs/04-mapeamento-hubspot.md`.
 *
 * ⚠️ ARMADILHA CONHECIDA: os nomes internos das propriedades **não descrevem o
 * que elas guardam**. Várias foram reaproveitadas de usos antigos — o rótulo na
 * tela mudou, o nome interno ficou. O prazo mora em `cluster_atual_parceiro_local`
 * e a taxa em `dias_em_atraso___consignado`. Não "corrija" esses nomes achando
 * que são erro de digitação: eles são o que a API devolve.
 *
 * As regras puras aqui (linha de crédito, tipo de taxa, rótulo) espelham
 * `src/utils/operacaoFormulas.ts`, que tem testes. A duplicação existe porque
 * edge functions rodam em Deno e não empacotam arquivos de fora de
 * `supabase/functions/`. **Ao alterar uma, altere a outra.**
 */

/** Pipeline "MaisTODOS - Comercial Crédito PJ". */
export const PIPELINE_CREDITO_PJ = "134862882";

/** Etapa do HubSpot → etapa do painel. */
export const ETAPA_HUBSPOT: Record<string, string> = {
  "233641651": "recolhimento", // Aguardando documentos — entrada no painel
  "233641652": "analise", // Análise Fornecedor
  "233641653": "aguardando_contrato", // Formalização
  "1420321874": "contrato_assinado", // Aguardando desembolso
  "233844036": "desembolsado", // Crédito concedido
  "1060807075": "desembolsado", // Crédito Concedido (legado)
};

/** Operação perdida: sai do quadro, mas o registro permanece. */
export const ETAPA_PERDIDA = "233844037";

/**
 * Etapas que o HubSpot governa (fonte da verdade), conforme acordado em 03/09.
 *
 * O sync só move a operação de etapa se ela estiver em uma destas. A partir de
 * "aguardando contrato" quem manda é o painel — puxar de volta apagaria o
 * trabalho de formalização, que é justamente o que o HubSpot não enxerga.
 */
export const ETAPAS_GOVERNADAS_PELO_HUBSPOT = new Set(["recolhimento", "analise"]);

/** Etapas do HubSpot que interessam ao painel. */
export const ETAPAS_MONITORADAS = [...Object.keys(ETAPA_HUBSPOT), ETAPA_PERDIDA];

/**
 * Propriedades do negócio.
 *
 * A coluna "rótulo" é o que aparece na tela do HubSpot — use-a para conferir,
 * porque o nome interno engana.
 */
export const PROP = {
  nome: "dealname", // Deal Name
  cnpj: "cnpj_empresa", // CNPJ Empresa
  etapa: "dealstage",
  valorBruto: "valor_do_contrato", // Valor do contrato
  valorTac: "close_rate", // "Valor da TAC"
  taxaPercentual: "dias_em_atraso___consignado", // "Valor da Taxa"
  taxaTipo: "tipo_de_taxa", // Tipo de Taxa (pré/pós)
  prazoMeses: "cluster_atual_parceiro_local", // "Prazo total"
  numeroParcelas: "numero_de_leads_diarios_da_as", // "Número de parcelas"
  carenciaPrincipal: "rotulo_de_associacao_as", // "Carência do Principal"
  linhaCredito: "objections_description", // "Tipo de Produto"
  idOperacao: "id_da_operacao", // ID da Operação (PO…)
  dataAnaliseFundo: "data_de_analise_valora",
  dataFormalizacao: "data_de_formalizacao",
  dataCreditoConcedido: "data_de_credito_concedido",
} as const;

export const PROPRIEDADES = Object.values(PROP);

// ---------------------------------------------------------------------------
// Conversões
// ---------------------------------------------------------------------------

const semAcento = (v: unknown) =>
  String(v ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();

/**
 * "Tipo de Produto" → linha de crédito do painel.
 *
 * Confirmado em 04/09: só QIA e Amor Saúde nesta versão. Os demais produtos
 * (Imóvel em Garantia, Antecipação de Recebíveis, Financiamento Imobiliário)
 * são de **outro fundo** e não pertencem a este painel — retornam `null` e a
 * operação é ignorada pelo sync.
 *
 * Ignorar é o comportamento certo: importar com uma linha inventada geraria o
 * checklist documental errado, e o checklist errado trava a formalização.
 */
export function mapearLinhaCredito(tipoProduto: string | null | undefined): string | null {
  const t = semAcento(tipoProduto);
  if (!t) return null;
  if (t.includes("qia")) return "QIA";
  if (t.includes("recebiveis como garantia")) return "Amor Saúde";
  return null;
}

/** "Tipo de Taxa" → `pre` | `pos`. "PRÉ/PÓS" conta como pós. */
export function normalizarTipoTaxa(valor: string | null | undefined): "pre" | "pos" | null {
  const t = semAcento(valor);
  if (!t) return null;
  if (t.includes("pre") && t.includes("pos")) return "pos";
  if (t.includes("pos")) return "pos";
  if (t.includes("pre")) return "pre";
  return null;
}

/** Rótulo exibido no painel: "2,19% a.m." ou "2,19% a.m. + CDI". */
export function montarRotuloTaxa(percentual: number | null, tipo: "pre" | "pos" | null): string {
  if (percentual === null || !Number.isFinite(percentual)) return "";
  const numero = percentual.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return tipo === "pos" ? `${numero}% a.m. + CDI` : `${numero}% a.m.`;
}

/** Número do HubSpot: vem como string, com vírgula ou ponto. */
export function numero(valor: unknown): number | null {
  if (valor === null || valor === undefined || valor === "") return null;
  const n = Number(String(valor).replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/** Inteiro não negativo, ou `null`. */
export function inteiro(valor: unknown): number | null {
  const n = numero(valor);
  return n === null ? null : Math.max(0, Math.round(n));
}

/** Data `AAAA-MM-DD`, ou `null`. O HubSpot devolve ISO ou timestamp. */
export function data(valor: unknown): string | null {
  if (!valor) return null;
  const bruto = String(valor);
  if (/^\d{4}-\d{2}-\d{2}/.test(bruto)) return bruto.slice(0, 10);
  const ms = Number(bruto);
  if (!Number.isFinite(ms)) return null;
  return new Date(ms).toISOString().slice(0, 10);
}

/** CNPJ normalizado em 14 dígitos, no mesmo formato do resto do sistema. */
export function cnpj(valor: unknown): string | null {
  const digitos = String(valor ?? "").replace(/\D/g, "");
  if (digitos.length === 0) return null;
  return digitos.padStart(14, "0").slice(-14);
}
