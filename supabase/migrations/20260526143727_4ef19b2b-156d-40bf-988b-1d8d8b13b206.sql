DROP POLICY IF EXISTS "Admins gerenciam papéis" ON public.user_roles;

ALTER POLICY "Admins inserem limites"
ON public.clientes_limites
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'admin'::public.app_role
  )
);

ALTER POLICY "Admins atualizam limites"
ON public.clientes_limites
USING (
  EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'admin'::public.app_role
  )
);

ALTER POLICY "Admins removem limites"
ON public.clientes_limites
USING (
  EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'admin'::public.app_role
  )
);

ALTER POLICY "Admins registram histórico"
ON public.import_history
WITH CHECK (
  auth.uid() = imported_by
  AND EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'admin'::public.app_role
  )
);

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM authenticated;