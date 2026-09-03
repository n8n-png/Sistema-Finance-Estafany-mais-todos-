# Painel de Crédito PJ — Backlog e Sprints

- **Versão:** 1.0 · 03/09/2026
- **Base:** `docs/01-diagnostico-tecnico.md`
- **POs:** Estefany Gomes e Lavínia Resende · **Dev:** Matheus Torquato

---

## Princípio de sequenciamento

O backlog está ordenado por **independência de terceiros**, não por valor percebido.
Tudo que não depende de token, acesso ou decisão de outra pessoa vem primeiro — assim o
projeto avança enquanto os pedidos das mensagens
(`docs/comunicacao/`) circulam.

Legenda de bloqueio:
🟢 pronto para executar · 🟡 depende de decisão interna · 🔴 depende de terceiro

---

## Épicos

| Épico | Título | Stories | Status |
|---|---|---|---|
| **E1** | Fundação e migração de infraestrutura | 5 | 2/5 |
| **E2** | Segurança e controle de acesso | 6 | 4/6 (+1 parcial) |
| **E3** | Funil de formalização persistido | 6 | 3/6 |
| **E4** | Integrações externas | 4 | 0/4 |
| **E5** | Esteira de evolução contínua | 1 | 0/1 |

---

## Sprint 1 — Coração do produto (🟢 sem bloqueio)

O funil de formalização é a razão do projeto e hoje é uma casca sem banco. Esta sprint o
transforma em software de verdade. Nada aqui depende de terceiros: o modelo de dados sai do
código que já existe e do escopo v2, ambos fechados.

| Story | Título | Bloqueio | Status |
|---|---|---|---|
| **3.1** | Modelo de dados do funil de formalização | 🟢 | ✅ Concluída |
| **3.2** | Matriz de permissões por etapa e RLS do funil | 🟢 | ✅ Concluída |
| **3.3** | Substituir o mock por acesso real ao banco | 🟢 | ✅ Concluída |
| **2.2** | Trilha de auditoria de movimentações | 🟢 | ✅ Concluída (junto da 3.1) |
| **2.1** | Corrigir a RLS que não distingue perfil | 🟢 / 🟡 | ◑ Parte 1 concluída |
| **3.4** | Anexos do checklist no Storage | 🟡 depende do item 4 da Estefany (Drive × bucket) | Pendente |

**Objetivo da sprint:** ao final, o funil persiste. Uma operação criada sobrevive ao F5,
o histórico registra quem moveu o quê e quando, e o fundo só enxerga a etapa que lhe cabe —
no banco, não só na tela.

### Resultado (03/09/2026)

Objetivo atingido, com uma ressalva de validação. Entregues:

| Artefato | Conteúdo |
|---|---|
| `20260903120000_funil_formalizacao.sql` | 6 enums, 6 tabelas, 4 triggers, SLA configurável (55 statements) |
| `20260903120100_funil_formalizacao_rls.sql` | matriz por etapa, 4 funções de decisão, 20 policies (42 statements) |
| `20260903120200_rls_pre_aprovados.sql` | fecha a carteira de pré-aprovados (6 statements) |
| `src/integrations/supabase/funil.ts` | tipos das tabelas novas e client tipado |
| `src/services/operacoes.types.ts` | tipos de domínio extraídos |
| `src/services/operacoesRepo.ts` | conversão banco ↔ domínio e IO |
| `src/services/operacoes.ts` | reescrito sem o mock, mesma interface pública |

**Verificações executadas:** sintaxe das 28 migrations validada com `pglast` (parser real do
PostgreSQL); `tsc --noEmit` sem erros; `npm run build` OK; ESLint limpo nos arquivos novos.

**Ressalva honesta:** não há Docker nem PostgreSQL nesta máquina, então as migrations **não
foram executadas** — apenas tiveram a sintaxe validada. Semântica (referências, tipos de coluna,
comportamento dos triggers e das policies) só se comprova rodando. Isso entra como primeira
tarefa da Sprint 2, assim que houver banco.

