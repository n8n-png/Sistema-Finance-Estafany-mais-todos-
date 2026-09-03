-- ============================================================================
-- Story 3.2 — Matriz de permissões por etapa e RLS do funil
--
-- Implementa no banco a matriz que a Lavínia esboçou no protótipo: quem vê e
-- quem edita, POR ETAPA. É o que permite dar acesso ao time do fundo (Valora)
-- sem expor o resto da esteira — e sem depender do front-end esconder o menu.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Matriz de acesso por etapa
--
--    Regra de interpretação (importante):
--      • admin                          → vê e edita tudo
--      • sem linha nesta tabela         → usuário interno irrestrito: vê e edita
--                                          todas as etapas, desde que tenha a
--                                          page_key 'operacoes_valora'
--      • com pelo menos uma linha       → usuário restrito: vê e edita SOMENTE
--                                          o que estiver marcado aqui
--
--    Ou seja: cadastrar a primeira linha para um usuário o transforma em
--    restrito. É assim que o time da Valora entra — e é obrigatório configurar
--    essas linhas ANTES de conceder acesso a qualquer usuário externo.
-- ----------------------------------------------------------------------------

CREATE TABLE public.user_etapas_acesso (
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  etapa       public.etapa_formalizacao NOT NULL,
  pode_ver    boolean NOT NULL DEFAULT true,
  pode_editar boolean NOT NULL DEFAULT false,
  granted_by  uuid REFERENCES auth.users(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, etapa),
  -- Não faz sentido poder editar sem poder ver.
  CONSTRAINT user_etapas_acesso_coerente CHECK (pode_ver OR NOT pode_editar)
);

COMMENT ON TABLE public.user_etapas_acesso IS
  'Matriz de permissão por etapa do funil. Usuário SEM linhas aqui é irrestrito; COM linhas é restrito ao que está marcado.';

ALTER TABLE public.user_etapas_acesso ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.user_etapas_acesso FROM anon;
GRANT SELECT ON public.user_etapas_acesso TO authenticated;
GRANT ALL ON public.user_etapas_acesso TO service_role;

CREATE POLICY "Usuários veem suas próprias etapas"
  ON public.user_etapas_acesso FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- Concessão de permissão é operação sensível: só por service_role (edge function
-- do painel administrativo), nunca direto pelo cliente.
CREATE POLICY "Bloquear inserção de etapas por usuários"
  ON public.user_etapas_acesso FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY "Bloquear atualização de etapas por usuários"
  ON public.user_etapas_acesso FOR UPDATE TO authenticated USING (false);
CREATE POLICY "Bloquear remoção de etapas por usuários"
  ON public.user_etapas_acesso FOR DELETE TO authenticated USING (false);

