-- 1) Convert has_role to SECURITY INVOKER so it does not bypass RLS,
--    and restrict EXECUTE to authenticated only (removed from PUBLIC/anon).
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO service_role;

-- 2) Explicit deny policies on user_roles for INSERT/UPDATE/DELETE.
--    Role assignments must be performed only via service_role (edge functions).
CREATE POLICY "Bloquear inserção de papéis por usuários"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (false);

CREATE POLICY "Bloquear atualização de papéis por usuários"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (false)
WITH CHECK (false);

CREATE POLICY "Bloquear remoção de papéis por usuários"
ON public.user_roles
FOR DELETE
TO authenticated
USING (false);