/**
 * Notificação de mudança de etapa da operação.
 *
 * Story 2.5 (autenticação) e alinhamento ao SECURITY.md do Hub MaisTODOS.
 *
 * Histórico do que foi corrigido aqui:
 *
 *  1. A function não exigia autenticação. Com `to`, `subject` e `html` livres no
 *     corpo, era um relay de e-mail aberto: qualquer pessoa com a URL disparava
 *     mensagem arbitrária, para qualquer destinatário, saindo de um remetente da
 *     MaisTODOS. Material de phishing pronto, com a reputação do domínio junto.
 *
 *  2. Mesmo depois de exigir JWT, aceitar HTML pronto do cliente continuava
 *     sendo um vetor: bastava uma conta comprometida — inclusive do time externo
 *     do fundo — para enviar qualquer conteúdo com a marca da empresa.
 *     **O corpo do e-mail passou a ser montado aqui no servidor**, a partir de
 *     dados lidos do banco. O cliente informa apenas QUAL operação e QUAL
 *     evento; não escolhe destinatário nem conteúdo.
 *     É a mesma lógica de defesa em profundidade da sanitização server-side
 *     descrita no SECURITY.md (S0.5.5) — só que aqui o vetor é eliminado por
 *     construção, sem precisar de sanitização.
 *
 *  3. Os destinatários vêm do campo `destinatarios` da própria operação, lido
 *     com o client do usuário — ou seja, passando pela RLS. Quem não enxerga a
 *     operação não consegue disparar e-mail sobre ela.
 *
 *  4. O envio passava pelo gateway do Lovable, que deixa de existir após a
 *     migração. Agora fala direto com o Resend.
 */

import { corsHeaders, exigirUsuario, json } from "../_shared/auth.ts";

const RESEND_URL = "https://api.resend.com/emails";
const MAX_DESTINATARIOS = 20;

type Evento =
  | "enviado_analise"
  | "aprovado"
  | "falta_documentacao"
  | "reprovado"
  | "contrato_emitido"
  | "assinaturas_concluidas"
  | "desembolsado"
  | "teste";

const EVENTOS: Evento[] = [
  "enviado_analise",
  "aprovado",
  "falta_documentacao",
  "reprovado",
  "contrato_emitido",
  "assinaturas_concluidas",
  "desembolsado",
  "teste",
];

interface Corpo {
  operacao_id?: string;
  evento?: Evento;
  detalhe?: string;
}

interface OperacaoEmail {
  id: string;
  unidade: string;
  linha: string;
  fundo: string;
  valor: number;
  taxa: string;
  prazo_meses: number;
  etapa: string;
  destinatarios: string[];
}

