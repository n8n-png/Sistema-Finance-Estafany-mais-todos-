import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

// Pure monthly Price PMT (usado apenas para operações PRÉ-fixadas)
const pmt = (saldo: number, i: number, n: number) => {
  if (n <= 0 || saldo <= 0) return 0;
  if (i <= 0) return saldo / n;
  return (saldo * i) / (1 - Math.pow(1 + i, -n));
};

// Add month, keep day 15
const addMonth = (iso: string, k: number): string => {
  const d = new Date(iso + "T00:00:00");
  const y = d.getFullYear();
  const m = d.getMonth() + k;
  const nd = new Date(y, m, 15);
  const yy = nd.getFullYear();
  const mm = String(nd.getMonth() + 1).padStart(2, "0");
  return `${yy}-${mm}-15`;
};

const isoAddDays = (iso: string, n: number): string => {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
};

const isoDayOfWeek = (iso: string): number => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
};

// Mesma heurística de isPosFixado em src/components/ativos/AtivoDetalhes.tsx
const isPosFixado = (tipo: string | null | undefined, taxaRaw: string | null | undefined): boolean => {
  const raw = (taxaRaw ?? "").toLowerCase();
  if (raw.includes("cdi")) return true;
  const t = (tipo ?? "").toLowerCase();
  if (!t) return true;
  if (t.includes("pré/pós") || t.includes("pre/pos") || t.includes("/")) return true;
  if (t.includes("pós") || t.includes("pos")) return true;
  return false;
};

interface ProjectedRow {
  month: number;
  dueDate: string;
  payment: number;
  interest: number;
  principal: number;
  balance: number;
}

// Porta fiel de projectProRataDU (src/utils/calculations.ts).
// VLR_PAGAR_k = Amortização_k × ∏(fator CDI diário) × ∏(fator PRE diário)
// para cada dia útil em (data_emissao, vencimento_k].
const projectProRataDU = (opts: {
  valorOperacao: number;
  totalParcelas: number;
  dataEmissao: string;
  primeiroVencimento: string;
  spreadMensal: number;
  parcelaAtual: number;
  cdiDaily: Map<string, number>;
  lastCdiFactor: number;
  holidays: Set<string>;
  carenciaMeses?: number;
  carenciaTipo?: "principal" | "total";
  cdiAnual?: number;
}): ProjectedRow[] => {
  const {
    valorOperacao,
    totalParcelas: N,
    dataEmissao: t0,
    primeiroVencimento,
    spreadMensal: i,
    parcelaAtual,
    cdiDaily,
    lastCdiFactor,
    holidays,
    carenciaMeses = 0,
    carenciaTipo = "principal",
    cdiAnual,
  } = opts;
  if (!valorOperacao || !N || !t0 || !primeiroVencimento || !i) return [];

  const CDI_mensal = cdiAnual ? Math.pow(1 + cdiAnual, 1 / 12) - 1 : 0;
  const jurosMensal = i + CDI_mensal;
  const carencia = Math.max(0, Math.min(carenciaMeses, N - 1));

  // 1) Vencimentos (dia 15)
  const dueDates: string[] = [];
  for (let k = 1; k <= N; k++) {
    dueDates.push(k === 1 ? primeiroVencimento : addMonth(primeiroVencimento, k - 1));
  }

  // 2) Fatores diários acumulados (∏CDI × ∏PRE) por data
  const preDiario = Math.pow(1 + i, 1 / 21);
  const isBusiness = (iso: string) => {
    const dow = isoDayOfWeek(iso);
    if (dow === 0 || dow === 6) return false;
    return !holidays.has(iso);
  };
  const factorByDate = new Map<string, { cdi: number; pre: number }>();
  let cdiAcc = 1;
  let preAcc = 1;
  const lastDue = dueDates[N - 1];
  let cursor = isoAddDays(t0, 1);
  while (cursor <= lastDue) {
    if (isBusiness(cursor)) {
      const fc = cdiDaily.get(cursor) ?? lastCdiFactor;
      cdiAcc *= fc;
      preAcc *= preDiario;
    }
    factorByDate.set(cursor, { cdi: cdiAcc, pre: preAcc });
    cursor = isoAddDays(cursor, 1);
  }
  const factorAt = (iso: string) => factorByDate.get(iso) ?? { cdi: 1, pre: 1 };

  // 3) Cronograma base (amortização) — com carência quando houver
  type Base = { month: number; dueDate: string; amort: number; balance: number; payment?: number };
  const base: Base[] = [];

  if (carencia === 0) {
    const p = (valorOperacao * i) / (1 - Math.pow(1 + i, -N));
    let bal = valorOperacao;
    for (let k = 1; k <= N; k++) {
      const juros = bal * i;
      const amort = Math.max(p - juros, 0);
      bal = Math.max(bal - amort, 0);
      base.push({ month: k, dueDate: dueDates[k - 1], amort, balance: bal });
    }
  } else if (carenciaTipo === "principal") {
    for (let k = 1; k <= carencia; k++) {
      base.push({
        month: k,
        dueDate: dueDates[k - 1],
        amort: 0,
        balance: valorOperacao,
        payment: valorOperacao * jurosMensal,
      });
    }
    const nAmort = N - carencia;
    const p = (valorOperacao * i) / (1 - Math.pow(1 + i, -nAmort));
    let bal = valorOperacao;
    for (let k = carencia + 1; k <= N; k++) {
      const juros = bal * i;
      const amort = Math.max(p - juros, 0);
      bal = Math.max(bal - amort, 0);
      base.push({ month: k, dueDate: dueDates[k - 1], amort, balance: bal });
    }
  } else {
    const saldoBase = valorOperacao * Math.pow(1 + jurosMensal, carencia);
    for (let k = 1; k <= carencia; k++) {
      base.push({ month: k, dueDate: dueDates[k - 1], amort: 0, balance: saldoBase, payment: 0 });
    }
    const nAmort = N - carencia;
    const p = (saldoBase * i) / (1 - Math.pow(1 + i, -nAmort));
    let bal = saldoBase;
    for (let k = carencia + 1; k <= N; k++) {
      const juros = bal * i;
      const amort = Math.max(p - juros, 0);
      bal = Math.max(bal - amort, 0);
      base.push({ month: k, dueDate: dueDates[k - 1], amort, balance: bal });
    }
  }

  // 4) Parcelas com payment pré-computado (carência) usam o valor direto;
  //    demais aplicam o fator acumulado CDI×PRE.
  const rows: ProjectedRow[] = [];
  for (const row of base) {
    if (row.month < parcelaAtual) continue;
    let payment: number;
    if (row.payment !== undefined) {
      payment = row.payment;
    } else {
      const f = factorAt(row.dueDate);
      payment = row.amort * f.cdi * f.pre;
    }
    rows.push({
      month: row.month,
      dueDate: row.dueDate,
      payment,
      interest: payment - row.amort,
      principal: row.amort,
      balance: row.balance,
    });
  }
  return rows;
};

