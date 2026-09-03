-- ============================================================================
-- Story 2.1 (parte 2) — PROPOSTA, NÃO É MIGRATION
--
-- Este arquivo está fora de supabase/migrations/ de propósito: aplicá-lo sem
-- validar contra a base real pode REMOVER acesso de usuários que hoje
-- funcionam. Rode a seção 1 (verificação) antes de promover a seção 3.
--
-- Problema: sete tabelas usam `is_staff(auth.uid())`, que só verifica se o
-- usuário tem ALGUM papel em user_roles. Não distingue admin de user, não
-- consulta user_page_access e não conhece a noção de usuário externo. Como o
-- time da Valora vai precisar de um papel para autenticar, hoje eles entrariam
-- já enxergando toda a base operacional.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) VERIFICAÇÃO — rodar ANTES, na base real, e revisar o resultado
--
-- Lista cada usuário com papel e as page_keys que possui. Quem aparecer com
-- `paginas = {}` (nenhuma página) e não for admin PERDE acesso de leitura às
-- tabelas operacionais quando a seção 3 for aplicada.
-- ----------------------------------------------------------------------------

SELECT
  u.email,
  EXISTS (SELECT 1 FROM public.user_roles r
           WHERE r.user_id = u.id AND r.role = 'admin')          AS is_admin,
  COALESCE(ARRAY_AGG(pa.page_key) FILTER (WHERE pa.page_key IS NOT NULL), '{}') AS paginas,
  CASE
    WHEN EXISTS (SELECT 1 FROM public.user_roles r
                  WHERE r.user_id = u.id AND r.role = 'admin') THEN 'OK — admin'
    WHEN COUNT(pa.page_key) FILTER (
           WHERE pa.page_key IN ('ativos','indicadores_home','limites')
         ) > 0 THEN 'OK — mantém acesso'
    ELSE '>>> PERDE ACESSO <<<'
  END AS impacto
FROM auth.users u
JOIN public.user_roles ur ON ur.user_id = u.id
LEFT JOIN public.user_page_access pa ON pa.user_id = u.id
GROUP BY u.id, u.email
ORDER BY impacto DESC, u.email;

-- ----------------------------------------------------------------------------
-- 2) CORREÇÃO PRÉVIA (se a verificação apontar quem perde acesso)
--
-- Conceder explicitamente as páginas a quem já usa o sistema, antes de apertar
-- a RLS. Rodar com service_role. Ajustar a lista de e-mails conforme o resultado.
-- ----------------------------------------------------------------------------

-- INSERT INTO public.user_page_access (user_id, page_key, granted_by)
-- SELECT u.id, k.page_key, NULL
--   FROM auth.users u
--   CROSS JOIN (VALUES ('ativos'), ('indicadores_home')) AS k(page_key)
--  WHERE u.email IN ('fulano@maistodos.com.br', 'beltrano@maistodos.com.br')
-- ON CONFLICT (user_id, page_key) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 3) ENDURECIMENTO — promover para migration só depois de 1 e 2
--
-- Mapeamento tabela → páginas que a consomem (levantado no código):
--   operacoes_ativas ....... ativos, indicadores_home, limites
--   operacoes_snapshots .... ativos, indicadores_home
--   operacoes_projecoes .... ativos, indicadores_home
--   operacoes_divergencias . ativos
--   operacoes_overrides .... ativos
--   operacoes_parcelas_... . ativos
--   operacoes_checklists ... central_documentos
-- ----------------------------------------------------------------------------

-- BEGIN;

-- DROP POLICY IF EXISTS "Staff consultam operações ativas" ON public.operacoes_ativas;
-- CREATE POLICY "Leitura de operações ativas por permissão" ON public.operacoes_ativas
--   FOR SELECT TO authenticated
--   USING (public.has_any_page_access(auth.uid(), ARRAY['ativos','indicadores_home','limites']));

-- DROP POLICY IF EXISTS "Staff leem snapshots" ON public.operacoes_snapshots;
-- CREATE POLICY "Leitura de snapshots por permissão" ON public.operacoes_snapshots
--   FOR SELECT TO authenticated
--   USING (public.has_any_page_access(auth.uid(), ARRAY['ativos','indicadores_home']));

-- DROP POLICY IF EXISTS "Staff leem projecoes" ON public.operacoes_projecoes;
-- CREATE POLICY "Leitura de projecoes por permissão" ON public.operacoes_projecoes
--   FOR SELECT TO authenticated
--   USING (public.has_any_page_access(auth.uid(), ARRAY['ativos','indicadores_home']));

-- DROP POLICY IF EXISTS "Staff leem divergencias" ON public.operacoes_divergencias;
-- CREATE POLICY "Leitura de divergencias por permissão" ON public.operacoes_divergencias
--   FOR SELECT TO authenticated
--   USING (public.has_any_page_access(auth.uid(), ARRAY['ativos']));

-- DROP POLICY IF EXISTS "Staff leem overrides" ON public.operacoes_overrides;
-- CREATE POLICY "Leitura de overrides por permissão" ON public.operacoes_overrides
--   FOR SELECT TO authenticated
--   USING (public.has_any_page_access(auth.uid(), ARRAY['ativos']));

-- DROP POLICY IF EXISTS "Staff leem parcelas manuais" ON public.operacoes_parcelas_manuais;
-- CREATE POLICY "Leitura de parcelas manuais por permissão" ON public.operacoes_parcelas_manuais
--   FOR SELECT TO authenticated
--   USING (public.has_any_page_access(auth.uid(), ARRAY['ativos']));

-- DROP POLICY IF EXISTS "Staff leem checklists" ON public.operacoes_checklists;
-- CREATE POLICY "Leitura de checklists por permissão" ON public.operacoes_checklists
--   FOR SELECT TO authenticated
--   USING (public.has_any_page_access(auth.uid(), ARRAY['central_documentos']));

-- COMMIT;

-- ----------------------------------------------------------------------------
-- 4) VALIDAÇÃO PÓS-APLICAÇÃO
--
-- Confirmar que nenhuma policy de SELECT sobrou permissiva nas tabelas de
-- negócio. O resultado esperado é apenas cdi_cache, cdi_daily e holidays —
-- dados públicos (taxa CDI e calendário de feriados).
-- ----------------------------------------------------------------------------

-- SELECT schemaname, tablename, policyname, qual
--   FROM pg_policies
--  WHERE schemaname = 'public'
--    AND cmd = 'SELECT'
--    AND qual = 'true'
--  ORDER BY tablename;
