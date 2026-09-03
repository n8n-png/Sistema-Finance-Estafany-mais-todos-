import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Search, ChevronRight, Building2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useOperacoesAtivas, OperacaoAtiva } from "@/hooks/useOperacoesAtivas";
import { useLimites } from "@/hooks/useLimites";
import { useLastImportAtivos } from "@/hooks/useLastImportAtivos";
import { useQueryClient } from "@tanstack/react-query";
import { useDebounce } from "@/hooks/useDebounce";

const formatBRL = (v: number | null) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v ?? 0);

const PAGE_SIZE = 60;

export interface EstabelecimentoGroup {
  cnpj: string;
  unidade: string | null;
  grupo: string | null;
  franquia: string | null;
  operacoes: OperacaoAtiva[];
  totalContrato: number;
  totalSaldo: number;
}

interface Props {
  onSelect: (grupo: EstabelecimentoGroup) => void;
}

export const EstabelecimentosList = ({ onSelect }: Props) => {
  const navigate = useNavigate();
  const { data: operacoes, isLoading, error } = useOperacoesAtivas();
  const { data: limites } = useLimites();
  const { data: lastImport } = useLastImportAtivos();
  const qc = useQueryClient();
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 300);
  const [visible, setVisible] = useState(PAGE_SIZE);

  const lastUpdateLabel = lastImport?.created_at
    ? new Date(lastImport.created_at).toLocaleString("pt-BR", {
        day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
      })
    : null;

  const limitesByCnpj = useMemo(() => {
    const m = new Map<string, { unidade: string | null; grupo: string | null }>();
    for (const l of limites ?? []) {
      m.set(l.cnpj, { unidade: l.unidade, grupo: l.grupo });
    }
    return m;
  }, [limites]);

  const grupos = useMemo<EstabelecimentoGroup[]>(() => {
    if (!operacoes) return [];
    const map = new Map<string, EstabelecimentoGroup>();
    for (const op of operacoes) {
      const key = op.cnpj;
      const info = limitesByCnpj.get(key);
      let g = map.get(key);
      if (!g) {
        g = {
          cnpj: key,
          unidade: info?.unidade ?? null,
          grupo: info?.grupo ?? null,
          franquia: op.franquia ?? null,
          operacoes: [],
          totalContrato: 0,
          totalSaldo: 0,
        };
        map.set(key, g);
      }
      g.operacoes.push(op);
      g.totalContrato += op.valor_operacao ?? 0;
      g.totalSaldo += op.saldo_devedor ?? 0;
      if (!g.franquia && op.franquia) g.franquia = op.franquia;
    }
    return [...map.values()].sort((a, b) =>
      (a.unidade ?? a.franquia ?? a.cnpj).localeCompare(b.unidade ?? b.franquia ?? b.cnpj),
    );
  }, [operacoes, limitesByCnpj]);

  const searchIndex = useMemo(() => {
    return grupos.map((g) => ({
      item: g,
      hay: [
        g.cnpj,
        g.unidade ?? "",
        g.grupo ?? "",
        g.franquia ?? "",
        ...g.operacoes.flatMap((o) => [o.id_valora ?? "", o.seu_numero ?? "", o.nosso_numero ?? ""]),
      ]
        .join("\n")
        .toLowerCase(),
    }));
  }, [grupos]);

  const filtered = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    if (!q) return searchIndex.map((e) => e.item);
    return searchIndex.filter((e) => e.hay.includes(q)).map((e) => e.item);
  }, [searchIndex, debouncedQuery]);

  const visibleItems = useMemo(() => filtered.slice(0, visible), [filtered, visible]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate("/")}
          className="text-primary hover:text-primary/80 font-semibold transition-colors"
        >
          ← Voltar
        </button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            qc.invalidateQueries({ queryKey: ["operacoes_ativas"] });
            qc.invalidateQueries({ queryKey: ["clientes_limites"] });
          }}
        >
          <RefreshCw size={16} className="mr-2" /> Atualizar
        </Button>
      </div>

      <div className="relative">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por ID Valora, Seu Número, Nosso Número ou CNPJ..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setVisible(PAGE_SIZE);
          }}
          className="pl-10"
        />
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{filtered.length} estabelecimento(s)</span>
        {lastUpdateLabel && <span>Atualizado em {lastUpdateLabel}</span>}
      </div>

      {isLoading && <p className="text-muted-foreground text-center py-8">Carregando...</p>}
      {error && <p className="text-destructive text-center py-8">Erro ao carregar operações.</p>}
      {!isLoading && filtered.length === 0 && (
        <p className="text-muted-foreground text-center py-8">Nenhum estabelecimento encontrado.</p>
      )}

      <div className="space-y-2">
        {visibleItems.map((g) => (
          <Card
            key={g.cnpj}
            onClick={() => onSelect(g)}
            className="relative p-4 cursor-pointer hover:shadow-card-hover transition-all border border-border hover:border-primary overflow-hidden"
          >
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />
            <div className="flex items-center gap-3 pl-2">
              <div className="shrink-0 h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                <Building2 size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-foreground truncate">
                    {g.unidade ?? g.franquia ?? "Sem unidade"}
                  </p>
                  {g.grupo && (
                    <Badge variant="secondary" className="font-normal">
                      {g.grupo}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate mt-0.5">{g.cnpj}</p>
                <div className="flex items-center gap-3 mt-2 text-xs">
                  <span className="text-muted-foreground">
                    {g.operacoes.length} operaç{g.operacoes.length === 1 ? "ão" : "ões"}
                  </span>
                  <span className="text-foreground font-medium">
                    Total: {formatBRL(g.totalContrato)}
                  </span>
                </div>
              </div>
              <ChevronRight size={18} className="shrink-0 text-muted-foreground" />
            </div>
          </Card>
        ))}
      </div>

      {visibleItems.length < filtered.length && (
        <div className="flex justify-center pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setVisible((v) => v + PAGE_SIZE)}
          >
            Carregar mais ({filtered.length - visibleItems.length} restantes)
          </Button>
        </div>
      )}
    </div>
  );
};