interface Snapshot {
  id: string;
  import_id: string;
  cnpj: string;
  id_valora: string | null;
  seu_numero: string | null;
  total_parcelas: number | null;
  parcela_atual: number | null;
  valor_parcela: number | null;
  valor_operacao: number | null;
  saldo_devedor: number | null;
  taxa_op: number | null;
  taxa_op_raw: string | null;
  tipo_op: string | null;
  data_emissao: string | null;
  primeiro_vencimento: string | null;
  data_vencimento_atual: string | null;
  carencia_principal: number | null;
}

const keyOf = (s: { id_valora: string | null; cnpj: string; seu_numero: string | null }) =>
  s.id_valora ? `V:${s.id_valora}` : `C:${s.cnpj}|${s.seu_numero ?? ""}`;

const overrideKey = (s: { cnpj: string; id_valora: string | null; seu_numero: string | null }) =>
  `${s.cnpj}|${s.id_valora ?? ""}|${s.seu_numero ?? ""}`;

const FALLBACK_CDI_AA = 0.1465;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // --- Guarda de autenticação/autorização (mesmo padrão de bulk-import-parcelas) ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Acesso negado" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // --- fim da guarda ---

    const body = await req.json().catch(() => ({}));
    const importId: string | undefined = body?.import_id;
    if (!importId) {
      return new Response(JSON.stringify({ error: "import_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }



    const pageAll = async <T>(build: (from: number, to: number) => any): Promise<T[]> => {
      const all: T[] = [];
      const PAGE = 1000;
      let from = 0;
      while (true) {
        const { data, error } = await build(from, from + PAGE - 1);
        if (error) throw error;
        const batch = (data ?? []) as T[];
        all.push(...batch);
        if (batch.length < PAGE) break;
        from += PAGE;
      }
      return all;
    };

    // 1. Load all snapshots for this import (paged)
    const loadAllSnaps = (impId: string) =>
      pageAll<Snapshot>((from, to) =>
        supabase
          .from("operacoes_snapshots")
          .select(
            "id,import_id,cnpj,id_valora,seu_numero,total_parcelas,parcela_atual,valor_parcela,valor_operacao,saldo_devedor,taxa_op,taxa_op_raw,tipo_op,data_emissao,primeiro_vencimento,data_vencimento_atual,carencia_principal",
          )
          .eq("import_id", impId)
          .range(from, to),
      );

    const currentSnaps = await loadAllSnaps(importId);

    // 1b. CDI diário, feriados e overrides — carregados UMA vez por execução
    const [cdiRows, holRows, ovRows] = await Promise.all([
      pageAll<{ date: string; factor: number }>((from, to) =>
        supabase.from("cdi_daily").select("date,factor").order("date", { ascending: true }).range(from, to),
      ),
      pageAll<{ date: string }>((from, to) => supabase.from("holidays").select("date").range(from, to)),
      pageAll<{ cnpj: string; id_valora: string | null; seu_numero: string | null; carencia_meses: number; carencia_tipo: string }>(
        (from, to) =>
          supabase
            .from("operacoes_overrides")
            .select("cnpj,id_valora,seu_numero,carencia_meses,carencia_tipo")
            .range(from, to),
      ),
    ]);

    const cdiDaily = new Map<string, number>();
    let lastCdiFactor = 1.00055131; // fallback ~14,65% a.a. base 252
    for (const r of cdiRows) {
      cdiDaily.set(r.date, Number(r.factor));
      lastCdiFactor = Number(r.factor);
    }
    const holidays = new Set<string>(holRows.map((r) => r.date));
    const overrides = new Map<string, { carencia_meses: number; carencia_tipo: "principal" | "total" }>();
    for (const o of ovRows) {
      overrides.set(overrideKey(o), {
        carencia_meses: Number(o.carencia_meses ?? 0),
        carencia_tipo: o.carencia_tipo === "total" ? "total" : "principal",
      });
    }

    // CDI anual: derivado do último fator diário disponível (fator^252 - 1).
    // Escolha deliberada: é a fonte mais robusta dentro da edge function — não depende
    // de rede/API externa (o BCB é instável) e é exatamente a mesma série usada no
    // cálculo pro-rata DU. Se a tabela estiver vazia, cai no fallback de 14,65% a.a.
    const cdiAnual = cdiRows.length ? Math.pow(lastCdiFactor, 252) - 1 : FALLBACK_CDI_AA;

    // 2. Find previous import
    const { data: prevImp } = await supabase
      .from("operacoes_import_history")
      .select("id, created_at")
      .lt("id", importId) // fallback tiebreaker
      .order("created_at", { ascending: false })
      .limit(20);
    // pick most recent import whose id != importId with snapshots
    let prevImportId: string | null = null;
    if (prevImp) {
      for (const row of prevImp) {
        if (row.id === importId) continue;
        const { count } = await supabase
          .from("operacoes_snapshots")
          .select("id", { count: "exact", head: true })
          .eq("import_id", row.id);
        if ((count ?? 0) > 0) {
          prevImportId = row.id;
          break;
        }
      }
    }

    const prevSnaps = prevImportId ? await loadAllSnaps(prevImportId) : [];
    const prevMap = new Map<string, Snapshot>();
    for (const s of prevSnaps) prevMap.set(keyOf(s), s);

    // 3. Compute projections for CURRENT import
    const projectionsToInsert: any[] = [];
    for (const s of currentSnaps) {
      const total = Number(s.total_parcelas ?? 0);
      const parcelaAtual = Number(s.parcela_atual ?? 0);
      const taxaPct = Number(s.taxa_op ?? 0);
      if (!total || !parcelaAtual || !taxaPct) continue;

      const ov = overrides.get(overrideKey(s));
      const carenciaMeses = ov?.carencia_meses ?? Number(s.carencia_principal ?? 0);
      const posFixado = isPosFixado(s.tipo_op, s.taxa_op_raw);
      const i = taxaPct / 100;

      // Reancoragem no saldo devedor REAL da ingestão mais recente (mesma lógica de
      // projectFromCurrent no front). Pós-fixado: taxa = CDI mensal atual + spread.
      const saldo = Number(s.saldo_devedor ?? 0);
      const dueIso = s.data_vencimento_atual;
      if (!saldo || !dueIso) continue;
      const parcelasRest = total - parcelaAtual + 1;
      if (parcelasRest <= 0) continue;

      const cdiMensal = posFixado ? Math.pow(1 + cdiAnual, 1 / 12) - 1 : 0;
      const taxaMensal = i + cdiMensal;
      const parcelaReal = Number(s.valor_parcela ?? 0);

      let bal = saldo;
      for (let k = 0; k < parcelasRest; k++) {
        let parcela: number;
        if (k === 0 && parcelaReal > 0) {
          parcela = parcelaReal;
        } else if (!posFixado && parcelaReal > 0) {
          parcela = parcelaReal;
        } else {
          parcela = pmt(bal, taxaMensal, parcelasRest - k);
        }
        const juros = bal * taxaMensal;
        const amort = Math.max(parcela - juros, 0);
        bal = Math.max(bal - amort, 0);
        projectionsToInsert.push({
          import_id: importId,
          cnpj: s.cnpj,
          id_valora: s.id_valora,
          seu_numero: s.seu_numero,
          month: parcelaAtual + k,
          due_date: k === 0 ? dueIso : addMonth(dueIso, k),
          projected_payment: Number(parcela.toFixed(2)),
          projected_interest: Number(juros.toFixed(2)),
          projected_amortization: Number(amort.toFixed(2)),
          projected_balance: Number(bal.toFixed(2)),
          taxa_mensal: taxaMensal,
          cdi_aa: posFixado ? cdiAnual : null,
        });
      }
      void carenciaMeses;

    }

    // 4. Save projections (upsert on unique)
    if (projectionsToInsert.length) {
      // clean previous projections for this import to keep idempotent
      await supabase.from("operacoes_projecoes").delete().eq("import_id", importId);
      const CHUNK = 500;
      for (let k = 0; k < projectionsToInsert.length; k += CHUNK) {
        const chunk = projectionsToInsert.slice(k, k + CHUNK);
        const { error } = await supabase.from("operacoes_projecoes").insert(chunk);
        if (error) throw error;
      }
    }

    // 5. Detect divergences against previous import
    const divergencesToInsert: any[] = [];
    if (prevImportId) {
      // load previous projections into memory keyed by (opKey, month)
      const prevProjs: Record<string, { projected_payment: number }> = {};
      const batchRows = await pageAll<{
        cnpj: string;
        id_valora: string | null;
        seu_numero: string | null;
        month: number;
        projected_payment: number;
      }>((from, to) =>
        supabase
          .from("operacoes_projecoes")
          .select("cnpj,id_valora,seu_numero,month,projected_payment")
          .eq("import_id", prevImportId)
          .range(from, to),
      );
      for (const r of batchRows) {
        prevProjs[`${keyOf(r)}|${r.month}`] = { projected_payment: Number(r.projected_payment) };
      }

      for (const cur of currentSnaps) {
        const prev = prevMap.get(keyOf(cur));
        if (!prev) continue;
        const prevP = Number(prev.parcela_atual ?? 0);
        const curP = Number(cur.parcela_atual ?? 0);
        if (!prevP || !curP || curP <= prevP) continue;
        // Paid parcels: [prevP .. curP-1]
        const actualPayment = Number(prev.valor_parcela ?? 0);
        for (let m = prevP; m < curP; m++) {
          const k = `${keyOf(cur)}|${m}`;
          const projRow = prevProjs[k];
          if (!projRow) continue;
          const proj = projRow.projected_payment;
          const diff = actualPayment - proj;
          if (Math.abs(diff) < 0.5) continue; // ignore rounding noise
          divergencesToInsert.push({
            cnpj: cur.cnpj,
            id_valora: cur.id_valora,
            seu_numero: cur.seu_numero,
            month: m,
            due_date: prev.data_vencimento_atual,
            projected_payment: Number(proj.toFixed(2)),
            actual_payment: Number(actualPayment.toFixed(2)),
            diff: Number(diff.toFixed(2)),
            diff_pct: proj > 0 ? Number(((diff / proj) * 100).toFixed(2)) : null,
            import_id_projected: prevImportId,
            import_id_actual: importId,
          });
        }
      }

      if (divergencesToInsert.length) {
        const CHUNK = 500;
        for (let k = 0; k < divergencesToInsert.length; k += CHUNK) {
          const chunk = divergencesToInsert.slice(k, k + CHUNK);
          const { error } = await supabase
            .from("operacoes_divergencias")
            .upsert(chunk, { onConflict: "id_valora,cnpj,seu_numero,month,import_id_actual" });
          if (error) throw error;
        }
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        import_id: importId,
        prev_import_id: prevImportId,
        cdi_aa: cdiAnual,
        projections: projectionsToInsert.length,
        divergences: divergencesToInsert.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("reconcile-operacoes error", err);
    return new Response(JSON.stringify({ error: err?.message ?? String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
