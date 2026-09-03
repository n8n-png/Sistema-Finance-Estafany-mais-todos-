import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { formatCurrency } from "@/utils/currency";

export type ParcelaStatus = "paga" | "atual" | "projetada" | "divergente";

export interface ParcelaDetalhe {
  month: number;
  dueDate: string; // pt-BR display
  status: ParcelaStatus;
  payment: number;
  interest?: number;
  principal?: number;
  balance?: number;
  actualPayment?: number;
  diff?: number;
  diffPct?: number | null;
  isManual?: boolean;
  manualId?: string;
  onRemoveManual?: () => void;
}

const statusLabel: Record<ParcelaStatus, string> = {
  paga: "Paga",
  atual: "Parcela atual",
  projetada: "Projetada",
  divergente: "Divergente",
};

const statusColor: Record<ParcelaStatus, string> = {
  paga: "text-emerald-700 bg-emerald-500/10 border-emerald-500/40",
  atual: "text-primary bg-primary/10 border-primary/40",
  projetada: "text-muted-foreground bg-muted border-border",
  divergente: "text-amber-700 bg-amber-500/10 border-amber-500/40",
};

const Line = ({ label, value }: { label: string; value: string }) => (
  <div className="flex justify-between py-2 border-b border-border last:border-0">
    <span className="text-xs text-muted-foreground uppercase tracking-wide">{label}</span>
    <span className="text-sm font-medium text-foreground">{value}</span>
  </div>
);

interface Props {
  parcela: ParcelaDetalhe | null;
  onClose: () => void;
}

export const ParcelaDetalheSheet = ({ parcela, onClose }: Props) => {
  const open = !!parcela;
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        {parcela && (
          <>
            <SheetHeader>
              <SheetTitle className="text-primary">Parcela {parcela.month}</SheetTitle>
              <SheetDescription>Vencimento em {parcela.dueDate}</SheetDescription>
            </SheetHeader>

            <div className="mt-4 flex items-center gap-2 flex-wrap">
              <span className={`inline-block px-2 py-1 text-xs rounded-md border ${statusColor[parcela.status]}`}>
                {statusLabel[parcela.status]}
              </span>
              {parcela.isManual && (
                <span className="inline-block px-2 py-1 text-xs rounded-md border border-secondary/40 bg-secondary/10 text-secondary-foreground">
                  Registro manual
                </span>
              )}
            </div>

            <div className="mt-6 space-y-1">
              <Line label="Valor calculado" value={formatCurrency(parcela.payment)} />
              {parcela.actualPayment !== undefined && (
                <Line label="Valor real (planilha)" value={formatCurrency(parcela.actualPayment)} />
              )}
              {parcela.diff !== undefined && (
                <>
                  <Line
                    label="Divergência (R$)"
                    value={`${parcela.diff >= 0 ? "+" : ""}${formatCurrency(parcela.diff)}`}
                  />
                  {parcela.diffPct != null && (
                    <Line
                      label="Divergência (%)"
                      value={`${parcela.diffPct >= 0 ? "+" : ""}${parcela.diffPct.toFixed(2)}%`}
                    />
                  )}
                </>
              )}
              {parcela.interest !== undefined && (
                <Line label="Juros" value={formatCurrency(parcela.interest)} />
              )}
              {parcela.principal !== undefined && (
                <Line label="Amortização" value={formatCurrency(parcela.principal)} />
              )}
              {parcela.balance !== undefined && (
                <Line label="Saldo devedor após" value={formatCurrency(parcela.balance)} />
              )}
            </div>

            {parcela.status === "divergente" && (
              <div className="mt-6 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
                A parcela cobrada nesta ingestão difere da projeção calculada no mês anterior.
                Como a operação é pós-fixada (indexada ao CDI), essa diferença é normalmente
                explicada pela variação do CDI entre um mês e o outro.
              </div>
            )}

            {parcela.isManual && parcela.onRemoveManual && (
              <div className="mt-6 flex justify-end">
                <button
                  onClick={parcela.onRemoveManual}
                  className="text-xs text-destructive hover:underline"
                >
                  Remover registro manual
                </button>
              </div>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
};
