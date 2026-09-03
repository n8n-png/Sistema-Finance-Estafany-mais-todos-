/**
 * Camada de serviço das Operações Ativas.
 * Nesta fase TODOS os dados são mockados em memória (array estático).
 * Cada função abaixo é o ponto único de troca para a integração real.
 */

import { AS_DOCS, CDT_DOCS } from "@/utils/checklistSchema";
import type { Pessoa } from "@/utils/docFormats";

/** Fundo responsável pela operação. // TODO: integração real com HubSpot aqui. */
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
  slaDias: number; // limite mockado por etapa (ajustável depois)
  oculta?: boolean;
}

export const ETAPAS: EtapaConfig[] = [
  { id: "recolhimento", titulo: "Recolhimento de documentos", slaDias: 3 },
  { id: "analise", titulo: "Análise fornecedor", slaDias: 3 },
  { id: "aguardando_contrato", titulo: "Aguardando contrato", slaDias: 3 },
  { id: "contrato_emitido", titulo: "Contrato emitido", slaDias: 3 },
  { id: "contrato_assinado", titulo: "Contrato assinado — pronto para desembolso", slaDias: 3 },
  { id: "desembolsado", titulo: "Desembolsado", slaDias: 3 },
];

export interface ChecklistItem {
  id: string;
  label: string;
  checked: boolean;
  pendente?: boolean;
  anexoNome?: string | null;
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
}

export interface Operacao {
  id: string;
  unidade: string;
  /** CNPJ da unidade. // TODO: integração real com HubSpot aqui. */
  cnpj?: string;
  /** Número da conta do estabelecimento para depósito (dado bancário do documento). */
  contaDeposito?: string;
  /** Carência total (meses) — sem pagamento de principal nem juros. */
  carenciaTotalMeses?: number;
  /** Carência de principal (meses) — paga apenas juros. */
  carenciaPrincipalMeses?: number;
  linha: LinhaCredito;
  fundo: Fundo; // TODO: integração real com HubSpot aqui — hoje mockado.
  valor: number;
  taxa: string;
  prazoMeses: number;
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
  /** E-mails que recebem as notificações desta operação (Admin > Usuários cadastrados). */
  destinatarios: string[];
  comprovanteDesembolso?: string | null;
}

/**
 * Checklist por linha de crédito — reaproveita as MESMAS listas da
 * Central de Documentos Operacionais (`src/utils/checklistSchema.ts`),
 * em vez de manter uma lista fixa separada.
 */
export const CHECKLIST_REGRAS: Record<LinhaCredito, string[]> = {
  QIA: CDT_DOCS,
  "Amor Saúde": AS_DOCS,
  "Visão de Todos": AS_DOCS,
};

export const montarChecklist = (linha: LinhaCredito): ChecklistItem[] =>
  CHECKLIST_REGRAS[linha].map((label, i) => ({
    id: `${linha}-${i}`,
    label,
    checked: false,
    pendente: false,
    anexoNome: null,
  }));

const diasAtras = (d: number) => {
  const dt = new Date();
  dt.setDate(dt.getDate() - d);
  return dt.toISOString();
};

let movSeq = 0;
export const mov = (descricao: string, autor = "Equipe MaisTODOS", data = new Date().toISOString()): Movimentacao => ({
  id: `mov-${++movSeq}`,
  descricao,
  autor,
  data,
});

/** Registra uma movimentação no histórico. // TODO: integração real aqui — persistir no backend. */
export const registrarMovimentacao = (
  op: Operacao,
  descricao: string,
  autor = "Equipe MaisTODOS"
): Operacao => ({ ...op, historico: [...op.historico, mov(descricao, autor)] });

const sig = (nome: string, papel: string, status: Signatario["status"] = "Pendente"): Signatario => ({
  id: `${nome}-${papel}`,
  nome,
  papel,
  status,
});

