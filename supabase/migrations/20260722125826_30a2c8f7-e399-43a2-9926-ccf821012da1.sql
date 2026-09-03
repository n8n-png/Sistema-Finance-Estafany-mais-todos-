
CREATE TABLE public.cdi_cache (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rate numeric NOT NULL,
  reference_date date NOT NULL,
  fetched_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.cdi_cache TO authenticated, anon;
GRANT ALL ON public.cdi_cache TO service_role;

ALTER TABLE public.cdi_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "CDI cache é público para leitura"
  ON public.cdi_cache FOR SELECT
  TO authenticated, anon
  USING (true);
