# Painel de Crédito PJ — MaisTODOS

Sistema interno de Crédito PJ da MaisTODOS: esteira de formalização com o fundo (Valora),
operações ativas, limites de clientes, central de documentos e simulações de crédito.

Origem: protótipo construído no Lovable pela área de Crédito PJ, migrado para código próprio.
**O Lovable está congelado** — alterações lá não chegam neste repositório.

## Stack

| Camada | Tecnologia |
|---|---|
| Front-end | React 18 + Vite 5 + TypeScript |
| UI | Tailwind CSS + shadcn/ui (Radix) |
| Dados | TanStack Query |
| Backend | Supabase (Postgres + Auth + RLS + Storage + Edge Functions/Deno) |
| Automação | n8n |
| Deploy | Dokploy |

## Rodando localmente

```bash
cp .env.example .env   # preencha com as credenciais do ambiente
npm install
npm run dev            # http://localhost:8080
```

Scripts: `npm run dev`, `npm run build`, `npm run preview`, `npm run lint`.

## Estrutura

```
src/
  components/     # UI — ui/ (shadcn), valora/ (funil), ativos/, limites/, checklist/, admin/
  hooks/          # useAuth, usePageAccess, hooks de dados
  integrations/   # cliente Supabase e tipos gerados
  pages/          # rotas
  services/       # camada de serviço (operacoes, notificacoes, usuarios)
  utils/          # cálculos, CDI, feriados, exports PDF/DOCX
supabase/
  functions/      # Edge Functions (Deno)
  migrations/     # migrations SQL
docs/
  01-diagnostico-tecnico.md   # diagnóstico, plano de migração e riscos
  referencias/                # escopo, transcrição, manuais de API, export original
```

## Documentação

- [`docs/01-diagnostico-tecnico.md`](docs/01-diagnostico-tecnico.md) — diagnóstico do protótipo,
  achados de segurança, análise das APIs (HubSpot, Flixsign, Notion) e plano de execução por fases.
