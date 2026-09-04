/**
 * Tipos de domínio do funil de formalização.
 *
 * Separados de `operacoes.ts` para que a camada de repositório
 * (`operacoesRepo.ts`) possa importá-los sem dependência circular.
 * `operacoes.ts` reexporta tudo — nenhum import existente precisou mudar.
 */

import type { Pessoa } from "@/utils/docFormats";

/** Fundo responsável pela operação. */
export type Fundo = "FIDC MaisTODOS";

export type LinhaCredito = "QIA" | "Amor Saúde" | "Visão de Todos";

export type Etapa =
  | "recolhimento"
  | "analise"
  | "aguardando_contrato"
  | "contrato_emitido"
  | "contrato_assinado"
  | "desembolsado";

export interface EtapaConfig {
  id: Etapa;
  titulo: string;
  slaDias: number;
  oculta?: boolean;
}

export interface ChecklistItem {
  id: string;
  label: string;
  checked: boolean;
  pendente?: boolean;
  anexoNome?: string | null;
  /** Caminho no Storage. Preenchido pela Story 3.4. */
  anexoPath?: string | null;
}

export interface Movimentacao {
  id: string;
  descricao: string;
  autor: string;
  data: string; // ISO
}

export interface Signatario {
  id: string;
  nome: string;
  papel: string;
  status: "Pendente" | "Assinado";
  email?: string | null;
  assinadoEm?: string | null;
}

export interface Operacao {
  id: string;
  unidade: string;
  /** CNPJ normalizado em 14 dígitos, como no resto do sistema. */
  cnpj?: string;
  /** Número da conta do estabelecimento para depósito. */
  contaDeposito?: string;
  /** Carência total (meses) — sem pagamento de principal nem juros. */
  carenciaTotalMeses?: number;
  /** Carência de principal (meses) — paga apenas juros. */
  carenciaPrincipalMeses?: number;
  linha: LinhaCredito;
  fundo: Fundo;
  /** Valor do contrato — o que o cliente deve. */
  valorBruto: number;
  /** Taxa de abertura, embutida no valor do contrato. */
  valorTac: number;
  /** O que deveria cair na conta: bruto − TAC. Calculado no banco. */
  valorLiquidoPrevisto: number;
  /** O que de fato caiu. Informado no desembolso; pode divergir do previsto. */
  valorLiquidoDepositado?: number | null;
  /** Rótulo exibido, ex.: "2,19% a.m. + CDI". */
  taxa: string;
  /** Percentual de juros ao mês, estruturado. */
  taxaPercentual?: number | null;
  taxaTipo?: "pre" | "pos" | null;
  prazoMeses: number;
  /** Difere do prazo quando há carência total. */
  numeroParcelas?: number | null;
  etapa: Etapa;
  dataEntradaFunil: string; // ISO
  dataEntradaEtapa: string; // ISO — base do SLA/aging
  checklist: ChecklistItem[];
  signatarios: Signatario[];
  /** Dados completos do(s) representante(s) legal(is) — usados no checklist PDF/Word. */
  dadosRepresentantes?: Pessoa[];
  /** Dados completos do(s) avalista(s) — usados no checklist PDF/Word. */
  dadosAvalistas?: Pessoa[];
  historico: Movimentacao[];
  alerta?: { tipo: "Pendência" | "Reprovado"; mensagem: string } | null;
  /** E-mails que recebem as notificações desta operação. */
  destinatarios: string[];
  comprovanteDesembolso?: string | null;
  /** Código da operação, ex.: PF46262IBI45. Gerado no desembolso (Story 3.8). */
  idOperacao?: string | null;
  /** Operação perdida no HubSpot: sai do quadro, mas o registro permanece. */
  arquivada?: boolean;
  arquivadaEm?: string | null;
  arquivadaMotivo?: string | null;
  /** Identificador do deal correspondente no HubSpot (Story 4.1). */
  hubspotDealId?: string | null;
  /** Identificador do envelope na Flixsign (Story 4.3). */
  flixsignEnvelopeId?: string | null;
}
