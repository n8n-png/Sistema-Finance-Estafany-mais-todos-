import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

interface ParcelaRow {
  id_valora?: string | null;
  seu_numero?: string | null;
  cnpj?: string | null;
  month?: number | string | null;
  due_date?: string | null;
  actual_payment?: number | string | null;
  note?: string | null;
}

const onlyDigits = (v: unknown) => String(v ?? "").replace(/\D/g, "");
const CHUNK = 500;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Não autenticado" }, 401);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) return json({ error: "Não autenticado" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (!isAdmin) return json({ error: "Acesso negado" }, 403);

    const body = await req.json().catch(() => null);
    const records: ParcelaRow[] = Array.isArray(body?.records) ? body.records : [];
    if (!records.length) return json({ error: "Nenhum registro recebido" }, 400);

    const errors: string[] = [];
    const valid: {
      cnpj: string;
      id_valora: string | null;
      seu_numero: string | null;
      month: number;
      due_date: string | null;
      actual_payment: number;
      note: string;
      created_by: string;
    }[] = [];

    records.forEach((r, i) => {
      const cnpj = onlyDigits(r.cnpj);
      const month = Number(r.month);
      const payment = Number(r.actual_payment);
      if (cnpj.length !== 14) return void errors.push(`Registro ${i + 1}: CNPJ inválido (${r.cnpj})`);
      if (!Number.isFinite(month) || month < 1) return void errors.push(`Registro ${i + 1}: parcela inválida (${r.month})`);
      if (!Number.isFinite(payment)) return void errors.push(`Registro ${i + 1}: valor pago inválido (${r.actual_payment})`);

      const due = typeof r.due_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(r.due_date) ? r.due_date : null;
      valid.push({
        cnpj,
        id_valora: r.id_valora ? String(r.id_valora) : null,
        seu_numero: r.seu_numero ? String(r.seu_numero) : null,
        month: Math.trunc(month),
        due_date: due,
        actual_payment: payment,
        note: "importado_planilha",
        created_by: user.id,
      });
    });

    let inserted = 0;
    let updated = 0;

    for (let start = 0; start < valid.length; start += CHUNK) {
      const batch = valid.slice(start, start + CHUNK);
      const { data, error } = await admin.rpc("bulk_upsert_parcelas_manuais", {
        _rows: batch.map(({ created_by: _ignored, note: _n, ...row }) => row),
        _user: user.id,
      });
      if (error) {
        errors.push(`Lote ${Math.floor(start / CHUNK) + 1}: ${error.message}`);
      } else {
        inserted += Number(data?.inserted ?? 0);
        updated += Number(data?.deleted ?? 0);
      }
    }

    return json({ ok: errors.length === 0, inserted: inserted - updated, updated, total: inserted, errors });

  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});
