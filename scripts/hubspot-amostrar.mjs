#!/usr/bin/env node
/**
 * Amostragem de negócios reais de um pipeline — insumo da Story 4.1.
 *
 * O portal da MaisTODOS tem 2.582 propriedades de negócio, compartilhadas por
 * dezenas de operações do grupo. Procurar por nome, nesse volume, é chute.
 * Este script faz o caminho inverso: pega negócios reais do pipeline e mostra
 * **quais propriedades estão de fato preenchidas** — o que revela, sem adivinhar,
 * onde moram o CNPJ, o valor, a taxa e o prazo.
 *
 * Uso:
 *   node scripts/hubspot-amostrar.mjs <pipelineId> [quantidade]
 *
 * Exemplo (pipeline Comercial Crédito PJ):
 *   node scripts/hubspot-amostrar.mjs 134862882 5
 *
 * Somente leitura. Valores são MASCARADOS por padrão — o relatório mostra que a
 * propriedade tem conteúdo e o formato dele, não o dado do cliente.
 * Use --revelar para ver os valores (evite; é dado de cliente real).
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const destino = join(raiz, "export");
const BASE = "https://api.hubapi.com";

const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const revelar = process.argv.includes("--revelar");
const pipelineId = args[0];
const quantidade = Number(args[1] ?? 5);

/**
 * Filtro opcional por etapa: `--stage=233844036`.
 *
 * Existe porque a primeira execução ensinou uma lição: amostrar os negócios
 * "mais recentes" traz sobretudo os que morreram na fase comercial — sem valor,
 * sem taxa, sem prazo, porque esses campos só são preenchidos quando a operação
 * avança. Para descobrir onde moram os dados da operação, é preciso amostrar
 * negócios que **chegaram** à formalização.
 */
const stageId = process.argv.find((a) => a.startsWith("--stage="))?.split("=")[1];

if (!pipelineId) {
  console.error(
    "Uso: node scripts/hubspot-amostrar.mjs <pipelineId> [quantidade] [--stage=ID] [--revelar]",
  );
  process.exit(1);
}

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
  console.error("HUBSPOT_TOKEN não encontrado. Crie .env.local com HUBSPOT_TOKEN=...");
  process.exit(1);
}

async function api(caminho, opcoes = {}) {
  const res = await fetch(`${BASE}${caminho}`, {
    ...opcoes,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(opcoes.headers ?? {}),
    },
  });
  if (!res.ok) {
    const corpo = await res.text();
    throw new Error(`HubSpot ${res.status} em ${caminho}: ${corpo.slice(0, 400)}`);
  }
  return res.json();
}

/** Esconde o valor, preservando o formato — é isso que interessa no mapeamento. */
function mascarar(valor) {
  if (revelar) return String(valor);
  const s = String(valor);
  if (/^\d+([.,]\d+)?$/.test(s)) return `«número: ${s.length} dígitos»`;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return "«data»";
  if (s.length <= 3) return "«•••»";
  return `«texto: ${s.length} caracteres, começa com "${s.slice(0, 2)}…"»`;
}

console.log(`Buscando negócios do pipeline ${pipelineId}${stageId ? ` na etapa ${stageId}` : ""}...`);

// 1) Propriedades do objeto negócio
const propsResp = await api("/crm/v3/properties/deals");
const todas = (propsResp.results ?? []).map((p) => ({
  name: p.name,
  label: p.label,
  type: p.type,
  custom: !p.hubspotDefined,
}));
const porNome = new Map(todas.map((p) => [p.name, p]));

// 2) Negócios do pipeline, dos mais recentes
const busca = await api("/crm/v3/objects/deals/search", {
  method: "POST",
  body: JSON.stringify({
    filterGroups: [
      {
        filters: [
          { propertyName: "pipeline", operator: "EQ", value: pipelineId },
          ...(stageId
            ? [{ propertyName: "dealstage", operator: "EQ", value: stageId }]
            : []),
        ],
      },
    ],
    sorts: [{ propertyName: "hs_lastmodifieddate", direction: "DESCENDING" }],
    properties: ["dealname", "dealstage", "amount", "createdate"],
    limit: quantidade,
  }),
});

const negocios = busca.results ?? [];
console.log(`  ${busca.total ?? negocios.length} negócios no pipeline; amostrando ${negocios.length}`);

