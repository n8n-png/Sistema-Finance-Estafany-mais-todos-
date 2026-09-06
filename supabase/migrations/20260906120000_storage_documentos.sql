-- ============================================================================
-- Story 3.4 — Armazenamento dos documentos da operação
--
-- Decidido com a área em 04/09: *"como vamos utilizar o próprio painel como
-- armazenador de doc, não utilizaremos mais esse campo [link para o SharePoint].
-- Atualmente copio o link da pasta e anexo aí para ter histórico."*
--
-- O SharePoint continua existindo com o histórico antigo — não há integração a
-- fazer, é coexistência. Daqui para frente o documento vive no painel.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Bucket privado
--
--    Privado, não público: são documentos de crédito com CNPJ, contrato social,
--    imposto de renda de sócios e identificação de avalistas. Bucket público
--    entregaria qualquer um deles a quem descobrisse a URL.
-- ----------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'operacoes-documentos',
  'operacoes-documentos',
  false,
  52428800, -- 50 MB
  ARRAY[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/msword',
    'application/vnd.ms-excel'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 2) Permissão de acesso aos arquivos
--
--    Convenção de caminho: {operacao_id}/{nome-do-arquivo}
--
--    O primeiro segmento ser o id da operação não é organização — é o que
--    permite reaproveitar exatamente a mesma matriz de permissão por etapa que
--    protege a operação. Sem essa convenção, seria preciso uma segunda regra de
--    acesso, que inevitavelmente divergiria da primeira.
--
--    Consequência prática: o time do fundo enxerga os documentos das operações
--    que lhe cabem, e apenas deles.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.operacao_do_arquivo(caminho text)
RETURNS uuid
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN (storage.foldername(caminho))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      THEN ((storage.foldername(caminho))[1])::uuid
    ELSE NULL
  END
$$;

COMMENT ON FUNCTION public.operacao_do_arquivo(text) IS
  'Extrai o id da operação do caminho do arquivo ({operacao_id}/{arquivo}). Devolve NULL se o caminho não seguir a convenção — e nesse caso nenhuma policy concede acesso.';

-- Leitura: quem pode ver a operação pode baixar os documentos dela.
CREATE POLICY "Ver documentos das operações permitidas"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'operacoes-documentos'
    AND public.operacao_do_arquivo(name) IS NOT NULL
    AND public.pode_ver_operacao(auth.uid(), public.operacao_do_arquivo(name))
  );

-- Envio: exige permissão de edição — acompanhar a operação não dá direito de
-- alterar a documentação dela.
CREATE POLICY "Enviar documentos das operações permitidas"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'operacoes-documentos'
    AND public.operacao_do_arquivo(name) IS NOT NULL
    AND public.pode_editar_operacao(auth.uid(), public.operacao_do_arquivo(name))
  );

CREATE POLICY "Substituir documentos das operações permitidas"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'operacoes-documentos'
    AND public.operacao_do_arquivo(name) IS NOT NULL
    AND public.pode_editar_operacao(auth.uid(), public.operacao_do_arquivo(name))
  );

-- Remoção: só administrador. Documento de operação de crédito apagado por
-- engano não tem de onde voltar.
CREATE POLICY "Admins removem documentos"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'operacoes-documentos'
    AND public.has_role(auth.uid(), 'admin')
  );

-- ----------------------------------------------------------------------------
-- 3) Metadados do anexo no item de checklist
--
--    `anexo_path` já existia (migration 20260903120000). Os campos abaixo
--    completam o registro para a interface conseguir listar sem consultar o
--    Storage a cada renderização.
-- ----------------------------------------------------------------------------

ALTER TABLE public.operacoes_formalizacao_checklist
  ADD COLUMN anexo_tamanho integer CHECK (anexo_tamanho IS NULL OR anexo_tamanho >= 0),
  ADD COLUMN anexo_tipo text,
  ADD COLUMN anexo_enviado_em timestamptz,
  ADD COLUMN anexo_enviado_por uuid REFERENCES auth.users(id);

COMMENT ON COLUMN public.operacoes_formalizacao_checklist.anexo_path IS
  'Caminho no bucket operacoes-documentos, no formato {operacao_id}/{arquivo}.';
