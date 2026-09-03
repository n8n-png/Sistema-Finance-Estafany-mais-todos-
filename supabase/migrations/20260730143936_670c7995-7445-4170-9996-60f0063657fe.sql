
CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id)
$$;

-- operacoes_ativas
DROP POLICY IF EXISTS "Autenticados consultam operações ativas" ON public.operacoes_ativas;
CREATE POLICY "Staff consultam operações ativas" ON public.operacoes_ativas
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

-- operacoes_snapshots
DROP POLICY IF EXISTS "Autenticados leem snapshots" ON public.operacoes_snapshots;
CREATE POLICY "Staff leem snapshots" ON public.operacoes_snapshots
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

-- operacoes_projecoes
DROP POLICY IF EXISTS "Autenticados leem projecoes" ON public.operacoes_projecoes;
CREATE POLICY "Staff leem projecoes" ON public.operacoes_projecoes
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

-- operacoes_divergencias
DROP POLICY IF EXISTS "Autenticados leem divergencias" ON public.operacoes_divergencias;
CREATE POLICY "Staff leem divergencias" ON public.operacoes_divergencias
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

-- operacoes_checklists
DROP POLICY IF EXISTS "Autenticados leem checklists" ON public.operacoes_checklists;
DROP POLICY IF EXISTS "Autenticados inserem checklists" ON public.operacoes_checklists;
DROP POLICY IF EXISTS "Autenticados atualizam checklists" ON public.operacoes_checklists;
DROP POLICY IF EXISTS "Autenticados removem checklists" ON public.operacoes_checklists;
CREATE POLICY "Staff leem checklists" ON public.operacoes_checklists
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Staff inserem checklists" ON public.operacoes_checklists
  FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()) AND created_by = auth.uid());
CREATE POLICY "Staff atualizam checklists" ON public.operacoes_checklists
  FOR UPDATE TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Admins removem checklists" ON public.operacoes_checklists
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

-- operacoes_overrides
DROP POLICY IF EXISTS "Autenticados leem overrides" ON public.operacoes_overrides;
DROP POLICY IF EXISTS "Autenticados inserem overrides" ON public.operacoes_overrides;
DROP POLICY IF EXISTS "Autenticados atualizam overrides" ON public.operacoes_overrides;
CREATE POLICY "Staff leem overrides" ON public.operacoes_overrides
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Staff inserem overrides" ON public.operacoes_overrides
  FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Staff atualizam overrides" ON public.operacoes_overrides
  FOR UPDATE TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- operacoes_parcelas_manuais
DROP POLICY IF EXISTS "Autenticados leem parcelas manuais" ON public.operacoes_parcelas_manuais;
DROP POLICY IF EXISTS "Autenticados inserem parcelas manuais" ON public.operacoes_parcelas_manuais;
DROP POLICY IF EXISTS "Autenticados atualizam parcelas manuais" ON public.operacoes_parcelas_manuais;
DROP POLICY IF EXISTS "Autenticados removem parcelas manuais" ON public.operacoes_parcelas_manuais;
CREATE POLICY "Staff leem parcelas manuais" ON public.operacoes_parcelas_manuais
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Staff inserem parcelas manuais" ON public.operacoes_parcelas_manuais
  FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()) AND created_by = auth.uid());
CREATE POLICY "Staff atualizam parcelas manuais" ON public.operacoes_parcelas_manuais
  FOR UPDATE TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Admins removem parcelas manuais" ON public.operacoes_parcelas_manuais
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