if (negocios.length === 0) {
  console.error("Nenhum negócio encontrado neste pipeline. Confira o ID.");
  process.exit(1);
}

// 3) Para cada negócio, buscar todas as propriedades em lotes.
//    A API limita o tamanho da querystring, então vai de 150 em 150.
const LOTE = 150;
const nomes = todas.map((p) => p.name);
const preenchidasPorNegocio = [];

for (const negocio of negocios) {
  const valores = {};
  for (let i = 0; i < nomes.length; i += LOTE) {
    const lote = nomes.slice(i, i + LOTE);
    const qs = lote.map((n) => `properties=${encodeURIComponent(n)}`).join("&");
    const detalhe = await api(`/crm/v3/objects/deals/${negocio.id}?${qs}`);
    for (const [chave, valor] of Object.entries(detalhe.properties ?? {})) {
      if (valor !== null && valor !== "" && valor !== undefined) valores[chave] = valor;
    }
  }
  preenchidasPorNegocio.push({ id: negocio.id, valores });
  process.stdout.write(`  negócio ${negocio.id}: ${Object.keys(valores).length} propriedades preenchidas\n`);
}

// 4) Frequência: propriedade preenchida em quantos negócios da amostra
const frequencia = new Map();
for (const { valores } of preenchidasPorNegocio) {
  for (const chave of Object.keys(valores)) {
    frequencia.set(chave, (frequencia.get(chave) ?? 0) + 1);
  }
}

// Ruído do próprio HubSpot: métricas internas que não são dado de negócio.
const ruido = /^(hs_|hubspot_|num_|days_|engagements_|notes_|closed_lost|closed_won)/;

const relevantes = [...frequencia.entries()]
  .filter(([nome]) => !ruido.test(nome))
  .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

const tabela = (cabecalhos, linhas) =>
  [
    `| ${cabecalhos.join(" | ")} |`,
    `|${cabecalhos.map(() => "---").join("|")}|`,
    ...linhas.map((l) => `| ${l.join(" | ")} |`),
  ].join("\n");

const exemplo = preenchidasPorNegocio[0];

const md = `# HubSpot — propriedades realmente usadas

> Pipeline \`${pipelineId}\`${stageId ? ` · etapa \`${stageId}\`` : ""} · amostra de ${negocios.length} negócios.
> Gerado em ${new Date().toISOString().slice(0, 10)} por \`scripts/hubspot-amostrar.mjs\`.
> Somente leitura. ${revelar ? "**Valores revelados** — contém dado de cliente." : "Valores mascarados: aparece o formato, não o conteúdo."}

O portal tem ${todas.length} propriedades de negócio cadastradas, compartilhadas por dezenas
de operações do grupo. As ${relevantes.length} abaixo são as que aparecem **efetivamente
preenchidas** nos negócios deste pipeline — é entre elas que estão os campos do Crédito PJ.

## Propriedades preenchidas, por frequência na amostra

${tabela(
  ["Propriedade", "Rótulo", "Tipo", "Preenchida em", "Exemplo (mascarado)"],
  relevantes.map(([nome, n]) => {
    const p = porNome.get(nome);
    const valor = exemplo.valores[nome];
    return [
      `\`${nome}\``,
      p?.label ?? "—",
      p?.type ?? "—",
      `${n}/${negocios.length}`,
      valor === undefined ? "—" : mascarar(valor),
    ];
  }),
)}

---

## Como usar esta lista

Para cada campo do painel, escolha a propriedade correspondente e confirme com a
Estefany antes de virar código:

| Campo do painel | Propriedade do HubSpot | Confirmado? |
|---|---|---|
| \`unidade\` | | |
| \`cnpj\` | | |
| \`valor\` | | |
| \`taxa\` | | |
| \`prazo_meses\` | | |
| \`linha\` (QIA / Amor Saúde / Visão de Todos) | | |

Preferir propriedades preenchidas em **todos** os negócios da amostra: as que aparecem em
poucos costumam ser de uso pontual e deixariam o sync com buracos.
`;

mkdirSync(destino, { recursive: true });
const arquivo = `hubspot-amostra-${pipelineId}${stageId ? `-${stageId}` : ""}.md`;
writeFileSync(join(destino, arquivo), md, "utf8");
console.log(`Relatório em export/${arquivo} (${relevantes.length} propriedades relevantes)`);
