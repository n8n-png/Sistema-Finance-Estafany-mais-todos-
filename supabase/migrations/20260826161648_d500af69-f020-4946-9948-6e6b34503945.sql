CREATE TABLE public.clientes_pre_aprovados (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cnpj text NOT NULL,
  produto text,
  limite numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.clientes_pre_aprovados TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.clientes_pre_aprovados TO authenticated;
GRANT ALL ON public.clientes_pre_aprovados TO service_role;

ALTER TABLE public.clientes_pre_aprovados ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX clientes_pre_aprovados_cnpj_key ON public.clientes_pre_aprovados (cnpj);

CREATE POLICY "Autenticados leem pre aprovados"
  ON public.clientes_pre_aprovados FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins inserem pre aprovados"
  ON public.clientes_pre_aprovados FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins atualizam pre aprovados"
  ON public.clientes_pre_aprovados FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins removem pre aprovados"
  ON public.clientes_pre_aprovados FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));