# Decisões e pendências — Painel de Crédito PJ

- **Atualizado em:** 03/09/2026
- **Fonte:** conversas no Slack com Estefany Gomes e Lavínia Resende

---

## 1. Decisões fechadas

| # | Assunto | Decisão | Efeito |
|---|---|---|---|
| 1 | Banco do Lovable | **Abandonado.** O projeto Supabase não foi localizado; o banco será criado do zero | Ver §2 — há perda de dados |
| 2 | E-mail remetente | `credito.pj@maistodos.com.br`, autorizado como remetente automático | Ver §3 |
| 3 | Documentos da operação | **No painel** (armazenamento próprio) **e também no SharePoint** | Ver §4 |
| 4 | Congelamento do Lovable | **01/09/2026 às 16:42** | Ver §5 |
| 5 | Autenticação do fundo (Valora) | Eles usam **Outlook**, não Google Workspace | Ver §6 — muda a arquitetura de acesso |
| 6 | Token do HubSpot | Recebido e em uso. Pipeline identificado: **MaisTODOS - Comercial Crédito PJ** (`134862882`) | Ver `docs/04-mapeamento-hubspot.md` |
| 7 | Fonte da verdade | HubSpot manda nas etapas 1–2; Painel manda nas 4–6 | Confirmado em 03/09 |

---

## 2. Banco do Lovable — o que se perde e o que se recupera

O projeto `cehpsvuytdriikxtukmb` não apareceu na conta da Estefany nem por link direto, nem
por organização, nem pelo Lovable. Ela é a criadora do projeto, o que descarta a hipótese
mais provável (projeto de outra pessoa). Decisão: **criar o banco do zero.**

O que isso custa, item a item:

| Item | Situação | Como recuperar |
|---|---|---|
| Estrutura do banco (25 migrations) | ✅ Preservada — veio no export | Nada a fazer |
| Edge Functions (8) | ✅ Preservadas | Nada a fazer |
| Código do front | ✅ Preservado | Nada a fazer |
| Histórico de parcelas pagas (7.334 registros) | ❌ Perdido no banco | **Reimportável** — a tela `/admin/importar-parcelas` existe e aceita JSON em lote |
| Limites de clientes | ❌ Perdido no banco | **Reimportável** — `/admin/limites` aceita planilha |
| Operações ativas | ❌ Perdido no banco | **Reimportável** — upload de planilha no admin |
| Clientes pré-aprovados | ❌ Perdido no banco | **Reimportável** — mesmo caminho |
| Usuários e senhas | ❌ Perdidos | Serão recriados de qualquer forma na entrada do SSO |
| Funil de formalização | — | Nunca existiu no banco: era mock (ver diagnóstico §2) |

> **Pendência aberta:** as planilhas de origem ainda existem com a área? O sistema tem as
> telas de importação prontas, então a perda é reversível — desde que os arquivos existam.
> **Se não existirem, é perda definitiva de histórico.** Confirmar com a Estefany antes de
> descartar qualquer tentativa de recuperar o projeto do Lovable.

**Ganho colateral:** o banco novo nasce direto com a RLS correta, sem arrastar as policies
permissivas herdadas. A Story 2.1 parte 2 deixa de ser uma migração de risco e vira o estado
inicial.

---

## 3. E-mail — a pergunta da Lavínia sobre SPAM

> *"Caso a gente opte pela opção A, quanto tempo aproximadamente isso deve levar? Pergunto
> porque recentemente tivemos problemas com os e-mails do HubSpot caindo no SPAM."*

**A opção A é justamente o que resolve esse problema.** Quando uma ferramenta externa envia
usando `@maistodos.com.br` sem SPF e DKIM configurados para ela, o servidor de destino vê um
remetente que se diz da MaisTODOS mas não consegue provar — e manda para o spam. É o cenário
clássico do que aconteceu com o HubSpot.

**Prazo:** a configuração é rápida; o gargalo é humano.

| Etapa | Tempo |
|---|---|
| Criar o domínio no serviço de envio | minutos |
| Time de infra adicionar os registros DNS (SPF, DKIM, DMARC) | **depende da fila deles** — é o gargalo real |
| Propagação do DNS | minutos a poucas horas |
| Verificação e primeiro envio | minutos |

Ou seja: **horas de trabalho técnico, dias de espera por terceiros.**

**Recomendação técnica adicional:** enviar por um **subdomínio** (ex.: `notificacoes.maistodos.com.br`)
em vez do domínio raiz. Assim a reputação de envio transacional fica isolada — se algo der
errado, não contamina o e-mail corporativo de todo mundo. O endereço visível para quem recebe
continua sendo `credito.pj@maistodos.com.br` no campo de resposta.

