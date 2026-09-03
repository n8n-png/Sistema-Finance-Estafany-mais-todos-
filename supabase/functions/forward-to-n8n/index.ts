/**
 * Encaminha a simulação de crédito para o fluxo do n8n.
 *
 * Story 2.5 — o que mudou e por quê:
 *  1. A function não exigia autenticação. Como edge functions ficam expostas na
 *     internet, qualquer pessoa com a URL podia despejar payload arbitrário no
 *     webhook do n8n da empresa. Agora exige JWT de usuário válido.
 *  2. A URL do webhook estava fixa no código. Passou para variável de ambiente,
 *     para que a migração do n8n cloud para o Dokploy não exija alterar código.
 *  3. O corpo da requisição agora tem limite de tamanho.
 */

import { corsHeaders, exigirUsuario, json } from "../_shared/auth.ts";

const TAMANHO_MAXIMO = 128 * 1024; // 128 KB — simulação é um objeto pequeno

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);

  const auth = await exigirUsuario(req);
  if (!auth.ok) return auth.response;

  const WEBHOOK_URL = Deno.env.get("N8N_WEBHOOK_URL");
  if (!WEBHOOK_URL) {
    console.error("[forward-to-n8n] N8N_WEBHOOK_URL ausente no ambiente");
    return json({ error: "Integração não configurada" }, 500);
  }

  try {
    const bruto = await req.text();
    if (bruto.length > TAMANHO_MAXIMO) {
      return json({ error: "Payload muito grande" }, 413);
    }

    let corpo: unknown;
    try {
      corpo = JSON.parse(bruto);
    } catch {
      return json({ error: "JSON inválido" }, 400);
    }

    const headers: Record<string, string> = { "Content-Type": "application/json" };

    // Segredo compartilhado opcional: permite ao n8n rejeitar chamadas que não
    // venham desta function, mesmo que a URL do webhook vaze.
    const segredo = Deno.env.get("N8N_WEBHOOK_SECRET");
    if (segredo) headers["X-Webhook-Secret"] = segredo;

    const res = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers,
      // Identifica quem originou a chamada, para rastreio no n8n.
      body: JSON.stringify({ ...(corpo as Record<string, unknown>), _origem_user_id: auth.user.id }),
    });

    const texto = await res.text();
    if (!res.ok) {
      console.error("[forward-to-n8n] n8n respondeu com erro", res.status, texto);
      // Não devolve o corpo da resposta do n8n ao cliente: pode conter detalhe
      // interno do fluxo. O suficiente é saber que a integração falhou.
      return json({ error: "Falha na integração", status: res.status }, 502);
    }

    return json({ ok: true, response: texto });
  } catch (err) {
    console.error("[forward-to-n8n] erro inesperado", err);
    return json({ error: "Erro ao encaminhar a requisição" }, 500);
  }
});
