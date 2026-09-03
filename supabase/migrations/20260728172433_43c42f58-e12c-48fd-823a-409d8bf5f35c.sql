ALTER TABLE public.operacoes_ativas ADD COLUMN IF NOT EXISTS taxa_op_raw text;
ALTER TABLE public.operacoes_snapshots ADD COLUMN IF NOT EXISTS taxa_op_raw text;