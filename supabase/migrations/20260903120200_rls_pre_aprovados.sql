-- ============================================================================
-- Story 2.1 (parte 1) — Fechar a leitura aberta de clientes_pre_aprovados
--
-- A tabela foi criada em 26/08, DEPOIS do endurecimento geral de RLS de 30/07,
-- e nasceu com `TO authenticated USING (true)`: qualquer conta logada lê a
-- carteira inteira de clientes pré-aprovados. Com o time do fundo (Valora)
-- prestes a receber login, isso vira vazamento de dado comercial.
--
-- A parte 2 (endurecimento das policies que hoje usam is_staff) está em
-- docs/seguranca/rls-endurecimento-proposto.sql — precisa de validação contra
-- a base real antes de virar migration, porque pode remover acesso de usuários
-- que hoje funcionam.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Helper: o usuário tem ao menos uma das page_keys informadas?
--
--    SECURITY INVOKER: user_page_access já tem policy que deixa o usuário ler
--    as próprias linhas. Não há motivo para abrir bypass de RLS aqui.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.has_any_page_access(_user_id uuid, _page_keys text[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_catalog
AS $$
  SELECT public.has_role(_user_id, 'admin')
      OR EXISTS (
           SELECT 1 FROM public.user_page_access
            WHERE user_id = _user_id
              AND page_key = ANY(_page_keys)
         )
$$;

COMMENT ON FUNCTION public.has_any_page_access(uuid, text[]) IS
  'Leva a matriz de user_page_access para dentro do banco. Até então ela só existia no front-end (usePageAccess), o que a tornava cosmética.';

REVOKE EXECUTE ON FUNCTION public.has_any_page_access(uuid, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_any_page_access(uuid, text[]) TO authenticated;

-- ----------------------------------------------------------------------------
-- 2) clientes_pre_aprovados: fecha a leitura
--
--    Quem consome a tabela hoje:
--      • src/components/limites/ClienteSelector.tsx      → página 'limites'
--      • src/components/valora/OperacaoCard.tsx / Modal  → página 'operacoes_valora'
--
--    O acesso pelo funil é concedido apenas a usuário IRRESTRITO (sem linhas em
--    user_etapas_acesso). Assim o time do fundo, que é restrito por etapa, vê a
--    operação que lhe cabe sem enxergar a carteira de pré-aprovados.
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS "Autenticados leem pre aprovados" ON public.clientes_pre_aprovados;

CREATE POLICY "Leitura de pre aprovados por permissão"
  ON public.clientes_pre_aprovados FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_any_page_access(auth.uid(), ARRAY['limites'])
    OR (
      public.has_any_page_access(auth.uid(), ARRAY['operacoes_valora'])
      AND NOT EXISTS (
        SELECT 1 FROM public.user_etapas_acesso WHERE user_id = auth.uid()
      )
    )
  );
