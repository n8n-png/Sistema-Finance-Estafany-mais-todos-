-- ============================================================================
-- Story 3.1 — Modelo de dados do funil de formalização
-- Story 2.2 — Trilha de auditoria (triggers de histórico)
--
-- Substitui o array em memória de src/services/operacoes.ts por persistência real.
-- Não altera nenhuma tabela existente.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Enums do domínio
-- ----------------------------------------------------------------------------

-- Ordem dos valores = ordem do funil. Não reordenar: comparações dependem disso.
CREATE TYPE public.etapa_formalizacao AS ENUM (
  'recolhimento',
  'analise',
  'aguardando_contrato',
  'contrato_emitido',
  'contrato_assinado',
  'desembolsado'
);

CREATE TYPE public.linha_credito AS ENUM ('QIA', 'Amor Saúde', 'Visão de Todos');

CREATE TYPE public.alerta_tipo AS ENUM ('pendencia', 'reprovado');

CREATE TYPE public.signatario_status AS ENUM ('pendente', 'assinado');

CREATE TYPE public.pessoa_papel AS ENUM ('representante', 'avalista');

-- Quem originou a alteração. É a defesa contra loop de sincronização (Story 4.2).
CREATE TYPE public.origem_alteracao AS ENUM ('painel', 'hubspot', 'flixsign', 'sistema');

-- ----------------------------------------------------------------------------
-- 2) Configuração de SLA por etapa
--    Hoje o SLA é fixo em 3 dias no código (ETAPAS em services/operacoes.ts).
--    Passa a ser configurável sem deploy.
-- ----------------------------------------------------------------------------

CREATE TABLE public.operacoes_formalizacao_sla (
  etapa      public.etapa_formalizacao PRIMARY KEY,
  ordem      smallint NOT NULL UNIQUE,
  titulo     text NOT NULL,
  sla_dias   smallint NOT NULL DEFAULT 3 CHECK (sla_dias > 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

INSERT INTO public.operacoes_formalizacao_sla (etapa, ordem, titulo, sla_dias) VALUES
  ('recolhimento',        1, 'Recolhimento de documentos',                     3),
  ('analise',             2, 'Análise fornecedor',                             3),
  ('aguardando_contrato', 3, 'Aguardando contrato',                            3),
  ('contrato_emitido',    4, 'Contrato emitido',                               3),
  ('contrato_assinado',   5, 'Contrato assinado — pronto para desembolso',     3),
  ('desembolsado',        6, 'Desembolsado',                                   3);

-- ----------------------------------------------------------------------------
-- 3) Tabela principal
-- ----------------------------------------------------------------------------

CREATE TABLE public.operacoes_formalizacao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identificação da operação
  unidade text NOT NULL,
  -- CNPJ sem máscara, 14 dígitos — mesmo formato de src/utils/cnpj.ts,
  -- para permitir cruzamento com operacoes_ativas e clientes_limites.
  cnpj text CHECK (cnpj IS NULL OR cnpj ~ '^[0-9]{14}$'),
  linha public.linha_credito NOT NULL,
  fundo text NOT NULL DEFAULT 'FIDC MaisTODOS',

  -- Condições comerciais
  valor numeric(14,2) NOT NULL CHECK (valor > 0),
  -- Rótulo de negócio, não número calculável (ex.: "1,2% a.m. + CDI").
  taxa text NOT NULL,
  prazo_meses smallint NOT NULL CHECK (prazo_meses > 0),
  carencia_total_meses smallint CHECK (carencia_total_meses IS NULL OR carencia_total_meses >= 0),
  carencia_principal_meses smallint CHECK (carencia_principal_meses IS NULL OR carencia_principal_meses >= 0),
  conta_deposito text,

  -- Posição no funil
  etapa public.etapa_formalizacao NOT NULL DEFAULT 'recolhimento',
  data_entrada_funil timestamptz NOT NULL DEFAULT now(),
  -- Base do cálculo de SLA/aging. Mantida por trigger a cada mudança de etapa.
  data_entrada_etapa timestamptz NOT NULL DEFAULT now(),

  -- Alerta exibido no card (pendência de documento ou reprovação)
  alerta_tipo public.alerta_tipo,
  alerta_mensagem text,

  -- Destinatários das notificações desta operação
  destinatarios text[] NOT NULL DEFAULT '{}',

  comprovante_desembolso text,

  -- Integrações (nascem no modelo para não exigir migration nas Stories 4.x)
  hubspot_deal_id text UNIQUE,
  flixsign_envelope_id text,
  origem_ultima_alteracao public.origem_alteracao NOT NULL DEFAULT 'painel',
  sincronizado_em timestamptz,

  -- Auditoria
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id),

  -- Alerta sem tipo não faz sentido; tipo sem mensagem é permitido.
  CONSTRAINT operacoes_formalizacao_alerta_coerente
    CHECK (alerta_mensagem IS NULL OR alerta_tipo IS NOT NULL)
);

