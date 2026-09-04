/**
 * Tipos e client tipado das tabelas do funil de formalização.
 *
 * Por que este arquivo existe: `types.ts` é gerado pela CLI do Supabase a partir
 * do banco e ainda não conhece as tabelas criadas nas migrations 20260903*.
 * Assim que o banco próprio estiver de pé, rode
 *   `supabase gen types typescript --project-id <id> > src/integrations/supabase/types.ts`
 * e este arquivo pode ser reduzido apenas aos aliases de domínio.
 *
 * O client é o MESMO objeto em runtime — só a tipagem muda. Não há segunda
 * sessão de autenticação.
 *
 * ATENÇÃO ao editar: os tipos de linha abaixo precisam ser `type`, nunca
 * `interface`. O supabase-js exige que o schema satisfaça `GenericSchema`, cujo
 * `Row` é `Record<string, unknown>` — e o TypeScript não considera interfaces
 * atribuíveis a `Record<string, unknown>` (só type aliases, que ganham index
 * signature implícito). Com `interface`, o schema inteiro colapsa para `never`:
 * o `select` continua compilando normalmente, mas todo `insert`/`update` passa
 * a ser rejeitado com "not assignable to parameter of type 'never'".
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "./client";
import type { Database as GeneratedDatabase } from "./types";

export type EtapaDb =
  | "recolhimento"
  | "analise"
  | "aguardando_contrato"
  | "contrato_emitido"
  | "contrato_assinado"
  | "desembolsado";

export type LinhaCreditoDb = "QIA" | "Amor Saúde" | "Visão de Todos";
export type AlertaTipoDb = "pendencia" | "reprovado";
export type SignatarioStatusDb = "pendente" | "assinado";
export type PessoaPapelDb = "representante" | "avalista";
export type OrigemAlteracaoDb = "painel" | "hubspot" | "flixsign" | "sistema";
export type TipoTaxaDb = "pre" | "pos";

export type OperacaoRow = {
  id: string;
  unidade: string;
  cnpj: string | null;
  linha: LinhaCreditoDb;
  fundo: string;
  valor_bruto: number;
  valor_tac: number;
  /** Coluna gerada no banco: valor_bruto - valor_tac. Não é gravável. */
  valor_liquido_previsto: number;
  valor_liquido_depositado: number | null;
  taxa: string;
  taxa_percentual: number | null;
  taxa_tipo: TipoTaxaDb | null;
  prazo_meses: number;
  numero_parcelas: number | null;
  carencia_total_meses: number | null;
  carencia_principal_meses: number | null;
  conta_deposito: string | null;
  etapa: EtapaDb;
  data_entrada_funil: string;
  data_entrada_etapa: string;
  alerta_tipo: AlertaTipoDb | null;
  alerta_mensagem: string | null;
  destinatarios: string[];
  comprovante_desembolso: string | null;
  id_operacao: string | null;
  arquivada: boolean;
  arquivada_em: string | null;
  arquivada_motivo: string | null;
  hubspot_deal_id: string | null;
  hubspot_stage_id: string | null;
  data_analise_fundo: string | null;
  data_formalizacao: string | null;
  data_credito_concedido: string | null;
  flixsign_envelope_id: string | null;
  origem_ultima_alteracao: OrigemAlteracaoDb;
  sincronizado_em: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

export type ChecklistRow = {
  id: string;
  operacao_id: string;
  ordem: number;
  label: string;
  checked: boolean;
  pendente: boolean;
  anexo_nome: string | null;
  anexo_path: string | null;
  updated_at: string;
  updated_by: string | null;
}

export type SignatarioRow = {
  id: string;
  operacao_id: string;
  nome: string;
  papel: string;
  email: string | null;
  cpf: string | null;
  status: SignatarioStatusDb;
  assinado_em: string | null;
  flixsign_signatory_id: string | null;
  ordem: number | null;
  created_at: string;
  updated_at: string;
}

export type PessoaRow = {
  id: string;
  operacao_id: string;
  papel: PessoaPapelDb;
  nome: string;
  cpf: string | null;
  email: string | null;
  regime: string | null;
  ordem: number;
  created_at: string;
}

export type HistoricoRow = {
  id: string;
  operacao_id: string;
  descricao: string;
  autor: string;
  autor_id: string | null;
  etapa_de: EtapaDb | null;
  etapa_para: EtapaDb | null;
  origem: OrigemAlteracaoDb;
  created_at: string;
}

export type SlaRow = {
  etapa: EtapaDb;
  ordem: number;
  titulo: string;
  sla_dias: number;
  updated_at: string;
  updated_by: string | null;
}

type Tabela<Row, Insert = Partial<Row>, Update = Partial<Row>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

/**
 * Achata a interseção num tipo mapeado simples, no mesmo formato do arquivo
 * gerado pela CLI.
 */
type Achatar<T> = { [K in keyof T]: T[K] };

type PublicSchema = GeneratedDatabase["public"];

export type FunilDatabase = {
  __InternalSupabase: GeneratedDatabase["__InternalSupabase"];
  public: {
    Tables: Achatar<
      PublicSchema["Tables"] & {
        operacoes_formalizacao: Tabela<OperacaoRow>;
        operacoes_formalizacao_checklist: Tabela<ChecklistRow>;
        operacoes_formalizacao_signatarios: Tabela<SignatarioRow>;
        operacoes_formalizacao_pessoas: Tabela<PessoaRow>;
        operacoes_formalizacao_historico: Tabela<HistoricoRow>;
        operacoes_formalizacao_sla: Tabela<SlaRow>;
      }
    >;
    Views: PublicSchema["Views"];
    Functions: PublicSchema["Functions"];
    Enums: Achatar<
      PublicSchema["Enums"] & {
        etapa_formalizacao: EtapaDb;
        linha_credito: LinhaCreditoDb;
        alerta_tipo: AlertaTipoDb;
        signatario_status: SignatarioStatusDb;
      tipo_taxa: TipoTaxaDb;
        pessoa_papel: PessoaPapelDb;
        origem_alteracao: OrigemAlteracaoDb;
      }
    >;
    CompositeTypes: PublicSchema["CompositeTypes"];
  };
};

/** Mesmo client, tipado com as tabelas do funil somadas às já geradas. */
export const dbFunil = supabase as unknown as SupabaseClient<FunilDatabase>;