/** Escapa tudo que entra no HTML. Nenhum dado do banco é interpolado cru. */
const esc = (v: unknown): string =>
  String(v ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const moeda = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const emailValido = (e: unknown): e is string =>
  typeof e === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && e.length <= 254;

const assunto = (evento: Evento, op: OperacaoEmail): string => {
  const base = `Operação ${op.unidade}`;
  switch (evento) {
    case "enviado_analise":
      return `${base} — enviada para análise do fornecedor`;
    case "aprovado":
      return `${base} aprovada`;
    case "falta_documentacao":
      return `${base} — falta documentação`;
    case "reprovado":
      return `${base} reprovada`;
    case "contrato_emitido":
      return `${base} — contrato emitido, assinaturas pendentes`;
    case "assinaturas_concluidas":
      return `${base} — todas as assinaturas concluídas`;
    case "desembolsado":
      return `${base} desembolsada (${moeda(op.valor)})`;
    case "teste":
      return `[Teste] ${base} — exemplo de notificação`;
  }
};

const corpoHtml = (
  evento: Evento,
  op: OperacaoEmail,
  etapaTitulo: string,
  detalhe?: string,
) => `
  <div style="font-family: Arial, Helvetica, sans-serif; color:#1a1a1a; max-width:560px">
    <h2 style="color:#7200d6; margin:0 0 12px">${esc(assunto(evento, op))}</h2>
    <p style="margin:0 0 16px">A operação abaixo mudou de etapa no Painel de Crédito PJ.</p>
    <table style="border-collapse:collapse; font-size:14px">
      <tr><td style="padding:4px 12px 4px 0; color:#6b7280">Unidade</td><td><strong>${esc(op.unidade)}</strong></td></tr>
      <tr><td style="padding:4px 12px 4px 0; color:#6b7280">Linha de crédito</td><td>${esc(op.linha)}</td></tr>
      <tr><td style="padding:4px 12px 4px 0; color:#6b7280">Fundo</td><td>${esc(op.fundo)}</td></tr>
      <tr><td style="padding:4px 12px 4px 0; color:#6b7280">Valor</td><td>${esc(moeda(op.valor))}</td></tr>
      <tr><td style="padding:4px 12px 4px 0; color:#6b7280">Taxa</td><td>${esc(op.taxa)}</td></tr>
      <tr><td style="padding:4px 12px 4px 0; color:#6b7280">Prazo</td><td>${esc(op.prazo_meses)}x</td></tr>
      <tr><td style="padding:4px 12px 4px 0; color:#6b7280">Etapa atual</td><td><strong>${esc(etapaTitulo)}</strong></td></tr>
    </table>
    ${
      detalhe
        ? `<p style="margin:16px 0 0; padding:12px; background:#f5f0ff; border-left:4px solid #7200d6"><strong>Observação:</strong> ${esc(detalhe)}</p>`
        : ""
    }
    <p style="margin:24px 0 0; font-size:12px; color:#6b7280">MaisTODOS — Painel de Crédito PJ</p>
  </div>
`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);

  const auth = await exigirUsuario(req);
  if (!auth.ok) return auth.response;

  try {
    const corpo = (await req.json().catch(() => null)) as Corpo | null;
    const evento = corpo?.evento;
    const operacaoId = corpo?.operacao_id;

    if (!evento || !EVENTOS.includes(evento)) {
      return json({ error: "Evento inválido" }, 400);
    }
    if (typeof operacaoId !== "string" || !operacaoId) {
      return json({ error: "operacao_id é obrigatório" }, 400);
    }

    // Limite de tamanho da observação; o resto do conteúdo vem do banco.
    const detalhe = typeof corpo?.detalhe === "string" ? corpo.detalhe.slice(0, 500) : undefined;

    // Leitura com o client do USUÁRIO: a RLS decide. Quem não enxerga a
    // operação recebe 404 e não consegue disparar e-mail sobre ela.
    const { data: operacao, error: erroOperacao } = await auth.userClient
      .from("operacoes_formalizacao")
      .select("id, unidade, linha, fundo, valor, taxa, prazo_meses, etapa, destinatarios")
      .eq("id", operacaoId)
      .maybeSingle();

    if (erroOperacao) {
      console.error("[send-operacao-email] falha ao ler a operação", erroOperacao);
      return json({ error: "Falha ao carregar a operação" }, 500);
    }
    if (!operacao) return json({ error: "Operação não encontrada" }, 404);

    const op = operacao as OperacaoEmail;
    op.valor = Number(op.valor);

    const { data: sla } = await auth.userClient
      .from("operacoes_formalizacao_sla")
      .select("titulo")
      .eq("etapa", op.etapa)
      .maybeSingle();
    const etapaTitulo = sla?.titulo ?? op.etapa;

    // O e-mail de teste vai só para quem pediu. Os demais, para os destinatários
    // cadastrados na operação — nunca para uma lista informada pelo cliente.
    const destinatarios =
      evento === "teste"
        ? [auth.user.email].filter(emailValido)
        : (op.destinatarios ?? []).filter(emailValido);

    if (destinatarios.length === 0) {
      return json({ error: "Nenhum destinatário válido para esta operação" }, 400);
    }
    if (destinatarios.length > MAX_DESTINATARIOS) {
      return json({ error: `No máximo ${MAX_DESTINATARIOS} destinatários por envio` }, 400);
    }

    const subject = assunto(evento, op);
    const html = corpoHtml(evento, op, etapaTitulo, detalhe);

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    const REMETENTE = Deno.env.get("EMAIL_REMETENTE");

    // Sem chave configurada, responde em modo simulado em vez de falhar: permite
    // exercitar o fluxo completo antes de o domínio de e-mail estar verificado.
    if (!RESEND_API_KEY || !REMETENTE) {
      console.info("[send-operacao-email] modo simulado — integração não configurada", {
        to: destinatarios,
        subject,
        solicitante: auth.user.id,
      });
      return json({ simulated: true, to: destinatarios, subject });
    }

    const res = await fetch(RESEND_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({ from: REMETENTE, to: destinatarios, subject, html }),
    });

    if (!res.ok) {
      const erro = await res.text();
      console.error(`[send-operacao-email] Resend falhou [${res.status}]: ${erro}`);
      return json({ error: "Falha no envio de e-mail", status: res.status }, 502);
    }

    const data = await res.json();
    console.info("[send-operacao-email] enviado", {
      id: data?.id,
      destinatarios: destinatarios.length,
      operacao: op.id,
      solicitante: auth.user.id,
    });
    return json({ simulated: false, id: data?.id ?? null, to: destinatarios, subject });
  } catch (err) {
    console.error("[send-operacao-email] erro inesperado", err);
    return json({ error: "Erro ao enviar o e-mail" }, 500);
  }
});
