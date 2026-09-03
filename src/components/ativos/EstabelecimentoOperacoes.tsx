import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ChevronRight, FileText, Search } from "lucide-react";
import { OperacaoAtiva } from "@/hooks/useOperacoesAtivas";
import { EstabelecimentoGroup } from "./EstabelecimentosList";
import { useDebounce } from "@/hooks/useDebounce";

const formatBRL = (v: number | null) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v ?? 0);

const formatDate = (iso: string | null) => {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};

interface Props {
  grupo: EstabelecimentoGroup;
  onSelectOperacao: (o: OperacaoAtiva) => void;
  onBack: () => void;
}

export const EstabelecimentoOperacoes = ({ grupo, onSelectOperacao, onBack }: Props) => {
  const [query, setQuery] = useState("");
  const debounced = useDebounce(query, 150);

  const filtered = useMemo(() => {
    const q = debounced.trim().toLowerCase();
    if (!q) return grupo.operacoes;
    return grupo.operacoes.filter((o) =>
      `${o.nosso_numero ?? ""}\n${o.id_valora ?? ""}\n${o.seu_numero ?? ""}\n${o.tipo_op ?? ""}`
        .toLowerCase()
        .includes(q),
    );
  }, [grupo.operacoes, debounced]);

  return (
    <div className="space-y-4">
      <button
        onClick={onBack}
        className="text-primary hover:text-primary/80 font-semibold transition-colors"
      >
        ← Voltar para estabelecimentos
      </button>

      <Card className="p-4 border border-border border-l-4 border-l-primary shadow-card">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-semibold text-foreground truncate">
                {grupo.unidade ?? grupo.franquia ?? "Sem unidade"}
              </h2>
              {grupo.grupo && (
                <Badge variant="secondary" className="font-normal">
                  {grupo.grupo}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">{grupo.cnpj}</p>
          </div>
          <div className="text-right">
            <p className="crm-field-label">Total contratado</p>
            <p className="text-base font-semibold text-primary">{formatBRL(grupo.totalContrato)}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-border">
          <div>
            <p className="crm-field-label">Operações</p>
            <p className="text-sm font-medium text-foreground">{grupo.operacoes.length}</p>
          </div>
          <div>
            <p className="crm-field-label">Saldo devedor</p>
            <p className="text-sm font-medium text-foreground">{formatBRL(grupo.totalSaldo)}</p>
          </div>
        </div>
      </Card>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Operações ativas
        </h3>
        <span className="text-xs text-muted-foreground">
          {filtered.length} de {grupo.operacoes.length}
        </span>
      </div>

      <div className="relative">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por Nosso número, ID Valora, Seu número ou modalidade..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      <div className="space-y-2">
        {filtered.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-6">
            Nenhuma operação encontrada.
          </p>
        )}
        {filtered.map((o) => {
          const parc = o.parcela_atual ?? 0;
          const tot = o.total_parcelas ?? 0;
          return (
            <Card
              key={o.id}
              onClick={() => onSelectOperacao(o)}
              className="relative p-4 cursor-pointer hover:shadow-card-hover transition-all border border-border hover:border-primary overflow-hidden"
            >
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-secondary" />
              <div className="flex items-start gap-3 pl-2">
                <div className="shrink-0 h-9 w-9 rounded-full bg-secondary/20 text-secondary-foreground flex items-center justify-center">
                  <FileText size={16} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-foreground truncate">
                      {o.id_valora ?? o.seu_numero ?? "Sem ID"}
                    </p>
                    {o.tipo_op && (
                      <Badge variant="outline" className="font-normal">
                        {o.tipo_op}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    Nosso nº: {o.nosso_numero ?? "—"}
                  </p>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1 mt-2 text-xs">
                    <div>
                      <span className="text-muted-foreground">Total contrato: </span>
                      <span className="font-medium text-foreground">{formatBRL(o.valor_operacao)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Parcela: </span>
                      <span className="font-medium text-foreground">{formatBRL(o.valor_parcela)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Progresso: </span>
                      <span className="font-medium text-foreground">{parc}/{tot}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Venc.: </span>
                      <span className="font-medium text-foreground">{formatDate(o.data_vencimento_atual)}</span>
                    </div>
                  </div>
                </div>
                <ChevronRight size={16} className="shrink-0 text-muted-foreground self-center" />
              </div>
            </Card>
          );
        })}
      </div>

      <div className="flex justify-center pt-2">
        <Button variant="outline" size="sm" onClick={onBack}>
          Voltar
        </Button>
      </div>
    </div>
  );
};
