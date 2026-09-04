/**
 * Repositório do funil de formalização — Story 3.3.
 *
 * Substitui o array em memória que existia em `operacoes.ts`. Toda a conversão
 * entre o formato do banco (snake_case, enums em minúsculo) e o formato de
 * domínio usado pela UI acontece aqui, e só aqui.
 */

import { dbFunil } from "@/integrations/supabase/funil";
import type {
  ChecklistRow,
  HistoricoRow,
  OperacaoRow,
  PessoaRow,
  SignatarioRow,
  SlaRow,
} from "@/integrations/supabase/funil";
import { normalizeCnpj } from "@/utils/cnpj";
import type {
  ChecklistItem,
  Movimentacao,
  Operacao,
  Signatario,
} from "./operacoes.types";

// ---------------------------------------------------------------------------
// Conversões banco → domínio
// ---------------------------------------------------------------------------

const toAlerta = (row: OperacaoRow): Operacao["alerta"] => {
  if (!row.alerta_tipo) return null;
  return {
    tipo: row.alerta_tipo === "pendencia" ? "Pendência" : "Reprovado",
    mensagem: row.alerta_mensagem ?? "",
  };
};

const toChecklist = (rows: ChecklistRow[]): ChecklistItem[] =>
  rows
    .slice()
    .sort((a, b) => a.ordem - b.ordem)
    .map((r) => ({
      id: r.id,
      label: r.label,
      checked: r.checked,
      pendente: r.pendente,
      anexoNome: r.anexo_nome,
      anexoPath: r.anexo_path,
    }));

const toSignatarios = (rows: SignatarioRow[]): Signatario[] =>
  rows
    .slice()
    .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))
    .map((r) => ({
      id: r.id,
      nome: r.nome,
      papel: r.papel,
      status: r.status === "assinado" ? "Assinado" : "Pendente",
      email: r.email,
      assinadoEm: r.assinado_em,
    }));

const toHistorico = (rows: HistoricoRow[]): Movimentacao[] =>
  rows
    .slice()
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map((r) => ({
      id: r.id,
      descricao: r.descricao,
      autor: r.autor,
      data: r.created_at,
    }));

const toPessoas = (rows: PessoaRow[], papel: PessoaRow["papel"]) =>
  rows
    .filter((r) => r.papel === papel)
    .sort((a, b) => a.ordem - b.ordem)
    .map((r) => ({
      nome: r.nome,
      cpf: r.cpf ?? "",
      email: r.email ?? "",
      regime: r.regime ?? undefined,
    }));

const montarOperacao = (
  row: OperacaoRow,
  checklist: ChecklistRow[],
  signatarios: SignatarioRow[],
  pessoas: PessoaRow[],
  historico: HistoricoRow[],
): Operacao => ({
  id: row.id,
  unidade: row.unidade,
  cnpj: row.cnpj ?? undefined,
  contaDeposito: row.conta_deposito ?? undefined,
  carenciaTotalMeses: row.carencia_total_meses ?? undefined,
  carenciaPrincipalMeses: row.carencia_principal_meses ?? undefined,
  linha: row.linha,
  fundo: row.fundo as Operacao["fundo"],
  valorBruto: Number(row.valor_bruto),
  valorTac: Number(row.valor_tac ?? 0),
  valorLiquidoPrevisto: Number(row.valor_liquido_previsto),
  valorLiquidoDepositado:
    row.valor_liquido_depositado === null ? null : Number(row.valor_liquido_depositado),
  taxa: row.taxa,
  taxaPercentual: row.taxa_percentual === null ? null : Number(row.taxa_percentual),
  taxaTipo: row.taxa_tipo,
  prazoMeses: row.prazo_meses,
  numeroParcelas: row.numero_parcelas,
  etapa: row.etapa,
  dataEntradaFunil: row.data_entrada_funil,
  dataEntradaEtapa: row.data_entrada_etapa,
  checklist: toChecklist(checklist),
  signatarios: toSignatarios(signatarios),
  dadosRepresentantes: toPessoas(pessoas, "representante"),
  dadosAvalistas: toPessoas(pessoas, "avalista"),
  historico: toHistorico(historico),
  alerta: toAlerta(row),
  destinatarios: row.destinatarios ?? [],
  comprovanteDesembolso: row.comprovante_desembolso,
  idOperacao: row.id_operacao,
  arquivada: row.arquivada,
  arquivadaEm: row.arquivada_em,
  arquivadaMotivo: row.arquivada_motivo,
  hubspotDealId: row.hubspot_deal_id,
  flixsignEnvelopeId: row.flixsign_envelope_id,
});

// ---------------------------------------------------------------------------
// Leitura
// ---------------------------------------------------------------------------

const porOperacao = <T extends { operacao_id: string }>(rows: T[]) => {
  const mapa = new Map<string, T[]>();
  for (const r of rows) {
    const lista = mapa.get(r.operacao_id);
    if (lista) lista.push(r);
    else mapa.set(r.operacao_id, [r]);
  }
  return mapa;
};

/**
 * Carrega o funil completo.
 *
 * Cinco consultas em paralelo em vez de joins aninhados: a RLS das tabelas
 * filhas já filtra pela permissão da operação-pai, então o resultado é o mesmo
 * e cada consulta permanece simples de auditar.
 */
