# Mapeamento HubSpot → Painel de Crédito PJ

- **Data:** 03/09/2026
- **Base:** descoberta via API com o token do aplicativo privado (somente leitura)
- **Status:** proposto — **pende confirmação da Estefany e da Lavínia**

---

## 1. Pipeline identificado

**`MaisTODOS - Comercial Crédito PJ`** — ID `134862882`

- 3.015 negócios no total
- 350 na etapa "Crédito concedido"
- 12 etapas, que batem com o funil descrito na reunião de 28/08

Havia 67 pipelines no portal. O segundo candidato, `MaisTODOS - Carteira PJ` (`910998540`),
tem apenas 4 etapas genéricas (Carteira, Em tratativa, Negócio fechado, Negócio perdido) —
não é o funil de esteira.

---

## 2. ⚠️ Armadilha: os nomes internos mentem

Este é o achado mais importante da descoberta. Várias propriedades foram **reaproveitadas de
usos antigos** — o nome interno ficou, o conteúdo mudou:

| Nome interno da propriedade | Rótulo que aparece na tela | O que guarda de verdade |
|---|---|---|
| `cluster_atual_parceiro_local` | **Prazo total** | Prazo da operação em meses |
| `dias_em_atraso___consignado` | **Valor da Taxa** | Taxa da operação |
| `numero_de_leads_diarios_da_as` | **Número de parcelas** | Quantidade de parcelas |
| `rotulo_de_associacao_as` | **Carência do Principal** | Meses de carência |
| `e_mail_suporte___financeira` | **Custo de Estruturação** | Valor do custo |
| `close_rate` | **Valor da TAC** | Valor da TAC |
| `objections_description` | **Tipo de Produto** | Linha de crédito |

**Consequência:** qualquer mapeamento feito por semelhança de nome erra. Mapear `taxa` para
algo chamado "taxa" levaria a `taxa_de_conexao` ou `taxa_de_trabalho` — que são métricas de
prospecção comercial, nada a ver com juros.

Foi por isso que a descoberta foi feita amostrando **negócios reais**, e não lendo a lista de
propriedades. O relatório completo está em `export/hubspot-amostra-134862882-233844036.md`.

> Nota de método: a primeira amostragem pegou os negócios "mais recentes" e trouxe sobretudo
> os perdidos na fase comercial — sem valor, sem taxa, sem prazo, porque esses campos só são
> preenchidos quando a operação avança. Foi preciso filtrar pela etapa "Crédito concedido"
> para ver uma operação completa.

---

## 3. Etapas — HubSpot × Painel

| # | Etapa no HubSpot | ID | Etapa no painel | Observação |
|---|---|---|---|---|
| 0 | Oportunidades | `233641647` | — | Comercial, fora do painel |
| 1 | Em contato | `965324587` | — | Comercial |
| 2 | Follow up | `233641649` | — | Comercial |
| 3 | Negociação | `233641650` | — | Comercial |
| 4 | Análise Interna | `1177469015` | — | Porta de entrada: é aqui que a Lavínia assume |
| 5 | Aguardando documentos | `233641651` | `recolhimento` | **Entrada no painel** |
| 6 | Análise Fornecedor | `233641652` | `analise` | Etapa do fundo |
| 7 | Formalização | `233641653` | `aguardando_contrato` + `contrato_emitido` + `contrato_assinado` | ⚠️ Ver §4 |
| 8 | Aguardando desembolso | `1420321874` | `contrato_assinado` | ⚠️ Ver §4 |
| 9 | Crédito concedido | `233844036` | `desembolsado` | Encerra a operação |
| 10 | Negociação perdida | `233844037` | — | Precisa de tratamento (§5) |
| 11 | Crédito Concedido (legado) | `1060807075` | `desembolsado` | Etapa antiga; tratar como a 9 |

## 4. ⚠️ O painel é mais detalhado que o HubSpot

O HubSpot resolve em **uma etapa** ("Formalização") o que o painel divide em **três**
(aguardando contrato → contrato emitido → contrato assinado). Isso é justamente o ganho que a
área pediu: enxergar o que hoje é uma caixa-preta.

A consequência prática precisa ser decidida:

**HubSpot → Painel** (sem problema): quando o negócio entra em "Aguardando documentos", nasce
no painel em `recolhimento`.

**Painel → HubSpot** (precisa de decisão): as três etapas de formalização do painel voltam
para uma só no HubSpot. Proposta:

