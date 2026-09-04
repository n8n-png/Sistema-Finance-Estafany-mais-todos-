#!/usr/bin/env node
/**
 * Extração dos dados do Supabase do Lovable — resgate de histórico.
 *
 * ⚠️ URGENTE. Contexto:
 *
 * A área confirmou em 04/09 que **não tem as planilhas originais**. O painel do
 * Lovable, porém, continua em uso diário — ou seja, o banco está de pé e
 * acessível. Enquanto estiver, dá para resgatar tudo por aqui.
 *
 * Essa janela não é permanente: projetos Supabase no plano gratuito pausam por
 * inatividade, e o vínculo com o Lovable pode ser desfeito. Sem planilha e sem
 * este resgate, o histórico se perde de vez.
 *
 * Como funciona: entra com um usuário do painel e lê as tabelas pela mesma API
 * que a aplicação usa. A RLS continua valendo — por isso o usuário precisa ser
 * **administrador**, senão parte das tabelas volta vazia.
 *
 * Preparação:
 *   1. Peça à Estefany (admin do painel) que crie um usuário administrador para
 *      você, pela tela de administração do painel.
 *   2. Acrescente ao .env.local:
 *        LOVABLE_SUPABASE_URL=https://cehpsvuytdriikxtukmb.supabase.co
 *        LOVABLE_SUPABASE_ANON_KEY=<a chave do .env do export>
 *        LOVABLE_EMAIL=seu-usuario@maistodos.com.br
 *        LOVABLE_SENHA=...
 *   3. node scripts/extrair-dados-lovable.mjs
 *
 * Saída: export/dados-lovable/<tabela>.json + um relatório de contagem.
 * Somente leitura — nada é alterado no banco de origem.
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const destino = join(raiz, "export", "dados-lovable");

// --- configuração -----------------------------------------------------------

function lerEnvLocal() {
  const caminho = join(raiz, ".env.local");
  const vars = {};
  if (existsSync(caminho)) {
    for (const linha of readFileSync(caminho, "utf8").split("\n")) {
      const limpa = linha.trim();
      if (!limpa || limpa.startsWith("#")) continue;
      const i = limpa.indexOf("=");
      if (i === -1) continue;
      vars[limpa.slice(0, i).trim()] = limpa
        .slice(i + 1)
        .trim()
        .replace(/^["']|["']$/g, "");
    }
  }
  return vars;
}

const env = { ...lerEnvLocal(), ...process.env };
const URL = env.LOVABLE_SUPABASE_URL;
const ANON = env.LOVABLE_SUPABASE_ANON_KEY;
const EMAIL = env.LOVABLE_EMAIL;
const SENHA = env.LOVABLE_SENHA;

if (!URL || !ANON || !EMAIL || !SENHA) {
  console.error(
    "Faltam variáveis. Acrescente ao .env.local:\n" +
      "  LOVABLE_SUPABASE_URL=\n" +
      "  LOVABLE_SUPABASE_ANON_KEY=\n" +
      "  LOVABLE_EMAIL=\n" +
      "  LOVABLE_SENHA=\n",
  );
  process.exit(1);
}

/**
 * Tabelas a resgatar, em ordem de importância.
 * `critica` marca o que não tem como refazer se perder.
 */
const TABELAS = [
  { nome: "operacoes_parcelas_manuais", critica: true, desc: "Histórico de parcelas pagas" },
  { nome: "clientes_limites", critica: true, desc: "Limites por cliente" },
  { nome: "clientes_pre_aprovados", critica: true, desc: "Carteira de pré-aprovados" },
  { nome: "operacoes_ativas", critica: true, desc: "Operações ativas" },
  { nome: "operacoes_overrides", critica: true, desc: "Ajustes manuais de carência" },
  { nome: "operacoes_checklists", critica: true, desc: "Checklists preenchidos" },
  { nome: "indicadores_manuais_mensais", critica: true, desc: "Indicadores da home" },
  { nome: "user_page_access", critica: true, desc: "Permissões por usuário" },
  { nome: "user_roles", critica: true, desc: "Papéis dos usuários" },
  { nome: "operacoes_snapshots", critica: false, desc: "Snapshots (recalculáveis)" },
  { nome: "operacoes_projecoes", critica: false, desc: "Projeções (recalculáveis)" },
  { nome: "operacoes_divergencias", critica: false, desc: "Divergências (recalculáveis)" },
  { nome: "import_history", critica: false, desc: "Histórico de importações" },
  { nome: "operacoes_import_history", critica: false, desc: "Histórico de importações de operações" },
  { nome: "cdi_daily", critica: false, desc: "CDI diário (rebaixável do BCB)" },
  { nome: "cdi_cache", critica: false, desc: "Cache de CDI" },
  { nome: "holidays", critica: false, desc: "Feriados" },
];

const PAGINA = 1000;

// --- execução ---------------------------------------------------------------

