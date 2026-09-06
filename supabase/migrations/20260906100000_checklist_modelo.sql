-- ============================================================================
-- Modelo de checklist documental por linha de crédito
--
-- Necessário para a Story 4.1: quando o sync do HubSpot cria uma operação, o
-- checklist precisa nascer com ela — e a lista de documentos **depende da linha
-- de crédito**. É por isso que classificar a linha errado é pior do que não
-- importar: o fundo receberia a operação pedindo os documentos errados.
--
-- As listas vêm de `src/utils/checklistSchema.ts` (AS_DOCS e CDT_DOCS), que hoje
-- alimentam a Central de Documentos. Ficam no banco para que a área possa
-- ajustá-las sem depender de nova versão do sistema.
-- ============================================================================

CREATE TABLE public.operacoes_formalizacao_checklist_modelo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  linha public.linha_credito NOT NULL,
  ordem smallint NOT NULL,
  label text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id),
  UNIQUE (linha, ordem)
);

COMMENT ON TABLE public.operacoes_formalizacao_checklist_modelo IS
  'Documentos exigidos por linha de crédito. Base do checklist criado a cada operação nova.';

CREATE TRIGGER trg_form_checklist_modelo_updated_at
  BEFORE UPDATE ON public.operacoes_formalizacao_checklist_modelo
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ----------------------------------------------------------------------------
-- QIA — lista CDT (9 documentos)
-- ----------------------------------------------------------------------------

INSERT INTO public.operacoes_formalizacao_checklist_modelo (linha, ordem, label) VALUES
  ('QIA', 1, 'Quantidade de famílias atendidas com histórico de entrada e saída dos últimos 12 meses'),
  ('QIA', 2, 'Contrato / Estatuto Social / Atas / Eleição da Diretoria'),
  ('QIA', 3, 'Cartão CNPJ'),
  ('QIA', 4, 'Contrato da franquia'),
  ('QIA', 5, 'Carta Bacen'),
  ('QIA', 6, 'Relação de matrículas dos afiliados (com valores)'),
  ('QIA', 7, 'IR dos sócios'),
  ('QIA', 8, 'Histórico de repasse mensal dos últimos 24 meses + comprovante de TED + comprovante de repasse'),
  ('QIA', 9, 'Documento de identificação dos representantes legais / avalistas — e caso aplicável, dos cônjuges + certidão de casamento');

-- ----------------------------------------------------------------------------
-- Amor Saúde e Visão de Todos — lista AS (6 documentos)
-- ----------------------------------------------------------------------------

INSERT INTO public.operacoes_formalizacao_checklist_modelo (linha, ordem, label) VALUES
  ('Amor Saúde', 1, 'Contrato / Estatuto Social / Atas / Eleição da Diretoria'),
  ('Amor Saúde', 2, 'Cartão CNPJ'),
  ('Amor Saúde', 3, 'Carta Bacen'),
  ('Amor Saúde', 4, 'Extrato de recebíveis dos últimos 12 meses com valores e comprovantes'),
  ('Amor Saúde', 5, 'IR dos sócios'),
  ('Amor Saúde', 6, 'Documento de identificação dos representantes legais / avalistas — e caso aplicável, dos cônjuges + certidão de casamento');

INSERT INTO public.operacoes_formalizacao_checklist_modelo (linha, ordem, label) VALUES
  ('Visão de Todos', 1, 'Contrato / Estatuto Social / Atas / Eleição da Diretoria'),
  ('Visão de Todos', 2, 'Cartão CNPJ'),
  ('Visão de Todos', 3, 'Carta Bacen'),
  ('Visão de Todos', 4, 'Extrato de recebíveis dos últimos 12 meses com valores e comprovantes'),
  ('Visão de Todos', 5, 'IR dos sócios'),
  ('Visão de Todos', 6, 'Documento de identificação dos representantes legais / avalistas — e caso aplicável, dos cônjuges + certidão de casamento');

-- ----------------------------------------------------------------------------
-- Acesso
-- ----------------------------------------------------------------------------

ALTER TABLE public.operacoes_formalizacao_checklist_modelo ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.operacoes_formalizacao_checklist_modelo FROM anon;
GRANT SELECT ON public.operacoes_formalizacao_checklist_modelo TO authenticated;
GRANT ALL ON public.operacoes_formalizacao_checklist_modelo TO service_role;

-- A lista de documentos exigidos não é sigilosa e a interface precisa dela para
-- montar telas. A escrita fica com admin.
CREATE POLICY "Autenticados leem o modelo de checklist"
  ON public.operacoes_formalizacao_checklist_modelo FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins ajustam o modelo de checklist"
  ON public.operacoes_formalizacao_checklist_modelo FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
