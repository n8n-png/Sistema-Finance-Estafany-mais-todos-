import { useMemo, useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { toast } from "@/hooks/use-toast";
import { OperacaoAtiva } from "@/hooks/useOperacoesAtivas";
import { useOperacaoHistorico } from "@/hooks/useOperacaoHistorico";
import { useCdiDaily } from "@/hooks/useCdiDaily";
import { useOperacaoOverride, CarenciaTipo } from "@/hooks/useOperacaoOverride";
import { useParcelasManuais } from "@/hooks/useParcelasManuais";
import { projectFromCurrent, projectProRataDU } from "@/utils/calculations";
import { formatCurrency } from "@/utils/currency";
import { getCDI } from "@/utils/cdi";

import { ParcelaDetalheSheet, ParcelaDetalhe, ParcelaStatus } from "./ParcelaDetalheSheet";


const formatBRL = (v: number | null | undefined) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v ?? 0);

const formatDateIso = (iso: string | null) => {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};

const Field = ({ label, value }: { label: string; value: string }) => (
  <div className="py-2 border-b border-border last:border-0">
    <p className="crm-field-label">{label}</p>
    <p className="mt-0.5 text-sm text-foreground break-words">{value || "—"}</p>
  </div>
);

const isPosFixado = (tipo: string | null | undefined, taxaRaw: string | null | undefined): boolean => {
  const raw = (taxaRaw ?? "").toLowerCase();
  if (raw.includes("cdi")) return true;
  const t = (tipo ?? "").toLowerCase();
  if (!t) return true;
  if (t.includes("pré/pós") || t.includes("pre/pos") || t.includes("/")) return true;
  if (t.includes("pós") || t.includes("pos")) return true;
  return false;
};

// Devolve o ISO (dia 15) do vencimento da parcela `month`, sabendo o primeiro vencimento.
const dueForMonth = (primeiroVenc: string | null, month: number): string | null => {
  if (!primeiroVenc) return null;
  const [y, m] = primeiroVenc.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1 + (month - 1), 15));
  return dt.toISOString().slice(0, 10);
};

interface Props {
  operacao: OperacaoAtiva;
  onBack: () => void;
}