-- ----------------------------------------------------------------------------
-- 2) Funções de decisão
--
--    SECURITY INVOKER de propósito: as tabelas consultadas (user_roles,
--    user_page_access, user_etapas_acesso) já têm policy que deixa o usuário
--    ler as próprias linhas. Usar DEFINER aqui abriria um bypass de RLS sem
--    necessidade. Não há recursão: nenhuma dessas tabelas referencia o funil.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.pode_ver_etapa(
  _user_id uuid,
  _etapa public.etapa_formalizacao
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_catalog
AS $$
  SELECT CASE
    WHEN public.has_role(_user_id, 'admin') THEN true
    WHEN NOT EXISTS (
      SELECT 1 FROM public.user_page_access
       WHERE user_id = _user_id AND page_key = 'operacoes_valora'
    ) THEN false
    WHEN EXISTS (
      SELECT 1 FROM public.user_etapas_acesso WHERE user_id = _user_id
    ) THEN EXISTS (
      SELECT 1 FROM public.user_etapas_acesso
       WHERE user_id = _user_id AND etapa = _etapa AND pode_ver
    )
    ELSE true
  END
$$;

CREATE OR REPLACE FUNCTION public.pode_editar_etapa(
  _user_id uuid,
  _etapa public.etapa_formalizacao
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_catalog
AS $$
  SELECT CASE
    WHEN public.has_role(_user_id, 'admin') THEN true
    WHEN NOT EXISTS (
      SELECT 1 FROM public.user_page_access
       WHERE user_id = _user_id AND page_key = 'operacoes_valora'
    ) THEN false
    WHEN EXISTS (
      SELECT 1 FROM public.user_etapas_acesso WHERE user_id = _user_id
    ) THEN EXISTS (
      SELECT 1 FROM public.user_etapas_acesso
       WHERE user_id = _user_id AND etapa = _etapa AND pode_editar
    )
    ELSE true
  END
$$;

-- Helper para as tabelas filhas: a permissão sempre segue a etapa da operação-pai.
CREATE OR REPLACE FUNCTION public.pode_ver_operacao(_user_id uuid, _operacao_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_catalog
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.operacoes_formalizacao o
     WHERE o.id = _operacao_id AND public.pode_ver_etapa(_user_id, o.etapa)
  )
$$;

CREATE OR REPLACE FUNCTION public.pode_editar_operacao(_user_id uuid, _operacao_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_catalog
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.operacoes_formalizacao o
     WHERE o.id = _operacao_id AND public.pode_editar_etapa(_user_id, o.etapa)
  )
$$;

REVOKE EXECUTE ON FUNCTION public.pode_ver_etapa(uuid, public.etapa_formalizacao) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.pode_editar_etapa(uuid, public.etapa_formalizacao) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.pode_ver_operacao(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.pode_editar_operacao(uuid, uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.pode_ver_etapa(uuid, public.etapa_formalizacao) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pode_editar_etapa(uuid, public.etapa_formalizacao) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pode_ver_operacao(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pode_editar_operacao(uuid, uuid) TO authenticated;

-- ----------------------------------------------------------------------------
-- 3) Policies da operação
--
--    UPDATE usa duas condições distintas:
--      USING      → aplicada à linha ANTES da alteração: precisa poder EDITAR
--                   a etapa em que a operação está hoje.
--      WITH CHECK → aplicada à linha DEPOIS: precisa ao menos ENXERGAR a etapa
--                   de destino.
--    É isso que permite ao fundo aprovar em "Análise fornecedor" e empurrar para
--    "Aguardando contrato" (que ele vê mas não edita), sem poder despachar a
--    operação para uma etapa que nem enxerga.
-- ----------------------------------------------------------------------------

CREATE POLICY "Ver operações das etapas permitidas"
  ON public.operacoes_formalizacao FOR SELECT TO authenticated
  USING (public.pode_ver_etapa(auth.uid(), etapa));

-- Criação de operação é do time interno irrestrito (ou do sync, via service_role).
CREATE POLICY "Criar operações"
  ON public.operacoes_formalizacao FOR INSERT TO authenticated
  WITH CHECK (
    public.pode_editar_etapa(auth.uid(), etapa)
    AND NOT EXISTS (
      SELECT 1 FROM public.user_etapas_acesso WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Editar operações das etapas permitidas"
  ON public.operacoes_formalizacao FOR UPDATE TO authenticated
  USING (public.pode_editar_etapa(auth.uid(), etapa))
  WITH CHECK (public.pode_ver_etapa(auth.uid(), etapa));

CREATE POLICY "Admins removem operações"
  ON public.operacoes_formalizacao FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ----------------------------------------------------------------------------
-- 4) Policies das tabelas filhas — herdam a permissão da operação-pai
-- ----------------------------------------------------------------------------

-- Checklist
CREATE POLICY "Ver checklist da operação"
  ON public.operacoes_formalizacao_checklist FOR SELECT TO authenticated
  USING (public.pode_ver_operacao(auth.uid(), operacao_id));
CREATE POLICY "Inserir checklist da operação"
  ON public.operacoes_formalizacao_checklist FOR INSERT TO authenticated
  WITH CHECK (public.pode_editar_operacao(auth.uid(), operacao_id));
CREATE POLICY "Editar checklist da operação"
  ON public.operacoes_formalizacao_checklist FOR UPDATE TO authenticated
  USING (public.pode_editar_operacao(auth.uid(), operacao_id))
  WITH CHECK (public.pode_editar_operacao(auth.uid(), operacao_id));
CREATE POLICY "Admins removem checklist"
  ON public.operacoes_formalizacao_checklist FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Signatários
CREATE POLICY "Ver signatários da operação"
  ON public.operacoes_formalizacao_signatarios FOR SELECT TO authenticated
  USING (public.pode_ver_operacao(auth.uid(), operacao_id));
CREATE POLICY "Inserir signatários da operação"
  ON public.operacoes_formalizacao_signatarios FOR INSERT TO authenticated
  WITH CHECK (public.pode_editar_operacao(auth.uid(), operacao_id));
CREATE POLICY "Editar signatários da operação"
  ON public.operacoes_formalizacao_signatarios FOR UPDATE TO authenticated
  USING (public.pode_editar_operacao(auth.uid(), operacao_id))
  WITH CHECK (public.pode_editar_operacao(auth.uid(), operacao_id));
CREATE POLICY "Admins removem signatários"
  ON public.operacoes_formalizacao_signatarios FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Pessoas (representantes e avalistas) — dado pessoal: leitura só para quem
-- pode EDITAR a operação, não para quem apenas a enxerga.
CREATE POLICY "Ver pessoas da operação"
  ON public.operacoes_formalizacao_pessoas FOR SELECT TO authenticated
  USING (public.pode_editar_operacao(auth.uid(), operacao_id));
CREATE POLICY "Inserir pessoas da operação"
  ON public.operacoes_formalizacao_pessoas FOR INSERT TO authenticated
  WITH CHECK (public.pode_editar_operacao(auth.uid(), operacao_id));
CREATE POLICY "Editar pessoas da operação"
  ON public.operacoes_formalizacao_pessoas FOR UPDATE TO authenticated
  USING (public.pode_editar_operacao(auth.uid(), operacao_id))
  WITH CHECK (public.pode_editar_operacao(auth.uid(), operacao_id));
CREATE POLICY "Admins removem pessoas"
  ON public.operacoes_formalizacao_pessoas FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Histórico — append-only. Sem policy de UPDATE ou DELETE: nem admin reescreve
-- auditoria. O trigger de auditoria grava via SECURITY DEFINER e não passa por aqui.
CREATE POLICY "Ver histórico da operação"
  ON public.operacoes_formalizacao_historico FOR SELECT TO authenticated
  USING (public.pode_ver_operacao(auth.uid(), operacao_id));
CREATE POLICY "Registrar movimentação manual"
  ON public.operacoes_formalizacao_historico FOR INSERT TO authenticated
  WITH CHECK (
    public.pode_editar_operacao(auth.uid(), operacao_id)
    AND autor_id = auth.uid()          -- ninguém registra em nome de outro
    AND etapa_de IS NULL               -- mudança de etapa é privilégio do trigger
    AND etapa_para IS NULL
  );

-- SLA — leitura para todos os autenticados (a UI precisa dos títulos e prazos),
-- escrita só para admin.
CREATE POLICY "Autenticados leem SLA"
  ON public.operacoes_formalizacao_sla FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "Admins ajustam SLA"
  ON public.operacoes_formalizacao_sla FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ----------------------------------------------------------------------------
-- 5) Nova page_key do funil para o painel administrativo
--    (o front já usa 'operacoes_valora' e 'operacoes_valora_editar')
-- ----------------------------------------------------------------------------
-- Nada a criar: user_page_access é livre em page_key. Registrado aqui apenas
-- para deixar explícito que 'operacoes_valora' passou a ter efeito no BANCO,
-- não só na interface.
