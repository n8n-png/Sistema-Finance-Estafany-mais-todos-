# Segurança — Hub MaisTODOS

> Política de segurança consolidada. Atualizada a cada sprint.

## Última auditoria
**2026-05-19** — Sprint S0.5 (Foundation Segurança PII + Todas Camadas)

---

## Camadas de Segurança Aplicadas

### 1. LGPD / PII
- `profiles_public` view: mascara email, CPF, data_nascimento bruta
- `birthdays_view`: ano nascimento NUNCA exposto, mes/dia + idade opcional
- `get_profile_contact(target_id)` RPC: email só pra self ou admin
- Telemetria `interaction_events`: removido `profile_view` (não rastreamos quem vê qual perfil)
- TTL 90 dias via cron `purge_old_interactions`

### 2. RLS (Row Level Security)
- 32/32 tabelas com RLS habilitada
- `profiles` raw: SELECT só pra self OU admin (via `current_user_is_admin()`)
- `page_permissions`: write só super-admin, read all authenticated
- Audit completo em `supabase/migrations/20260516000011_profiles_rls_lockdown.sql`

### 3. SECURITY DEFINER functions
Todas com `search_path = public, pg_catalog` fixo:
- `current_user_is_admin`, `get_profile_contact`, `handle_new_user`
- `has_admin_permission`, `notify_comentario_reacao`, `purge_old_interactions`

