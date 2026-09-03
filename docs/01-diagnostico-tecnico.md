# Painel de Crédito PJ — MaisTODOS
## Diagnóstico técnico do protótipo Lovable e plano de migração

- **Data:** 03/09/2026
- **Base:** transcrição da reunião de 28/08/2026, `Escopo_Painel_Credito_PJ_MaisTODOS_v2.docx`, `mais-todos-finance.zip`, `Manual API V1.0.2 - Flixsign.pdf`
- **Responsável técnico:** Matheus Torquato
- **Solicitantes (POs):** Estefany Gomes e Lavínia Resende

---

## 1. O que o protótipo é de fato

| Camada | Tecnologia |
|---|---|
| Front-end | React 18 + Vite 5 + TypeScript + Tailwind + shadcn/ui (Radix) |
| Estado/dados | TanStack Query |
| Backend | **Supabase** (Postgres + Auth + RLS + Storage + Edge Functions em Deno) |
| Projeto Supabase atual | `cehpsvuytdriikxtukmb` — conta do Lovable, **não** da MaisTODOS |
| Automação | n8n cloud (`maistodossa.app.n8n.cloud`) — webhook `simulacao-pj` |
| E-mail | Resend via gateway do Lovable (`connector-gateway.lovable.dev`) |

**Consequência central:** o "backend" do painel não é um servidor próprio — é o Supabase.
Toda a autenticação, permissão (RLS), regra de negócio e as 8 Edge Functions estão lá.
Qualquer decisão sobre "banco na AWS" é, na prática, uma decisão sobre **o que fazer com o Supabase**.

### 1.1 Estrutura funcional já construída

Rotas existentes (`src/App.tsx`):

| Rota | Tela | Estado |
|---|---|---|
| `/auth` | Login (e-mail + senha) | Funcional, inseguro (ver §3) |
| `/` | Home / indicadores + calculadora de crédito | Funcional |
| `/ativos` | Operações ativas, parcelas, amortização, CDI | Funcional, dados reais |
| `/central-documentos` | Checklist documental (AS/CDT), export PDF/DOCX | Funcional |
| `/operacoes-valora` | **Funil de formalização** — a prioridade nº 1 | **100% mockado** |
| `/admin/limites` | Admin: limites, usuários, permissões, upload | Funcional |

### 1.2 Banco de dados existente (18 tabelas)

`cdi_cache`, `cdi_daily`, `clientes_limites`, `clientes_pre_aprovados`, `holidays`,
`import_history`, `indicadores_manuais_mensais`, `operacoes_ativas`, `operacoes_checklists`,
`operacoes_divergencias`, `operacoes_import_history`, `operacoes_overrides`,
`operacoes_parcelas_manuais`, `operacoes_projecoes`, `operacoes_snapshots`,
`staging_parcelas`, `user_page_access`, `user_roles`.

Enum de papéis: `app_role` = `admin` | `user`. 72 políticas RLS. 25 migrations.

### 1.3 Edge Functions (Deno)

`admin-create-user`, `admin-manage-users`, `bulk-import-parcelas`, `fetch-cdi`,
`forward-to-n8n`, `reconcile-operacoes`, `send-operacao-email`, `sync-cdi-daily`.

---

## 2. ACHADO CRÍTICO: o funil de formalização não existe no banco

A tela `/operacoes-valora` — que é **a dor nº 1 do cliente e a razão do projeto** — roda
inteiramente sobre um array em memória em `src/services/operacoes.ts`. O próprio arquivo declara:

> "Camada de serviço das Operações Ativas. Nesta fase TODOS os dados são mockados em memória (array estático)."

Não há tabela de formalização, nem histórico, nem checklist persistido, nem signatários.
Ao recarregar a página, tudo volta ao estado inicial. As funções `salvarOperacao`,
`criarPastaDocumentos`, `sincronizarAssinaturas`, `anexarComprovante` e `baixarAnexo`
são todas marcadas `// TODO: integração real aqui`.

**Impacto:** a Fase 3 do escopo (integrações núcleo) não é "plugar API em tela pronta".
Antes dela é preciso **construir a persistência do funil do zero** — modelo de dados,
RLS por perfil, histórico/auditoria, anexos e a máquina de estados das 6 etapas.
Essa é a maior diferença entre o que o documento de escopo assume e o que o código entrega.

O que **já está pronto e é aproveitável**: todo o layout, o card, o modal de 774 linhas com
as ações por etapa, a máquina de etapas em TypeScript (`ETAPAS`, `moverEtapa`, SLA/aging),
os templates de e-mail em HTML e a lógica de checklist por linha de crédito. É um
excelente ponto de partida de UI — mas é uma casca sem banco.

