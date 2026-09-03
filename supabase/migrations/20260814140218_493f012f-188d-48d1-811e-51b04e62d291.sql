CREATE TABLE public.user_page_access (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  page_key text NOT NULL,
  granted_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, page_key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_page_access TO authenticated;
GRANT ALL ON public.user_page_access TO service_role;

ALTER TABLE public.user_page_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários veem seus próprios acessos"
ON public.user_page_access FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins inserem acessos"
ON public.user_page_access FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins atualizam acessos"
ON public.user_page_access FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins removem acessos"
ON public.user_page_access FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_user_page_access_user ON public.user_page_access(user_id);

INSERT INTO public.user_page_access (user_id, page_key)
SELECT u.id, p.page_key
FROM auth.users u
CROSS JOIN (VALUES
  ('qia'), ('recebiveis'), ('amor_saude'), ('expansao_amor_saude'),
  ('limites'), ('ativos'), ('central_documentos')
) AS p(page_key)
ON CONFLICT (user_id, page_key) DO NOTHING;