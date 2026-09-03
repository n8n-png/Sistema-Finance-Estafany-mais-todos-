
-- Enum de papéis
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Tabela de papéis
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Função has_role (security definer, evita recursão)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Policies user_roles
CREATE POLICY "Usuários veem seus próprios papéis"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins gerenciam papéis"
  ON public.user_roles FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Trigger updated_at compartilhado
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Tabela de clientes/limites
CREATE TABLE public.clientes_limites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  socios text,
  cnpj text NOT NULL,
  unidade text,
  grupo text,
  status_operacoes text,
  total_com_carencia numeric(18,2) DEFAULT 0,
  total_sem_carencia numeric(18,2) DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.clientes_limites TO authenticated;
GRANT ALL ON public.clientes_limites TO service_role;

ALTER TABLE public.clientes_limites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários autenticados podem consultar limites"
  ON public.clientes_limites FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins inserem limites"
  ON public.clientes_limites FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins atualizam limites"
  ON public.clientes_limites FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins removem limites"
  ON public.clientes_limites FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_clientes_limites_cnpj ON public.clientes_limites (cnpj);
CREATE INDEX idx_clientes_limites_unidade ON public.clientes_limites (unidade);
CREATE INDEX idx_clientes_limites_grupo ON public.clientes_limites (grupo);

CREATE TRIGGER trg_clientes_limites_updated_at
  BEFORE UPDATE ON public.clientes_limites
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Tabela de histórico de importações
CREATE TABLE public.import_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  imported_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  imported_by_email text,
  row_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.import_history TO authenticated;
GRANT ALL ON public.import_history TO service_role;

ALTER TABLE public.import_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins veem histórico"
  ON public.import_history FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins registram histórico"
  ON public.import_history FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') AND auth.uid() = imported_by);