### 2.1 As 6 etapas já modeladas no código

| # | Etapa | Título | SLA mock |
|---|---|---|---|
| 1 | `recolhimento` | Recolhimento de documentos | 3 dias |
| 2 | `analise` | Análise fornecedor | 3 dias |
| 3 | `aguardando_contrato` | Aguardando contrato | 3 dias |
| 4 | `contrato_emitido` | Contrato emitido | 3 dias |
| 5 | `contrato_assinado` | Contrato assinado — pronto para desembolso | 3 dias |
| 6 | `desembolsado` | Desembolsado | 3 dias |

A etapa "Contrato desembolsado" pedida no escopo v2 **já está no código**. Ponto positivo.

---

## 3. Achados de segurança (bloqueiam a publicação na internet)

| # | Achado | Gravidade | Detalhe |
|---|---|---|---|
| S1 | **RLS permissiva demais** | **Alta** | 12 políticas usam `TO authenticated USING (true)`: `clientes_limites`, `operacoes_ativas`, `operacoes_snapshots`, `operacoes_projecoes`, `operacoes_divergencias`, `operacoes_overrides`, `operacoes_parcelas_manuais`, `clientes_pre_aprovados`. Ou seja, **qualquer usuário logado lê tudo** — inclusive o time externo da Valora. O controle por `user_page_access` existe apenas no front-end (`usePageAccess`), portanto é cosmético: basta chamar a API do Supabase direto com o token para ler a base inteira. |
| S2 | **Redefinição de senha sem validação real** | **Alta** | Já relatado pela Lavínia na reunião. Confirmado: fluxo herdado do protótipo, sem hardening. |
| S3 | **Sem login Google / SSO** | Alta | Hoje é e-mail + senha, sem MFA. Escopo exige Google (MaisTODOS) + política definida para externos. |
| S4 | **Chave e URL do Supabase versionadas** | Média | `.env` veio dentro do zip. É a chave `anon` (pública por design), mas o projeto `cehpsvuytdriikxtukmb` está na conta Lovable e precisa ser abandonado/rotacionado na migração. |
| S5 | **Webhook n8n hardcoded e sem autenticação** | Média | `forward-to-n8n` repassa qualquer payload para `maistodossa.app.n8n.cloud/webhook/simulacao-pj` sem validar JWT nem assinar a requisição. Function pública = webhook aberto. |
| S6 | **E-mail dependente do gateway Lovable** | Média | `send-operacao-email` chama `connector-gateway.lovable.dev/resend` com `LOVABLE_API_KEY`. Fora do Lovable, deixa de funcionar. |
| S7 | **Sem trilha de auditoria** | Média | Não há log de quem moveu qual operação de etapa. Em esteira de crédito com fundo externo, é requisito. |

---

## 4. Análise da API Flixsign (v1.0.2)

Base: `https://api.flix-sign.com`

| # | Endpoint | Uso no painel |
|---|---|---|
| 1 | `POST /customer/service/v1/api/Auth/Login` (header `ClientId: Flixsign`) | Gera Bearer token a partir de **e-mail + senha**. Retorna `token` e `customerId`. |
| 2 | `POST /document/service/v1/api/Document/CreateDocument/{empresaId}/{envelopeId}` | Cria envelope e sobe o PDF do contrato. |
| 3 | `GET /Signatory/ListAllSignatoryType` | Tipos de signatário. |
| 4 | Adicionar signatário / ordenar / tipo de assinatura / mínimo de assinaturas | Monta a ordem de assinatura. |
| 5 | Enviar para assinaturas | Dispara o envelope. |
| 6 | `GET /Document/GetEnvelope/{id}` | **Status do envelope + signatários** → alimenta as etapas 4→5. |
| 7 | `GET /Document/GetEnvelopeDocuments/{id}` | Lista documentos, com `documentIdSigned` e hashes assinados. |
| 8 | `GET /Document/Download/{fileHash}/{fileHashEncrypted}` | Baixa o arquivo. |
| 9 | `GET /Document/DownloadEnvelopeContent/{envelopeId}/{clientId}` | ZIP final — só quando **todas** as assinaturas concluíram. |

### Pontos de atenção da Flixsign

1. **NÃO HÁ WEBHOOK documentado.** O manual v1.0.2 não descreve callback de status.
   → A passagem de "contrato emitido" para "contrato assinado" terá de ser por **polling**
   (`GetEnvelope`), a cada 15–30 min. Com ~5 operações/semana, é perfeitamente viável.
2. **Autenticação por usuário e senha**, não por API key de serviço. Precisamos de uma
   **conta de serviço na Flixsign** (a conta é do fundo/Valora, não da MaisTODOS) — e as
   credenciais ficam no nosso cofre de segredos.
