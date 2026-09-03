# Segurança — Painel de Crédito PJ MaisTODOS

> Política de segurança do projeto. Atualizada a cada sprint.
> Segue o padrão consolidado no Hub MaisTODOS
> (`docs/referencias/SECURITY-hub-maistodos.md`), aceito pela TI.

## Última auditoria
**2026-09-03** — Migração do protótipo Lovable + Sprint 1

## Contexto que diferencia este projeto do Hub

| Fator | Hub MaisTODOS | Painel de Crédito PJ |
|---|---|---|
| Usuários | 12 colaboradores internos | Internos **+ time externo do fundo (Valora)** |
| Dado | RH, comunicação interna | **Crédito PJ**: limites, parcelas, contratos, CNPJ, CPF de avalistas |
| Auth hardening | Postergado até o SSO | **Não pode ser postergado** — há usuário externo |

O Hub decidiu adiar o endurecimento de autenticação porque só há colaboradores internos
testando. **Aqui essa decisão não se aplica:** o time da Valora é externo, acessa pela
internet e enxerga dado financeiro de cliente. Por isso a política de senha e a redefinição
foram corrigidas já na primeira sprint (ver §2).

---

## Camadas de Segurança Aplicadas

### 1. RLS (Row Level Security)

**Matriz de permissão por etapa do funil** — `user_etapas_acesso`
(migration `20260903120100_funil_formalizacao_rls.sql`).

Regra de interpretação:
- **admin** → vê e edita tudo
- **sem linha na tabela** → usuário interno irrestrito (exige a page_key `operacoes_valora`)
- **com pelo menos uma linha** → restrito ao que estiver marcado

> ⚠️ **Obrigatório:** configurar as linhas de `user_etapas_acesso` **antes** de conceder
> acesso a qualquer usuário externo. Sem elas, o usuário é tratado como interno irrestrito.

Configuração prevista para a Valora:

| Etapa | `pode_ver` | `pode_editar` |
|---|---|---|
| Análise fornecedor | sim | sim |
| Aguardando contrato | sim | não |
| Demais etapas | não | não |

**UPDATE com duas condições:** `USING` exige poder **editar** a etapa atual; `WITH CHECK`
exige poder **ver** a etapa de destino. É o que permite ao fundo aprovar e empurrar para a
etapa seguinte sem poder despachar a operação para uma etapa que não enxerga.

**Histórico append-only:** `operacoes_formalizacao_historico` não tem policy de UPDATE nem
DELETE. Nem admin reescreve auditoria.

**Dados pessoais** (representantes e avalistas) exigem permissão de **edição**, não só de
leitura — quem apenas acompanha a operação não vê CPF.

### 2. Autenticação

- Política de senha: **mínimo 10 caracteres**, com maiúscula, minúscula e número
  (`src/utils/passwordPolicy.ts`). Era 6 sem exigência de composição.
- Redefinição de senha corrigida: o link de recuperação **não funciona mais como login
  automático**. A navegação fica bloqueada até a nova senha ser definida, e a sessão aberta
  pelo link é encerrada — o acesso passa a depender de saber a senha, não de ter recebido
  o e-mail.
- "Esqueci minha senha" responde de forma idêntica existindo ou não a conta (não enumera
  usuários).
- **Pendente:** Google OAuth com allowlist de domínio (Story 2.3), e definição de como o
  time da Valora autentica.

### 3. SECURITY DEFINER / INVOKER

Todas as funções novas com `search_path = public, pg_catalog` fixo, conforme o padrão do Hub.

| Função | Modo | Por quê |
|---|---|---|
| `pode_ver_etapa`, `pode_editar_etapa` | **INVOKER** | As tabelas consultadas já têm policy para o próprio usuário. DEFINER abriria bypass de RLS sem necessidade |
| `pode_ver_operacao`, `pode_editar_operacao` | **INVOKER** | idem |
| `has_any_page_access` | **INVOKER** | idem |
| `operacao_formalizacao_audita` | **DEFINER** | Precisa ler `auth.users` para resolver o nome do autor |

### 4. Edge Functions

`verify_jwt = true` declarado explicitamente para as 8 functions em `supabase/config.toml` —
mesmo padrão adotado no Hub após a auditoria externa. O default já é `true`; declarar evita
que uma function nova nasça aberta por omissão.

Helper compartilhado `supabase/functions/_shared/auth.ts` (`exigirUsuario`, `exigirAdmin`)
para que a verificação não seja reescrita — nem esquecida — a cada function.

| Function | Proteção |
|---|---|
| `admin-create-user` | JWT + `has_role(admin)` |
| `admin-manage-users` | JWT + `has_role(admin)` |
| `bulk-import-parcelas` | JWT + `has_role(admin)` |
| `reconcile-operacoes` | JWT + `has_role(admin)` |
| `send-operacao-email` | JWT + RLS na leitura da operação |
| `forward-to-n8n` | JWT + segredo opcional no webhook |
| `fetch-cdi` | JWT |
| `sync-cdi-daily` | JWT |

As duas de CDI foram fechadas na Story 2.8. Não há dado sensível envolvido — a taxa é
pública —, mas sem autenticação eram consumo de recurso em nome da MaisTODOS por quem não
deveria: a `sync-cdi-daily` varre janelas anuais desde 2020 com retry, e mantida em loop
martelaria a API do BCB a ponto de arriscar bloqueio.

### 5. E-mail transacional — vetor eliminado por construção

**Era o achado mais grave da migração.** A `send-operacao-email` não exigia autenticação e
aceitava `to`, `subject` e `html` livres no corpo: qualquer pessoa com a URL disparava
mensagem arbitrária, para qualquer destinatário, saindo de um remetente da MaisTODOS.

Corrigido em duas camadas:

