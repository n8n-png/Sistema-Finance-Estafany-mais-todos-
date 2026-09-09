-- ============================================================================
-- Story 3.9 — Vários documentos por item de checklist
--
-- Pedido da Lavínia em 06/09/2026, a partir de um caso real:
--
-- > *"seria interessante se tivéssemos a opção de adicionar mais documentos no
-- > 'Documento de identificação dos representantes legais / avalistas — e caso
-- > aplicável, dos cônjuges + certidão de casamento'... Pensei agora porque
-- > estou fazendo uma operação com 3 RL com 3 Outorgas"*
--
-- O modelo atual permite **um** arquivo por item (`anexo_path` singular). Vários
-- itens do checklist são inerentemente plurais: identificação de cada
-- representante legal, outorga de cada cônjuge, certidão de cada casamento. Uma
-- operação com 3 representantes precisa de 3 documentos no mesmo item.
--
-- O que acontecia sem isso: cada envio sobrescrevia o anterior no campo, e o
-- operador teria que juntar tudo num PDF só fora do sistema — perdendo a
-- identificação de qual documento é de quem.
--
-- ## Sobre a sugestão do arquivo zipado
--
-- A Lavínia sugeriu, como alternativa, "anexar todos e virar um arquivo zipado".
-- Adotamos a lista em vez do zip, por três motivos:
--
-- 1. Zip guardado é caixa preta: ninguém vê o que tem dentro sem baixar e
--    descompactar, e não dá para conferir documento por documento.
-- 2. Substituir um único documento exigiria refazer o pacote inteiro.
-- 3. O fundo precisa abrir documentos específicos, não o conjunto.
--
-- O zip continua fazendo sentido — mas na **saída**, ao baixar tudo de uma vez,
-- e não no armazenamento. Isso fica na interface, não no banco.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Anexos como tabela própria
-- ----------------------------------------------------------------------------

CREATE TABLE public.operacoes_formalizacao_anexos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Redundância deliberada: o anexo pertence a um item, mas guardar também a
  -- operação evita um JOIN em toda verificação de permissão — e é a operação
  -- que define quem pode ver o quê.
  operacao_id uuid NOT NULL REFERENCES public.operacoes_formalizacao(id) ON DELETE CASCADE,
  item_checklist_id uuid NOT NULL REFERENCES public.operacoes_formalizacao_checklist(id) ON DELETE CASCADE,

  -- Nome dado pela pessoa, ex.: "RG do João", "Outorga da Maria".
  -- É o que resolve o problema de saber de quem é cada documento.
  descricao text,

  nome_arquivo text NOT NULL,
  path text NOT NULL UNIQUE,
  tamanho integer CHECK (tamanho IS NULL OR tamanho >= 0),
  tipo text,

  enviado_em timestamptz NOT NULL DEFAULT now(),
  enviado_por uuid REFERENCES auth.users(id)
);

COMMENT ON TABLE public.operacoes_formalizacao_anexos IS
  'Documentos anexados aos itens do checklist. Vários por item: uma operação com 3 representantes legais tem 3 identificações no mesmo item.';
COMMENT ON COLUMN public.operacoes_formalizacao_anexos.descricao IS
  'Identifica o documento dentro do item, ex.: "Outorga da Maria". Sem isso, 3 arquivos no mesmo item viram um enigma.';

CREATE INDEX idx_form_anexos_item ON public.operacoes_formalizacao_anexos (item_checklist_id);
CREATE INDEX idx_form_anexos_operacao ON public.operacoes_formalizacao_anexos (operacao_id);

-- ----------------------------------------------------------------------------
-- 2) As colunas de anexo saem do item de checklist
--
--    Podem ser removidas sem migração de dados porque o banco ainda não subiu:
--    nenhuma operação existe, nenhum arquivo foi enviado. Fazer isso agora é
--    muito mais barato do que conviver com dois lugares guardando anexo.
-- ----------------------------------------------------------------------------

ALTER TABLE public.operacoes_formalizacao_checklist
  DROP COLUMN anexo_nome,
  DROP COLUMN anexo_path,
  DROP COLUMN anexo_tamanho,
  DROP COLUMN anexo_tipo,
  DROP COLUMN anexo_enviado_em,
  DROP COLUMN anexo_enviado_por;

-- ----------------------------------------------------------------------------
-- 3) `checked` acompanha os anexos automaticamente
--
--    Item com documento anexado está atendido; item que ficou sem nenhum volta a
--    pendente. Deixar isso na aplicação seria abrir espaço para o checklist
--    dizer que está completo quando não está — e é ele que o fundo usa para
--    decidir se a documentação está em ordem.
--
--    A marcação manual continua possível: nem todo item exige arquivo.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.item_checklist_sincroniza_checked()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_item uuid := COALESCE(NEW.item_checklist_id, OLD.item_checklist_id);
  v_total integer;
BEGIN
  SELECT count(*) INTO v_total
    FROM public.operacoes_formalizacao_anexos
   WHERE item_checklist_id = v_item;

  IF v_total > 0 THEN
    UPDATE public.operacoes_formalizacao_checklist
       SET checked = true, pendente = false
     WHERE id = v_item AND checked = false;
  ELSE
    -- Só desmarca o que havia sido marcado por causa de anexo. Item marcado à
    -- mão, sem nunca ter tido arquivo, não é afetado.
    UPDATE public.operacoes_formalizacao_checklist
       SET checked = false
     WHERE id = v_item AND checked = true;
  END IF;

  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_anexo_sincroniza_checked
  AFTER INSERT OR DELETE ON public.operacoes_formalizacao_anexos
  FOR EACH ROW EXECUTE FUNCTION public.item_checklist_sincroniza_checked();

-- ----------------------------------------------------------------------------
-- 4) Acesso — herda a permissão da operação, como todo o resto do funil
-- ----------------------------------------------------------------------------

ALTER TABLE public.operacoes_formalizacao_anexos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.operacoes_formalizacao_anexos FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.operacoes_formalizacao_anexos TO authenticated;
GRANT ALL ON public.operacoes_formalizacao_anexos TO service_role;

CREATE POLICY "Ver anexos da operação"
  ON public.operacoes_formalizacao_anexos FOR SELECT TO authenticated
  USING (public.pode_ver_operacao(auth.uid(), operacao_id));

CREATE POLICY "Enviar anexos da operação"
  ON public.operacoes_formalizacao_anexos FOR INSERT TO authenticated
  WITH CHECK (public.pode_editar_operacao(auth.uid(), operacao_id));

-- Só a descrição é editável depois de enviado: corrigir "Outorga da Maria" para
-- "Outorga da Maria Silva" é rotina. Trocar o arquivo por baixo do mesmo
-- registro, não — para isso, remove-se e envia-se de novo, e o histórico mostra.
CREATE POLICY "Renomear anexos da operação"
  ON public.operacoes_formalizacao_anexos FOR UPDATE TO authenticated
  USING (public.pode_editar_operacao(auth.uid(), operacao_id))
  WITH CHECK (public.pode_editar_operacao(auth.uid(), operacao_id));

CREATE POLICY "Remover anexos da operação"
  ON public.operacoes_formalizacao_anexos FOR DELETE TO authenticated
  USING (public.pode_editar_operacao(auth.uid(), operacao_id));
