#!/usr/bin/env node
/**
 * Descoberta do HubSpot — insumo da Story 4.1 (sync HubSpot → Painel).
 *
 * Lê o pipeline de negócios, as etapas e as propriedades, e gera um relatório
 * com o mapeamento sugerido para o funil do painel. É o que substitui pedir à
 * Estefany que cace ID de pipeline e nome de propriedade na interface.
 *
 * Uso (o token NUNCA vai no comando, para não ficar no histórico do shell):
 *
 *   1. Crie o arquivo .env.local na raiz com a linha:
 *        HUBSPOT_TOKEN=pat-na1-xxxxxxxx
 *   2. node scripts/hubspot-descobrir.mjs
 *
 * `.env.local` já está no .gitignore.
 *
 * Saída: export/hubspot-descoberta.md
 *
 * Somente leitura — não cria, altera nem apaga nada no HubSpot.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const destino = join(raiz, "export");
const BASE = "https://api.hubapi.com";

// --- token -----------------------------------------------------------------

function lerToken() {
  if (process.env.HUBSPOT_TOKEN) return process.env.HUBSPOT_TOKEN.trim();
  const caminho = join(raiz, ".env.local");
  if (existsSync(caminho)) {
    const linha = readFileSync(caminho, "utf8")
      .split("\n")
      .find((l) => l.trim().startsWith("HUBSPOT_TOKEN="));
    if (linha) return linha.split("=").slice(1).join("=").trim().replace(/^["']|["']$/g, "");
  }
  return null;
}

const token = lerToken();
if (!token) {
  console.error(
    "HUBSPOT_TOKEN não encontrado.\n" +
      "Crie o arquivo .env.local na raiz com a linha:\n" +
      "  HUBSPOT_TOKEN=pat-na1-xxxxxxxx\n",
  );
  process.exit(1);
}

// --- API -------------------------------------------------------------------

async function api(caminho) {
  const res = await fetch(`${BASE}${caminho}`, {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
  if (!res.ok) {
    const corpo = await res.text();
    if (res.status === 401) throw new Error("Token inválido ou expirado (401).");
    if (res.status === 403) {
      throw new Error(
        `Sem permissão (403) para ${caminho}.\n` +
          "Confira os escopos do aplicativo privado: crm.objects.deals.read, crm.schemas.deals.read.",
      );
    }
    throw new Error(`HubSpot ${res.status} em ${caminho}: ${corpo.slice(0, 300)}`);
  }
  return res.json();
}

// --- mapeamento ------------------------------------------------------------

/** Etapas do painel, para sugerir o pareamento com as do HubSpot. */
const ETAPAS_PAINEL = [
  { id: "recolhimento", titulo: "Recolhimento de documentos", pistas: ["document", "recolh"] },
  { id: "analise", titulo: "Análise fornecedor", pistas: ["analis", "fornecedor", "fundo"] },
  { id: "aguardando_contrato", titulo: "Aguardando contrato", pistas: ["aguard", "contrato"] },
  { id: "contrato_emitido", titulo: "Contrato emitido", pistas: ["emitid", "emiss"] },
  { id: "contrato_assinado", titulo: "Contrato assinado", pistas: ["assinad", "assinatura"] },
  { id: "desembolsado", titulo: "Desembolsado", pistas: ["desembols", "pago", "concedid"] },
];

