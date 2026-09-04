# Respostas recebidas — 04/09/2026

Consolidação das 14 perguntas enviadas em 03/09, respondidas por Estefany Gomes e
Lavínia Resende.

---

## 1. Respostas fechadas

| # | Pergunta | Resposta | Efeito |
|---|---|---|---|
| 1 | Planilhas originais | **Não têm nenhuma** | 🔴 Ver §2 — mudou a prioridade do projeto |
| 3 | Negociação perdida | Sumir do painel | ⚠️ Ver §4 — "sumir" ≠ apagar |
| 4 | Mapeamento das etapas | Confirmado | Story 4.2 liberada |
| 5 | Painel antes do SharePoint | Confirmado | Sequência mantida |
| 6 | Subdomínio de e-mail | Autorizado | Pedir DNS ao Victor |
| 7 | Valor da operação | **Valor do contrato** | Confirma a Story 3.7 |
| 8 | Prazo | **Prazo total** | Ver §5 — a explicação valida o modelo |
| 10 | Taxa | Valor da Taxa = % de juros; Tipo de Taxa = pré/pós; pós inclui CDI | Ver §6 |
| 11 | Link documentos | Vão parar de usar — o painel passa a ser o armazenador | Ver §7 |
| 13 | ROD | Retool novo do Crédito PJ, para documento **do CNPJ**, não da operação. Ainda imaturo | Fora de escopo |
| 14 | Pasta do SharePoint | Criar uma pasta "Painel PJ" | Falta o nome exato do site/biblioteca |

---

## 2. 🔴 A resposta mais grave: não há planilhas

> *"Não temos nenhuma"*

Isso muda a natureza do problema. Antes, perder o banco do Lovable era um contratempo
recuperável por reimportação. **Agora é perda definitiva de histórico** — a menos que os dados
sejam resgatados direto do banco.

### A janela ainda está aberta

A Lavínia relatou em 04/09 que **continua usando o painel do Lovable no dia a dia** — inclusive
editou uma tela lá para conseguir trabalhar. Se o painel funciona, **o banco está de pé e
acessível**.

Ou seja: mesmo sem o acesso ao dashboard do Supabase, dá para ler os dados pela mesma API que
a aplicação usa, entrando com um usuário do painel.

### Por que é urgente

| Risco | Consequência |
|---|---|
| Projetos Supabase no plano gratuito **pausam por inatividade** | Banco fica inacessível |
| O vínculo com o Lovable pode ser desfeito a qualquer momento | Perda do acesso |
| Ninguém sabe quem controla a organização onde o projeto vive | Não há a quem recorrer |

**Enquanto não houver banco novo, o Lovable é a única cópia do histórico da área.**

### O que foi preparado

`scripts/extrair-dados-lovable.mjs` (`npm run resgatar:dados`) — entra com um usuário do
painel e resgata as 17 tabelas, com paginação, para JSON.

**O que falta:** um usuário **administrador** do painel. A Estefany é admin e consegue criar
um pela própria tela de administração. Sem privilégio de administrador, a RLS esconde parte
dos dados e o resgate vem incompleto — por isso o script verifica o papel e avisa em vez de
terminar em falso sucesso.

`LOVABLE_SUPABASE_URL` e `LOVABLE_SUPABASE_ANON_KEY` já estão preenchidos no `.env.local`
(vieram no export). Faltam apenas `LOVABLE_EMAIL` e `LOVABLE_SENHA`.

---

## 3. ⚠️ Pergunta 2 (acesso da Valora) não foi respondida

A resposta marcada foi *"Outra: MaisTODOS: Google Workspace / Valora: outlook"* — que repete a
informação já conhecida, sem escolher entre as opções A, B ou C.

Provavelmente a pergunta foi entendida como "qual ferramenta cada um usa". Precisa ser
reformulada de forma mais concreta, porque **é uma das duas coisas que ainda bloqueiam a
publicação**.

---

## 4. "Sumir do painel" — como implementar sem perder auditoria

A resposta foi "sumir do painel". Interpretação técnica:

| Opção | Avaliação |
|---|---|
| Apagar a linha | ❌ Descartada — destrói o histórico e a trilha de auditoria de uma operação que existiu |
| Marcar como arquivada e ocultar da tela | ✅ Adotada |

A operação sai do quadro (que é o que foi pedido), mas o registro permanece no banco com o
motivo e a data. Se alguém perguntar depois "o que aconteceu com aquela operação?", há
resposta. E se o HubSpot reverter a perda, ela volta sem precisar recriar nada.

Vale confirmar com elas que "sumir da tela, mas continuar registrado" atende.

---

## 5. Prazo — a explicação validou o modelo

> *"Prazo total! Pode ser que tenha operação com carência total, que não possui parcelas, por
> isso a diferença"*