**Implementação:** já está pronta. A função `send-operacao-email` lê `EMAIL_REMETENTE` do
ambiente e opera em modo simulado enquanto a chave não existir — o fluxo inteiro pode ser
testado antes do DNS sair.

---

## 4. Documentos — painel + SharePoint

Confirmado: guardar **no painel** e **também no SharePoint**.

Os dois caminhos têm custos bem diferentes:

| Destino | Complexidade | O que exige |
|---|---|---|
| **Painel** (Supabase Storage) | Baixa | Nada além do banco de pé. Buckets com limite de tamanho e tipo, acesso pela mesma RLS por etapa |
| **SharePoint** | **Alta** | Registro de aplicativo no Azure AD da MaisTODOS, permissões de API (Microsoft Graph), consentimento de administrador, e definição do site e da biblioteca de destino |

**Recomendação de sequenciamento:** entregar o painel primeiro (funciona sozinho e destrava o
uso), e o espelhamento para o SharePoint como etapa seguinte. Amarrar as duas coisas na mesma
entrega faz o SharePoint bloquear o que já funcionaria.

> **Pendências:** qual site e qual biblioteca do SharePoint; quem faz o registro do aplicativo
> no Azure AD; e o que significa **"ROD"** na mensagem da Lavínia — sigla não identificada.

---

## 5. Congelamento do Lovable

Declarado: **01/09/2026 às 16:42.**

Verificação feita no export: a migration mais recente é `20260901170110`, de 01/09 às 17:01 —
**posterior ao congelamento**. Ou seja, o pacote que recebemos foi exportado depois da data de
corte e contém tudo. Nada ficou para trás.

---

## 6. Autenticação do fundo — o Outlook muda o plano

> *"Eles não utilizam Google, usam outlook mesmo."*

Isso derruba a hipótese mais simples (login Google com allowlist do domínio da Valora).
Restam três caminhos:

| # | Opção | Prós | Contras |
|---|---|---|---|
| **A** | **Microsoft (Azure AD) como provedor adicional** | Eles usam a conta corporativa que já têm; nenhuma senha nossa para gerenciar; sai quando saem da empresa deles | Exige registro de aplicativo no Azure AD **da Valora** — depende do TI de outra empresa, e é o item mais lento |
| **B** | **E-mail e senha com MFA obrigatório** | Não depende de ninguém; pode ser entregue já | Somos nós que gerenciamos credenciais de gente de fora; exige processo de revogação quando alguém sai de lá |
| **C** | **Link mágico por e-mail** (sem senha) | Sem senha para vazar; sem dependência do TI deles | Acesso fica atrelado à caixa de entrada; sessão precisa de expiração curta |

**Recomendação: começar pela B e migrar para a A depois.** A opção A é melhor no fim, mas
depende do TI de uma empresa externa — e não faz sentido segurar a publicação por causa disso.
A B já está meio caminho andada: a política de senha e a redefinição foram corrigidas na
Story 2.4; falta ativar o MFA.

Para o time **interno** da MaisTODOS o plano segue o mesmo: Google (Workspace próprio).

Ou seja, o sistema terá **dois provedores de login convivendo** — o que é normal, mas precisa
estar decidido antes de publicar.

---

## 7. Pendências abertas

| # | Pendência | Com quem | Bloqueia |
|---|---|---|---|
| 1 | As planilhas de origem existem para reimportar os dados? | Estefany | Recuperação do histórico |
| 2 | Como o fundo autentica — opção A, B ou C do §6 | Estefany / Lavínia | Publicação |
| 3 | O que significa **"ROD"** | Lavínia | Entender o pedido do §4 |
| 4 | Site e biblioteca do SharePoint | Estefany / Lavínia | Espelhamento de documentos |
| 5 | Quem registra o aplicativo no Azure AD da MaisTODOS | TI / Victor | SharePoint |
| 6 | Registros DNS (SPF, DKIM, DMARC) do subdomínio de envio | TI / Victor | E-mail real |
| 7 | Confirmar o mapeamento de campos do HubSpot — ver `docs/04-mapeamento-hubspot.md` §6 | Estefany / Lavínia | Sync do HubSpot |
| 8 | Como o `envelopeId` da Flixsign chega ao painel | Estefany / fundo | Integração de assinatura |
| 9 | VPS separada, bucket S3 e DNS do subdomínio | Victor | Publicação |
