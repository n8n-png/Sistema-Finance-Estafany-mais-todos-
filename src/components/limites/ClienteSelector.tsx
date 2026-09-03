import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Search, X, CheckCircle2, AlertCircle } from "lucide-react";
import { useLimites, ClienteLimite } from "@/hooks/useLimites";
import { useDebounce } from "@/hooks/useDebounce";
import { usePreAprovados } from "@/hooks/usePreAprovados";
import { normalizeCnpj } from "@/utils/cnpj";

const PreApprovedBadge = () => (
  <span
    className="crm-pill rounded-full border border-secondary/40 bg-secondary/15 uppercase tracking-wide text-secondary-foreground"
    title="Este CNPJ possui status de pré-aprovação"
  >
    <span aria-hidden>✅</span>
    <span style={{ color: "#3a8a00" }}>Pré-aprovado</span>
  </span>
);

const formatBRL = (v: number | null) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v ?? 0);

export type Segmento = "CDT" | "VDT" | "AMORSAUDE";

const SEGMENTO_LABELS: Record<Segmento, string> = {
  CDT: "Cartão de TODOS",
  VDT: "Visão de TODOS",
  AMORSAUDE: "Amor Saúde",
};

interface Props {
  segmento: Segmento;
  selected: ClienteLimite | null;
  onSelect: (c: ClienteLimite | null) => void;
}

export const ClienteSelector = ({ segmento, selected, onSelect }: Props) => {
  const { data, isLoading } = useLimites();
  const { data: preAprovados } = usePreAprovados();
  const getPreAprovado = (cnpj: string | null | undefined) =>
    cnpj ? preAprovados?.get(normalizeCnpj(cnpj)) : undefined;
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const debouncedQuery = useDebounce(query, 200);

  // Índice de busca em minúsculas pré-computado uma única vez por dataset
  const searchIndex = useMemo(() => {
    if (!data) return [] as Array<{ item: ClienteLimite; hay: string }>;
    return data.map((c) => ({
      item: c,
      hay: `${c.cnpj ?? ""}\n${c.unidade ?? ""}\n${c.socios ?? ""}`.toLowerCase(),
    }));
  }, [data]);

  const filtered = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    if (!q) return searchIndex.slice(0, 50).map((e) => e.item);
    const out: ClienteLimite[] = [];
    for (const e of searchIndex) {
      if (e.hay.includes(q)) {
        out.push(e.item);
        if (out.length >= 50) break;
      }
    }
    return out;
  }, [searchIndex, debouncedQuery]);

  if (selected) {
    const pre = getPreAprovado(selected.cnpj);
    const total = selected.total_com_carencia ?? 0;
    const positivo = total > 0;
    return (
      <Card className="relative overflow-hidden p-5 border border-border shadow-card">
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />
        <div className="flex items-start justify-between gap-4 pl-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="crm-field-label">
                Estabelecimento selecionado — {SEGMENTO_LABELS[segmento]}
              </span>
            </div>
            <p className="font-display font-bold text-lg text-foreground truncate">
              {selected.unidade ?? "—"}
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm text-muted-foreground truncate">CNPJ {selected.cnpj}</p>
              {pre && <PreApprovedBadge />}
            </div>
            {selected.socios && (
              <p className="text-xs text-muted-foreground truncate mt-1">{selected.socios}</p>
            )}
          </div>
          <button
            type="button"
            onClick={() => onSelect(null)}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Trocar estabelecimento"
          >
            <X size={18} />
          </button>
        </div>
        <div className={`grid gap-3 mt-4 pl-2 ${pre ? "grid-cols-3" : "grid-cols-2"}`}>
          <div className="rounded-md border border-border p-3">
            <p className="crm-field-label">Limite com carência</p>
            <p className={`font-display font-bold text-lg mt-1 ${positivo ? "text-primary" : "text-destructive"}`}>
              {formatBRL(selected.total_com_carencia)}
            </p>
          </div>
          <div className="rounded-md border border-border p-3">
            <p className="crm-field-label">Limite sem carência</p>
            <p className="font-display font-bold text-lg mt-1 text-foreground">
              {formatBRL(selected.total_sem_carencia)}
            </p>
          </div>
          {pre && (
            <div className="rounded-md border border-border p-3">
              <p className="crm-field-label">Valor pré-aprovado</p>
              <p className="font-display font-bold text-lg mt-1 text-secondary-foreground">
                {formatBRL(pre.limite)}
              </p>
            </div>
          )}
        </div>
        <div className={`flex items-center gap-2 mt-3 pl-2 text-xs ${positivo ? "text-secondary-foreground" : "text-destructive"}`}>
          {positivo ? (
            <>
              <CheckCircle2 size={14} className="text-secondary" />
              <span className="text-muted-foreground">Limite disponível para simulação.</span>
            </>
          ) : (
            <>
              <AlertCircle size={14} />
              <span>Cliente sem limite disponível no momento.</span>
            </>
          )}
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4 border border-border shadow-card">
      <p className="text-sm font-semibold text-primary mb-2">
        Consultar estabelecimento — {SEGMENTO_LABELS[segmento]}
      </p>
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por CNPJ, unidade ou sócio..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          className="pl-9"
        />
      </div>
      {open && (
        <div className="mt-2 max-h-72 overflow-y-auto border border-border rounded-md divide-y divide-border">
          {isLoading && (
            <p className="text-sm text-muted-foreground px-3 py-3">Carregando...</p>
          )}
          {!isLoading && filtered.length === 0 && (
            <p className="text-sm text-muted-foreground px-3 py-3">
              Nenhum estabelecimento encontrado.
            </p>
          )}
          {filtered.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                onSelect(c);
                setOpen(false);
                setQuery("");
              }}
              className="w-full text-left px-3 py-2 hover:bg-accent transition-colors flex items-center justify-between gap-3"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground truncate">
                  {c.unidade ?? "—"}
                </p>
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-xs text-muted-foreground truncate">CNPJ {c.cnpj}</p>
                  {getPreAprovado(c.cnpj) && <PreApprovedBadge />}
                </div>
              </div>
              <span className="text-xs font-semibold text-primary whitespace-nowrap">
                {formatBRL(c.total_com_carencia)}
              </span>
            </button>
          ))}
        </div>
      )}
      <p className="text-xs text-muted-foreground mt-2">
        A busca é opcional. Você pode simular sem selecionar um estabelecimento.
      </p>
    </Card>
  );
};
