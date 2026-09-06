# Status e bloqueios — 04/09/2026

O que está pronto, o que dá para continuar sem depender de ninguém, e o que precisa de
credencial, acesso ou decisão.

---

## 1. Entregue

### Fundação
| Story | Entrega |
|---|---|
| 1.1 | Migração do Lovable para o repositório, artefatos removidos |
| 1.2 | Dockerfile, nginx com CSP e cabeçalhos, procedimento de deploy |
| 5.1 | Esteira de evolução (`npm run export:evolucao`) |

### Segurança
| Story | Entrega |
|---|---|
| 2.1 | Carteira de pré-aprovados fechada; proposta de endurecimento pronta |
| 2.2 | Auditoria append-only por trigger |
| 2.4 | Redefinição de senha corrigida (era login automático pelo link) |
| 2.5 | 8 edge functions exigindo JWT; relay de e-mail e webhook n8n fechados |
| 2.6 | 21 → 4 vulnerabilidades; `xlsx` migrado para a distribuição oficial |
| 2.7 | Conformidade com o padrão da MaisTODOS; `SECURITY.md` do projeto |
| 2.8 | Auditoria das functions de CDI |

### Funil de formalização
| Story | Entrega |
|---|---|
| 3.1 | Modelo de dados: 6 enums, 6 tabelas, triggers, SLA configurável |
| 3.2 | Matriz de permissão por etapa, com RLS no banco |
| 3.3 | Mock substituído por persistência real |

### Regras de negócio confirmadas com a área (04/09)
| Item | Entrega |
|---|---|
| Fórmulas | `src/utils/operacaoFormulas.ts` — taxa, valores, ID da operação, linha de crédito |
| Testes | **38 testes**, incluindo os 5 exemplos reais da planilha da Lavínia |
| Migration | `20260904100000` — valores bruto/TAC/líquido, taxa estruturada, parcelas, ID, arquivamento, datas do HubSpot |
| Interface | Valor bruto, TAC e líquido no modal e no resumo (Story 3.7 parcial) |
| Auditoria | Trigger que registra divergência entre depósito previsto e efetivo |

---

## 2. Feito em 06/09

| # | Trabalho | Situação |
|---|---|---|
| 1 | **Sync HubSpot → Painel** (Story 4.1) | ✅ Implementado — falta executar contra o banco |
| 5 | **Conferência de depósito na tela** (Story 3.7) | ✅ Implementado |

| 2 | **Anexos de documentos** (Story 3.4) | ✅ Bucket privado, upload, download assinado, RLS herdando a matriz por etapa |
| 3 | **MFA** (Story 2.3) | ✅ TOTP, com barreira em todas as rotas protegidas |
| 4 | **Login Google** (Story 2.3) | ✅ Botão na tela de login; imposição de domínio fica no servidor |
| 6 | **Endurecimento de RLS** (Story 2.1, parte 2) | ✅ Sete tabelas migradas de `is_staff` para `has_any_page_access` |
| 7 | **Sync Painel → HubSpot** (Story 4.2) | ✅ Implementado, com três camadas contra loop |

## 2b. O que sobrou sem bloqueio

Nada relevante. Todo o trabalho que não depende de credencial, acesso ou decisão
externa foi executado. O que resta na seção 3 e 4 depende de terceiros.

---

## 3. Bloqueado por credencial ou acesso

| # | O que trava | Precisa de | Com quem |
|---|---|---|---|
| B1 | **Flixsign** — polling de status de assinatura | Credencial de serviço (e-mail e senha da conta) **e** definir como o `envelopeId` de cada operação chega ao painel | Fundo, via Estefany |
| B2 | **Notion** — OKRs na tela central | Token de integração da página | Alguém com permissão N2 |
| B3 | **E-mail real** | Chave do serviço de envio **e** registros DNS (SPF, DKIM, DMARC) do subdomínio | Victor / TI |
| B4 | **Publicação** | VPS (separada, de preferência), bucket S3 para backup, DNS do subdomínio | Victor |
| B5 | **Banco de pé** | Depende de B4. Sem ele, as migrations seguem apenas com sintaxe validada — nunca executadas | Victor |
| B6 | **Resgate do histórico** | Usuário **administrador** no painel do Lovable | Estefany |

> **B6 é o único com prazo.** Sem as planilhas originais, aquele banco é a única cópia do
> histórico da área. Projetos gratuitos do Supabase pausam por inatividade, e ninguém sabe
> quem controla a organização onde ele vive.

---

## 4. Bloqueado por decisão

| # | Decisão pendente | Com quem | Trava |
|---|---|---|---|
| D1 | Formato do ID: manter o atual (12–13 caracteres, validado) ou adotar o de 20 caracteres descrito na própria planilha | Lavínia | Story 3.8 |
| D2 | Método do segundo fator: aplicativo autenticador (TOTP), SMS ou e-mail | Estefany / Lavínia | Story 2.3 |

Sobre D1: a função de geração já está implementada e testada no formato atual. Se a escolha
for o formato novo, muda só o corpo de uma função — os testes ficam como estão e ganham novos
casos.

---

## 5. O que precisa de mais informação

| # | Informação | Por quê |
|---|---|---|
| I1 | Como o `envelopeId` da Flixsign chega ao painel — digitado, vindo do fundo por e-mail, ou outro caminho | Sem isso o polling não sabe o que consultar |
| I2 | Valores possíveis de "Tipo de Contrato/Operação" no HubSpot | Pode ser a origem do "TIPO OP" (PRÉ/PÓS/FUMAÇA) usado no ID |
| I3 | O que significa "FUMAÇA" como tipo de operação | Aparece na fórmula do ID; nenhum contexto até agora |
| I4 | Se o valor efetivamente depositado deve voltar para o HubSpot | Hoje esse dado não existe lá |

Nenhum desses bloqueia o trabalho da seção 2 — são refinamentos que entram quando chegarem.

---

## 6. Verificações (06/09)

- `tsc --noEmit` sem erros
- **38 testes** passando, incluindo os 5 IDs reais da planilha
- `npm run build` OK
- **30 migrations** validadas com o parser do PostgreSQL
- ESLint sem erros novos

**Ressalva mantida:** nenhuma migration foi **executada** — não há banco nem Docker nesta
máquina. Sintaxe validada não é o mesmo que comportamento validado.
