CREATE TABLE public.operacoes_ativas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  franquia text,
  cnpj text NOT NULL,
  data_aquisicao date,
  data_emissao date,
  valor_operacao numeric DEFAULT 0,
  primeiro_vencimento date,
  ultimo_vencimento date,
  total_parcelas integer,
  parcela_atual integer,
  valor_parcela numeric DEFAULT 0,
  data_vencimento_atual date,
  total_pago numeric DEFAULT 0,
  saldo_devedor numeric DEFAULT 0,
  seu_numero text,
  id_valora text,
  nosso_numero text,
  tipo_op text,
  taxa_op numeric,
  refin_aditivo text,
  carencia_principal integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_operacoes_ativas_cnpj ON public.operacoes_ativas(cnpj);
CREATE INDEX idx_operacoes_ativas_id_valora ON public.operacoes_ativas(id_valora);
CREATE INDEX idx_operacoes_ativas_seu_numero ON public.operacoes_ativas(seu_numero);
CREATE INDEX idx_operacoes_ativas_venc_atual ON public.operacoes_ativas(data_vencimento_atual);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.operacoes_ativas TO authenticated;
GRANT ALL ON public.operacoes_ativas TO service_role;

ALTER TABLE public.operacoes_ativas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados consultam operações ativas"
  ON public.operacoes_ativas FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins inserem operações ativas"
  ON public.operacoes_ativas FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins atualizam operações ativas"
  ON public.operacoes_ativas FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins removem operações ativas"
  ON public.operacoes_ativas FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_operacoes_ativas_updated_at
  BEFORE UPDATE ON public.operacoes_ativas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.operacoes_import_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  imported_by uuid,
  imported_by_email text,
  row_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.operacoes_import_history TO authenticated;
GRANT ALL ON public.operacoes_import_history TO service_role;

ALTER TABLE public.operacoes_import_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins veem histórico de importação de operações"
  ON public.operacoes_import_history FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins registram histórico de operações"
  ON public.operacoes_import_history FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = imported_by
    AND has_role(auth.uid(), 'admin'::app_role)
  );