3. O manual **não documenta os valores do campo `status`** (aparece sempre `0` nos exemplos).
   Será preciso mapear os códigos empiricamente ou pedir a tabela ao suporte da Flixsign.
4. O fundo ainda usa **DocuSign** e está migrando para a Flixsign. Enquanto durar a transição,
   a integração deve ficar atrás de uma interface (`AssinaturaProvider`) com duas
   implementações, para não reescrever nada quando a virada acontecer.

---

## 5. Integrações — situação de cada uma

### 5.1 HubSpot (obrigatório no MVP)
- Acesso já localizado: Configurações → Integrações → **Aplicativos privados** (Estefany é admin).
- Necessário: criar o **private app** e obter o token, com escopos `crm.objects.deals.read` (+ `.write` para o caminho de volta).
- Direção mínima: **HubSpot → Painel** (polling a cada 1–2 h; o volume comporta).
- Caminho de volta (**Painel → HubSpot**): tecnicamente viável — a API de CRM do HubSpot é read/write.
  O risco real não é a API, é o **loop de sincronização**. Mitigação: marcador de origem da última
  alteração + janela de silêncio por deal, e definir **fonte da verdade por etapa**.
- Recomendação: HubSpot manda nas etapas 1–2 (comercial/entrada); o Painel manda nas etapas 4–6
  (formalização, assinatura, desembolso).

### 5.2 Notion (OKRs)
- Bloqueio conhecido: criação da integração exige permissão N2. É configuração de ~10 minutos.
- Integração é **por página**: precisamos do token da integração + o ID da página compartilhada com ela.
- Baixa complexidade técnica, alta dependência de gente. Não bloqueia nada crítico.

### 5.3 E-mail para o fundo
- Remetente desejado: grupo **Crédito PJ**, via Gmail/Workspace.
- Hoje: Resend pelo gateway do Lovable → **não sobrevive à migração**.
- Duas rotas: (a) Resend próprio com domínio `maistodos.com.br` verificado (SPF/DKIM), ou
  (b) envio via Google Workspace (SMTP/API Gmail com conta de serviço).
  A rota (a) é mais robusta para transacional; a (b) atende melhor o pedido de "sair do e-mail do grupo".
- O template HTML já existe e está bom (`src/services/notificacoes.ts`).

### 5.4 Pasta de documentos
- `criarPastaDocumentos` é mock. O código sugere Google Drive ou SharePoint ("não usar file server local — sem API").
- Decisão pendente: onde os documentos da operação realmente ficam.

---

## 6. Plano de execução proposto

### Fase 0 — Fundação (não depende de terceiros — pode começar hoje)
1. Extrair o Lovable para este repositório, limpando os artefatos do Lovable
   (`lovable-tagger`, `@lovable.dev/*`, `previewAuthStorage.ts`).
2. Subir a aplicação rodando localmente contra um Supabase próprio.
3. Congelar o Lovable (o sync é só de ida — qualquer edição lá depois vira retrabalho).
4. Deixar a configuração de deploy pronta no Dokploy.

### Fase 1 — Banco e infraestrutura
5. Definir a estratégia de banco (ver §7, decisão nº 1).
6. Migrar schema (25 migrations) **e os dados existentes** — há dados reais em produção
   (7.334 parcelas importadas, usuários, limites, pré-aprovados).
7. Publicar em domínio provisório da MaisTODOS enquanto `credito.maistodos.com.br` não sai.

### Fase 2 — Segurança
8. Reescrever as 12 políticas RLS permissivas para respeitar `user_page_access` **no banco**.
9. Login Google (Workspace MaisTODOS) + política de acesso do time externo (Valora).
10. Corrigir o fluxo de redefinição de senha.
11. Autenticar a function do n8n; tirar o gateway do Lovable do caminho do e-mail.
12. Tabela de auditoria de movimentações.

### Fase 3 — Funil de formalização de verdade (o coração do projeto)
13. Modelar e criar as tabelas do funil (operações, etapas, histórico, checklist, signatários, anexos).
14. Trocar o mock de `src/services/operacoes.ts` por acesso real ao banco.
15. E-mail automático por mudança de etapa (funcional, não simulado).
16. Sync HubSpot → Painel.

### Fase 4 — Integrações externas
17. Flixsign: criar envelope, adicionar signatários, enviar e **polling** de status.
18. Sync Painel → HubSpot nas etapas `contrato_assinado` e `desembolsado`.
19. OKRs do Notion na home.

### Fase 5 — Esteira de evolução
20. Export de HTML do painel + processo de solicitação com as POs, como já roda no painel do Pedro.

---

## 7. Decisões que precisam do cliente / do Matheus

