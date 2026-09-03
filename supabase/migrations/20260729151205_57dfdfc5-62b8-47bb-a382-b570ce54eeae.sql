CREATE TABLE public.operacoes_checklists (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  estabelecimento_cnpj text NOT NULL,
  operacao_id text,
  checklist_type text NOT NULL CHECK (checklist_type IN ('as','cdt')),
  items_state jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX operacoes_checklists_unique_key
  ON public.operacoes_checklists (estabelecimento_cnpj, COALESCE(operacao_id, ''), checklist_type);

CREATE INDEX operacoes_checklists_cnpj_idx ON public.operacoes_checklists (estabelecimento_cnpj);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.operacoes_checklists TO authenticated;
GRANT ALL ON public.operacoes_checklists TO service_role;

ALTER TABLE public.operacoes_checklists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados leem checklists"
  ON public.operacoes_checklists FOR SELECT
  TO authenticated USING (auth.uid() IS NOT NULL);

CREATE POLICY "Autenticados inserem checklists"
  ON public.operacoes_checklists FOR INSERT
  TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Autenticados atualizam checklists"
  ON public.operacoes_checklists FOR UPDATE
  TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Autenticados removem checklists"
  ON public.operacoes_checklists FOR DELETE
  TO authenticated USING (auth.uid() IS NOT NULL);

CREATE TRIGGER update_operacoes_checklists_updated_at
  BEFORE UPDATE ON public.operacoes_checklists
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();