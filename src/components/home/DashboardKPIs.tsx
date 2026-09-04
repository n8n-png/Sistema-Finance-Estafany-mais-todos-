import { useState } from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLimites } from "@/hooks/useLimites";
import {
  Building2,
  Wallet,
  Activity,
  RefreshCw,
  Receipt,
  Banknote,
  FileText,
  Landmark,
  ArrowUp,
  ArrowDown,
  Minus,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { listarOperacoes } from "@/services/operacoes";
import {
  Tooltip as UITooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const formatBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const formatCompact = (n: number) => {
  if (n >= 1_000_000_000) return `R$ ${(n / 1_000_000_000).toFixed(1).replace(".", ",")} bi`;
  if (n >= 1_000_000) return `R$ ${(n / 1_000_000).toFixed(1).replace(".", ",")} mi`;
  if (n >= 1_000) return `R$ ${(n / 1_000).toFixed(0)} mil`;
  return formatBRL(n);
};

const isActive = (s: string | null) => {
  if (!s) return false;
  const v = s.trim().toLowerCase();
  if (!v) return false;
  return !["inativo", "encerrado", "cancelado", "bloqueado", "0", "não", "nao", "no"].includes(v);
};



const PERIODO_LABELS: Record<string, string> = {
  "3": "últimos 3 meses",
  "6": "últimos 6 meses",
  "12": "últimos 12 meses",
  all: "tudo",
};

export const DashboardKPIs = () => {
  const [periodoCards, setPeriodoCards] = useState<string>("12");
  const [periodoGraficos, setPeriodoGraficos] = useState<string>("12");
  const { data: limites, isLoading } = useLimites();

  const { data: lastUpdate } = useQuery({
    queryKey: ["last_import"],
    queryFn: async () => {
      const { data } = await supabase
        .from("import_history")
        .select("created_at")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data?.created_at as string | undefined;
    },
  });

  // Operações ativas: ticket médio e valor total desembolsado
  const { data: operacoes } = useQuery({
    queryKey: ["indicadores-operacoes-ativas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("operacoes_ativas")
        .select("valor_operacao, data_emissao")
        .range(0, 9999);
      if (error) throw error;
      return (data ?? []).map((r) => ({
        valor: Number(r.valor_operacao) || 0,
        dataEmissao: r.data_emissao as string | null,
      }));
    },
  });


  // Evolução mês a mês: snapshots agrupados por import_id
  const { data: evolucao } = useQuery({
    queryKey: ["indicadores-evolucao-desembolso"],
    queryFn: async () => {
      const { data: imports, error: impErr } = await supabase
        .from("operacoes_import_history")
        .select("id, created_at")
        .order("created_at", { ascending: true });
      if (impErr) throw impErr;

      const { data: snaps, error: snapErr } = await supabase
        .from("operacoes_snapshots")
        .select("import_id, valor_operacao")
        .range(0, 49999);
      if (snapErr) throw snapErr;

      const totals = new Map<string, number>();
      (snaps ?? []).forEach((s) => {
        totals.set(s.import_id, (totals.get(s.import_id) ?? 0) + (Number(s.valor_operacao) || 0));
      });

      return (imports ?? [])
        .filter((i) => totals.has(i.id))
        .map((i) => ({
          label: new Date(i.created_at).toLocaleDateString("pt-BR", {
            month: "short",
            year: "2-digit",
          }),
          valor: totals.get(i.id)!,
          ts: new Date(i.created_at).getTime(),
        }));
    },
  });

  // Operações por fundo — protótipo (desembolsadas no mês corrente)
  const { data: porFundo } = useQuery({
    queryKey: ["indicadores-operacoes-por-fundo-mes"],
    queryFn: async () => {
      const ops = await listarOperacoes();
      const now = new Date();
      const acc = {
        valora: { qtd: 0, valor: 0 },
        xvi: { qtd: 0, valor: 0 },
      };
      ops.forEach((o) => {
        if (o.etapa !== "desembolsado") return;
        const d = new Date(o.dataEntradaEtapa);
        if (isNaN(d.getTime())) return;
        if (d.getMonth() !== now.getMonth() || d.getFullYear() !== now.getFullYear()) return;
        const bucket = o.fundo === "FIDC MaisTODOS" ? acc.valora : null;

        if (!bucket) return;
        bucket.qtd += 1;
        bucket.valor += Number(o.valorBruto) || 0;
      });
      return acc;
    },
  });

  // Valor contratado por mês — protótipo (Operações em Formalização desembolsadas)
  const { data: contratadoPorMes } = useQuery({
    queryKey: ["indicadores-contratado-por-mes-formalizacao"],
    queryFn: async () => {
      const ops = await listarOperacoes();
      const totals = new Map<string, { label: string; valor: number; ts: number }>();
      ops.forEach((o) => {
        if (o.etapa !== "desembolsado") return;
        const d = new Date(o.dataEntradaEtapa);
        if (isNaN(d.getTime())) return;
        const key = `${d.getFullYear()}-${d.getMonth()}`;
        const cur =
          totals.get(key) ??
          {
            label: d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }),
            valor: 0,
            ts: new Date(d.getFullYear(), d.getMonth(), 1).getTime(),
          };
        cur.valor += Number(o.valorBruto) || 0;
        totals.set(key, cur);
      });
      return Array.from(totals.values()).sort((a, b) => a.ts - b.ts);
    },
  });


  // Desembolsos do mês corrente — protótipo (Operações em Formalização)
  const { data: desembolsosMes } = useQuery({
    queryKey: ["indicadores-desembolsos-mes-formalizacao"],
    queryFn: async () => {
      const ops = await listarOperacoes();
      const now = new Date();
      return ops.filter((o) => {
        if (o.etapa !== "desembolsado") return false;
        const d = new Date(o.dataEntradaEtapa);
        return (
          !isNaN(d.getTime()) &&
          d.getMonth() === now.getMonth() &&
          d.getFullYear() === now.getFullYear()
        );
      });
    },
  });

  const contratadoMes = desembolsosMes?.reduce((s, o) => s + (Number(o.valorBruto) || 0), 0);
  const propostasMes = desembolsosMes?.length;

  const total = limites?.length ?? 0;
  const ativos = limites?.filter((c) => isActive(c.status_operacoes)).length ?? 0;

  const makeCutoff = (p: string) => {
    if (p === "all") return null;
    const d = new Date();
    d.setMonth(d.getMonth() - Number(p));
    return d;
  };

  const cutoffCards = makeCutoff(periodoCards);
  const cutoffGraficos = makeCutoff(periodoGraficos);

  const operacoesPeriodo = (operacoes ?? []).filter((o) => {
    if (!cutoffCards) return true;
    if (!o.dataEmissao) return false;
    const d = new Date(o.dataEmissao);
    return !isNaN(d.getTime()) && d >= cutoffCards;
  });

  const valorDesembolsado = operacoesPeriodo.reduce((s, o) => s + o.valor, 0);
  const ticketMedio = operacoesPeriodo.length ? valorDesembolsado / operacoesPeriodo.length : 0;

  const evolucaoFiltrada = (evolucao ?? []).filter(
    (e) => !cutoffGraficos || e.ts >= cutoffGraficos.getTime()
  );
  const contratadoFiltrado = (contratadoPorMes ?? []).filter(
    (m) => !cutoffGraficos || m.ts >= cutoffGraficos.getTime()
  );



  // Período imediatamente anterior de mesmo tamanho (para variação %)
  const cutoffPrev = (() => {
    if (periodoCards === "all") return null;
    const d = new Date();
    d.setMonth(d.getMonth() - Number(periodoCards) * 2);
    return d;
  })();

  const operacoesPeriodoAnterior =
    cutoffPrev && cutoffCards
      ? (operacoes ?? []).filter((o) => {
          if (!o.dataEmissao) return false;
          const d = new Date(o.dataEmissao);
          return !isNaN(d.getTime()) && d >= cutoffPrev && d < cutoffCards;
        })
      : [];

  const valorDesembolsadoAnterior = operacoesPeriodoAnterior.reduce((s, o) => s + o.valor, 0);
  const ticketMedioAnterior = operacoesPeriodoAnterior.length
    ? valorDesembolsadoAnterior / operacoesPeriodoAnterior.length
    : 0;

  const variacao = (atual: number, anterior: number) => {
    if (!operacoes || !anterior || !isFinite(anterior)) return null;
    return ((atual - anterior) / anterior) * 100;
  };

  const Delta = ({ pct }: { pct: number | null }) => {
    if (pct === null)
      return (
        <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-muted-foreground">
          <Minus className="h-3 w-3" />—
        </span>
      );
    const up = pct >= 0;
    const Icon = up ? ArrowUp : ArrowDown;
    return (
      <span
        className={`inline-flex items-center gap-0.5 text-[10px] font-semibold ${
          up ? "text-emerald-600" : "text-muted-foreground"
        }`}
      >
        <Icon className="h-3 w-3" />
        {Math.abs(pct).toFixed(0)}%
      </span>
    );
  };

  type Metric = {
    icon: typeof Building2;
    label: string;
    value: string;
    hint?: string;
    delta?: number | null;
    proto?: boolean;
  };

  const painelCarteira: Metric[] = [
    {
      icon: Building2,
      label: "Estabelecimentos",
      value: isLoading ? "…" : total.toLocaleString("pt-BR"),
      hint: `${ativos.toLocaleString("pt-BR")} com operação ativa`,
    },
    {
      icon: Activity,
      label: "Operações ativas",
      value: isLoading ? "…" : ativos.toLocaleString("pt-BR"),
    },
    {
      icon: RefreshCw,
      label: "Última atualização",
      value: lastUpdate
        ? new Date(lastUpdate).toLocaleDateString("pt-BR", {
            day: "2-digit",
            month: "2-digit",
            year: "2-digit",
          })
        : "—",
    },
  ];

  const painelFinanceiro: Metric[] = [
    {
      icon: Receipt,
      label: "Ticket médio",
      value: operacoes ? formatCompact(ticketMedio) : "…",
      delta: variacao(ticketMedio, ticketMedioAnterior),
    },
    {
      icon: Banknote,
      label: "Valor total desembolsado",
      value: operacoes ? formatCompact(valorDesembolsado) : "…",
      delta: variacao(valorDesembolsado, valorDesembolsadoAnterior),
    },
    {
      icon: Wallet,
      label: "Contratado no mês",
      value: contratadoMes === undefined ? "…" : formatCompact(contratadoMes),
      proto: true,
    },
  ];

  const painelFormalizacao: Metric[] = [
    {
      icon: FileText,
      label: "Propostas no mês",
      value: propostasMes === undefined ? "…" : propostasMes.toLocaleString("pt-BR"),
    },
    {
      icon: Landmark,
      label: "Operações Valora (mês)",
      value: porFundo ? `${porFundo.valora.qtd} · ${formatCompact(porFundo.valora.valor)}` : "…",
    },
    {
      icon: Landmark,
      label: "Operações XVI (mês)",
      value: porFundo ? `${porFundo.xvi.qtd} · ${formatCompact(porFundo.xvi.valor)}` : "…",
    },
  ];


  const protoBadge = (
    <UITooltip>
      <TooltipTrigger asChild>
        <span className="crm-pill cursor-help text-muted-foreground ring-1 ring-border">
          Dados de exemplo
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-[240px] text-xs leading-snug">
        Baseado no protótipo de Operações em Formalização — ainda não integrado ao HubSpot.
      </TooltipContent>
    </UITooltip>
  );

  const Painel = ({
    title,
    metrics,
    proto,
  }: {
    title: string;
    metrics: Metric[];
    proto?: boolean;
  }) => (
    <div
      className={`rounded-lg border p-5 ${proto ? "border-dashed bg-muted/30" : "bg-card"}`}
    >
      <div className="mb-4 flex items-center justify-between gap-2">
        <span className="truncate text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </span>
        {proto && protoBadge}
      </div>
      <div className="flex flex-col divide-y divide-border">
        {metrics.map((m, i) => (
          <div
            key={m.label}
            className={`w-full ${i === 0 ? "pb-3" : i === metrics.length - 1 ? "pt-3" : "py-3"}`}
          >
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <m.icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="text-[11px] uppercase leading-tight tracking-wide text-muted-foreground">
                {m.label}
              </span>
              {m.proto && !proto && protoBadge}
            </div>
            <div className="mt-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span
                className={`text-xl font-bold leading-tight ${
                  proto || m.proto ? "text-muted-foreground" : "text-primary"
                }`}
              >
                {m.value}
              </span>
              {"delta" in m && <Delta pct={m.delta ?? null} />}
            </div>
            {m.hint && (
              <div className="mt-1 text-[11px] leading-snug text-muted-foreground">{m.hint}</div>
            )}
          </div>
        ))}
      </div>


    </div>
  );

  const periodSelect = (value: string, onChange: (v: string) => void, label: string) => (
    <div className="flex min-w-[170px] flex-col gap-1">
      <span className="mb-1 crm-field-label">{label}</span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-9 min-w-[200px] rounded-md border bg-background px-2 text-sm font-normal shadow-none focus:ring-1 focus:ring-primary focus:ring-offset-0">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="3">Últimos 3 meses</SelectItem>
          <SelectItem value="6">Últimos 6 meses</SelectItem>
          <SelectItem value="12">Últimos 12 meses</SelectItem>
          <SelectItem value="all">Tudo</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );


  return (
    <TooltipProvider>
    <div className="mx-auto mb-8 max-w-[1360px] space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-display font-bold text-foreground">Relatórios</h2>
      </div>

      <div className="crm-filterbar flex flex-wrap items-center gap-6">
        <div className="min-w-[200px]">
          <div className="mb-1 crm-field-label">Módulo</div>
          <div className="flex h-9 items-center rounded-md border bg-background px-2 text-sm font-medium text-foreground">
            Crédito PJ
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-6">
          {periodSelect(periodoCards, setPeriodoCards, "Cards")}
          {periodSelect(periodoGraficos, setPeriodoGraficos, "Gráficos")}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
        <Painel title="Carteira" metrics={painelCarteira} />
        <Painel
          title={`Financeiro (${PERIODO_LABELS[periodoCards]})`}
          metrics={painelFinanceiro}
        />
        <Painel title="Formalização (protótipo)" metrics={painelFormalizacao} proto />
      </div>


      <div className="grid gap-4 xl:grid-cols-2">


      <div className="rounded-lg border border-dashed bg-muted/30 p-4">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
          <div>
          <h2 className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase text-muted-foreground">
            Valor contratado por mês — Operações em Formalização (desembolsado)
            {protoBadge}
          </h2>
          <p className="text-xs text-muted-foreground font-normal">
            Soma do valor das operações desembolsadas, por mês de desembolso (
            {PERIODO_LABELS[periodoGraficos]}).
          </p>
          </div>
        </div>
        {!contratadoPorMes ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : contratadoFiltrado.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem dados ainda.</p>
        ) : (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={contratadoFiltrado} margin={{ top: 8, right: 16, bottom: 0, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  stroke="hsl(var(--border))"
                />
                <YAxis
                  tickFormatter={(v) => formatCompact(Number(v))}
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  stroke="hsl(var(--border))"
                  width={80}
                />
                <Tooltip
                  formatter={(v) => formatBRL(Number(v))}
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="valor"
                  stroke="hsl(var(--muted-foreground))"
                  strokeWidth={2.5}
                  strokeDasharray="5 4"
                  dot={{ r: 3, fill: "hsl(var(--muted-foreground))" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="rounded-lg border bg-card p-4">
        <div className="mb-4">
          <h2 className="text-xs font-semibold uppercase text-muted-foreground">
            Evolução do valor desembolsado
          </h2>
          <p className="text-xs text-muted-foreground font-normal">
            Base: cada importação arquivada da carteira de operações (
            {PERIODO_LABELS[periodoGraficos]}).
          </p>
        </div>
        {!evolucao ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : evolucaoFiltrada.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem dados ainda.</p>
        ) : (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={evolucaoFiltrada} margin={{ top: 8, right: 16, bottom: 0, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  stroke="hsl(var(--border))"
                />
                <YAxis
                  tickFormatter={(v) => formatCompact(Number(v))}
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  stroke="hsl(var(--border))"
                  width={80}
                />
                <Tooltip
                  formatter={(v) => formatBRL(Number(v))}
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="valor"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: "hsl(var(--primary))" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <p className="xl:col-span-2 text-[10px] leading-snug text-muted-foreground">
        Nota: distribuição por linha de produto (QIA / Recebíveis / Amor Saúde) não está disponível —
        os dados de operações ativas só trazem <code>tipo_op</code> (PRÉ, PRÉ/PÓS, FUMAÇA) e a
        franquia, que não identificam a linha de produto.
      </p>

      </div>
    </div>

    </TooltipProvider>
  );
};
