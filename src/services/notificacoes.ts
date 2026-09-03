import { toast } from "@/hooks/use-toast";
import type { Operacao } from "./operacoes.types";
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

/**
 * Dispara a notificação da operação por e-mail.
 *
 * O corpo do e-mail e a lista de destinatários **não são montados aqui**.
 * A edge function `send-operacao-email` lê a operação no banco (passando pela
 * RLS), monta o HTML e envia para os destinatários cadastrados na própria
 * operação. Daqui vai só o identificador da operação, o evento e uma observação
 * opcional.
 *
 * Por que assim: enquanto o cliente montava o HTML e escolhia os destinatários,
 * qualquer conta autenticada — inclusive do time externo do fundo — podia
 * disparar conteúdo arbitrário com a marca da MaisTODOS. Movendo a montagem
 * para o servidor, o vetor deixa de existir por construção.
 */
export async function notificar(
  evento: EventoNotificacao,
  operacao: Operacao,
  detalhe?: string,
): Promise<void> {
  try {
    const { data, error } = await supabase.functions.invoke("send-operacao-email", {
      body: { operacao_id: operacao.id, evento, detalhe },
    });
    if (error) throw error;

    const resposta = data as { simulated?: boolean; to?: string[]; subject?: string } | null;
    const destinatarios = resposta?.to ?? [];
    const simulado = !!resposta?.simulated;

    toast({
      title: simulado
        ? `E-mail simulado para: ${destinatarios.join(", ")}`
        : `E-mail enviado para: ${destinatarios.join(", ")}`,
      description: simulado
        ? `${resposta?.subject ?? ""} — configure RESEND_API_KEY e EMAIL_REMETENTE para envio real.`
        : (resposta?.subject ?? ""),
    });
  } catch (err: unknown) {
    console.error("[notificar] falha", err);
    toast({
      title: "Falha ao enviar e-mail",
      description:
        err instanceof Error && err.message ? err.message : "Erro desconhecido",
      variant: "destructive",
    });
  }
}

/**
 * Envia um e-mail de exemplo. O destinatário é sempre o próprio usuário
 * autenticado — resolvido no servidor, não informado pelo cliente.
 */
export const enviarEmailTeste = (op: Operacao) => notificar("teste", op);