export const listarOperacoesDb = async (): Promise<Operacao[]> => {
  const [ops, checklist, signatarios, pessoas, historico] = await Promise.all([
    // Arquivadas ficam fora do quadro — a área pediu que a operação perdida
    // "suma do painel". O registro continua no banco (ver migration 20260904).
    dbFunil
      .from("operacoes_formalizacao")
      .select("*")
      .eq("arquivada", false)
      .order("data_entrada_funil", { ascending: false }),
    dbFunil.from("operacoes_formalizacao_checklist").select("*"),
    dbFunil.from("operacoes_formalizacao_signatarios").select("*"),
    dbFunil.from("operacoes_formalizacao_pessoas").select("*"),
    dbFunil.from("operacoes_formalizacao_historico").select("*"),
  ]);

  const erro = ops.error ?? checklist.error ?? signatarios.error ?? pessoas.error ?? historico.error;
  if (erro) throw erro;

  const porChecklist = porOperacao(checklist.data ?? []);
  const porSignatario = porOperacao(signatarios.data ?? []);
  const porPessoa = porOperacao(pessoas.data ?? []);
  const porHistorico = porOperacao(historico.data ?? []);

  return (ops.data ?? []).map((row) =>
    montarOperacao(
      row,
      porChecklist.get(row.id) ?? [],
      porSignatario.get(row.id) ?? [],
      porPessoa.get(row.id) ?? [],
      porHistorico.get(row.id) ?? [],
    ),
  );
};

/** SLA e títulos configurados por etapa. */
export const carregarSlaDb = async (): Promise<SlaRow[]> => {
  const { data, error } = await dbFunil
    .from("operacoes_formalizacao_sla")
    .select("*")
    .order("ordem", { ascending: true });
  if (error) throw error;
  return data ?? [];
};

// ---------------------------------------------------------------------------
// Escrita
// ---------------------------------------------------------------------------

const cnpjParaBanco = (cnpj?: string): string | null => {
  const digitos = String(cnpj ?? "").replace(/\D/g, "");
  return digitos.length === 0 ? null : normalizeCnpj(digitos);
};

/**
 * Persiste a operação inteira: cabeçalho, checklist, signatários e as
 * movimentações que ainda não existem no banco.
 *
 * Sobre o histórico: a mudança de etapa é registrada pelo **trigger**
 * `trg_operacao_formalizacao_audita`, não por aqui. As movimentações gravadas
 * nesta função são as notas descritivas que a aplicação cria (o "porquê"),
 * enquanto o trigger registra o fato auditável (o "o quê"). Por isso a policy
 * de INSERT do histórico exige `etapa_de`/`etapa_para` nulos.
 */
export const salvarOperacaoDb = async (op: Operacao): Promise<Operacao> => {
  const { error: erroOperacao } = await dbFunil
    .from("operacoes_formalizacao")
    .update({
      unidade: op.unidade,
      cnpj: cnpjParaBanco(op.cnpj),
      linha: op.linha,
      fundo: op.fundo,
      valor_bruto: op.valorBruto,
      valor_tac: op.valorTac,
      // valor_liquido_previsto é coluna gerada — o banco calcula, não se grava.
      valor_liquido_depositado: op.valorLiquidoDepositado ?? null,
      taxa: op.taxa,
      taxa_percentual: op.taxaPercentual ?? null,
      taxa_tipo: op.taxaTipo ?? null,
      prazo_meses: op.prazoMeses,
      numero_parcelas: op.numeroParcelas ?? null,
      carencia_total_meses: op.carenciaTotalMeses ?? null,
      carencia_principal_meses: op.carenciaPrincipalMeses ?? null,
      conta_deposito: op.contaDeposito ?? null,
      etapa: op.etapa,
      alerta_tipo: op.alerta ? (op.alerta.tipo === "Pendência" ? "pendencia" : "reprovado") : null,
      alerta_mensagem: op.alerta?.mensagem ?? null,
      destinatarios: op.destinatarios ?? [],
      comprovante_desembolso: op.comprovanteDesembolso ?? null,
      id_operacao: op.idOperacao ?? null,
      flixsign_envelope_id: op.flixsignEnvelopeId ?? null,
      origem_ultima_alteracao: "painel",
    })
    .eq("id", op.id);

  if (erroOperacao) throw erroOperacao;

  // Checklist e signatários: só as linhas já existentes no banco são atualizadas.
  // Itens criados na UI sem id do banco entram na Story 3.4, junto dos anexos.
  await Promise.all([
    ...op.checklist
      .filter((item) => !item.id.startsWith("novo-"))
      .map((item) =>
        dbFunil
          .from("operacoes_formalizacao_checklist")
          .update({
            checked: item.checked,
            pendente: item.pendente ?? false,
            anexo_nome: item.anexoNome ?? null,
          })
          .eq("id", item.id),
      ),
    ...op.signatarios.map((s) =>
      dbFunil
        .from("operacoes_formalizacao_signatarios")
        .update({
          status: s.status === "Assinado" ? "assinado" : "pendente",
          assinado_em: s.status === "Assinado" ? (s.assinadoEm ?? new Date().toISOString()) : null,
        })
        .eq("id", s.id),
    ),
  ]);

  await persistirMovimentacoesNovas(op);

  return op;
};

/** Movimentações locais ainda não gravadas recebem id `mov-N` (ver `mov()`). */
const persistirMovimentacoesNovas = async (op: Operacao) => {
  const novas = op.historico.filter((h) => h.id.startsWith("mov-"));
  if (novas.length === 0) return;

  const { data: sessao } = await dbFunil.auth.getUser();
  const autorId = sessao.user?.id ?? null;
  if (!autorId) return; // sem usuário autenticado a policy rejeitaria de qualquer forma

  const { error } = await dbFunil.from("operacoes_formalizacao_historico").insert(
    novas.map((h) => ({
      operacao_id: op.id,
      descricao: h.descricao,
      autor: h.autor,
      autor_id: autorId,
      etapa_de: null,
      etapa_para: null,
      origem: "painel" as const,
    })),
  );
  if (error) throw error;
};