export const AtivoDetalhes = ({ operacao: o, onBack }: Props) => {
  const [selected, setSelected] = useState<ParcelaDetalhe | null>(null);
  const posFixado = isPosFixado(o.tipo_op, o.taxa_op_raw);

  const key = {
    cnpj: o.cnpj,
    id_valora: o.id_valora,
    seu_numero: o.seu_numero ?? o.nosso_numero ?? null,
    numeros: [o.seu_numero, o.nosso_numero].filter(Boolean) as string[],
  };
  const { data: hist } = useOperacaoHistorico(key);
  const { data: cdiData } = useCdiDaily();
  const { data: override, save: saveOverride } = useOperacaoOverride(key);
  const { data: manuais, upsertMany: saveManuais, remove: removeManual } = useParcelasManuais(key);

  // ---------- Bloco Carência ----------
  const [carenciaInput, setCarenciaInput] = useState<string>("");
  const [carenciaTipoInput, setCarenciaTipoInput] = useState<CarenciaTipo>("principal");

  useEffect(() => {
    if (override) {
      setCarenciaInput(String(override.carencia_meses));
      setCarenciaTipoInput(override.carencia_tipo);
    } else {
      setCarenciaInput(String(o.carencia_principal ?? 0));
      setCarenciaTipoInput("principal");
    }
  }, [override, o.carencia_principal]);

  const carenciaMesesEfetivo = override?.carencia_meses ?? (o.carencia_principal ?? 0);
  const carenciaTipoEfetivo: CarenciaTipo = override?.carencia_tipo ?? "principal";

  const handleSaveCarencia = async () => {
    const n = parseInt(carenciaInput, 10);
    if (isNaN(n) || n < 0) {
      toast({ title: "Valor inválido", description: "Informe um número inteiro >= 0.", variant: "destructive" });
      return;
    }
    try {
      await saveOverride.mutateAsync({ carencia_meses: n, carencia_tipo: carenciaTipoInput });
      toast({ title: "Carência salva", description: `${n} meses (${carenciaTipoInput === "total" ? "Total" : "Principal"}).` });
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: e?.message ?? String(e), variant: "destructive" });
    }
  };

  // ---------- Projeção ----------
  // Override manual de carência ativo = usuário está SIMULANDO um cenário hipotético
  // de carência futura -> mantém o motor pro-rata DU desde a emissão.
  const simulandoCarencia = !!override && (override.carencia_meses ?? 0) > 0;

  const projecao = useMemo(() => {
    const total = o.total_parcelas ?? 0;
    const M = o.parcela_atual ?? 0;
    const taxaPct = o.taxa_op ?? 0;
    if (!total || !M || !taxaPct) return [];

    if (simulandoCarencia && posFixado && cdiData && o.data_emissao && o.primeiro_vencimento && o.valor_operacao) {
      return projectProRataDU({
        valorOperacao: o.valor_operacao,
        totalParcelas: total,
        dataEmissao: o.data_emissao,
        primeiroVencimento: o.primeiro_vencimento,
        spreadMensal: taxaPct / 100,
        parcelaAtual: M,
        cdiDaily: cdiData.cdi,
        lastCdiFactor: cdiData.lastCdiFactor,
        holidays: cdiData.holidays,
        carenciaMeses: carenciaMesesEfetivo,
        carenciaTipo: carenciaTipoEfetivo,
        cdiAnual: carenciaMesesEfetivo > 0 ? getCDI() : undefined,
      });
    }

    const saldo = o.saldo_devedor ?? 0;
    const due = o.data_vencimento_atual;
    if (!saldo || !due) return [];
    const parcelasRest = total - M + 1;
    if (parcelasRest <= 0) return [];

    // Pós-fixado: reancora no saldo devedor REAL da última ingestão.
    // Taxa mensal = CDI mensal (derivado do último fator diário real de cdi_daily) + spread.
    let taxaMensal = taxaPct / 100;
    if (posFixado) {
      const lastFactor = cdiData?.lastCdiFactor ?? 1.00055131;
      const cdiAnual = Math.pow(lastFactor, 252) - 1;
      const cdiMensal = Math.pow(1 + cdiAnual, 1 / 12) - 1;
      taxaMensal = cdiMensal + taxaPct / 100;
    }

    return projectFromCurrent({
      saldoInicial: saldo,
      parcelasRestantes: parcelasRest,
      taxaMensal,
      proximoVencimento: due,
      startMonth: M,
      parcelaReal: o.valor_parcela ?? undefined,
      posFixado,
    });
  }, [o, posFixado, cdiData, carenciaMesesEfetivo, carenciaTipoEfetivo, simulandoCarencia]);


  // ---------- Pagas (snapshots + manual como fallback) ----------
  const pagasSnapshot = useMemo(() => {
    const map = new Map<number, { valor: number; due: string | null }>();
    const snaps = hist?.snapshots ?? [];
    for (let i = 0; i < snaps.length - 1; i++) {
      const cur = snaps[i];
      const nxt = snaps[i + 1];
      const pa = cur.parcela_atual ?? 0;
      const na = nxt.parcela_atual ?? 0;
      if (na > pa) {
        for (let m = pa; m < na; m++) {
          map.set(m, { valor: cur.valor_parcela ?? 0, due: cur.data_vencimento_atual });
        }
      }
    }
    return map;
  }, [hist]);

  const pagasCombinadas = useMemo(() => {
    const map = new Map<number, { valor: number; due: string | null; source: "snapshot" | "manual"; manualId?: string }>();
    for (const [m, info] of pagasSnapshot) map.set(m, { ...info, source: "snapshot" });
    for (const mn of manuais) {
      if (!map.has(mn.month)) {
        map.set(mn.month, { valor: mn.actual_payment, due: mn.due_date, source: "manual", manualId: mn.id });
      }
    }
    return map;
  }, [pagasSnapshot, manuais]);


  const divergByMonth = useMemo(() => {
    const m = new Map<number, any>();
    for (const d of hist?.divergencias ?? []) m.set(d.month, d);
    return m;
  }, [hist]);

  const linhas = useMemo(() => {
    const arr: {
      month: number;
      dueDate: string;
      dueIso: string;
      status: ParcelaStatus;
      payment: number;
      interest?: number;
      principal?: number;
      balance?: number;
      actualPayment?: number;
      diff?: number;
      diffPct?: number | null;
      manualId?: string;
      isManual?: boolean;
      isCarencia?: boolean;
    }[] = [];

    const pagasSorted = [...pagasCombinadas.entries()].sort((a, b) => a[0] - b[0]);
    for (const [m, info] of pagasSorted) {
      const div = divergByMonth.get(m);
      arr.push({
        month: m,
        dueIso: info.due ?? "",
        dueDate: formatDateIso(info.due),
        status: div ? "divergente" : "paga",
        payment: div ? div.projected_payment : info.valor,
        actualPayment: div ? div.actual_payment : info.valor,
        diff: div ? div.diff : undefined,
        diffPct: div ? div.diff_pct : undefined,
        manualId: info.source === "manual" ? info.manualId : undefined,
        isManual: info.source === "manual",
      });
    }
    projecao.forEach((r, idx) => {
      const isCarencia = carenciaMesesEfetivo > 0 && r.month <= carenciaMesesEfetivo;
      arr.push({
        month: r.month,
        dueIso: r.dueDate,
        dueDate: formatDateIso(r.dueDate),
        status: idx === 0 ? "atual" : "projetada",
        payment: r.payment,
        interest: r.interest,
        principal: r.principal,
        balance: r.balance,
        isCarencia,
      });
    });
    return arr;
  }, [pagasCombinadas, divergByMonth, projecao, carenciaMesesEfetivo]);


  const divergentesAntigas = (hist?.divergencias ?? []).filter((d) => Math.abs(d.diff) >= 1);
  const parcelaAtualValor = projecao[0]?.payment ?? 0;
  const parcelaPlanilha = o.valor_parcela ?? 0;
  const diffPlanilha =
    parcelaAtualValor && parcelaPlanilha ? parcelaAtualValor - parcelaPlanilha : 0;

  const openParcela = (row: (typeof linhas)[0]) => {
    setSelected({
      month: row.month,
      dueDate: row.dueDate,
      status: row.status,
      payment: row.payment,
      interest: row.interest,
      principal: row.principal,
      balance: row.balance,
      actualPayment: row.actualPayment,
      diff: row.diff,
      diffPct: row.diffPct ?? null,
      isManual: row.isManual,
      manualId: row.manualId,
      onRemoveManual: row.manualId
        ? async () => {
            try {
              await removeManual.mutateAsync(row.manualId!);
              toast({ title: "Parcela manual removida" });
              setSelected(null);
            } catch (e: any) {
              toast({ title: "Erro ao remover", description: e?.message, variant: "destructive" });
            }
          }
        : undefined,
    });
  };

  const rowClass = (s: ParcelaStatus, isManual?: boolean) => {
    switch (s) {
      case "paga":
        return isManual
          ? "bg-emerald-500/[0.03] hover:bg-emerald-500/10"
          : "bg-emerald-500/5 hover:bg-emerald-500/10";
      case "atual":
        return "bg-primary/5 hover:bg-primary/10 font-medium";
      case "divergente":
        return "bg-amber-500/10 hover:bg-amber-500/20";
      default:
        return "hover:bg-muted";
    }
  };

  const statusPill = (s: ParcelaStatus, isManual?: boolean) => {
    const map: Record<ParcelaStatus, string> = {
      paga: "bg-emerald-500/15 text-emerald-700",
      atual: "bg-primary/15 text-primary",
      projetada: "bg-muted text-muted-foreground",
      divergente: "bg-amber-500/20 text-amber-700",
    };
    const label: Record<ParcelaStatus, string> = {
      paga: "Paga",
      atual: "Atual",
      projetada: "Projetada",
      divergente: "Divergente",
    };
    return (
      <span className="inline-flex items-center gap-1">
        <span className={`crm-pill ${map[s]}`}>{label[s]}</span>
        {isManual && (
          <span className="crm-pill bg-secondary/20 text-secondary-foreground border border-secondary/40">
            manual
          </span>
        )}
      </span>
    );
  };

  // ---------- Bloco Parcelas anteriores ----------
  const parcelaAtualNum = o.parcela_atual ?? 0;
  const missingMonths = useMemo(() => {
    const arr: number[] = [];
    for (let m = 1; m < parcelaAtualNum; m++) {
      if (!pagasSnapshot.has(m)) arr.push(m);
    }
    return arr;
  }, [parcelaAtualNum, pagasSnapshot]);

  const [manualDraft, setManualDraft] = useState<Record<number, { valor: string; note: string }>>({});

  useEffect(() => {
    const draft: Record<number, { valor: string; note: string }> = {};
    for (const mn of manuais) {
      draft[mn.month] = { valor: String(mn.actual_payment ?? ""), note: mn.note ?? "" };
    }
    setManualDraft((prev) => ({ ...draft, ...prev }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manuais.length]);

  const handleSaveManuais = async () => {
    const items: { month: number; due_date: string | null; actual_payment: number; note: string | null }[] = [];
    for (const m of missingMonths) {
      const d = manualDraft[m];
      if (!d) continue;
      const v = parseFloat((d.valor ?? "").toString().replace(",", "."));
      if (isNaN(v) || v <= 0) continue;
      items.push({
        month: m,
        due_date: dueForMonth(o.primeiro_vencimento, m),
        actual_payment: v,
        note: d.note?.trim() || null,
      });
    }
    if (!items.length) {
      toast({ title: "Nada para salvar", description: "Preencha valor em pelo menos uma parcela.", variant: "destructive" });
      return;
    }
    try {
      await saveManuais.mutateAsync(items);
      toast({ title: "Parcelas salvas", description: `${items.length} registro(s) atualizado(s).` });
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: e?.message ?? String(e), variant: "destructive" });
    }
  };

  const handleExportCsv = () => {
    const sep = ";";
    const esc = (v: string | number) => {
      const s = String(v ?? "");
      return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const taxaMensal = o.taxa_op ?? 0;
    const header = [
      `# Memória de cálculo — Operação ${o.id_valora ?? o.seu_numero ?? ""}`,
      `# CNPJ: ${o.cnpj}`,
      `# Nosso número: ${o.nosso_numero ?? "—"}`,
      `# Modalidade: ${o.tipo_op ?? "—"} (${posFixado ? "Pós-fixado (CDI)" : "Pré-fixado"})`,
      `# Valor da operação: ${formatBRL(o.valor_operacao)}`,
      `# Total de parcelas: ${o.total_parcelas ?? "—"} · Parcela atual: ${o.parcela_atual ?? "—"}`,
      `# Taxa (spread) contratual: ${taxaMensal.toFixed(4)}% a.m.`,
      `# Carência aplicada: ${carenciaMesesEfetivo} meses (${carenciaTipoEfetivo === "total" ? "Total" : "Principal"})`,
      `# Motor: Pro-Rata DU · Base 252 · Tabela Price · Vencimento dia 15 · Juros compostos pós-fixados (CDI diário × PRE)`,
      `# Gerado em: ${new Date().toLocaleString("pt-BR")}`,
      "",
    ].join("\n");
    const cols = ["Mês", "Vencimento", "Status", "Projetado (R$)", "Valor real (R$)", "Divergência (R$)", "Divergência (%)", "Origem"].join(sep);
    const body = linhas
      .map((r) =>
        [
          r.month,
          r.dueDate,
          r.status,
          r.payment.toFixed(2).replace(".", ","),
          r.actualPayment !== undefined ? r.actualPayment.toFixed(2).replace(".", ",") : "",
          r.diff !== undefined ? r.diff.toFixed(2).replace(".", ",") : "",
          r.diffPct != null ? r.diffPct.toFixed(2).replace(".", ",") : "",
          r.isManual ? "manual" : r.actualPayment !== undefined ? "planilha" : "projetado",
        ]
          .map(esc)
          .join(sep),
      )
      .join("\n");
    const csv = "\ufeff" + header + cols + "\n" + body;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `memoria-calculo-${o.id_valora ?? o.seu_numero ?? o.cnpj}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };


  return (
    <div className="space-y-4">
      <button
        onClick={onBack}
        className="text-primary hover:text-primary/80 font-semibold transition-colors"
      >
        ← Voltar para operações
      </button>

      {/* Cabeçalho compacto da operação */}
      <Card className="p-4 border border-border border-l-4 border-l-primary shadow-card">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-semibold text-foreground truncate">
                {o.id_valora ?? o.seu_numero ?? "Operação"}
              </h2>
              {o.tipo_op && (
                <Badge variant="outline" className="font-normal">
                  {o.tipo_op}
                </Badge>
              )}
              <span
                className={`crm-pill ${
                  posFixado ? "bg-primary/15 text-primary" : "bg-emerald-500/15 text-emerald-700"
                }`}
              >
                {posFixado ? "Pós (CDI)" : "Pré"}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {o.cnpj} · Nosso nº {o.nosso_numero ?? "—"}
            </p>
          </div>
          <div className="text-right">
            <p className="crm-field-label">Contrato</p>
            <p className="text-base font-semibold text-primary">{formatBRL(o.valor_operacao)}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3 pt-3 border-t border-border">
          <div>
            <p className="crm-field-label">Parcela</p>
            <p className="text-sm font-medium text-foreground">{formatBRL(o.valor_parcela)}</p>
          </div>
          <div>
            <p className="crm-field-label">Progresso</p>
            <p className="text-sm font-medium text-foreground">
              {o.parcela_atual ?? "—"}/{o.total_parcelas ?? "—"}
            </p>
          </div>
          <div>
            <p className="crm-field-label">Vencimento</p>
            <p className="text-sm font-medium text-foreground">{formatDateIso(o.data_vencimento_atual)}</p>
          </div>
          <div>
            <p className="crm-field-label">Saldo devedor</p>
            <p className="text-sm font-medium text-foreground">{formatBRL(o.saldo_devedor)}</p>
          </div>
        </div>
      </Card>

      <Accordion type="multiple" defaultValue={["overview"]} className="space-y-2">
        {/* 1. Condições Atuais e Visão Geral */}
        <AccordionItem
          value="overview"
          className="border border-border rounded-lg bg-card px-4"
        >
          <AccordionTrigger className="text-sm font-semibold text-primary hover:no-underline">
            Condições atuais e visão geral
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-4">
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  Condições comerciais
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
                  <Field label="Franquia" value={o.franquia ?? ""} />
                  <Field label="CNPJ" value={o.cnpj} />
                  <Field label="Modalidade" value={o.tipo_op ?? ""} />
                  <Field label="Refin / Aditivo" value={o.refin_aditivo ?? ""} />
                  <Field label="Valor da operação" value={formatBRL(o.valor_operacao)} />
                  <Field
                    label="Taxa do contrato (% a.m.)"
                    value={o.taxa_op ? `${o.taxa_op.toFixed(4)}%` : ""}
                  />
                  <Field label="Total de parcelas" value={o.total_parcelas?.toString() ?? ""} />
                  <Field
                    label="Carência do principal (meses)"
                    value={o.carencia_principal?.toString() ?? "0"}
                  />
                  <Field label="Data de aquisição" value={formatDateIso(o.data_aquisicao)} />
                  <Field label="Data de emissão" value={formatDateIso(o.data_emissao)} />
                  <Field label="1º vencimento" value={formatDateIso(o.primeiro_vencimento)} />
                  <Field label="Último vencimento" value={formatDateIso(o.ultimo_vencimento)} />
                </div>
              </div>

              <div>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  Status atual
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
                  <Field
                    label="Parcela a ser paga"
                    value={`${o.parcela_atual ?? "—"} de ${o.total_parcelas ?? "—"}`}
                  />
                  <Field label="Valor da parcela" value={formatBRL(o.valor_parcela)} />
                  <Field label="Próximo vencimento" value={formatDateIso(o.data_vencimento_atual)} />
                  <Field label="Total pago em parcelas" value={formatBRL(o.total_pago)} />
                  <Field label="Saldo devedor (D-1)" value={formatBRL(o.saldo_devedor)} />
                </div>
              </div>

              <div>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  Identificação
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6">
                  <Field label="ID Valora" value={o.id_valora ?? ""} />
                  <Field label="Seu número" value={o.seu_numero ?? ""} />
                  <Field label="Nosso número" value={o.nosso_numero ?? ""} />
                </div>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* 2. Memória de Cálculo */}
        <AccordionItem
          value="memoria"
          className="border border-border rounded-lg bg-card px-4"
        >
          <AccordionTrigger className="text-sm font-semibold text-primary hover:no-underline">
            Memória de cálculo (Pro-Rata DU)
          </AccordionTrigger>
          <AccordionContent>
            {/* Carência inline (persistida em operacoes_overrides) */}
            <div className="mb-4 rounded-lg border border-border bg-muted/40 p-3">
              <p className="crm-field-label mb-2">
                Carência aplicada à projeção
              </p>
              {carenciaMesesEfetivo > 0 && (
                <p className="text-xs text-orange-700 dark:text-orange-400 mb-2 -mt-1">
                  Carência ativa: {carenciaMesesEfetivo} {carenciaMesesEfetivo === 1 ? "mês" : "meses"} ({carenciaTipoEfetivo === "total" ? "Total — sem pagamento" : "Principal — só juros"})
                </p>
              )}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                <div>
                  <Label htmlFor="carencia-meses-memoria" className="text-xs">Meses</Label>
                  <Input
                    id="carencia-meses-memoria"
                    type="number"
                    min={0}
                    value={carenciaInput}
                    onChange={(e) => setCarenciaInput(e.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-xs">Tipo</Label>
                  <div className="flex gap-2 mt-2">
                    <Button
                      type="button"
                      size="sm"
                      variant={carenciaTipoInput === "principal" ? "default" : "outline"}
                      onClick={() => setCarenciaTipoInput("principal")}
                    >
                      Principal
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={carenciaTipoInput === "total" ? "default" : "outline"}
                      onClick={() => setCarenciaTipoInput("total")}
                    >
                      Total
                    </Button>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={handleSaveCarencia}
                    disabled={saveOverride.isPending}
                    className="flex-1"
                  >
                    {saveOverride.isPending ? "Salvando..." : "Salvar carência"}
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={carenciaMesesEfetivo === 0 || saveOverride.isPending}
                    onClick={async () => {
                      try {
                        await saveOverride.mutateAsync({ carencia_meses: 0, carencia_tipo: "principal" });
                        setCarenciaInput("0");
                        setCarenciaTipoInput("principal");
                        toast({ title: "Carência removida", description: "Projeção recalculada sem carência." });
                      } catch (e: any) {
                        toast({ title: "Erro", description: e?.message ?? String(e), variant: "destructive" });
                      }
                    }}
                  >
                    Remover
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleExportCsv}
                    disabled={linhas.length === 0}
                  >
                    Exportar CSV
                  </Button>
                </div>
              </div>
            </div>

            {linhas.length > 0 ? (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Histórico completo desde a 1ª parcela. Meses passados com ingestão exibem o valor
                  real pago e a divergência frente à projeção. Clique em uma parcela para ver detalhes.
                </p>
                {Math.abs(diffPlanilha) > 1 && (
                  <div className="text-xs rounded-md border border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400 px-3 py-2">
                    Parcela projetada ({formatCurrency(parcelaAtualValor)}) difere da parcela
                    informada na planilha ({formatBRL(parcelaPlanilha)}) em{" "}
                    {formatCurrency(Math.abs(diffPlanilha))}.
                    {posFixado
                      ? " Como a operação é pós-fixada, essa diferença pode ser explicada pela variação do CDI."
                      : " Operação pré-fixada: a parcela deveria ser constante — verifique a taxa e o saldo devedor da ingestão."}
                  </div>
                )}
                <div className="overflow-x-auto border border-border rounded-lg">
                  <table className="w-full text-sm">
                    <thead className="bg-muted">
                      <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                        <th className="p-2">Mês</th>
                        <th className="p-2">Vencimento</th>
                        <th className="p-2">Status</th>
                        <th className="p-2 text-right">Projetado</th>
                        <th className="p-2 text-right">Valor real</th>
                        <th className="p-2 text-right">Divergência</th>
                      </tr>
                    </thead>
                    <tbody>
                      {linhas.map((r) => (
                        <tr
                          key={`${r.month}-${r.status}`}
                          className={`border-t border-border cursor-pointer transition-colors ${rowClass(r.status, r.isManual)}`}
                          onClick={() => openParcela(r)}
                        >
                          <td className="p-2">{r.month}</td>
                          <td className="p-2">{r.dueDate}</td>
                          <td className="p-2">
                            {statusPill(r.status, r.isManual)}
                            {r.isCarencia && (
                              <span className="ml-1 crm-pill bg-orange-500/15 text-orange-700 border border-orange-500/30">
                                Carência
                              </span>
                            )}
                          </td>
                          <td className="p-2 text-right">{formatCurrency(r.payment)}</td>
                          <td className="p-2 text-right">
                            {r.actualPayment !== undefined ? formatCurrency(r.actualPayment) : "—"}
                          </td>
                          <td className="p-2 text-right">
                            {r.diff !== undefined
                              ? `${r.diff >= 0 ? "+" : ""}${formatCurrency(r.diff)}`
                              : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                Memória de cálculo indisponível — verifique saldo devedor, parcela atual, taxa e
                vencimento atual.
              </p>
            )}
          </AccordionContent>
        </AccordionItem>

        {/* 3. Extrato e Divergências */}
        <AccordionItem
          value="extrato"
          className="border border-border rounded-lg bg-card px-4"
        >
          <AccordionTrigger className="text-sm font-semibold text-primary hover:no-underline">
            Extrato e divergências
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-4">
              {divergentesAntigas.length > 0 ? (
                <Card className="p-4 border border-amber-500/40 bg-amber-500/5">
                  <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-400 mb-2">
                    Divergências identificadas em ingestões anteriores
                  </h3>
                  <ul className="text-xs text-amber-900 dark:text-amber-300 space-y-1">
                    {divergentesAntigas.map((d) => (
                      <li key={d.id}>
                        Parcela {d.month} · projetado {formatCurrency(d.projected_payment)} · real{" "}
                        {formatCurrency(d.actual_payment)} · Δ {d.diff >= 0 ? "+" : ""}
                        {formatCurrency(d.diff)}
                        {d.diff_pct != null
                          ? ` (${d.diff_pct >= 0 ? "+" : ""}${d.diff_pct.toFixed(2)}%)`
                          : ""}
                      </li>
                    ))}
                  </ul>
                </Card>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Nenhuma divergência identificada até o momento.
                </p>
              )}

              {parcelaAtualNum > 1 && missingMonths.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-primary mb-1">
                    Parcelas anteriores (preenchimento manual)
                  </h3>
                  <p className="text-xs text-muted-foreground mb-3">
                    O Hubspot não traz o histórico das parcelas já pagas antes da parcela atual.
                    Preencha aqui e salve. À medida que novas ingestões avançarem a parcela, o
                    valor vindo da planilha passa a prevalecer automaticamente.
                  </p>
                  <div className="overflow-x-auto border border-border rounded-lg">
                    <table className="w-full text-sm">
                      <thead className="bg-muted">
                        <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                          <th className="p-2 w-16">Mês</th>
                          <th className="p-2">Vencimento</th>
                          <th className="p-2">Valor pago (R$)</th>
                          <th className="p-2">Observação</th>
                        </tr>
                      </thead>
                      <tbody>
                        {missingMonths.map((m) => {
                          const iso = dueForMonth(o.primeiro_vencimento, m);
                          const draft = manualDraft[m] ?? { valor: "", note: "" };
                          return (
                            <tr key={m} className="border-t border-border">
                              <td className="p-2 font-medium">{m}</td>
                              <td className="p-2">{formatDateIso(iso)}</td>
                              <td className="p-2">
                                <Input
                                  type="number"
                                  step="0.01"
                                  min={0}
                                  placeholder="0,00"
                                  value={draft.valor}
                                  onChange={(e) =>
                                    setManualDraft((prev) => ({
                                      ...prev,
                                      [m]: { valor: e.target.value, note: prev[m]?.note ?? "" },
                                    }))
                                  }
                                />
                              </td>
                              <td className="p-2">
                                <Input
                                  type="text"
                                  placeholder="opcional"
                                  value={draft.note}
                                  onChange={(e) =>
                                    setManualDraft((prev) => ({
                                      ...prev,
                                      [m]: { valor: prev[m]?.valor ?? "", note: e.target.value },
                                    }))
                                  }
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-3 flex justify-end">
                    <Button onClick={handleSaveManuais} disabled={saveManuais.isPending}>
                      {saveManuais.isPending ? "Salvando..." : "Salvar parcelas"}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>



      <div className="flex justify-center pt-2">
        <Button variant="outline" size="sm" onClick={onBack}>
          Voltar
        </Button>
      </div>

      <ParcelaDetalheSheet parcela={selected} onClose={() => setSelected(null)} />
    </div>
  );
};
