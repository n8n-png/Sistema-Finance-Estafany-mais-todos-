/**
 * Envia a notificação de mudança de etapa da operação.
 *
 * Story 2.5 — o que mudou e por quê:
 *  1. A function não exigia autenticação. Combinada com `to`, `subject` e `html`
 *     livres no corpo, era um relay de e-mail aberto: qualquer pessoa com a URL
 *     podia disparar mensagem arbitrária a qualquer destinatário, saindo de um
 *     remetente da MaisTODOS. Agora exige JWT de usuário válido.
 *  2. O envio passava pelo gateway do Lovable (`connector-gateway.lovable.dev`),
 *     que deixa de existir para nós após a migração. Agora fala direto com o
 *     Resend.
 *  3. O remetente estava fixo em `onboarding@resend.dev`. Passou para variável
 *     de ambiente — vai ser o grupo Crédito PJ assim que a Estefany confirmar
 *     o endereço e o domínio estiver verificado (SPF/DKIM).
 *  4. Limites de tamanho e de número de destinatários.
 */

import { corsHeaders, exigirUsuario, json } from "../_shared/auth.ts";

const RESEND_URL = "https://api.resend.com/emails";
const MAX_DESTINATARIOS = 20;
const MAX_HTML = 256 * 1024; // 256 KB

interface Corpo {
  to?: string[];
  subject?: string;
  html?: string;
}

const emailValido = (e: unknown): e is string =>
  typeof e === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && e.length <= 254;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);

  const auth = await exigirUsuario(req);
  if (!auth.ok) return auth.response;

  try {
    const corpo = (await req.json().catch(() => null)) as Corpo | null;
    const to = Array.isArray(corpo?.to) ? corpo!.to.filter(emailValido) : [];
    const subject = typeof corpo?.subject === "string" ? corpo.subject.slice(0, 300) : "";
    const html = typeof corpo?.html === "string" ? corpo.html : "";

    if (to.length === 0 || !subject || !html) {
      return json({ error: "to, subject e html são obrigatórios" }, 400);
    }
    if (to.length > MAX_DESTINATARIOS) {
      return json({ error: `No máximo ${MAX_DESTINATARIOS} destinatários por envio` }, 400);
    }
    if (html.length > MAX_HTML) {
      return json({ error: "Conteúdo do e-mail muito grande" }, 413);
    }

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    const REMETENTE = Deno.env.get("EMAIL_REMETENTE");

    // Sem chave configurada, responde em modo simulado em vez de falhar: permite
    // exercitar o fluxo completo antes de o domínio de e-mail estar verificado.
    if (!RESEND_API_KEY || !REMETENTE) {
      console.info("[send-operacao-email] modo simulado — integração não configurada", {
        to,
        subject,
        solicitante: auth.user.id,
      });
      return json({ simulated: true, to, subject });
    }

    const res = await fetch(RESEND_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({ from: REMETENTE, to, subject, html }),
    });

    if (!res.ok) {
      const detalhe = await res.text();
      console.error(`[send-operacao-email] Resend falhou [${res.status}]: ${detalhe}`);
      return json({ error: "Falha no envio de e-mail", status: res.status }, 502);
    }

    const data = await res.json();
    console.info("[send-operacao-email] enviado", {
      id: data?.id,
      destinatarios: to.length,
      solicitante: auth.user.id,
    });
    return json({ simulated: false, id: data?.id ?? null });
  } catch (err) {
    console.error("[send-operacao-email] erro inesperado", err);
    return json({ error: "Erro ao enviar o e-mail" }, 500);
  }
});