---

## Sprint 2 — Infraestrutura (🔴 depende do Victor e da Estefany)

| Story | Título | Bloqueio | Status |
|---|---|---|---|
| **1.2** | Empacotamento e deploy no Dokploy | 🟡 Victor: VPS separada? | ✅ App pronto; Supabase documentado |
| **1.3** | Migração de schema e dados do Supabase do Lovable | 🔴 Estefany: acesso ao projeto | Pendente |
| **1.4** | Publicação + domínio provisório | 🔴 Victor: DNS | Pendente |
| **1.5** | Backup diário para S3 | 🔴 Victor: bucket + IAM | Pendente |

---

## Sprint 3 — Segurança de acesso (🟡 depende de decisão)

| Story | Título | Bloqueio | Status |
|---|---|---|---|
| **2.4** | Corrigir o fluxo de redefinição de senha | 🟢 | ✅ Concluída (antecipada) |
| **2.5** | Autenticar as edge functions e remover o gateway Lovable | 🟢 | ✅ Concluída (antecipada) |
| **2.6** | Dependências vulneráveis | 🟢 | ✅ Concluída (antecipada) |
| **2.3** | Login Google (Workspace MaisTODOS) | 🟡 política de acesso da Valora | Pendente |

---

## Sprint 4 — HubSpot (🔴 depende do token)

| Story | Título | Bloqueio |
|---|---|---|
| **4.1** | Sync HubSpot → Painel (entrada de operações) | 🔴 token do app privado |
| **4.2** | Sync Painel → HubSpot (etapas 5 e 6) | 🔴 token com escopo de escrita |
| **3.6** | Notificação por e-mail real a cada mudança de etapa | 🔴 decisão do remetente |

---

## Sprint 5 — Integrações finais

| Story | Título | Bloqueio |
|---|---|---|
| **4.3** | Flixsign — polling de status de assinatura | 🔴 credencial + origem do `envelopeId` |
| **4.4** | OKRs do Notion na tela central | 🔴 permissão N2 |
| **5.1** | Esteira de evolução (export HTML + processo) | 🟢 |

---

## Detalhamento das stories

### E1 — Fundação e migração

**1.1 — Extração do Lovable** ✅ **CONCLUÍDA em 03/09/2026**
Código migrado para o repositório, artefatos do Lovable removidos, build e typecheck limpos.

**1.2 — Stack Supabase self-hosted para o Dokploy**
`docker-compose` com Kong, GoTrue, PostgREST, Storage, Realtime, Deno e Postgres em container.
Analytics (Logflare/vector) desabilitado se a stack ficar no host compartilhado.
Segredos via variáveis de ambiente do Dokploy, nunca versionados.

**1.3 — Migração de schema e dados**
Aplicar as 25 migrations existentes + as novas no banco de destino; `pg_dump`/restore dos dados
reais (7.334 parcelas, usuários, limites, pré-aprovados); conferência de contagem por tabela
antes do corte.

**1.4 — Deploy no Dokploy + domínio provisório**
Build de produção, TLS, subdomínio provisório enquanto `credito.maistodos.com.br` não sai.

**1.5 — Backup diário para S3**
Destino S3 no Dokploy, retenção definida, teste de restauração — hoje nada naquele host tem backup.

---

### E2 — Segurança e controle de acesso

**2.1 — Corrigir a RLS que não distingue perfil** ◑ parte 1 concluída
O diagnóstico inicial foi corrigido: a migration de 30/07 já havia endurecido a maior parte das
policies (ver seção 11 do diagnóstico). Sobraram dois problemas reais — `clientes_pre_aprovados`
aberta a qualquer autenticado (**corrigido**) e sete tabelas em `is_staff()`, que não distingue
perfil nem consulta `user_page_access` (**proposta pronta**, aguarda validação contra a base real
em `docs/seguranca/rls-endurecimento-proposto.sql`).

**2.2 — Trilha de auditoria** 🟢
Registro imutável de quem moveu qual operação, de qual etapa para qual, quando e por qual origem
(painel, HubSpot, Flixsign, sistema). Entregue junto da 3.1.

