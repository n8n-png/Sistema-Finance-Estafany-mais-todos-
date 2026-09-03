
DROP POLICY IF EXISTS "Usuários autenticados podem consultar limites" ON public.clientes_limites;
CREATE POLICY "Admins consultam limites" ON public.clientes_limites
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Autenticados veem última atualização" ON public.import_history;
CREATE POLICY "Admins veem histórico de importação" ON public.import_history
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
