#!/usr/bin/env node
/**
 * Gera o pacote de contexto da esteira de evolução — Story 5.1.
 *
 * O ciclo acordado na reunião de 28/08: as POs (Estefany e Lavínia) desenham a
 * mudança com o Claude e devolvem a especificação pronta; o Matheus implementa.
 * Para isso funcionar, elas precisam entregar ao Claude o contexto do painel —
 * senão ele inventa telas, campos e regras que não existem, e a especificação
 * chega errada.
 *
 * Este script extrai esse contexto do próprio código, para que ele nunca fique
 * desatualizado em relação ao que está no ar.
 *
 * Uso:  node scripts/gerar-pacote-evolucao.mjs
 * Saída: export/
 */

import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const destino = join(raiz, "export");

const ler = (caminho) => {
  try {
    return readFileSync(join(raiz, caminho), "utf8");
  } catch {
    return "";
  }
};

const hoje = new Date().toISOString().slice(0, 10);

// ---------------------------------------------------------------------------
// Extração
// ---------------------------------------------------------------------------

/**
 * Rotas declaradas em App.tsx, com a proteção de cada uma.
 *
 * Em vez de tentar casar o bloco `<Route ... />` inteiro por regex — JSX
 * aninhado quebra qualquer expressão razoável — recorta o texto entre uma
 * declaração de `path=` e a seguinte, e inspeciona esse trecho.
 */
function extrairRotas() {
  const src = ler("src/App.tsx");
  const marcas = [...src.matchAll(/path="([^"]+)"/g)];
  // Componentes de infraestrutura não são a "tela" da rota.
  const infra = new Set(["Fallback", "AppLayout", "Suspense", "ProtectedRoute", "Route", "Routes"]);

  return marcas.map((marca, i) => {
    const path = marca[1];
    const inicio = marca.index;
    const fim = i + 1 < marcas.length ? marcas[i + 1].index : src.length;
    const trecho = src.slice(inicio, fim);

    const pageKey = trecho.match(/pageKey="([^"]+)"/)?.[1];
    const requerAdmin = /requireAdmin/.test(trecho);

    const componente =
      [...trecho.matchAll(/<([A-Z]\w+)\s*\/>/g)]
        .map((c) => c[1])
        .find((nome) => !infra.has(nome)) ?? "—";

    let protecao = "Pública";
    if (requerAdmin) protecao = "Somente administrador";
    else if (pageKey) protecao = `Permissão \`${pageKey}\``;
    else if (/ProtectedRoute/.test(trecho)) protecao = "Qualquer usuário logado";

    return { path, componente, protecao };
  });
}

/** Páginas que o administrador pode liberar por usuário. */
function extrairPageKeys() {
  const src = ler("src/hooks/usePageAccess.ts");
  const bloco = src.split("PAGE_KEYS = [")[1]?.split("] as const")[0] ?? "";
  const chaves = [];
  const re = /key:\s*"([^"]+)",\s*label:\s*"([^"]+)"/g;
  let m;
  while ((m = re.exec(bloco)) !== null) chaves.push({ key: m[1], label: m[2] });
  return chaves;
}

/** Etapas do funil de formalização. */
function extrairEtapas() {
  const src = ler("src/services/operacoes.ts");
  const bloco = src.split("export const ETAPAS")[1]?.split("];")[0] ?? "";
  const etapas = [];
  const re = /id:\s*"([^"]+)",\s*titulo:\s*"([^"]+)",\s*slaDias:\s*(\d+)/g;
  let m;
  while ((m = re.exec(bloco)) !== null) {
    etapas.push({ id: m[1], titulo: m[2], sla: m[3] });
  }
  return etapas;
}

/** Cores da identidade visual, do tailwind.config. */
function extrairCores() {
  const src = ler("tailwind.config.ts");
  const cores = [];
  const re = /"?([a-z][\w-]*)"?:\s*"(hsl\([^"]+\)|#[0-9a-fA-F]{3,8})"/g;
  let m;
  while ((m = re.exec(src)) !== null) cores.push({ nome: m[1], valor: m[2] });
  return cores;
}

/** Componentes de tela, agrupados por área (ignora a pasta ui/, que é a shadcn). */
function extrairComponentes() {
  const base = join(raiz, "src/components");
  if (!existsSync(base)) return [];
  return readdirSync(base, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name !== "ui")
    .map((d) => ({
      area: d.name,
      arquivos: readdirSync(join(base, d.name)).filter((f) => f.endsWith(".tsx")),
    }));
}

// ---------------------------------------------------------------------------
// Geração
// ---------------------------------------------------------------------------

const rotas = extrairRotas();
const pageKeys = extrairPageKeys();
const etapas = extrairEtapas();
const cores = extrairCores();
const componentes = extrairComponentes();

const tabela = (cabecalhos, linhas) =>
  [
    `| ${cabecalhos.join(" | ")} |`,
    `|${cabecalhos.map(() => "---").join("|")}|`,
    ...linhas.map((l) => `| ${l.join(" | ")} |`),
  ].join("\n");

const contexto = `# Contexto do Painel de Crédito PJ — para uso com o Claude

> Gerado automaticamente em ${hoje} por \`scripts/gerar-pacote-evolucao.mjs\`.
> Não editar à mão: rode o script de novo para atualizar.

Este arquivo descreve o painel como ele está hoje. Entregue-o ao Claude **antes**
de pedir qualquer alteração — sem ele, o Claude inventa telas, campos e regras
que não existem, e a especificação chega errada para implementação.

---

## Telas existentes

${tabela(["Endereço", "Tela", "Quem acessa"], rotas.map((r) => [`\`${r.path}\``, r.componente, r.protecao]))}