// TODO: integração real aqui — substituir o array mockado por GET no backend/HubSpot.
const MOCK: Operacao[] = [
  {
    id: "op-1",
    unidade: "CDT Aracaju",
    cnpj: "60.361.242/0001-32",
    linha: "QIA",
    fundo: "FIDC MaisTODOS",
    valor: 1000,
    taxa: "1,2% a.m. + CDI",
    prazoMeses: 24,
    etapa: "recolhimento",
    destinatarios: [],
    dataEntradaFunil: diasAtras(1),
    dataEntradaEtapa: diasAtras(1),
    checklist: montarChecklist("QIA"),
    signatarios: [sig("João Almeida", "Sócio avalista"), sig("Maria Souza", "Representante legal")],
    historico: [
      mov("Operação criada", "Integração HubSpot", diasAtras(9)),
      mov("Documentação solicitada à unidade", "Equipe MaisTODOS", diasAtras(5)),
    ],
    alerta: null,
  },
  {
    id: "op-2",
    unidade: "CDT Serra",
    cnpj: "23.456.789/0001-81",
    linha: "QIA",
    fundo: "FIDC MaisTODOS",
    valor: 5000,
    taxa: "1,2% a.m. + CDI",
    prazoMeses: 24,
    etapa: "analise",
    destinatarios: [],
    dataEntradaFunil: diasAtras(6),
    dataEntradaEtapa: diasAtras(3),
    checklist: montarChecklist("QIA").map((i) => ({ ...i, checked: true })),
    signatarios: [sig("Carlos Dias", "Sócio avalista"), sig("Ana Prado", "Representante legal")],
    historico: [
      mov("Operação criada", "Integração HubSpot", diasAtras(9)),
      mov("Documentação solicitada à unidade", "Equipe MaisTODOS", diasAtras(5)),
    ],
    alerta: null,
  },
  {
    id: "op-3",
    unidade: "CDT RP",
    cnpj: "34.567.890/0001-72",
    linha: "QIA",
    fundo: "FIDC MaisTODOS",
    valor: 90000,
    taxa: "1,2% a.m. + CDI",
    prazoMeses: 36,
    etapa: "recolhimento",
    destinatarios: [],
    dataEntradaFunil: diasAtras(12),
    dataEntradaEtapa: diasAtras(5),
    checklist: montarChecklist("QIA"),
    signatarios: [sig("Rita Lopes", "Sócia avalista")],
    historico: [
      mov("Operação criada", "Integração HubSpot", diasAtras(9)),
      mov("Documentação solicitada à unidade", "Equipe MaisTODOS", diasAtras(5)),
    ],
    alerta: { tipo: "Reprovado", mensagem: "Restrição de crédito identificada na análise do fornecedor." },
  },
  {
    id: "op-4",
    unidade: "Amor Saúde Niterói",
    cnpj: "45.678.901/0001-63",
    linha: "Amor Saúde",
    fundo: "FIDC MaisTODOS",
    valor: 12000,
    taxa: "2,19% a.m.",
    prazoMeses: 48,
    etapa: "contrato_emitido",
    destinatarios: [],
    dataEntradaFunil: diasAtras(9),
    dataEntradaEtapa: diasAtras(2),
    checklist: montarChecklist("Amor Saúde").map((i) => ({ ...i, checked: true })),
    signatarios: [
      sig("Pedro Antunes", "Representante legal"),
      sig("Luciana Reis", "Avalista"),
      sig("Valora Fundo", "Credor", "Assinado"),
    ],
    historico: [
      mov("Operação criada", "Integração HubSpot", diasAtras(9)),
      mov("Documentação solicitada à unidade", "Equipe MaisTODOS", diasAtras(5)),
    ],
    alerta: null,
  },
  {
    id: "op-5",
    unidade: "Visão de Todos Osasco",
    cnpj: "56.789.012/0001-54",
    linha: "Visão de Todos",
    fundo: "FIDC MaisTODOS",
    valor: 30000,
    taxa: "0,99% a.m. + CDI",
    prazoMeses: 24,
    etapa: "desembolsado",
    destinatarios: [],
    dataEntradaFunil: diasAtras(20),
    dataEntradaEtapa: diasAtras(1),
    checklist: montarChecklist("Visão de Todos").map((i) => ({ ...i, checked: true })),
    signatarios: [
      sig("Fábio Moraes", "Representante legal", "Assinado"),
      sig("Valora Fundo", "Credor", "Assinado"),
    ],
    historico: [
      mov("Operação criada", "Integração HubSpot", diasAtras(9)),
      mov("Documentação solicitada à unidade", "Equipe MaisTODOS", diasAtras(5)),
    ],
    alerta: null,
    comprovanteDesembolso: null,
  },
];

