CREATE POLICY "Autenticados veem última atualização"
ON public.import_history
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Admins veem histórico" ON public.import_history;