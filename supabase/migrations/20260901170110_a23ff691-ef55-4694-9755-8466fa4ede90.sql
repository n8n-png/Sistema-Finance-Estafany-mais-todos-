ALTER TABLE public.staging_parcelas ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.staging_parcelas FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.staging_parcelas TO authenticated;
GRANT ALL ON public.staging_parcelas TO service_role;

CREATE POLICY "Admins can select staging_parcelas" ON public.staging_parcelas
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can insert staging_parcelas" ON public.staging_parcelas
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update staging_parcelas" ON public.staging_parcelas
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete staging_parcelas" ON public.staging_parcelas
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));