COMMENT ON TABLE public.operacoes_formalizacao IS
  'Funil de formalização das operações de Crédito PJ com o fundo. Substitui o mock de src/services/operacoes.ts.';
COMMENT ON COLUMN public.operacoes_formalizacao.origem_ultima_alteracao IS
  'Origem da última alteração. Usado para evitar loop de sincronização com o HubSpot.';

CREATE INDEX idx_operacoes_formalizacao_etapa ON public.operacoes_formalizacao (etapa);
CREATE INDEX idx_operacoes_formalizacao_cnpj ON public.operacoes_formalizacao (cnpj);
CREATE INDEX idx_operacoes_formalizacao_entrada_etapa ON public.operacoes_formalizacao (data_entrada_etapa);
CREATE INDEX idx_operacoes_formalizacao_flixsign
  ON public.operacoes_formalizacao (flixsign_envelope_id)
  WHERE flixsign_envelope_id IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 4) Checklist documental por operação
--    Tabela, não JSONB: cada item tem anexo, estado e auditoria próprios.
-- ----------------------------------------------------------------------------

CREATE TABLE public.operacoes_formalizacao_checklist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operacao_id uuid NOT NULL REFERENCES public.operacoes_formalizacao(id) ON DELETE CASCADE,
  ordem smallint NOT NULL,
  label text NOT NULL,
  checked boolean NOT NULL DEFAULT false,
  pendente boolean NOT NULL DEFAULT false,
  anexo_nome text,
  -- Caminho no Storage. Preenchido pela Story 3.4.
  anexo_path text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id),
  UNIQUE (operacao_id, ordem)
);

CREATE INDEX idx_form_checklist_operacao ON public.operacoes_formalizacao_checklist (operacao_id);

-- ----------------------------------------------------------------------------
-- 5) Signatários do contrato
-- ----------------------------------------------------------------------------

CREATE TABLE public.operacoes_formalizacao_signatarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operacao_id uuid NOT NULL REFERENCES public.operacoes_formalizacao(id) ON DELETE CASCADE,
  nome text NOT NULL,
  papel text NOT NULL,
  email text,
  cpf text,
  status public.signatario_status NOT NULL DEFAULT 'pendente',
  assinado_em timestamptz,
  -- Vínculo com o envelope da Flixsign (Story 4.3)
  flixsign_signatory_id text,
  ordem smallint,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_form_signatarios_operacao ON public.operacoes_formalizacao_signatarios (operacao_id);

-- ----------------------------------------------------------------------------
-- 6) Representantes legais e avalistas
--    Alimentam a geração do checklist em PDF/DOCX (utils/checklistDocx.ts).
-- ----------------------------------------------------------------------------

CREATE TABLE public.operacoes_formalizacao_pessoas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operacao_id uuid NOT NULL REFERENCES public.operacoes_formalizacao(id) ON DELETE CASCADE,
  papel public.pessoa_papel NOT NULL,
  nome text NOT NULL,
  cpf text,
  email text,
  regime text,
  ordem smallint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_form_pessoas_operacao ON public.operacoes_formalizacao_pessoas (operacao_id);

-- ----------------------------------------------------------------------------
-- 7) Histórico / trilha de auditoria (Story 2.2)
--    Append-only. Sem policy de UPDATE ou DELETE — nem admin edita histórico.
-- ----------------------------------------------------------------------------

CREATE TABLE public.operacoes_formalizacao_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operacao_id uuid NOT NULL REFERENCES public.operacoes_formalizacao(id) ON DELETE CASCADE,
  descricao text NOT NULL,
  autor text NOT NULL,
  autor_id uuid REFERENCES auth.users(id),
  etapa_de public.etapa_formalizacao,
  etapa_para public.etapa_formalizacao,
  origem public.origem_alteracao NOT NULL DEFAULT 'painel',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_form_historico_operacao ON public.operacoes_formalizacao_historico (operacao_id, created_at DESC);

-- ----------------------------------------------------------------------------
-- 8) Triggers
-- ----------------------------------------------------------------------------

-- 8.1) updated_at nas tabelas com esse campo (reusa a função já existente)
CREATE TRIGGER trg_operacoes_formalizacao_updated_at
  BEFORE UPDATE ON public.operacoes_formalizacao
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_form_checklist_updated_at
  BEFORE UPDATE ON public.operacoes_formalizacao_checklist
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_form_signatarios_updated_at
  BEFORE UPDATE ON public.operacoes_formalizacao_signatarios
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_form_sla_updated_at
  BEFORE UPDATE ON public.operacoes_formalizacao_sla
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 8.2) Ao mudar de etapa, reinicia o relógio do SLA.
CREATE OR REPLACE FUNCTION public.operacao_formalizacao_reset_sla()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  IF NEW.etapa IS DISTINCT FROM OLD.etapa THEN
    NEW.data_entrada_etapa := now();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_operacao_formalizacao_reset_sla
  BEFORE UPDATE ON public.operacoes_formalizacao
  FOR EACH ROW EXECUTE FUNCTION public.operacao_formalizacao_reset_sla();

