/**
 * Autenticação compartilhada das edge functions — Story 2.5.
 *
 * O padrão já usado em `bulk-import-parcelas`, extraído para não ser reescrito
 * (nem esquecido) a cada function nova. Edge function sem esta verificação é
 * endpoint público na internet: qualquer um com a URL a executa.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

export interface UsuarioAutenticado {
  id: string;
  email?: string;
}

export type ResultadoAuth =
  | {
      ok: true;
      user: UsuarioAutenticado;
      /**
       * Client autenticado como o próprio usuário. Consultas feitas por ele
       * passam pela RLS — use-o sempre que a pergunta for "este usuário pode
       * ver isto?", em vez de consultar com service_role e checar na mão.
       */
      // deno-lint-ignore no-explicit-any
      userClient: any;
    }
  | { ok: false; response: Response };

/** Exige um JWT válido de usuário no header Authorization. */
export async function exigirUsuario(req: Request): Promise<ResultadoAuth> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { ok: false, response: json({ error: "Não autenticado" }, 401) };
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const ANON = Deno.env.get("SUPABASE_ANON_KEY");
  if (!SUPABASE_URL || !ANON) {
    console.error("[auth] SUPABASE_URL ou SUPABASE_ANON_KEY ausentes no ambiente");
    return { ok: false, response: json({ error: "Configuração ausente" }, 500) };
  }

  const userClient = createClient(SUPABASE_URL, ANON, {
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user },
    error,
  } = await userClient.auth.getUser();

  if (error || !user) {
    return { ok: false, response: json({ error: "Não autenticado" }, 401) };
  }

  return {
    ok: true,
    user: { id: user.id, email: user.email ?? undefined },
    userClient,
  };
}

/** Exige um JWT válido cujo dono tenha o papel `admin`. */
export async function exigirAdmin(req: Request): Promise<ResultadoAuth> {
  const auth = await exigirUsuario(req);
  if (!auth.ok) return auth;

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SERVICE_ROLE) {
    console.error("[auth] SUPABASE_SERVICE_ROLE_KEY ausente no ambiente");
    return { ok: false, response: json({ error: "Configuração ausente" }, 500) };
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
  const { data: isAdmin } = await admin.rpc("has_role", {
    _user_id: auth.user.id,
    _role: "admin",
  });

  if (!isAdmin) return { ok: false, response: json({ error: "Acesso negado" }, 403) };
  return auth;
}

export { corsHeaders };
