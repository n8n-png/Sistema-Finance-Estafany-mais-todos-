
CREATE TABLE public.operacoes_overrides (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cnpj text NOT NULL,
  id_valora text,
  seu_numero text,
  carencia_meses integer NOT NULL DEFAULT 0,
  carencia_tipo text NOT NULL DEFAULT 'principal' CHECK (carencia_tipo IN ('principal','total')),
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX operacoes_overrides_key
  ON public.operacoes_overrides (cnpj, COALESCE(id_valora,''), COALESCE(seu_numero,''));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.operacoes_overrides TO authenticated;
GRANT ALL ON public.operacoes_overrides TO service_role;

ALTER TABLE public.operacoes_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados leem overrides"
  ON public.operacoes_overrides FOR SELECT TO authenticated USING (true);
CREATE POLICY "Autenticados inserem overrides"
  ON public.operacoes_overrides FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Autenticados atualizam overrides"
  ON public.operacoes_overrides FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Admins removem overrides"
  ON public.operacoes_overrides FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER operacoes_overrides_updated_at
  BEFORE UPDATE ON public.operacoes_overrides
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


CREATE TABLE public.operacoes_parcelas_manuais (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cnpj text NOT NULL,
  id_valora text,
  seu_numero text,
  month integer NOT NULL,
  due_date date,
  actual_payment numeric NOT NULL DEFAULT 0,
  note text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX operacoes_parcelas_manuais_key
  ON public.operacoes_parcelas_manuais (cnpj, COALESCE(id_valora,''), COALESCE(seu_numero,''), month);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.operacoes_parcelas_manuais TO authenticated;
GRANT ALL ON public.operacoes_parcelas_manuais TO service_role;

ALTER TABLE public.operacoes_parcelas_manuais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados leem parcelas manuais"
  ON public.operacoes_parcelas_manuais FOR SELECT TO authenticated USING (true);
CREATE POLICY "Autenticados inserem parcelas manuais"
  ON public.operacoes_parcelas_manuais FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Autenticados atualizam parcelas manuais"
  ON public.operacoes_parcelas_manuais FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Autenticados removem parcelas manuais"
  ON public.operacoes_parcelas_manuais FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

CREATE TRIGGER operacoes_parcelas_manuais_updated_at
  BEFORE UPDATE ON public.operacoes_parcelas_manuais
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