1. Exige JWT de usuário.
2. **O corpo do e-mail é montado no servidor**, a partir de dados lidos do banco. O cliente
   informa apenas qual operação e qual evento — não escolhe destinatário nem conteúdo. Os
   destinatários vêm do campo `destinatarios` da própria operação, lido com o client do
   usuário (passando pela RLS). Todo dado interpolado no HTML é escapado.

É a mesma intenção da sanitização server-side do Hub (S0.5.5), mas aqui o vetor deixa de
existir por construção — não há HTML de usuário para sanitizar.

### 6. XSS

- `dangerouslySetInnerHTML` aparece em um único lugar: `src/components/ui/chart.tsx`
  (template CSS do shadcn, não recebe input de usuário) — mesmo caso já auditado no Hub.
- O painel não renderiza HTML gerado por usuário. DOMPurify não é necessário hoje;
  **se algum campo rich-text for introduzido, ele passa a ser obrigatório**, junto com as
  CHECK constraints de `contains_xss_pattern()` como no Hub.

### 7. Cabeçalhos HTTP

Aplicados no nginx da própria imagem (`deploy/nginx.conf`), não dependem do time de infra:
HSTS, `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`,
`Permissions-Policy`, `X-Robots-Tag: noindex` e CSP.

CSP sem `unsafe-inline` em `script-src` — mais restritivo que o do Hub, porque o bundle do
Vite não precisa. `style-src` mantém `unsafe-inline` por exigência do Tailwind/Radix.

> ⚠️ `connect-src` precisa listar o domínio real do Supabase antes da primeira publicação.

Validar pós-deploy em https://securityheaders.com/ — meta nota **A** ou **A+**.

### 8. Segredos

- `.env` no `.gitignore`; só `.env.example` versionado.
- Nenhuma `VITE_*` carrega segredo — apenas URL e chave `anon`, públicas por design.
- `service_role` existe somente no ambiente das edge functions.
- URL do webhook do n8n saiu do código para variável de ambiente.

---

## Vulnerabilidades Conhecidas (Risco Aceito)

### Deps dev-only — `vite` (high), `esbuild` (moderate)
- **Status:** correção exige major (Vite 7)
- **Exposição real:** **nenhuma em produção** — o CVE afeta o dev server servindo arquivos
  indevidos. O deploy publica estáticos atrás do nginx; não há dev server rodando
- **Plano:** atualizar quando houver janela para regressão de build
- **Data aceito:** 2026-09-03

### `react-router-dom` — redirect externo por caminho não confiável (moderate)
- **Status:** correção exige migrar v6 → v7 (major)
- **Exposição real:** baixa — o app não constrói rota a partir de entrada do usuário; todo
  `navigate()` aponta para rota fixa
- **Plano:** story própria, com teste de navegação. Não embutir em `audit fix`
- **Data aceito:** 2026-09-03

### `xlsx` — RESOLVIDO ✅
Diferente do Hub, que aceitou o risco: aqui a lib foi migrada para a distribuição oficial da
SheetJS (`https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`), que recebe correção.
A versão do npm está congelada em 0.18.5 com prototype pollution e ReDoS sem fix.

> **Sugestão para o Hub:** a mesma troca resolve o item equivalente no `SECURITY.md` de lá,
> sem esperar a refatoração para `exceljs`. API compatível — nenhum código precisou mudar.

---

## Pendências antes de publicar na internet

- [ ] **Endurecer as policies que usam `is_staff()`** — sete tabelas. `is_staff` só verifica
      se o usuário tem *algum* papel; não distingue perfil nem consulta `user_page_access`.
      Com o fundo autenticando, eles herdariam leitura de toda a base operacional.
      Procedimento pronto em `docs/seguranca/rls-endurecimento-proposto.sql` — exige rodar a
      verificação de impacto contra a base real antes de aplicar.
- [ ] **Configurar `user_etapas_acesso` para os usuários da Valora** antes de conceder acesso
- [ ] **Login Google + política de acesso do usuário externo** (Story 2.3)
- [ ] **Backup com destino S3** — hoje nada no host do Dokploy tem backup, nem os sistemas
      já em produção. **Testar a restauração**: backup nunca restaurado é hipótese
- [ ] **Rotacionar/abandonar o projeto Supabase do Lovable** após a migração
- [ ] Rate limit de sign-in e expiração de JWT

---

## Processo de Resposta a Incidente

1. **Detecção** — erro 500 ou comportamento anômalo nos logs das edge functions
2. **Conter** — revogar a page_key do usuário afetado (`user_page_access`) ou restringir a
   matriz de etapas (`user_etapas_acesso`)
3. **Investigar** — `operacoes_formalizacao_historico` registra quem moveu o quê, de qual
   etapa para qual, quando e por qual origem (painel, HubSpot, Flixsign, sistema)
4. **Corrigir** — migration SQL + commit + deploy
5. **Comunicar** — Estefany e Lavínia decidem a comunicação ao time do fundo
6. **Pós-mortem** — atualizar este arquivo

## Backups

- **Pendente** — ver §Pendências. Nada configurado até esta data.
- Destino previsto: bucket S3 na AWS, backup diário do Postgres, com teste de restauração.

---

## Histórico

| Data | O que mudou |
|---|---|
| 2026-09-03 | Migração do Lovable. **As 8 edge functions passaram a exigir JWT.** Corrigidos: redefinição de senha (era login automático pelo link), relay de e-mail aberto, webhook n8n aberto, carteira de pré-aprovados legível por qualquer autenticado. Adicionados: matriz de permissão por etapa, auditoria append-only por trigger, política de senha, cabeçalhos HTTP, `verify_jwt` explícito. 21 → 4 vulnerabilidades de dependência. |