Ou seja: **prazo total ≠ número de parcelas** quando há carência total (período sem pagar nada).

Isso confirma que os campos `carencia_total_meses` e `carencia_principal_meses`, que já existem
no modelo do funil, são necessários — e explica por que os dois números divergem no HubSpot.

**Mapeamento:** `prazo_meses` ← "Prazo total" (`cluster_atual_parceiro_local`).
"Número de parcelas" pode ser guardado à parte para conferência.

---

## 6. Taxa — regra de formatação definida

> *"Valor da taxa é a porcentagem de juros. Tipo de taxa é pós-fixada/pré-fixada. Quando for
> pós, tem CDI incluso no cálculo"*

Regra para montar o rótulo do painel:

| Tipo de Taxa | Rótulo gerado |
|---|---|
| Pré-fixada | `2,19% a.m.` |
| Pós-fixada | `2,19% a.m. + CDI` |

Isso conversa com o que o sistema já faz: `reconcile-operacoes` e `AtivoDetalhes.tsx` têm a
função `isPosFixado`, que detecta pós-fixação procurando "cdi" no texto da taxa. Com o campo
"Tipo de Taxa" vindo do HubSpot, a heurística deixa de ser necessária — passa a ser dado.

---

## 7. Documentos — o painel vira o armazenador

> *"como vamos utilizar o próprio painel como armazenador de doc, não utilizaremos mais esse
> campo. Atualmente copio o link da pasta e anexo aí para ter histórico"*

Fica assim:

| Hoje | Depois |
|---|---|
| Pasta no SharePoint, link colado à mão no HubSpot | Documentos anexados direto no painel, na operação |

O SharePoint **não sai de cena**: a Estefany confirmou que vão criar uma pasta "Painel PJ" e a
resposta 5 manteve a sequência painel → SharePoint. Entendimento:

1. **Painel é a fonte** — é onde o documento é anexado e onde a permissão por etapa vale.
2. **SharePoint recebe cópia** — na etapa seguinte, para quem trabalha por lá.

Vale confirmar esse entendimento: se o SharePoint deixar de ser necessário, a pergunta 14
perde o sentido e economiza o registro de aplicativo no Azure AD.

---

## 8. 🔴 Linha de crédito — os valores não batem

Esta é a divergência mais séria do mapeamento.

**O painel conhece três linhas:** QIA · Amor Saúde · Visão de Todos

**O HubSpot, no campo "Tipo de Produto", tem cinco:**

| Valor no HubSpot | Corresponde a quê no painel? |
|---|---|
| Recebíveis como Garantia - QIA | `QIA` — provável |
| Recebíveis como Garantia | ❓ Amor Saúde? Visão de Todos? **Ambíguo** |
| Imóvel em Garantia | ❌ Não existe no painel |
| Antecipação Recebíveis de Venda | ❌ Não existe no painel |
| Financiamento Imobiliário | ❌ Não existe no painel |

Duas consequências práticas:

1. **"Recebíveis como Garantia" sozinho não distingue** Amor Saúde de Visão de Todos. Precisa
   de outro campo — `tipo_de_contrato` é candidato — ou a distinção vem de outro lugar.
2. **Três produtos não existem no painel.** Se operações deles entram no mesmo pipeline, o
   sync não vai saber o que fazer.

Isso importa porque **o checklist documental depende da linha**: QIA usa uma lista de
documentos, Amor Saúde e Visão de Todos usam outra. Linha errada = checklist errado.

O `enum linha_credito` da migration `20260903120000` precisa ser revisto antes do sync.

---

## 9. 🔴 ID da Operação — virou funcionalidade nova

> *"Esse ID é calculado manualmente quando uma operação está sendo enviada para a coluna
> 'desembolsado'. Ela é feita através de uma fórmula (concatenar) no Excel. A ideia é que o
> painel crie esse ID automaticamente e reflita para o HubSpot o ID de acordo com o tipo da
> taxa"*

Não era só exibir um campo: é **automatizar um processo manual feito hoje em planilha**.

Bom negócio — elimina digitação e erro. Mas falta o essencial: **a fórmula**.

O exemplo visto na amostra tem 13 caracteres e começa com `PO`. Sem a fórmula do CONCATENAR,
não dá para reproduzir. E "de acordo com o tipo da taxa" sugere que a composição muda entre
pré e pós-fixada.

**Pendência:** pedir a fórmula do Excel (ou dois ou três exemplos de ID com os dados que os
geraram, para deduzir o padrão).

---

## 10. O erro de desembolso veio do fundo

> *"Ontem a Valora fez um desembolso errado porque confundiram o valor da TAC com o valor da
> operação. Eles pediram para especificarmos o valor da TAC no checklist"*