/** Lista operações. // TODO: integração real aqui — buscar do backend/HubSpot. */
export const listarOperacoes = async (): Promise<Operacao[]> =>
  MOCK.map((o) => ({
    ...o,
    checklist: o.checklist.map((c) => ({ ...c })),
    signatarios: o.signatarios.map((s) => ({ ...s })),
    historico: o.historico.map((h) => ({ ...h })),
  }));

/** Signatários ainda pendentes de assinatura. */
export const pendentesAssinatura = (op: Operacao): Signatario[] =>
  op.signatarios.filter((s) => s.status !== "Assinado");

/**
 * // TODO: integração real aqui — gerar .zip no backend com todos os anexos da operação
 * // (Drive/SharePoint/bucket) e devolver a URL de download.
 */
export const baixarDocumentacaoZip = async (op: Operacao): Promise<string> =>
  `documentacao-${op.id}.zip`;

/** // TODO: integração real aqui — download individual do anexo do storage. */
export const baixarAnexo = async (op: Operacao, itemId: string): Promise<string> =>
  `${op.id}-${itemId}.pdf`;

/**
 * Persiste a operação alterada.
 * // TODO: integração real aqui — PATCH no backend + sincronizar com HubSpot via API/private app token.
 * // Toda mudança de status deve refletir no deal correspondente do HubSpot, e mudanças feitas
 * // no HubSpot devem refletir aqui. Cuidado com loop de sincronização (evitar disparo duplo).
 */
export const salvarOperacao = async (op: Operacao): Promise<Operacao> => {
  // mock: apenas devolve o objeto
  return op;
};

/**
 * // TODO: integração real aqui — ao entrar em "Recolhimento de documentos",
 * // criar automaticamente uma pasta estruturada no Google Drive ou SharePoint
 * // (não usar file server local — sem API disponível).
 */
export const criarPastaDocumentos = async (op: Operacao): Promise<void> => {
  console.info("[mock] criar pasta de documentos para", op.unidade);
};

/**
 * // TODO: integração real aqui — FlixSign (webhook ou polling via API)
 * // atualizará o status de cada signatário automaticamente.
 * // Depende de o fundo (dono da conta FlixSign) liberar uma API key e/ou
 * // configurar webhook de status de assinatura para a Maistodos.
 */
export const sincronizarAssinaturas = async (op: Operacao): Promise<Signatario[]> => op.signatarios;

/**
 * // TODO: integração real aqui — upload do comprovante para storage (Drive/SharePoint/bucket).
 */
export const anexarComprovante = async (op: Operacao, nomeArquivo: string): Promise<string> => nomeArquivo;

/** Aging em dias na etapa atual. */
export const diasNaEtapa = (op: Operacao): number => {
  const ms = Date.now() - new Date(op.dataEntradaEtapa).getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
};

export type SlaStatus = "ok" | "atencao" | "estourado";

export const slaStatus = (op: Operacao): SlaStatus => {
  const limite = ETAPAS.find((e) => e.id === op.etapa)?.slaDias ?? 3;
  const dias = diasNaEtapa(op);
  if (dias > limite) return "estourado";
  if (dias >= limite - 1) return "atencao";
  return "ok";
};

export const tituloEtapa = (etapa: Etapa) => ETAPAS.find((e) => e.id === etapa)?.titulo ?? etapa;

export const moverEtapa = (op: Operacao, etapa: Etapa): Operacao => ({
  ...op,
  etapa,
  dataEntradaEtapa: new Date().toISOString(),
});
