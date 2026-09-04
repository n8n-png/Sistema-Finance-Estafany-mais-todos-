-- ============================================================================
-- Campos confirmados com a área em 04/09/2026
--
-- Cobre as Stories 3.7 (valores da operação) e 3.8 (ID da operação), mais os
-- campos do HubSpot cujo mapeamento foi fechado com a Estefany e a Lavínia.
--
-- Referências: docs/05-respostas-recebidas.md e docs/04-mapeamento-hubspot.md
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Tipo de taxa
--
--    Confirmado pela Lavínia: "Valor da taxa é a porcentagem de juros. Tipo de
--    taxa é pós-fixada/pré-fixada... Quando for pós, tem CDI incluso no cálculo."
--
--    Hoje o sistema adivinha isso procurando "cdi" no texto da taxa
--    (`isPosFixado`, em reconcile-operacoes e AtivoDetalhes). Com o campo vindo
--    do HubSpot, deixa de ser heurística e passa a ser dado.
-- ----------------------------------------------------------------------------

CREATE TYPE public.tipo_taxa AS ENUM ('pre', 'pos');

-- ----------------------------------------------------------------------------
-- 2) Valores da operação
--
--    A confusão entre "valor da operação" e "valor da TAC" fez a Valora
--    depositar errado em 03/09/2026. A separação abaixo existe para que isso
--    seja detectável.
--
--    Fórmula confirmada com uma operação real:
--      Valor do contrato (102.040,82) = Valor solicitado (100.000,00) + TAC (2.040,82)
-- ----------------------------------------------------------------------------

-- `valor` era ambíguo — passa a dizer explicitamente que é o valor bruto.
ALTER TABLE public.operacoes_formalizacao RENAME COLUMN valor TO valor_bruto;

COMMENT ON COLUMN public.operacoes_formalizacao.valor_bruto IS
  'Valor do contrato: o que o cliente deve. Vem de valor_do_contrato no HubSpot.';

ALTER TABLE public.operacoes_formalizacao
  ADD COLUMN valor_tac numeric(14,2) NOT NULL DEFAULT 0 CHECK (valor_tac >= 0);

COMMENT ON COLUMN public.operacoes_formalizacao.valor_tac IS
  'Taxa de abertura, embutida no valor do contrato. Vem de close_rate no HubSpot.';

-- Coluna gerada: nunca dessincroniza do bruto e da TAC, e não depende de a
-- aplicação lembrar de recalcular.
ALTER TABLE public.operacoes_formalizacao
  ADD COLUMN valor_liquido_previsto numeric(14,2)
  GENERATED ALWAYS AS (valor_bruto - COALESCE(valor_tac, 0)) STORED;

COMMENT ON COLUMN public.operacoes_formalizacao.valor_liquido_previsto IS
  'O que deveria cair na conta do cliente. Calculado: bruto - TAC.';

-- O que de fato caiu. Só existe a partir do desembolso, e pode divergir do
-- previsto — é justamente essa divergência que o painel precisa flagrar.
ALTER TABLE public.operacoes_formalizacao
  ADD COLUMN valor_liquido_depositado numeric(14,2) CHECK (valor_liquido_depositado >= 0);

COMMENT ON COLUMN public.operacoes_formalizacao.valor_liquido_depositado IS
  'Valor efetivamente depositado, informado no desembolso. Divergência em relação ao previsto é sinalizada.';

-- ----------------------------------------------------------------------------
-- 3) Taxa estruturada
--
--    A coluna `taxa` (texto, ex.: "2,19% a.m. + CDI") continua existindo porque
--    é o que a interface exibe. Os campos abaixo são a origem estruturada dela.
-- ----------------------------------------------------------------------------

ALTER TABLE public.operacoes_formalizacao
  ADD COLUMN taxa_percentual numeric(8,4) CHECK (taxa_percentual >= 0),
  ADD COLUMN taxa_tipo public.tipo_taxa;

COMMENT ON COLUMN public.operacoes_formalizacao.taxa_percentual IS
  'Percentual de juros ao mês. Vem de "Valor da Taxa" no HubSpot.';

-- ----------------------------------------------------------------------------
-- 4) Prazo e parcelas são coisas diferentes
--
--    Lavínia: "Pode ser que tenha operação com carência total, que não possui
--    parcelas, por isso a diferença." Ou seja, prazo total ≠ nº de parcelas
--    quando há carência.
-- ----------------------------------------------------------------------------

ALTER TABLE public.operacoes_formalizacao
  ADD COLUMN numero_parcelas smallint CHECK (numero_parcelas IS NULL OR numero_parcelas >= 0);

COMMENT ON COLUMN public.operacoes_formalizacao.numero_parcelas IS
  'Quantidade de parcelas. Difere do prazo quando há carência total.';

