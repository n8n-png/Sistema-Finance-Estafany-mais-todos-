import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Não autenticado" }, 401);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) return json({ error: "Não autenticado" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (!isAdmin) return json({ error: "Acesso negado" }, 403);

    const { action, user_id, role, active } = await req.json();

    if (action === "list") {
      const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      if (error) throw error;
      const { data: roles, error: rolesErr } = await admin.from("user_roles").select("user_id, role");
      if (rolesErr) throw rolesErr;
      const roleMap = new Map<string, string>();
      (roles ?? []).forEach((r: any) => roleMap.set(r.user_id, r.role));
      const users = data.users.map((u) => ({
        id: u.id,
        email: u.email,
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at,
        banned_until: (u as any).banned_until ?? null,
        role: roleMap.get(u.id) ?? "user",
      }));
      return json({ users });
    }

    if (action === "update_role") {
      if (!user_id || !["admin", "user", "moderator"].includes(role)) {
        return json({ error: "Parâmetros inválidos" }, 400);
      }
      const { error: delErr } = await admin.from("user_roles").delete().eq("user_id", user_id);
      if (delErr) throw delErr;
      const { error: insErr } = await admin.from("user_roles").insert({ user_id, role });
      if (insErr) throw insErr;
      return json({ ok: true });
    }

    if (action === "set_active") {
      if (!user_id || typeof active !== "boolean") {
        return json({ error: "Parâmetros inválidos" }, 400);
      }
      if (user_id === user.id && !active) {
        return json({ error: "Você não pode desativar seu próprio acesso" }, 400);
      }
      const { error } = await admin.auth.admin.updateUserById(user_id, {
        ban_duration: active ? "none" : "876000h",
      } as any);
      if (error) throw error;
      return json({ ok: true });
    }

    return json({ error: "Ação desconhecida" }, 400);
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});