### 4. Storage Buckets
| Bucket | Público | Size | MIME |
|--------|---------|------|------|
| `avatars` | sim | 10MB | image/* |
| `banners` | sim | 10MB | image/* |
| `content-files` | sim | 50MB | image/* + pdf |
| `reconhecimentos` | sim | 10MB | image/* |

Removidos: `Avatars` (dup), `time-pc` (P1 descontinuada), `divulgacoes` (legacy).

### 5. Sistema de Permissões
- `page_permissions` table — super-admin controla audience por página
- `AdminPermissions` — granular por aba admin (decisão PR8)
- Confirmação obrigatória ao liberar audience='all'

### 6. API Externa server-to-server (`colaboradores-export`)
- Edge Function pro time de Segurança/Acessos consultar dados de colaboradores sem login no portal (integração servidor-a-servidor — exceção deliberada ao não-objetivo do PRD, ver `DECISIONS.md` S5)
- Autenticação via tabela `api_tokens`: token opaco de 32 bytes aleatórios, armazenado só como hash SHA-256 (`token_hash`) — nunca texto puro. `token_last4` (texto puro) só pra UI mascarar o token na tela de gestão
- Escopo por campo: cada token libera só um subconjunto dos 15 campos suportados (coluna `escopo` jsonb), validado na Edge Function contra o `FIELD_MAP`
- Gestão de token (criar/revogar) restrita a `admin_permissions.api_colaboradores = 'edit'` (ou super-admin) — RLS na tabela `api_tokens`
- Validação do token na própria Edge Function usa cliente `service_role` (bypassa RLS) — o caller é um sistema externo sem sessão Supabase, não carrega JWT de usuário do Hub
- Audit log automático via trigger em toda criação/revogação de token (`colaboradores_api_token_created` / `colaboradores_api_token_revoked`) — nunca loga o token em si, só metadados (`escopo`, `expira_em`)
- **Expiração indeterminada é aceitável por decisão de produto** — `expira_em = NULL` é válido e intencional para uso contínuo do time de Segurança/Acessos. Risco aceito conscientemente, ver `DECISIONS.md` S6
- **Sem exigência de segunda aprovação pra token de escopo total (15/15 campos)** — controle de risco está na concessão da permissão granular `api_colaboradores` (poucos admins de confiança), não em dupla checagem por token gerado. Risco aceito conscientemente, ver `DECISIONS.md` S7
- Base legal LGPD: legítimo interesse do controlador (art. 7º/10 da Lei 13.709/2018), finalidade de segurança e controle de acesso corporativo — ver `DECISIONS.md` S5

---

## Vulnerabilidades Conhecidas (Risco Aceito)

### `xlsx` — Prototype Pollution + ReDoS (high)
- **CVE:** GHSA-4r6h-8v6p-xvw6 + GHSA-5pgg-2g8v-p4x9
- **Status:** sem fix upstream (lib abandonada na npm)
- **Uso:** `ColaboradoresPage.tsx` (admin importa xlsx) + `AnalyticsPage.tsx` + `RelatoriosPage.tsx` (export)
- **Mitigação atual:** RBAC — só super-admin acessa upload
- **Risco prático:** baixo (vetor exige super-admin malicioso ou file envenenado)
- **Plano:** substituir por `exceljs` em sprint futuro (junto refatoração admin S6.5)
- **Data aceito:** 2026-05-19

### Deps dev-only (low/moderate)
- `esbuild`, `vite`, `jsdom`, `@tootallnate/once`, `http-proxy-agent`
- **Status:** vulns afetam só servidor de dev local, não produção
- **Plano:** atualizar Vite 6→8 quando time tiver capacidade pra regressão de build

---

## Processo de Resposta a Incidente

1. **Detecção** — alerta de erro 500/breach via `error_logs` ou Sentry futuro
2. **Conter** — toggle `enabled=false` na `page_permissions` da página afetada
3. **Investigar** — query `audit_logs` filtrando por timeframe
4. **Corrigir** — migration SQL + commit + push main
5. **Comunicar** — Pedro decide se notificar colaboradores
6. **Pós-mortem** — atualizar este arquivo + DECISIONS.md

## Backups
- Git bundle local: `C:\Users\pedro.oliveira\hub-backup-YYYYMMDD.bundle`
- Supabase Dashboard: backup automático Postgres
- Stories CSV/ZIP exports antes de drops: `*-backup-YYYYMMDD.csv/.zip`

## Sanitização HTML Server-side (S0.5.5) ✅
**Data:** 2026-05-19

Defesa em profundidade contra XSS via API direta. CHECK constraints em 5 campos rich-text:
- `notion_content.conteudo`, `banners.conteudo`, `profiles.bio`
- `reconhecimentos.mensagem`, `reconhecimento_comentarios.texto`

Função `contains_xss_pattern()` detecta: `<script>`, `<iframe>`, `<object>`, `<embed>`, `javascript:`, `vbscript:`, `on*=` attrs, `data:text/html`.

Front-end DOMPurify continua sanitizando ao renderizar (camada extra).

**Bug encontrado e corrigido:** versão inicial usava regex Perl (`\s`, `\b`) que PostgreSQL POSIX não suporta — função retornava false pra payloads óbvios. Fix: usar `[[:space:]]` em vez de `\s`, sem `\b`.

---

## Auditoria Externa — Analista de Segurança (2026-05-19)

3 vulns reportadas externamente. Análise:

### Vuln 1 — invite-user JWT bypass (CRÍTICA → MITIGADA) ✅
**Reporte:** `verify_jwt=false` no config + validação manual sem checar assinatura cripto.

**Realidade:** código usa `supabaseAdmin.auth.getUser(token)` (linha 56 invite-user/index.ts) — valida assinatura criptográfica via service_role internamente. Forjar token sem service_role key = impossível. Plus checa `callerRole !== 'admin'` (linha 71).

**Fix defesa em profundidade aplicado:** `verify_jwt=true` em todas Edge Functions. Supabase agora rejeita JWT inválido ANTES de invocar função, dupla camada.

### Vuln 2 — service_role no bundle (CRÍTICA → JÁ RESOLVIDO) ✅
**Reporte:** `VITE_SUPABASE_SERVICE_ROLE_KEY` exposta no bundle JS.

**Auditoria:**
- Grep no `src/`: zero matches
- `.env.example`: nota explícita "NUNCA exponha com VITE_"
- `Dockerfile`: só VITE_SUPABASE_ANON_KEY + URL (public-safe)
- Secrets scan S0.5.7: zero leak em git history

**Conclusão:** analista olhou versão antiga. Service_role hoje só existe em Edge Functions (server-side secret no Dashboard).

### Vuln 3 — XSS Stored TipTap (CRÍTICA → JÁ RESOLVIDO) ✅
**Reporte:** HTML editor renderizado via `dangerouslySetInnerHTML` sem sanitização.

**Auditoria `dangerouslySetInnerHTML` no projeto:**
- `ContentDetailPage.tsx:286` → `sanitizeHtml(seg.content)` ✅
- `Index.tsx:143` → `sanitizeHtml(item.conteudo ?? '')` ✅
- `chart.tsx:70` → CSS template shadcn (não é input user)

**`src/lib/sanitize.ts` ATIVO:** usa DOMPurify em 100% dos renders de HTML user-generated.

**Plus banco:** CHECK constraints S0.5.5 bloqueiam `<script>`, `<iframe>`, `javascript:`, `on*=` direto na inserção. Defesa em profundidade dupla.

---

## Secrets Scan (S0.5.7) ✅
**Data:** 2026-05-19

Auditoria do git log:
- ✅ Nenhum `SUPABASE_SERVICE_ROLE_KEY` vazado
- ✅ Nenhum postgres connection string
- ✅ Nenhuma AWS/Gemini/Stripe key
- ⚠️ 2 JWTs `role: anon` encontrados — **públicos por design** (vão no JS bundle), RLS protege dado
- ✅ `.env` + `.env.local` gitignored
- ✅ Só `.env.example` tracked (placeholders)

## Pendente — Time de Infra (não acessível por Pedro)
- [ ] **Headers HTTP via Dokploy/Traefik** — Pedro precisa solicitar ao responsável Dokploy. Headers a adicionar (referência abaixo).

### Config Traefik recomendada (passar pro responsável)

Adicionar labels no service do Hub no docker-compose ou Dokploy UI:
```yaml
labels:
  - "traefik.http.middlewares.hub-headers.headers.stsSeconds=63072000"
  - "traefik.http.middlewares.hub-headers.headers.stsIncludeSubdomains=true"
  - "traefik.http.middlewares.hub-headers.headers.stsPreload=true"
  - "traefik.http.middlewares.hub-headers.headers.contentTypeNosniff=true"
  - "traefik.http.middlewares.hub-headers.headers.frameDeny=true"
  - "traefik.http.middlewares.hub-headers.headers.referrerPolicy=strict-origin-when-cross-origin"
  - "traefik.http.middlewares.hub-headers.headers.permissionsPolicy=camera=(), microphone=(), geolocation=(), interest-cohort=()"
  - "traefik.http.middlewares.hub-headers.headers.contentSecurityPolicy=default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://*.supabase.co wss://*.supabase.co; font-src 'self' data:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
  - "traefik.http.routers.hub.middlewares=hub-headers@docker"
```

Validar pós-deploy: https://securityheaders.com/ — meta nota **A** ou **A+**.

## Auth Hardening — POSPONDO ⏸️
**Status:** 12 colaboradores internos testando. Decisão Pedro: aguardar migração pra Google SSO antes de endurecer auth (password policy, MFA, JWT expiry, rate limit).

**Trigger pra retomar:** quando Pedro avisar que SSO Google está pronto pra migração.

**Ações futuras (S0.5.8 quando ativar):**
1. Desabilitar Email/Password provider (Supabase Auth)
2. Habilitar Google OAuth provider
3. Server-side domain enforcement (`@maistodos.com.br`) via trigger ou Auth Hook
4. JWT expiry 1h + refresh rotation
5. MFA TOTP opcional
6. Rate limit sign-in (5/h por IP)
7. Redirect URLs restritivas

## Auditorias Futuras
- [ ] Substituir `xlsx` por `exceljs` — futuro
- [ ] Pre-commit secretlint hook — futuro
