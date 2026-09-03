import { toast } from "@/hooks/use-toast";
import type { Operacao } from "./operacoes";
import { formatCurrency } from "@/utils/currency";
import { supabase } from "@/integrations/supabase/client";

export type EventoNotificacao =
  | "enviado_analise"
  | "aprovado"
  | "falta_documentacao"
  | "reprovado"
  | "contrato_emitido"
  | "assinaturas_concluidas"
  | "desembolsado"
  | "teste";

const assunto = (evento: EventoNotificacao, op: Operacao): string => {
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
      return `${base} desembolsada (${formatCurrency(op.valor)})`;
    case "teste":
      return `[Teste] ${base} — exemplo de notificação`;
  }
};

const corpo = (evento: EventoNotificacao, op: Operacao, etapaTitulo: string, detalhe?: string) => `
  <div style="font-family: Arial, Helvetica, sans-serif; color:#1a1a1a; max-width:560px">
    <h2 style="color:#7200d6; margin:0 0 12px">${assunto(evento, op)}</h2>
    <p style="margin:0 0 16px">A operação abaixo mudou de etapa no Painel de Crédito PJ.</p>
    <table style="border-collapse:collapse; font-size:14px">
      <tr><td style="padding:4px 12px 4px 0; color:#6b7280">Unidade</td><td><strong>${op.unidade}</strong></td></tr>
      <tr><td style="padding:4px 12px 4px 0; color:#6b7280">Linha de crédito</td><td>${op.linha}</td></tr>
      <tr><td style="padding:4px 12px 4px 0; color:#6b7280">Fundo</td><td>${op.fundo}</td></tr>
      <tr><td style="padding:4px 12px 4px 0; color:#6b7280">Valor</td><td>${formatCurrency(op.valor)}</td></tr>
      <tr><td style="padding:4px 12px 4px 0; color:#6b7280">Taxa</td><td>${op.taxa}</td></tr>
      <tr><td style="padding:4px 12px 4px 0; color:#6b7280">Prazo</td><td>${op.prazoMeses}x</td></tr>
      <tr><td style="padding:4px 12px 4px 0; color:#6b7280">Etapa atual</td><td><strong>${etapaTitulo}</strong></td></tr>
    </table>
    ${detalhe ? `<p style="margin:16px 0 0; padding:12px; background:#f5f0ff; border-left:4px solid #7200d6"><strong>Observação:</strong> ${detalhe}</p>` : ""}
    <p style="margin:24px 0 0; font-size:12px; color:#6b7280">MaisTODOS — Painel de Crédito PJ</p>
  </div>
`;

/**
 * Envia a notificação do evento por e-mail.
 * Usa a edge function `send-operacao-email`, que fala direto com o Resend e
 * exige usuário autenticado (Story 2.5). Enquanto `RESEND_API_KEY` e
 * `EMAIL_REMETENTE` não estiverem configurados no ambiente, a function responde
 * em modo simulado — o fluxo roda inteiro, só não sai e-mail.
 */
export async function notificar(
  evento: EventoNotificacao,
  dadosOperacao: Operacao,
  destinatarios: string[] = dadosOperacao.destinatarios ?? [],
  detalhe?: string,
  etapaTitulo: string = dadosOperacao.etapa
) {
  const subject = assunto(evento, dadosOperacao);

  if (destinatarios.length === 0) {
    toast({
      title: "Nenhum destinatário definido",
      description: "Selecione os destinatários de e-mail no card da operação.",
      variant: "destructive",
    });
    return;
  }

  try {
    const { data, error } = await supabase.functions.invoke("send-operacao-email", {
      body: {
        to: destinatarios,
        subject,
        html: corpo(evento, dadosOperacao, etapaTitulo, detalhe),
      },
    });
    if (error) throw error;
    const simulado = !!(data as any)?.simulated;
    toast({
      title: simulado
        ? `E-mail simulado para: ${destinatarios.join(", ")}`
        : `E-mail enviado para: ${destinatarios.join(", ")}`,
      description: simulado
        ? `Assunto: ${subject} — configure RESEND_API_KEY e EMAIL_REMETENTE para envio real.`
        : `Assunto: ${subject}`,
    });
  } catch (err: any) {
    console.error("[notificar] falha", err);
    toast({
      title: "Falha ao enviar e-mail",
      description: err?.message ?? "Erro desconhecido",
      variant: "destructive",
    });
  }
}

/** Envia um e-mail de exemplo para o usuário logado. */
export const enviarEmailTeste = (op: Operacao, email: string) =>
  notificar("teste", op, [email], "E-mail de exemplo para validação de layout e conteúdo.");