Contexto importante para a **Story 3.7**: o pedido não é preferência de tela, é **correção de
um erro operacional que já causou prejuízo** — e partiu do próprio fundo.

Reforça a decisão de entregar a comparação automática entre valor previsto e depositado, e não
apenas exibir os números.

---

## 11. Pendências que ficaram

| # | Pendência | Com quem | Bloqueia |
|---|---|---|---|
| A | 🔴 Usuário **administrador** do painel do Lovable, para o resgate | Estefany | Todo o histórico da área |
| B | 🔴 Como a Valora entra: opção A, B ou C | Estefany / Lavínia | Publicação |
| C | 🔴 Linha de crédito: como mapear os 5 produtos do HubSpot nas 3 linhas do painel | Lavínia | Sync e checklist |
| D | 🔴 Fórmula do "ID da Operação" | Lavínia | Geração automática do ID |
| E | 🟡 Confirmar: arquivar em vez de apagar na negociação perdida | Lavínia | Story 4.1 |
| F | 🟡 SharePoint ainda é necessário, agora que o painel guarda os documentos? | Estefany / Lavínia | Escopo do Azure AD |
| G | 🟡 Nome do site e da biblioteca do SharePoint | Estefany | Só se F for sim |


---

# Rodada 2 — respostas de 04/09/2026 (tarde)

## 12. Acesso da Valora — DECIDIDO

> *"Vamos seguir com a sua sugestão"*

**Opção B:** usuário e senha criados por nós, com verificação em duas etapas, migrando para
login Microsoft (opção A) mais adiante.

Efeito: a Story 2.3 deixa de depender do TI da Valora. A política de senha e a redefinição já
foram corrigidas (Story 2.4); falta implementar o segundo fator e o processo de revogação.

## 13. Linhas de crédito — ESCOPO REDUZIDO

> *"O painel hoje só precisa trabalhar com duas linhas, QIA e Amor Saúde, que são o fundo da
> Valora. As outras linhas são de outro fundo, que vamos migrar só mais para frente."*
> *"podemos considerar que sempre vai ser Amor Saúde"*

Mapeamento fechado para a primeira versão:

| Valor no HubSpot | Linha no painel |
|---|---|
| Recebíveis como Garantia - QIA | `QIA` |
| Recebíveis como Garantia | `Amor Saúde` |
| Imóvel em Garantia | *ignorar — outro fundo* |
| Antecipação Recebíveis de Venda | *ignorar — outro fundo* |
| Financiamento Imobiliário | *ignorar — outro fundo* |

**Decisão de implementação:** o sync do HubSpot processa apenas os dois primeiros e **ignora
silenciosamente** os demais — são operações de outro fundo, que não pertencem a este painel.

O `enum linha_credito` mantém `Visão de Todos`, mesmo sem uso no sync: o código atual já a
referencia (page_keys, checklist), e removê-la exigiria mexer em partes que funcionam. Fica
disponível para quando o outro fundo entrar.

## 14. Negociação perdida — CONFIRMADO

> *"Sem problemas"*

Arquivar e ocultar, nunca apagar. O registro permanece com motivo e data.

## 15. SharePoint — FORA DO ESCOPO ATUAL

> *"Se o SharePoint é trabalho, então tudo bem não incluirmos ele agora. Perguntei se é
> possível manter os dois, apenas pelo histórico que já existe no SharePoint."*

Esclarecido: não é integração, é **coexistência**. O SharePoint permanece com o histórico
antigo, intocado; o painel guarda os documentos novos.

**Nenhum trabalho técnico envolvido.** Some a necessidade de registro de aplicativo no
Azure AD, permissões do Microsoft Graph e aprovação do TI — economia relevante de prazo.

## 16. ID da Operação — fórmula recebida e validada

Ver `docs/stories/3.8.id-da-operacao.md` para a análise completa.

Resumo: a fórmula foi decifrada e **validada contra os 5 exemplos reais (5/5)**. O número no
meio do código é o **serial de data do Excel** — `46262` é 28/08/2026.

⚠️ **Apareceu uma inconsistência:** a mesma planilha traz, numa legenda destacada, a
especificação de um formato de **20 caracteres**, diferente do que a fórmula gera (12–13).
Provavelmente é o formato desejado, ainda não implementado. Precisa de decisão antes de
codificar.

---

## Pendências após a rodada 2

| # | Pendência | Com quem | Bloqueia |
|---|---|---|---|
| A | 🔴 **Usuário administrador do painel do Lovable** — ainda sem resposta | Estefany | Todo o histórico da área |
| B | 🟡 Qual formato de ID adotar: o atual ou o de 20 caracteres | Lavínia | Story 3.8 |

Todas as demais foram resolvidas.
