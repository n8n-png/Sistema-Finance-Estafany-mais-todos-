import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, Search } from "lucide-react";
import { useLimites, ClienteLimite } from "@/hooks/useLimites";
import { useLastImport } from "@/hooks/useLastImport";
import { useQueryClient } from "@tanstack/react-query";
import { useDebounce } from "@/hooks/useDebounce";

const formatBRL = (v: number | null) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v ?? 0);

const PAGE_SIZE = 100;

interface Props {
  onSelect: (c: ClienteLimite) => void;
  onBack: () => void;
}

export const LimitesList = ({ onSelect, onBack }: Props) => {
  const { data, isLoading, error } = useLimites();
  const { data: lastImport } = useLastImport();
  const qc = useQueryClient();
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 200);
  const [visible, setVisible] = useState(PAGE_SIZE);

  const lastUpdateLabel = lastImport?.created_at
    ? new Date(lastImport.created_at).toLocaleString("pt-BR", {
        day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
      })
    : null;

  // Pré-computa um índice de busca em minúsculas — evita fazer
  // toLowerCase() em cada linha a cada tecla digitada.
  const searchIndex = useMemo(() => {
    if (!data) return [] as Array<{ item: ClienteLimite; hay: string }>;
    return data.map((c) => ({
      item: c,
      hay: `${c.cnpj ?? ""}\n${c.unidade ?? ""}\n${c.socios ?? ""}\n${c.grupo ?? ""}`.toLowerCase(),
    }));
  }, [data]);

  const filtered = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    if (!q) return searchIndex.map((e) => e.item);
    return searchIndex.filter((e) => e.hay.includes(q)).map((e) => e.item);
  }, [searchIndex, debouncedQuery]);

  // Reseta paginação sempre que a busca muda
  const visibleItems = useMemo(() => filtered.slice(0, visible), [filtered, visible]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="text-primary hover:text-primary/80 font-semibold transition-colors">
          ← Voltar
        </button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => qc.invalidateQueries({ queryKey: ["clientes_limites"] })}
        >
          <RefreshCw size={16} className="mr-2" /> Atualizar
        </Button>
      </div>

      <div className="relative">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por CNPJ, unidade, sócio ou grupo..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setVisible(PAGE_SIZE);
          }}
          className="pl-10"
        />
      </div>

      {lastUpdateLabel && (
        <p className="text-xs text-muted-foreground text-right">
          Última atualização: {lastUpdateLabel}
        </p>
      )}

      {isLoading && <p className="text-muted-foreground text-center py-8">Carregando...</p>}
      {error && <p className="text-destructive text-center py-8">Erro ao carregar limites.</p>}
      {!isLoading && filtered.length === 0 && (
        <p className="text-muted-foreground text-center py-8">Nenhum cliente encontrado.</p>
      )}

      <div className="space-y-2">
        {visibleItems.map((c) => {
          const total = c.total_com_carencia ?? 0;
          return (
            <Card
              key={c.id}
              onClick={() => onSelect(c)}
              className="relative p-4 cursor-pointer hover:shadow-card-hover transition-all border border-border hover:border-primary overflow-hidden"
            >
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />
              <div className="flex justify-between items-start gap-4 pl-2">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-foreground truncate">
                    {c.cnpj} - {c.unidade ?? "—"}
                  </p>
                  <p className="text-sm text-muted-foreground truncate mt-1">{c.socios ?? "—"}</p>
                </div>
                <div className={`font-semibold whitespace-nowrap ${total < 0 ? "text-destructive" : "text-foreground"}`}>
                  {formatBRL(total)}
                </div>
              </div>
            </Card>
          );
        })}
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
