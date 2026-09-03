DROP FUNCTION IF EXISTS public.bulk_upsert_parcelas_manuais(jsonb);

CREATE OR REPLACE FUNCTION public.bulk_upsert_parcelas_manuais(_rows jsonb, _user uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  _deleted integer := 0;
  _inserted integer := 0;
BEGIN
  CREATE TEMP TABLE _batch ON COMMIT DROP AS
  SELECT
    (r->>'cnpj')::text AS cnpj,
    NULLIF(r->>'id_valora','') AS id_valora,
    NULLIF(r->>'seu_numero','') AS seu_numero,
    (r->>'month')::int AS month,
    NULLIF(r->>'due_date','')::date AS due_date,
    (r->>'actual_payment')::numeric AS actual_payment
  FROM jsonb_array_elements(_rows) AS r;

  WITH del AS (
    DELETE FROM public.operacoes_parcelas_manuais p
    USING _batch b
    WHERE p.cnpj = b.cnpj
      AND p.month = b.month
      AND COALESCE(p.id_valora,'') = COALESCE(b.id_valora,'')
      AND COALESCE(p.seu_numero,'') = COALESCE(b.seu_numero,'')
    RETURNING 1
  )
  SELECT count(*) INTO _deleted FROM del;

  WITH ins AS (
    INSERT INTO public.operacoes_parcelas_manuais
      (cnpj, id_valora, seu_numero, month, due_date, actual_payment, note, created_by)
    SELECT cnpj, id_valora, seu_numero, month, due_date, actual_payment, 'importado_planilha', _user
    FROM _batch
    RETURNING 1
  )
  SELECT count(*) INTO _inserted FROM ins;

  RETURN jsonb_build_object('deleted', _deleted, 'inserted', _inserted);
END;
$$;

REVOKE ALL ON FUNCTION public.bulk_upsert_parcelas_manuais(jsonb, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bulk_upsert_parcelas_manuais(jsonb, uuid) TO service_role;