| Etapa no painel | Vira, no HubSpot |
|---|---|
| `aguardando_contrato` | Formalização |
| `contrato_emitido` | Formalização (sem mudança — já está lá) |
| `contrato_assinado` | Aguardando desembolso |
| `desembolsado` | Crédito concedido |

Assim o HubSpot continua com a visão macro para o SLA da esteira comercial, e o painel guarda
o detalhe. **Confirmar com a Estefany.**

---

## 5. Campos — mapeamento proposto

Propriedades preenchidas em **5 de 5** operações concluídas da amostra:

| Campo do painel | Propriedade do HubSpot | Rótulo na tela | Confiança |
|---|---|---|---|
| `cnpj` | `cnpj_empresa` | CNPJ Empresa | ✅ Alta — 14 dígitos, formato bate |
| `unidade` | `dealname` | Deal Name | ✅ Alta |
| `prazo_meses` | `cluster_atual_parceiro_local` | Prazo total | ⚠️ Confirmar × `numero_de_leads_diarios_da_as` (Número de parcelas) |
| `taxa` | `dias_em_atraso___consignado` + `tipo_de_taxa` | Valor da Taxa + Tipo de Taxa | ⚠️ Confirmar como compor o rótulo |
| `valor` | `valor_do_contrato` × `valor_solicitado` × `amount` | — | ❌ **Ambíguo — precisa decisão** |
| `linha` | `objections_description` | Tipo de Produto | ⚠️ Confirmar os valores possíveis |
| `carencia_principal_meses` | `rotulo_de_associacao_as` | Carência do Principal | ✅ Alta |

### Campos úteis que o painel ainda não tem

| Propriedade | Rótulo | Por que interessa |
|---|---|---|
| `id_da_operacao` | ID da Operação | Formato `PO…`. **Melhor chave de negócio que o ID do HubSpot** — legível por humano e já usado pela área |
| `link_documentos` | Link documentos | **Já existe uma pasta de documentos por operação hoje.** Responde parte da pergunta sobre onde guardar (§4 de `03-decisoes-e-pendencias.md`) |
| `data_de_analise_valora` | Data de Análise Valora | Data real de entrada na etapa do fundo |
| `data_de_formalizacao` | Data de formalização | Idem |
| `data_de_credito_concedido` | Data de Crédito Concedido | Idem |
| `tipo_de_contrato` | Tipo de Contrato/Operação | Pode substituir ou complementar a linha de crédito |
| `destinacao_de_recurso` | Destinação de recurso | Informação de negócio não prevista no painel |
| `close_rate` | Valor da TAC | Custo cobrado — não previsto no painel |
| `e_mail_suporte___financeira` | Custo de Estruturação | Idem |

As três datas resolvem um problema real: ao importar uma operação que já está em andamento, o
SLA seria calculado a partir da data de importação e mostraria tudo em dia quando não está.
Com essas datas, o aging nasce correto.

---

## 6. Perguntas para fechar o mapeamento

1. **Valor:** qual das três propriedades é o valor da operação — `valor_do_contrato`,
   `valor_solicitado` ou `amount`? Elas diferem entre si; qual aparece no painel?
2. **Prazo:** "Prazo total" e "Número de parcelas" são a mesma coisa nesta operação?
3. **Linha de crédito:** quais são os valores possíveis de "Tipo de Produto"? Precisam
   corresponder a QIA, Amor Saúde e Visão de Todos.
4. **Taxa:** como o rótulo é montado hoje (ex.: `1,2% a.m. + CDI`)? "Valor da Taxa" +
   "Tipo de Taxa" bastam?
5. **`link_documentos`:** para onde aponta — Google Drive, SharePoint, outro? Isso muda a
   decisão sobre armazenamento de documentos.
6. **`id_da_operacao` (`PO…`):** é gerado onde? Se for a chave que a área usa no dia a dia,
   deveria aparecer no painel.
7. **Negociação perdida:** se uma operação já estiver no painel e for perdida no HubSpot, o
   que deve acontecer — sumir, ficar arquivada, ou virar um alerta?

---

## 7. Próximo passo técnico

Com as respostas de §6, a Story 4.1 (sync HubSpot → Painel) vira código:

1. Migration adicionando ao funil os campos novos (`id_da_operacao`, `link_documentos`,
   datas reais das etapas).
2. Edge function de sincronização, com polling a cada 1–2 h.
3. Idempotência por `hubspot_deal_id` — a coluna já existe e é única.