const normalizar = (s) =>
  String(s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

function sugerirEtapa(rotuloHubspot) {
  const alvo = normalizar(rotuloHubspot);
  for (const etapa of ETAPAS_PAINEL) {
    if (etapa.pistas.some((p) => alvo.includes(p))) return etapa.id;
  }
  return null;
}

/** Campos do painel que precisam de origem no HubSpot. */
const CAMPOS_PAINEL = [
  { campo: "unidade", descricao: "Nome da unidade/estabelecimento", pistas: ["name", "empresa", "unidade"] },
  { campo: "cnpj", descricao: "CNPJ (14 dígitos)", pistas: ["cnpj", "documento"] },
  { campo: "valor", descricao: "Valor da operação", pistas: ["amount", "valor"] },
  { campo: "taxa", descricao: 'Taxa (rótulo, ex.: "1,2% a.m. + CDI")', pistas: ["taxa", "juros", "rate"] },
  { campo: "prazo_meses", descricao: "Prazo em meses", pistas: ["prazo", "parcela", "meses"] },
  { campo: "linha", descricao: "Linha de crédito (QIA, Amor Saúde, Visão de Todos)", pistas: ["linha", "produto", "modalidade"] },
];

function sugerirPropriedades(propriedades, pistas) {
  return propriedades
    .filter((p) => pistas.some((pista) => normalizar(p.name).includes(pista) || normalizar(p.label).includes(pista)))
    .slice(0, 5);
}

// --- execução --------------------------------------------------------------

const tabela = (cabecalhos, linhas) =>
  [
    `| ${cabecalhos.join(" | ")} |`,
    `|${cabecalhos.map(() => "---").join("|")}|`,
    ...linhas.map((l) => `| ${l.join(" | ")} |`),
  ].join("\n");

console.log("Consultando o HubSpot (somente leitura)...");

const [pipelines, propriedadesResp] = await Promise.all([
  api("/crm/v3/pipelines/deals"),
  api("/crm/v3/properties/deals"),
]);

const propriedades = (propriedadesResp.results ?? []).map((p) => ({
  name: p.name,
  label: p.label,
  type: p.type,
  custom: !p.hubspotDefined,
}));

console.log(`  ${pipelines.results?.length ?? 0} pipelines · ${propriedades.length} propriedades`);

let md = `# HubSpot — descoberta para o sync

> Gerado em ${new Date().toISOString().slice(0, 10)} por \`scripts/hubspot-descobrir.mjs\`.
> Somente leitura: nada foi criado nem alterado no HubSpot.

## Pipelines de negócios

`;

for (const pipeline of pipelines.results ?? []) {
  const etapas = (pipeline.stages ?? []).sort((a, b) => a.displayOrder - b.displayOrder);
  md += `### ${pipeline.label}\n\n`;
  md += `- **ID do pipeline:** \`${pipeline.id}\`\n`;
  md += `- **Etapas:** ${etapas.length}\n\n`;
  md += tabela(
    ["Ordem", "Etapa no HubSpot", "ID da etapa", "Etapa correspondente no painel"],
    etapas.map((s) => {
      const sugestao = sugerirEtapa(s.label);
      return [
        s.displayOrder,
        s.label,
        `\`${s.id}\``,
        sugestao ? `\`${sugestao}\`` : "— *(a definir)*",
      ];
    }),
  );
  md += `\n\n`;
}

md += `> As correspondências acima são **sugestões automáticas** por semelhança de nome.
> Precisam ser confirmadas com a Estefany e a Lavínia antes de virar código —
> um pareamento errado move operação para a etapa errada nos dois sistemas.

## Propriedades sugeridas por campo do painel

`;

for (const campo of CAMPOS_PAINEL) {
  const candidatas = sugerirPropriedades(propriedades, campo.pistas);
  md += `### \`${campo.campo}\` — ${campo.descricao}\n\n`;
  md += candidatas.length
    ? tabela(
        ["Propriedade", "Rótulo", "Tipo", "Personalizada?"],
        candidatas.map((p) => [`\`${p.name}\``, p.label, p.type, p.custom ? "sim" : "não"]),
      )
    : "_Nenhuma candidata encontrada — confirmar com a área qual propriedade usar._";
  md += `\n\n`;
}

const personalizadas = propriedades.filter((p) => p.custom);
md += `## Propriedades personalizadas (${personalizadas.length})

Criadas pela MaisTODOS — é entre elas que costumam estar os campos de negócio do Crédito PJ.

${
  personalizadas.length
    ? tabela(
        ["Propriedade", "Rótulo", "Tipo"],
        personalizadas.map((p) => [`\`${p.name}\``, p.label, p.type]),
      )
    : "_Nenhuma._"
}

---

## Próximos passos

1. Confirmar o pipeline correto com a Estefany (o operacional, não o comercial).
2. Validar o pareamento das etapas — é o ponto de maior risco do sync.
3. Confirmar qual propriedade alimenta cada campo do painel.
4. Definir a propriedade que guardará o vínculo com o painel, para idempotência.

Só depois disso a Story 4.1 vira código.
`;

mkdirSync(destino, { recursive: true });
writeFileSync(join(destino, "hubspot-descoberta.md"), md, "utf8");
console.log("Relatório gerado em export/hubspot-descoberta.md");
