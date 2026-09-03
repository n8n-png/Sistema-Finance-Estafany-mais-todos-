CREATE TABLE public.indicadores_manuais_mensais (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  mes date NOT NULL UNIQUE,
  quantidade_propostas integer NOT NULL DEFAULT 0,
  valor_operacoes_valora numeric NOT NULL DEFAULT 0,
  quantidade_operacoes_valora integer NOT NULL DEFAULT 0,
  valor_operacoes_xvi numeric NOT NULL DEFAULT 0,
  quantidade_operacoes_xvi integer NOT NULL DEFAULT 0,
  updated_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.indicadores_manuais_mensais TO authenticated;
GRANT ALL ON public.indicadores_manuais_mensais TO service_role;

ALTER TABLE public.indicadores_manuais_mensais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff leem indicadores manuais" ON public.indicadores_manuais_mensais
FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

CREATE POLICY "Admins inserem indicadores manuais" ON public.indicadores_manuais_mensais
FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins atualizam indicadores manuais" ON public.indicadores_manuais_mensais
FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins removem indicadores manuais" ON public.indicadores_manuais_mensais
FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_indicadores_manuais_updated_at
BEFORE UPDATE ON public.indicadores_manuais_mensais
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();