| # | Decisão | Por que trava |
|---|---|---|
| 1 | **Estratégia de banco** — Supabase Cloud em conta MaisTODOS, Supabase self-hosted no Dokploy sobre o Postgres da AWS, ou reescrever o backend sobre Postgres puro | Define o esforço da Fase 1: de 1 dia (Cloud) a semanas (reescrita) |
| 2 | **Como o time da Valora autentica** | É usuário externo em sistema exposto na internet — risco alto |
| 3 | **Prazo**: 1º de setembro já passou (hoje é 03/09) | Precisa repactuação ou entrega faseada |
| 4 | Fonte da verdade por etapa (HubSpot × Painel) | Define se o sync é bidirecional e onde |
| 5 | Onde ficam os documentos da operação (Drive/SharePoint/bucket) | Bloqueia `criarPastaDocumentos` e os anexos do checklist |
| 6 | Conta de serviço da Flixsign (é do fundo) | Bloqueia toda a Fase 4 |
| 7 | Remetente de e-mail: Resend com domínio próprio × Gmail do grupo Crédito PJ | Bloqueia a notificação automática |

---

## 8. Riscos técnicos mapeados

| Risco | Impacto | Mitigação |
|---|---|---|
| Funil mockado — o escopo assume que está pronto | **Alto** — é a entrega prioritária | Tratar a Fase 3 como construção, não integração; repactuar prazo |
| Loop de sincronização HubSpot ↔ Painel | Alto — dados corrompidos nos dois lados | Fonte da verdade por etapa + marcador de origem + janela de silêncio |
| Flixsign sem webhook | Médio — status atrasa até o próximo polling | Polling de 15–30 min; aceitável para ~5 ops/semana |
| Migração de dados do Supabase do Lovable | Médio — há dados reais em produção | Dump completo antes de qualquer corte; janela de migração combinada |
| Time continuar editando no Lovable | Médio — retrabalho puro | Congelar o Lovable formalmente com as POs |
| Subdomínio atrasar | Baixo (já tem plano B) | Publicar em domínio provisório |

---

## 9. Status da execução

### Decisões tomadas em 03/09/2026

| # | Decisão | Escolha |
|---|---|---|
| 1 | Estratégia de banco | **Supabase self-hosted no Dokploy**, com o Postgres da AWS (RDS) como banco. Preserva Auth, RLS e as Edge Functions; o dado fica na infra da MaisTODOS. |
| 2 | Autenticação da Valora | Em aberto — arquitetura de auth ficará preparada para Google (allowlist de domínio) e para conta local com MFA. |
| 3 | Primeiro passo | Fase 0 — extrair do Lovable e deixar a aplicação rodando. |

### Fase 0 — CONCLUÍDA

- Código do Lovable extraído para a raiz deste repositório (186 arquivos).
- Artefatos do Lovable removidos: `lovable-tagger`, `@lovable.dev/vite-plugin-dev-server-bridge`,
  `@lovable.dev/vite-plugin-hmr-gate` e `src/integrations/supabase/previewAuthStorage.ts`
  (que trocava a sessão de auth por `postMessage` com o editor do Lovable).
- `vite.config.ts`, `index.html` e o client do Supabase limpos das referências ao Lovable.
- `.env` protegido pelo `.gitignore`; criado `.env.example`.
- `package.json` renomeado para `painel-credito-pj-maistodos` v1.0.0.
- Documentos de origem movidos para `docs/referencias/`.
- README próprio.

**Verificações:** `npm install` (438 pacotes), `npm run build` OK (15 s),
`tsc --noEmit` sem erros, dev server respondendo em `http://localhost:8080`.

### Dívida técnica registrada na extração

| Item | Detalhe |
|---|---|
| Lint | 56 erros e 14 avisos herdados (majoritariamente `@typescript-eslint/no-explicit-any`). Não bloqueiam build nem typecheck. |
| Bundle | Chunk principal de 1,81 MB (548 kB gzip). Precisa de `manualChunks` antes de ir a produção. |
| Vulnerabilidades de runtime | `react-router-dom` (XSS via open redirect) e `xlsx` (prototype pollution / ReDoS). Ambas exigem atualização — `xlsx` não tem correção no registro público do npm, precisa migrar para a distribuição oficial da SheetJS. |
| Vulnerabilidades de build | `vite`, `rollup`, `postcss`, `esbuild` e cadeia do eslint — só afetam o ambiente de desenvolvimento. |
| `supabase/config.toml` | Ainda aponta para `project_id = "cehpsvuytdriikxtukmb"` (projeto do Lovable). Trocar quando o Supabase próprio subir. |
| `.env` local | Ainda aponta para o Supabase do Lovable — é o que permite rodar local hoje. Trocar na Fase 1. |