-- 8.3) Auditoria automática de mudança de etapa.
--      SECURITY DEFINER porque precisa ler auth.users para resolver o nome do autor.
--      Nem o sync do HubSpot nem uma correção manual no banco escapam deste registro.
CREATE OR REPLACE FUNCTION public.operacao_formalizacao_audita()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_autor_id uuid;
  v_autor    text;
  v_titulo   text;
BEGIN
  -- auth.uid() existe quando a alteração vem do painel; em edge function com
  -- service_role ele é nulo e caímos no updated_by informado pela aplicação.
  v_autor_id := COALESCE(auth.uid(), NEW.updated_by, NEW.created_by);

  v_autor := COALESCE(
    (SELECT u.email FROM auth.users u WHERE u.id = v_autor_id),
    CASE NEW.origem_ultima_alteracao
      WHEN 'hubspot'  THEN 'Integração HubSpot'
      WHEN 'flixsign' THEN 'Integração Flixsign'
      ELSE 'Sistema'
    END
  );

  SELECT s.titulo INTO v_titulo
    FROM public.operacoes_formalizacao_sla s
   WHERE s.etapa = NEW.etapa;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.operacoes_formalizacao_historico
      (operacao_id, descricao, autor, autor_id, etapa_de, etapa_para, origem)
    VALUES
      (NEW.id, 'Operação criada em ' || COALESCE(v_titulo, NEW.etapa::text),
       v_autor, v_autor_id, NULL, NEW.etapa, NEW.origem_ultima_alteracao);

  ELSIF NEW.etapa IS DISTINCT FROM OLD.etapa THEN
    INSERT INTO public.operacoes_formalizacao_historico
      (operacao_id, descricao, autor, autor_id, etapa_de, etapa_para, origem)
    VALUES
      (NEW.id, 'Movida para ' || COALESCE(v_titulo, NEW.etapa::text),
       v_autor, v_autor_id, OLD.etapa, NEW.etapa, NEW.origem_ultima_alteracao);
  END IF;

  RETURN NULL; -- AFTER trigger
END;
$$;

CREATE TRIGGER trg_operacao_formalizacao_audita
  AFTER INSERT OR UPDATE ON public.operacoes_formalizacao
  FOR EACH ROW EXECUTE FUNCTION public.operacao_formalizacao_audita();

-- ----------------------------------------------------------------------------
-- 9) RLS habilitada. As policies vêm na Story 3.2 — até lá, nenhuma leitura
--    é permitida a `authenticated`, o que é o padrão seguro.
-- ----------------------------------------------------------------------------

ALTER TABLE public.operacoes_formalizacao              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operacoes_formalizacao_checklist    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operacoes_formalizacao_signatarios  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operacoes_formalizacao_pessoas      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operacoes_formalizacao_historico    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operacoes_formalizacao_sla          ENABLE ROW LEVEL SECURITY;

-- Sem GRANT para anon em nenhuma tabela do funil.
REVOKE ALL ON public.operacoes_formalizacao              FROM anon;
REVOKE ALL ON public.operacoes_formalizacao_checklist    FROM anon;
REVOKE ALL ON public.operacoes_formalizacao_signatarios  FROM anon;
REVOKE ALL ON public.operacoes_formalizacao_pessoas      FROM anon;
REVOKE ALL ON public.operacoes_formalizacao_historico    FROM anon;
REVOKE ALL ON public.operacoes_formalizacao_sla          FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.operacoes_formalizacao             TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.operacoes_formalizacao_checklist   TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.operacoes_formalizacao_signatarios TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.operacoes_formalizacao_pessoas     TO authenticated;
-- Histórico é append-only: sem UPDATE nem DELETE, nem para admin.
GRANT SELECT, INSERT ON public.operacoes_formalizacao_historico TO authenticated;
GRANT SELECT, UPDATE ON public.operacoes_formalizacao_sla       TO authenticated;

GRANT ALL ON public.operacoes_formalizacao              TO service_role;
GRANT ALL ON public.operacoes_formalizacao_checklist    TO service_role;
GRANT ALL ON public.operacoes_formalizacao_signatarios  TO service_role;
GRANT ALL ON public.operacoes_formalizacao_pessoas      TO service_role;
GRANT ALL ON public.operacoes_formalizacao_historico    TO service_role;
GRANT ALL ON public.operacoes_formalizacao_sla          TO service_role;
