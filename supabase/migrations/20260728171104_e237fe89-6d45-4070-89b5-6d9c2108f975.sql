
-- ============ operacoes_snapshots ============
CREATE TABLE public.operacoes_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  import_id UUID NOT NULL REFERENCES public.operacoes_import_history(id) ON DELETE CASCADE,
  cnpj TEXT NOT NULL,
  id_valora TEXT,
  seu_numero TEXT,
  nosso_numero TEXT,
  franquia TEXT,
  tipo_op TEXT,
  total_parcelas INTEGER,
  parcela_atual INTEGER,
  valor_parcela NUMERIC DEFAULT 0,
  valor_operacao NUMERIC DEFAULT 0,
  saldo_devedor NUMERIC DEFAULT 0,
  total_pago NUMERIC DEFAULT 0,
  data_vencimento_atual DATE,
  data_aquisicao DATE,
  data_emissao DATE,
  primeiro_vencimento DATE,
  ultimo_vencimento DATE,
  taxa_op NUMERIC,
  refin_aditivo TEXT,
  carencia_principal INTEGER,
  raw JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_snap_import ON public.operacoes_snapshots(import_id);
CREATE INDEX ix_snap_id_valora ON public.operacoes_snapshots(id_valora);
CREATE INDEX ix_snap_cnpj_seunum ON public.operacoes_snapshots(cnpj, seu_numero);

GRANT SELECT ON public.operacoes_snapshots TO authenticated;
GRANT ALL ON public.operacoes_snapshots TO service_role;
ALTER TABLE public.operacoes_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados leem snapshots"
  ON public.operacoes_snapshots FOR SELECT
  TO authenticated USING (true);
CREATE POLICY "Admins inserem snapshots"
  ON public.operacoes_snapshots FOR INSERT
  TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins atualizam snapshots"
  ON public.operacoes_snapshots FOR UPDATE
  TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins removem snapshots"
  ON public.operacoes_snapshots FOR DELETE
  TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

-- ============ operacoes_projecoes ============
CREATE TABLE public.operacoes_projecoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  import_id UUID NOT NULL REFERENCES public.operacoes_import_history(id) ON DELETE CASCADE,
  cnpj TEXT NOT NULL,
  id_valora TEXT,
  seu_numero TEXT,
  month INTEGER NOT NULL,
  due_date DATE,
  projected_payment NUMERIC NOT NULL DEFAULT 0,
  projected_interest NUMERIC DEFAULT 0,
  projected_amortization NUMERIC DEFAULT 0,
  projected_balance NUMERIC DEFAULT 0,
  taxa_mensal NUMERIC,
  cdi_aa NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (import_id, cnpj, seu_numero, month)
);
CREATE INDEX ix_proj_lookup ON public.operacoes_projecoes(id_valora, month);
CREATE INDEX ix_proj_cnpj_seu ON public.operacoes_projecoes(cnpj, seu_numero, month);

GRANT SELECT ON public.operacoes_projecoes TO authenticated;
GRANT ALL ON public.operacoes_projecoes TO service_role;
ALTER TABLE public.operacoes_projecoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados leem projecoes"
  ON public.operacoes_projecoes FOR SELECT
  TO authenticated USING (true);
-- Escrita apenas via service_role (edge function).

-- ============ operacoes_divergencias ============
CREATE TABLE public.operacoes_divergencias (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cnpj TEXT NOT NULL,
  id_valora TEXT,
  seu_numero TEXT,
  month INTEGER NOT NULL,
  due_date DATE,
  projected_payment NUMERIC NOT NULL DEFAULT 0,
  actual_payment NUMERIC NOT NULL DEFAULT 0,
  diff NUMERIC NOT NULL DEFAULT 0,
  diff_pct NUMERIC,
  import_id_projected UUID REFERENCES public.operacoes_import_history(id) ON DELETE SET NULL,
  import_id_actual UUID REFERENCES public.operacoes_import_history(id) ON DELETE SET NULL,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (id_valora, cnpj, seu_numero, month, import_id_actual)
);
CREATE INDEX ix_div_lookup ON public.operacoes_divergencias(id_valora);
CREATE INDEX ix_div_cnpj_seu ON public.operacoes_divergencias(cnpj, seu_numero);

GRANT SELECT ON public.operacoes_divergencias TO authenticated;
GRANT ALL ON public.operacoes_divergencias TO service_role;
ALTER TABLE public.operacoes_divergencias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados leem divergencias"
  ON public.operacoes_divergencias FOR SELECT
  TO authenticated USING (true);
-- Escrita apenas via service_role.
