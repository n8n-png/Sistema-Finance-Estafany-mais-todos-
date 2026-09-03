/**
 * Camada de serviço do funil de formalização.
 *
 * Story 3.3 — o array em memória foi substituído por persistência real no
 * banco (`operacoesRepo.ts`). A interface pública deste módulo permaneceu
 * idêntica de propósito: nenhuma tela precisou mudar.
 *
 * As funções de transformação (`moverEtapa`, `registrarMovimentacao`) continuam
 * puras e síncronas — a UI as usa para atualizar o estado local, e a gravação
 * acontece em `salvarOperacao`.
 */

import { AS_DOCS, CDT_DOCS } from "@/utils/checklistSchema";
import { carregarSlaDb, listarOperacoesDb, salvarOperacaoDb } from "./operacoesRepo";
import type {
  ChecklistItem,
  Etapa,
  EtapaConfig,
  LinhaCredito,
  Movimentacao,
  Operacao,
  Signatario,
} from "./operacoes.types";

export type {
  ChecklistItem,
  Etapa,
  EtapaConfig,
  Fundo,
  LinhaCredito,
  Movimentacao,
  Operacao,
  Signatario,
} from "./operacoes.types";

/**
 * Etapas do funil. Títulos e ordem são fixos (são a definição do processo);
 * o SLA é configurável em `operacoes_formalizacao_sla` e sincronizado por
 * `carregarSla()`. Os valores abaixo são o padrão até a primeira carga.
 */
export const ETAPAS: EtapaConfig[] = [
  { id: "recolhimento", titulo: "Recolhimento de documentos", slaDias: 3 },
  { id: "analise", titulo: "Análise fornecedor", slaDias: 3 },
  { id: "aguardando_contrato", titulo: "Aguardando contrato", slaDias: 3 },
  { id: "contrato_emitido", titulo: "Contrato emitido", slaDias: 3 },
  { id: "contrato_assinado", titulo: "Contrato assinado — pronto para desembolso", slaDias: 3 },
  { id: "desembolsado", titulo: "Desembolsado", slaDias: 3 },
];

/** Atualiza os SLAs em memória a partir da configuração do banco. */
export const carregarSla = async (): Promise<void> => {
  try {
    const linhas = await carregarSlaDb();
    for (const linha of linhas) {
      const etapa = ETAPAS.find((e) => e.id === linha.etapa);
      if (etapa) {
        etapa.slaDias = linha.sla_dias;
        etapa.titulo = linha.titulo;
      }
    }
  } catch (err) {
    // SLA é configuração, não dado crítico: falha aqui não pode derrubar o funil.
    console.warn("[operacoes] não foi possível carregar o SLA configurado", err);
  }
};

/**
 * Checklist por linha de crédito — reaproveita as MESMAS listas da
 * Central de Documentos Operacionais (`src/utils/checklistSchema.ts`).
 */
export const CHECKLIST_REGRAS: Record<LinhaCredito, string[]> = {
  QIA: CDT_DOCS,
  "Amor Saúde": AS_DOCS,
  "Visão de Todos": AS_DOCS,
};

/**
 * Monta o checklist inicial de uma operação nova.
 * Os ids recebem o prefixo `novo-` para o repositório distinguir o que ainda
 * não existe no banco.
 */
export const montarChecklist = (linha: LinhaCredito): ChecklistItem[] =>
  CHECKLIST_REGRAS[linha].map((label, i) => ({
    id: `novo-${linha}-${i}`,
    label,
    checked: false,
    pendente: false,
    anexoNome: null,
  }));

let movSeq = 0;

export const mov = (
  descricao: string,
  autor = "Equipe MaisTODOS",
  data = new Date().toISOString(),
): Movimentacao => ({
  id: `mov-${++movSeq}`,
  descricao,
  autor,
  data,
});

/**
 * Adiciona uma movimentação ao histórico local. A gravação acontece em
 * `salvarOperacao`; a mudança de etapa em si é auditada por trigger no banco.
 */
export const registrarMovimentacao = (
  op: Operacao,
  descricao: string,
  autor = "Equipe MaisTODOS",
): Operacao => ({ ...op, historico: [...op.historico, mov(descricao, autor)] });

/** Lista as operações do funil visíveis para o usuário logado (filtro por RLS). */
export const listarOperacoes = async (): Promise<Operacao[]> => {
  await carregarSla();
  return listarOperacoesDb();
};

/** Signatários ainda pendentes de assinatura. */
export const pendentesAssinatura = (op: Operacao): Signatario[] =>
  op.signatarios.filter((s) => s.status !== "Assinado");

/** Persiste a operação alterada. */
export const salvarOperacao = async (op: Operacao): Promise<Operacao> => salvarOperacaoDb(op);

/**
 * // Story 3.4 — gerar .zip com todos os anexos da operação e devolver a URL.
 * // Depende da decisão de onde os documentos ficam (Drive/SharePoint/bucket).
 */
export const baixarDocumentacaoZip = async (op: Operacao): Promise<string> =>
  `documentacao-${op.id}.zip`;

/** // Story 3.4 — download individual do anexo a partir do Storage. */
export const baixarAnexo = async (op: Operacao, itemId: string): Promise<string> =>
  `${op.id}-${itemId}.pdf`;

/**
 * // Story 3.4 — ao entrar em "Recolhimento de documentos", criar a pasta
 * // estruturada da operação. Bloqueado pela decisão de destino dos documentos.
 */
export const criarPastaDocumentos = async (op: Operacao): Promise<void> => {
  console.info("[pendente] criar pasta de documentos para", op.unidade);
};

/**
 * // Story 4.3 — polling da Flixsign (`GetEnvelope`) atualiza o status de cada
 * // signatário. O manual v1.0.2 não documenta webhook, então é polling mesmo.
 * // Depende da credencial de serviço, que é da conta do fundo.
 */
export const sincronizarAssinaturas = async (op: Operacao): Promise<Signatario[]> => op.signatarios;

/** // Story 3.4 — upload do comprovante de desembolso para o Storage. */
export const anexarComprovante = async (op: Operacao, nomeArquivo: string): Promise<string> =>
  nomeArquivo;

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

/**
 * Move a operação de etapa no estado local. `dataEntradaEtapa` é recalculada
 * também no banco, por trigger, na hora de salvar — o valor aqui serve para a
 * UI refletir o SLA imediatamente.
 */
export const moverEtapa = (op: Operacao, etapa: Etapa): Operacao => ({
  ...op,
  etapa,
  dataEntradaEtapa: new Date().toISOString(),
});
