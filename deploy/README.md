# Deploy — Painel de Crédito PJ

Story 1.2. Instruções para publicar no Dokploy.

> **Estado:** os arquivos deste diretório foram escritos mas **não executados** —
> não há Docker nesta máquina de desenvolvimento. A primeira execução real
> precisa ser acompanhada.

---

## 1. Aplicação (este repositório)

| Arquivo | Papel |
|---|---|
| `Dockerfile` (raiz) | Build em dois estágios: Node compila, nginx serve |
| `deploy/nginx.conf` | SPA fallback, cabeçalhos de segurança, política de cache |
| `.dockerignore` | Mantém `node_modules`, `docs/` e `.env` fora da imagem |

### Variáveis são de **build**, não de runtime

O Vite embute `VITE_*` no bundle durante a compilação. No Dokploy, cadastre-as
como **build arguments**, não como variáveis de ambiente do container — se
forem só env, o bundle sai sem elas e o app quebra ao subir:

```
VITE_SUPABASE_URL=https://supabase.credito.maistodos.com.br
VITE_SUPABASE_PUBLISHABLE_KEY=<chave anon>
VITE_SUPABASE_PROJECT_ID=<id>
```

Trocar qualquer uma dessas exige **rebuild**, não apenas restart.

### Dependência de rede no build

O `package.json` referencia o `xlsx` pela distribuição oficial da SheetJS
(`https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`), porque a versão do npm
tem prototype pollution e ReDoS sem correção (Story 2.6). **O build precisa
alcançar esse host.** Se o ambiente de build for restrito, espelhe o pacote num
registro interno e ajuste a referência.

### Ajuste obrigatório no CSP

A diretiva `connect-src` em `deploy/nginx.conf` precisa listar o domínio real do
Supabase. Enquanto estiver em domínio provisório, inclua-o também — senão o
navegador bloqueia todas as chamadas e a tela fica em branco sem erro visível.

### Cabeçalhos HTTP — nginx ou Traefik?

Os cabeçalhos de segurança já vão no `deploy/nginx.conf`, **dentro da imagem**. Essa é uma
diferença deliberada em relação ao Hub MaisTODOS, cujo `SECURITY.md` deixa os headers como
pendência com o time de infra ("Pendente — Time de Infra"): lá eles dependem de alguém
configurar o Traefik; aqui nós controlamos o nginx e não dependemos de ninguém.

Se o time de infra preferir centralizar no Traefik do Dokploy, os labels equivalentes são:

```yaml
labels:
  - "traefik.http.middlewares.credito-headers.headers.stsSeconds=63072000"
  - "traefik.http.middlewares.credito-headers.headers.stsIncludeSubdomains=true"
  - "traefik.http.middlewares.credito-headers.headers.stsPreload=true"
  - "traefik.http.middlewares.credito-headers.headers.contentTypeNosniff=true"
  - "traefik.http.middlewares.credito-headers.headers.frameDeny=true"
  - "traefik.http.middlewares.credito-headers.headers.referrerPolicy=strict-origin-when-cross-origin"
  - "traefik.http.middlewares.credito-headers.headers.permissionsPolicy=camera=(), microphone=(), geolocation=(), interest-cohort=()"
  - "traefik.http.routers.credito.middlewares=credito-headers@docker"
```

> Se ativar no Traefik, **remova os `add_header` correspondentes do nginx** para não duplicar.
> Cabeçalho duplicado não soma proteção e confunde auditoria.

Validar pós-deploy em https://securityheaders.com/ — meta nota **A** ou **A+**, mesmo alvo
definido no padrão do Hub.

---

## 2. Supabase self-hosted

**Decisão de arquitetura (03/09/2026):** Postgres em container, não RDS.
Motivo em `docs/01-diagnostico-tecnico.md` §10.2 — o RDS não oferece `pgjwt`,
`pg_net`, `pgsodium` nem `pg_graphql`, e não concede superuser. Sem essas
extensões o Supabase self-hosted não sobe, independente da rede.

### Por que não há um `docker-compose.yml` do Supabase aqui

O compose oficial do Supabase depende de arquivos de configuração que o
acompanham (`kong.yml`, scripts de init do Postgres, `vector.yml`). Copiar
esse YAML para cá criaria uma cópia que envelhece em silêncio e diverge do
upstream. O caminho correto é partir do oficial e aplicar as customizações
abaixo.

```bash
git clone --depth 1 https://github.com/supabase/supabase
cp -r supabase/docker /opt/supabase-credito-pj
cd /opt/supabase-credito-pj
cp .env.example .env
```

### Customizações necessárias

**a) Desabilitar o analytics.** O `analytics` (Logflare) + `vector` é o
componente mais pesado da stack e o menos essencial aqui. Na VPS atual —
~5 GB livres, dividida com o Hub P&C e o Faturamento, ambos em produção — a
stack completa consome 3–4 GB em idle e a folga fica perigosa. Remova os
serviços `analytics` e `vector` do compose e as dependências `depends_on` que
apontam para eles.

> Se o Victor liberar uma VPS separada, o analytics pode ficar. A recomendação
> continua sendo VPS separada.

**b) Gerar todos os segredos.** Nunca use os valores de exemplo:

| Variável | Como gerar |
|---|---|
| `POSTGRES_PASSWORD` | `openssl rand -base64 32` |
| `JWT_SECRET` | `openssl rand -base64 48` (mínimo 32 caracteres) |
| `ANON_KEY` / `SERVICE_ROLE_KEY` | JWTs assinados com o `JWT_SECRET` — use o gerador da documentação do Supabase |
| `DASHBOARD_PASSWORD` | `openssl rand -base64 24` |
| `SECRET_KEY_BASE`, `VAULT_ENC_KEY` | `openssl rand -base64 48` |

**c) Não exponha o Studio na internet.** No compose oficial o Studio sobe junto.
Deixe-o acessível só na rede interna e acesse por túnel SSH. É um painel com
poder de service_role.

**d) Segredos das edge functions.** Cadastre no ambiente das functions:

| Variável | Usada por | Observação |
|---|---|---|
| `N8N_WEBHOOK_URL` | `forward-to-n8n` | Deixou de ser hardcoded (Story 2.5) |
| `N8N_WEBHOOK_SECRET` | `forward-to-n8n` | Opcional; o n8n valida `X-Webhook-Secret` |
| `RESEND_API_KEY` | `send-operacao-email` | Sem ela, a function responde em modo simulado |
| `EMAIL_REMETENTE` | `send-operacao-email` | Ex.: `Crédito PJ MaisTODOS <creditopj@maistodos.com.br>` |

**e) Aplicar as migrations.** Na ordem de `supabase/migrations/`, incluindo as
três de 03/09/2026 (funil de formalização, RLS por etapa e pré-aprovados).

---

## 3. Backup

Hoje **nada** naquele host tem backup — nem o Hub P&C nem o Faturamento.
Configure o destino S3 no Dokploy antes de colocar dado real em produção, e
**teste a restauração**: backup que nunca foi restaurado é hipótese, não backup.

---

## 4. Ordem de publicação

1. Subir a stack Supabase e conferir que sobe sem OOM (`docker stats`).
2. Aplicar as migrations e conferir a contagem por tabela.
3. Migrar os dados do projeto do Lovable (Story 1.3).
4. Rodar a verificação de RLS de `docs/seguranca/rls-endurecimento-proposto.sql`.
5. Cadastrar os build args e publicar a aplicação.
6. Configurar o backup e testar a restauração.
7. Trocar o domínio provisório por `credito.maistodos.com.br` quando sair.