## Permissões que o administrador libera por pessoa

${tabela(["Chave", "O que libera"], pageKeys.map((p) => [`\`${p.key}\``, p.label]))}

## Etapas do funil de formalização

${tabela(["#", "Etapa", "Título na tela", "SLA (dias)"], etapas.map((e, i) => [i + 1, `\`${e.id}\``, e.titulo, e.sla]))}

A movimentação entre etapas é **automatizada** — não há arrastar de card, por
decisão da área. O SLA é configurável no banco, sem precisar de nova versão.

## Áreas de componentes

${tabela(["Área", "Componentes"], componentes.map((c) => [c.area, c.arquivos.length + " arquivos"]))}

## Identidade visual

Fonte de títulos: Lexend · Fonte de texto: Inter / Plus Jakarta Sans

${
  cores.length
    ? tabela(["Token", "Valor"], cores.slice(0, 30).map((c) => [`\`${c.nome}\``, `\`${c.valor}\``]))
    : "_(não foi possível extrair as cores do tailwind.config)_"
}

---

## Regras que qualquer proposta precisa respeitar

1. **Permissão por etapa.** O time do fundo (Valora) enxerga apenas as etapas
   que lhe foram liberadas. Qualquer tela nova precisa dizer quem vê o quê.
2. **Nada de dado sensível em tela compartilhada.** CPF de avalista e carteira de
   clientes pré-aprovados não aparecem para quem só acompanha a operação.
3. **Toda mudança de etapa é registrada.** O histórico é permanente e não pode
   ser editado nem apagado — inclusive por administrador.
4. **O HubSpot manda nas etapas 1 e 2** (entrada e análise); o painel manda nas
   etapas 4, 5 e 6 (contrato emitido, assinado e desembolsado).
5. **Notificação por e-mail** sai a cada mudança de etapa, para os destinatários
   cadastrados na própria operação.
`;

const template = `# Solicitação de alteração — Painel de Crédito PJ

> Preencha um arquivo destes por alteração desejada e envie junto com o HTML
> que você desenhou com o Claude.

## 1. Identificação

- **Data:**
- **Quem está pedindo:**
- **Tela afetada:** (ex.: Operações em Formalização, Home, Consultar Limites)
- **Prioridade:** Alta / Média / Baixa

## 2. O que incomoda hoje

Descreva a situação atual e por que ela atrapalha. Não descreva a solução ainda —
descreva o problema. Isso costuma abrir alternativas melhores.

## 3. O que você quer que aconteça

Descreva o comportamento desejado do ponto de vista de quem usa.

> Exemplo bom: "quando a operação passa de Contrato emitido para Contrato
> assinado, quero que o valor do desembolso apareça no card sem precisar abrir."
>
> Exemplo ruim: "adicionar um campo na tabela."

## 4. Quem pode ver e quem pode mexer

- [ ] Todo o time interno
- [ ] Somente administradores
- [ ] O time do fundo (Valora) também — **se sim, em quais etapas?**

⚠️ Este item é obrigatório. Sem ele a alteração não pode ser implementada, porque
o sistema controla acesso por etapa.

## 5. Campos novos (se houver)

| Campo | Tipo | Obrigatório? | De onde vem o dado? |
|---|---|---|---|
|  |  |  |  |

"De onde vem o dado" é importante: digitado por alguém, vindo do HubSpot, vindo
da ferramenta de assinatura, ou calculado pelo sistema?

## 6. O que NÃO deve mudar

Liste o que precisa continuar exatamente como está. Ajuda a evitar efeito colateral.

## 7. Como saber que ficou pronto

Liste como você vai conferir que a alteração funcionou.

- [ ]
- [ ]

## 8. Anexos

- [ ] HTML desenhado com o Claude
- [ ] Prints da tela atual
`;

const leiame = `# Pacote de evolução — Painel de Crédito PJ

Gerado em ${hoje}.

Este pacote existe para que a Estefany e a Lavínia consigam desenhar alterações
com o Claude e devolver uma especificação que já chega pronta para implementar.

## Como usar

1. **Abra uma conversa nova com o Claude.**
2. **Anexe o \`contexto-painel.md\`** e diga: *"este é o sistema que temos hoje"*.
3. Descreva a mudança que você quer. Peça ao Claude para desenhar a tela em HTML.
4. Converse e ajuste até ficar como você imagina.
5. **Preencha o \`template-solicitacao.md\`** com o que foi decidido.
6. Envie ao Matheus: o **HTML** + o **template preenchido**.

## Por que não basta mandar o print

O print mostra como deve ficar, mas não responde: quem pode ver, quem pode
editar, de onde vem cada dado, e o que não pode mudar. São essas respostas que
determinam se a alteração é de uma hora ou de uma semana — e é o que o template
captura.

## O que este pacote não inclui

O HTML da tela **como ela está hoje**. Enquanto o sistema não estiver publicado,
tire um print ou salve a página pelo navegador (Ctrl+S) e anexe junto.

## Importante

O Lovable está **congelado**. Alterações feitas lá não chegam ao sistema. Todo
pedido passa por esta esteira.
`;

mkdirSync(destino, { recursive: true });
writeFileSync(join(destino, "contexto-painel.md"), contexto, "utf8");
writeFileSync(join(destino, "template-solicitacao.md"), template, "utf8");
writeFileSync(join(destino, "README.md"), leiame, "utf8");

console.log(`Pacote gerado em export/ (${hoje})`);
console.log(`  ${rotas.length} telas · ${pageKeys.length} permissões · ${etapas.length} etapas · ${componentes.length} áreas de componentes`);