-- ----------------------------------------------------------------------------
-- 5) ID da Operação (Story 3.8)
--
--    Gerado hoje à mão, numa planilha, quando a operação vai para desembolso.
--    Passa a ser gerado pelo painel.
--
--    Índice NÃO é único de propósito: a regra atual pode produzir o mesmo ID
--    para operações diferentes (mesmo dia + mesmas 3 primeiras letras da unidade
--    + mesmos 2 primeiros dígitos do CNPJ). Uma constraint única faria a
--    gravação falhar e travar a operação; a aplicação detecta a colisão e avisa,
--    o que é mais seguro do que impedir o registro.
-- ----------------------------------------------------------------------------

ALTER TABLE public.operacoes_formalizacao
  ADD COLUMN id_operacao text;

COMMENT ON COLUMN public.operacoes_formalizacao.id_operacao IS
  'Código da operação, ex.: PF46262IBI45. Gerado no desembolso. Ver docs/stories/3.8.';

CREATE INDEX idx_operacoes_formalizacao_id_operacao
  ON public.operacoes_formalizacao (id_operacao)
  WHERE id_operacao IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 6) Arquivamento (negociação perdida)
--
--    A área pediu que a operação "suma do painel". Some da tela, mas o registro
--    permanece: apagar destruiria a trilha de auditoria de uma operação que
--    existiu, e impediria o retorno automático caso o HubSpot reverta a perda.
-- ----------------------------------------------------------------------------

ALTER TABLE public.operacoes_formalizacao
  ADD COLUMN arquivada boolean NOT NULL DEFAULT false,
  ADD COLUMN arquivada_em timestamptz,
  ADD COLUMN arquivada_motivo text,
  ADD CONSTRAINT operacoes_formalizacao_arquivamento_coerente
    CHECK (NOT arquivada OR arquivada_em IS NOT NULL);

-- O quadro consulta quase sempre só as ativas.
CREATE INDEX idx_operacoes_formalizacao_ativas
  ON public.operacoes_formalizacao (etapa)
  WHERE NOT arquivada;

-- ----------------------------------------------------------------------------
-- 7) Rastreamento e datas reais do HubSpot
--
--    As datas evitam um erro sutil: ao importar uma operação já em andamento, o
--    SLA seria contado a partir da importação e mostraria tudo em dia quando não
--    está. Com as datas reais, o aging nasce correto.
-- ----------------------------------------------------------------------------

ALTER TABLE public.operacoes_formalizacao
  ADD COLUMN hubspot_stage_id text,
  ADD COLUMN data_analise_fundo date,
  ADD COLUMN data_formalizacao date,
  ADD COLUMN data_credito_concedido date;

-- ----------------------------------------------------------------------------
-- 8) Trigger: registra divergência de depósito no histórico
--
--    A comparação é feita aqui, e não só na interface, porque o valor pode ser
--    gravado por outro caminho (sync, correção manual). Auditoria que depende da
--    tela é auditoria que falha.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.operacao_formalizacao_audita_deposito()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_divergencia numeric(14,2);
  v_autor_id uuid;
  v_autor text;
BEGIN
  IF NEW.valor_liquido_depositado IS NULL
     OR NEW.valor_liquido_depositado IS NOT DISTINCT FROM OLD.valor_liquido_depositado THEN
    RETURN NULL;
  END IF;

  v_divergencia := NEW.valor_liquido_depositado - NEW.valor_liquido_previsto;

  -- Um centavo de diferença é arredondamento entre sistemas, não erro operacional.
  IF abs(v_divergencia) <= 0.01 THEN
    RETURN NULL;
  END IF;

  v_autor_id := COALESCE(auth.uid(), NEW.updated_by);
  v_autor := COALESCE(
    (SELECT u.email FROM auth.users u WHERE u.id = v_autor_id),
    'Sistema'
  );

  INSERT INTO public.operacoes_formalizacao_historico
    (operacao_id, descricao, autor, autor_id, origem)
  VALUES (
    NEW.id,
    format(
      'DIVERGÊNCIA NO DEPÓSITO: previsto R$ %s, depositado R$ %s (diferença de R$ %s)',
      to_char(NEW.valor_liquido_previsto, 'FM999G999G990D00'),
      to_char(NEW.valor_liquido_depositado, 'FM999G999G990D00'),
      to_char(v_divergencia, 'FM999G999G990D00')
    ),
    v_autor,
    v_autor_id,
    'sistema'
  );

  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_operacao_formalizacao_audita_deposito
  AFTER UPDATE ON public.operacoes_formalizacao
  FOR EACH ROW EXECUTE FUNCTION public.operacao_formalizacao_audita_deposito();