const supabase = createClient(URL, ANON, {
  auth: { persistSession: false, autoRefreshToken: false },
});

console.log("Autenticando no painel do Lovable...");
const { data: sessao, error: erroLogin } = await supabase.auth.signInWithPassword({
  email: EMAIL,
  password: SENHA,
});

if (erroLogin || !sessao?.user) {
  console.error("Falha no login:", erroLogin?.message ?? "usuário não retornado");
  process.exit(1);
}
console.log(`  autenticado como ${sessao.user.email}`);

// Confere se é admin: sem isso, várias tabelas voltam vazias por RLS e o
// resgate parece bem-sucedido quando na verdade veio incompleto.
const { data: papeis } = await supabase
  .from("user_roles")
  .select("role")
  .eq("user_id", sessao.user.id);

const ehAdmin = (papeis ?? []).some((p) => p.role === "admin");
if (!ehAdmin) {
  console.warn(
    "\n⚠️  Este usuário NÃO é administrador.\n" +
      "   A RLS vai esconder parte dos dados e o resgate virá incompleto.\n" +
      "   Peça à Estefany que promova este usuário a administrador antes de continuar.\n",
  );
} else {
  console.log("  usuário é administrador — leitura completa\n");
}

mkdirSync(destino, { recursive: true });

const resultados = [];

for (const tabela of TABELAS) {
  let linhas = [];
  let inicio = 0;
  let erro = null;

  // Paginação: sem isso o PostgREST devolve só as primeiras 1.000 linhas e o
  // arquivo sai truncado sem nenhum aviso.
  for (;;) {
    const { data, error } = await supabase
      .from(tabela.nome)
      .select("*")
      .range(inicio, inicio + PAGINA - 1);

    if (error) {
      erro = error.message;
      break;
    }
    linhas = linhas.concat(data ?? []);
    if (!data || data.length < PAGINA) break;
    inicio += PAGINA;
  }

  if (erro) {
    console.log(`  ✗ ${tabela.nome.padEnd(32)} erro: ${erro}`);
    resultados.push({ ...tabela, total: 0, erro });
    continue;
  }

  writeFileSync(join(destino, `${tabela.nome}.json`), JSON.stringify(linhas, null, 2), "utf8");
  const marca = tabela.critica && linhas.length === 0 ? "⚠" : "✓";
  console.log(`  ${marca} ${tabela.nome.padEnd(32)} ${String(linhas.length).padStart(6)} registros`);
  resultados.push({ ...tabela, total: linhas.length, erro: null });
}

await supabase.auth.signOut();

// --- relatório --------------------------------------------------------------

const totalGeral = resultados.reduce((s, r) => s + r.total, 0);
const vaziasCriticas = resultados.filter((r) => r.critica && r.total === 0 && !r.erro);

const relatorio = `# Resgate dos dados do Lovable

- **Data:** ${new Date().toISOString().slice(0, 10)}
- **Origem:** \`${URL}\`
- **Usuário:** ${sessao.user.email}${ehAdmin ? " (administrador)" : " ⚠️ **não é administrador**"}
- **Total resgatado:** ${totalGeral.toLocaleString("pt-BR")} registros

| Tabela | O que é | Registros | Crítica? |
|---|---|---|---|
${resultados
  .map(
    (r) =>
      `| \`${r.nome}\` | ${r.desc} | ${r.erro ? `erro: ${r.erro}` : r.total.toLocaleString("pt-BR")} | ${r.critica ? "sim" : "não"} |`,
  )
  .join("\n")}

${
  vaziasCriticas.length
    ? `## ⚠️ Atenção\n\nTabelas críticas voltaram vazias:\n\n${vaziasCriticas
        .map((r) => `- \`${r.nome}\` — ${r.desc}`)
        .join("\n")}\n\nOu elas estão realmente vazias na origem, ou a RLS bloqueou a leitura.
${ehAdmin ? "Como o usuário é administrador, provavelmente estão vazias mesmo." : "**O usuário não é administrador — refaça o resgate com um usuário admin antes de concluir.**"}`
    : "Nenhuma tabela crítica voltou vazia."
}

## Próximo passo

Os arquivos JSON em \`export/dados-lovable/\` alimentam a carga no banco novo,
depois que ele estiver de pé. Guarde uma cópia fora deste repositório: enquanto o
banco novo não existe, **esta é a única cópia do histórico**.
`;

writeFileSync(join(raiz, "export", "resgate-dados-lovable.md"), relatorio, "utf8");

console.log(`\nTotal: ${totalGeral.toLocaleString("pt-BR")} registros`);
console.log("Arquivos em export/dados-lovable/");
console.log("Relatório em export/resgate-dados-lovable.md");
if (vaziasCriticas.length && !ehAdmin) {
  console.log("\n⚠️  Resgate possivelmente INCOMPLETO — refaça com usuário administrador.");
  process.exit(2);
}