**2.3 — Login Google** 🟡
Provider Google no GoTrue, allowlist de domínio, vínculo com os papéis existentes.
A política do time externo (Valora) precisa estar definida antes de publicar.

**2.4 — Corrigir a redefinição de senha** 🟢
Problema relatado pela Lavínia: o link abre a página direto, sem validação real.

**2.5 — Autenticar a edge function do n8n** 🟢
`forward-to-n8n` hoje é um webhook aberto: repassa qualquer payload sem validar JWT.
Também remove o gateway do Lovable do caminho do e-mail.

**2.6 — Dependências vulneráveis** 🟢
`react-router-dom` (XSS via open redirect) e `xlsx` (prototype pollution / ReDoS) são de runtime.
O `xlsx` não tem correção no registro público do npm — migrar para a distribuição oficial da SheetJS.

---

### E3 — Funil de formalização persistido

**3.1 — Modelo de dados do funil** 🟢
Tabelas: operação, checklist, signatários, pessoas (representantes/avalistas), histórico e
configuração de SLA por etapa. Enums para etapa, linha de crédito, alerta, status de assinatura
e origem da alteração. Campos de integração (`hubspot_deal_id`, `flixsign_envelope_id`) já nascem
no modelo para não exigir migration depois.

**3.2 — Matriz de permissões por etapa e RLS do funil** 🟢
Implementa a matriz que a Lavínia esboçou no protótipo: quem vê e quem edita, **por etapa**.
É o que permite dar acesso ao fundo sem expor o resto da esteira.

**3.3 — Substituir o mock por acesso real** 🟢
Trocar o array em memória de `src/services/operacoes.ts` por queries reais, mantendo a mesma
interface pública — a UI (card, modal, SLA) não muda.

**3.4 — Anexos do checklist** 🟡
Upload, download e vínculo dos documentos por item de checklist.

**3.5 — SLA configurável** 🟢
Hoje o SLA é fixo em 3 dias no código. Passa a vir da tabela de configuração, editável no admin.

**3.6 — Notificação por e-mail real** 🔴
O template HTML já existe e está bom. Falta o envio de verdade e o disparo automático por
mudança de etapa (hoje é manual e simulado).

---

### E4 — Integrações externas

**4.1 — Sync HubSpot → Painel** 🔴
Polling a cada 1–2 h. Deal do pipeline operacional vira operação no painel.
Idempotência por `hubspot_deal_id`.

**4.2 — Sync Painel → HubSpot** 🔴
Apenas nas etapas `contrato_assinado` e `desembolsado`, conforme a fonte da verdade aprovada.
Proteção contra loop: marcador de origem + janela de silêncio por deal.

**4.3 — Flixsign — polling de status** 🔴
Escopo reduzido: o fundo emite o contrato, o painel só lê. `GetEnvelope` +
`GetEnvelopeDocuments` a cada 15–30 min. Atrás de uma interface `AssinaturaProvider`, porque o
fundo ainda usa DocuSign e está migrando.

**4.4 — OKRs do Notion** 🔴
Espelho da página de OKRs na tela central.

---

### E5 — Esteira de evolução

**5.1 — Export de HTML + processo de solicitação**
Formaliza o ciclo que já roda no painel do Pedro: export do estado atual → o time desenha a
mudança → devolve HTML + documentação → implementação e versionamento.

---

## Fonte da verdade — HubSpot × Painel (aprovado em 03/09/2026)

| Etapa | Fonte da verdade | Direção do sync |
|---|---|---|
| 1. Recolhimento de documentação | **HubSpot** | HubSpot → Painel |
| 2. Análise fornecedor | **HubSpot** | HubSpot → Painel |
| 3. Aguardando contrato | Painel | — |
| 4. Contrato emitido | **Painel** | — |
| 5. Contrato assinado | **Painel** | Painel → HubSpot |
| 6. Desembolsado | **Painel** | Painel → HubSpot |
