-- ============================================================================
-- Story 2.1, parte 2 — Endurecimento da RLS das tabelas operacionais
--
-- Por que agora: esta correção estava parada porque aplicá-la numa base viva
-- poderia remover acesso de quem já usava o sistema, e não havia como verificar
-- quem. Com a decisão de 04/09 de criar o banco do zero, ela deixa de ser
-- migração de risco e passa a ser simplesmente o estado inicial correto.
--
-- O problema: sete tabelas usam `is_staff(auth.uid())`, que só verifica se o
-- usuário tem **algum** papel em `user_roles`. Não distingue perfil, não
-- consulta `user_page_access` e não conhece a noção de usuário externo.
--
-- Como o time do fundo (Valora) vai precisar de um papel para autenticar, eles
-- entrariam enxergando toda a base operacional: parcelas, projeções,
-- divergências e limites de clientes. Nenhum desses dados lhes diz respeito.
--
-- A partir daqui, a permissão passa a seguir a mesma matriz que a interface já
-- usa (`user_page_access`), agora valendo também no banco.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Mapeamento tabela → páginas que a consomem (levantado no código)
--
--   operacoes_ativas ............ ativos, indicadores_home, limites
--   operacoes_snapshots ......... ativos, indicadores_home
--   operacoes_projecoes ......... ativos, indicadores_home
--   operacoes_divergencias ...... ativos
--   operacoes_overrides ......... ativos
--   operacoes_parcelas_manuais .. ativos
--   operacoes_checklists ........ central_documentos
-- ----------------------------------------------------------------------------

-- operacoes_ativas
DROP POLICY IF EXISTS "Staff consultam operações ativas" ON public.operacoes_ativas;
CREATE POLICY "Leitura de operações ativas por permissão"
  ON public.operacoes_ativas FOR SELECT TO authenticated
  USING (public.has_any_page_access(auth.uid(), ARRAY['ativos', 'indicadores_home', 'limites']));

-- operacoes_snapshots
DROP POLICY IF EXISTS "Staff leem snapshots" ON public.operacoes_snapshots;
CREATE POLICY "Leitura de snapshots por permissão"
  ON public.operacoes_snapshots FOR SELECT TO authenticated
  USING (public.has_any_page_access(auth.uid(), ARRAY['ativos', 'indicadores_home']));

-- operacoes_projecoes
DROP POLICY IF EXISTS "Staff leem projecoes" ON public.operacoes_projecoes;
CREATE POLICY "Leitura de projecoes por permissão"
  ON public.operacoes_projecoes FOR SELECT TO authenticated
  USING (public.has_any_page_access(auth.uid(), ARRAY['ativos', 'indicadores_home']));

-- operacoes_divergencias
DROP POLICY IF EXISTS "Staff leem divergencias" ON public.operacoes_divergencias;
CREATE POLICY "Leitura de divergencias por permissão"
  ON public.operacoes_divergencias FOR SELECT TO authenticated
  USING (public.has_any_page_access(auth.uid(), ARRAY['ativos']));

-- operacoes_overrides
DROP POLICY IF EXISTS "Staff leem overrides" ON public.operacoes_overrides;
CREATE POLICY "Leitura de overrides por permissão"
  ON public.operacoes_overrides FOR SELECT TO authenticated
  USING (public.has_any_page_access(auth.uid(), ARRAY['ativos']));

-- operacoes_parcelas_manuais
DROP POLICY IF EXISTS "Staff leem parcelas manuais" ON public.operacoes_parcelas_manuais;
CREATE POLICY "Leitura de parcelas manuais por permissão"
  ON public.operacoes_parcelas_manuais FOR SELECT TO authenticated
  USING (public.has_any_page_access(auth.uid(), ARRAY['ativos']));

-- operacoes_checklists
DROP POLICY IF EXISTS "Staff leem checklists" ON public.operacoes_checklists;
CREATE POLICY "Leitura de checklists por permissão"
  ON public.operacoes_checklists FOR SELECT TO authenticated
  USING (public.has_any_page_access(auth.uid(), ARRAY['central_documentos']));

-- ----------------------------------------------------------------------------
-- Escrita: seguia a mesma lógica frouxa. Quem escreve precisa da mesma
-- permissão de quem lê — caso contrário alguém sem acesso à tela poderia
-- alterar o dado dela pela API.
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS "Staff inserem checklists" ON public.operacoes_checklists;
CREATE POLICY "Escrita de checklists por permissão"
  ON public.operacoes_checklists FOR INSERT TO authenticated
  WITH CHECK (public.has_any_page_access(auth.uid(), ARRAY['central_documentos']));

DROP POLICY IF EXISTS "Staff atualizam checklists" ON public.operacoes_checklists;
CREATE POLICY "Atualização de checklists por permissão"
  ON public.operacoes_checklists FOR UPDATE TO authenticated
  USING (public.has_any_page_access(auth.uid(), ARRAY['central_documentos']))
  WITH CHECK (public.has_any_page_access(auth.uid(), ARRAY['central_documentos']));

DROP POLICY IF EXISTS "Staff inserem overrides" ON public.operacoes_overrides;
CREATE POLICY "Escrita de overrides por permissão"
  ON public.operacoes_overrides FOR INSERT TO authenticated
  WITH CHECK (public.has_any_page_access(auth.uid(), ARRAY['ativos']));

DROP POLICY IF EXISTS "Staff atualizam overrides" ON public.operacoes_overrides;
CREATE POLICY "Atualização de overrides por permissão"
  ON public.operacoes_overrides FOR UPDATE TO authenticated
  USING (public.has_any_page_access(auth.uid(), ARRAY['ativos']))
  WITH CHECK (public.has_any_page_access(auth.uid(), ARRAY['ativos']));

DROP POLICY IF EXISTS "Staff inserem parcelas manuais" ON public.operacoes_parcelas_manuais;
CREATE POLICY "Escrita de parcelas manuais por permissão"
  ON public.operacoes_parcelas_manuais FOR INSERT TO authenticated
  WITH CHECK (public.has_any_page_access(auth.uid(), ARRAY['ativos']));

DROP POLICY IF EXISTS "Staff atualizam parcelas manuais" ON public.operacoes_parcelas_manuais;
CREATE POLICY "Atualização de parcelas manuais por permissão"
  ON public.operacoes_parcelas_manuais FOR UPDATE TO authenticated
  USING (public.has_any_page_access(auth.uid(), ARRAY['ativos']))
  WITH CHECK (public.has_any_page_access(auth.uid(), ARRAY['ativos']));

-- ----------------------------------------------------------------------------
-- `is_staff` deixa de ser usada por qualquer policy.
--
-- Mantida no banco de propósito, em vez de removida: apagar a função quebraria
-- qualquer código que ainda a chame, e a existência dela não é o problema — o
-- problema era usá-la para decidir acesso a dado. O comentário registra isso
-- para quem for mexer depois.
-- ----------------------------------------------------------------------------

COMMENT ON FUNCTION public.is_staff(uuid) IS
  'OBSOLETA para controle de acesso: só verifica se o usuário tem algum papel, sem distinguir perfil nem consultar user_page_access. Use has_any_page_access. Mantida apenas para compatibilidade.';
