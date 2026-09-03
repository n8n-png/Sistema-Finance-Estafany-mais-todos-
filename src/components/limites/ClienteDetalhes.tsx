import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CreditCard as CreditCardIcon, Eye, HeartPulse, Sprout } from "lucide-react";
import { ClienteLimite } from "@/hooks/useLimites";

const formatBRL = (v: number | null) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v ?? 0);

export type SimulacaoCalculadora = "qia" | "recebiveis" | "amorSaude" | "expansaoAmorSaude";

const CALCULADORAS: { id: SimulacaoCalculadora; title: string; icon: typeof Eye }[] = [
  { id: "qia", title: "QIA como Garantia - Cartão de TODOS", icon: CreditCardIcon },
  { id: "recebiveis", title: "Recebíveis como Garantia - Visão de TODOS", icon: Eye },
  { id: "amorSaude", title: "Recebíveis como Garantia - Amor Saúde", icon: HeartPulse },
  { id: "expansaoAmorSaude", title: "Recebíveis como Garantia - Expansão Amor Saúde", icon: Sprout },
];

interface Props {
  cliente: ClienteLimite;
  onBack: () => void;
  onSimular: (calculadora: SimulacaoCalculadora) => void;
}

const Field = ({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) => (
  <div className="py-3 border-b border-border last:border-0">
    <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
    <p className={`mt-1 ${highlight ? "text-lg font-semibold" : "text-base"} text-foreground break-words`}>
      {value || "—"}
    </p>
  </div>
);

export const ClienteDetalhes = ({ cliente, onBack, onSimular }: Props) => {
  const totalCom = cliente.total_com_carencia ?? 0;
  const totalSem = cliente.total_sem_carencia ?? 0;
  return (
    <div className="space-y-6">
      <button onClick={onBack} className="text-primary hover:text-primary/80 font-semibold transition-colors">
        ← Voltar para a lista
      </button>

      <Card className="p-6 border border-border border-l-4 border-l-primary shadow-card">
        <h2 className="text-xl font-semibold text-primary mb-4">Detalhes do Cliente</h2>
        <div className="space-y-0">
          <Field label="Sócios" value={cliente.socios ?? ""} />
          <Field label="CNPJ" value={cliente.cnpj} />
          <Field label="Unidade" value={cliente.unidade ?? ""} />
          <Field label="Grupo" value={cliente.grupo ?? ""} />
          <Field label="Status das operações" value={cliente.status_operacoes ?? ""} />
          <div className="py-3 border-b border-border">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Total com carência</p>
            <p className={`mt-1 text-lg font-semibold ${totalCom < 0 ? "text-destructive" : "text-foreground"}`}>
              {formatBRL(totalCom)}
            </p>
          </div>
          <div className="py-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Total sem carência</p>
            <p className={`mt-1 text-lg font-semibold ${totalSem < 0 ? "text-destructive" : "text-foreground"}`}>
              {formatBRL(totalSem)}
            </p>
          </div>
        </div>
      </Card>

      <div className="flex gap-3 justify-center">
        <Button variant="outline" size="lg" onClick={onBack}>
          Voltar
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="gradient" size="lg">
              Simular
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center" className="w-80 bg-popover z-50">
            <DropdownMenuLabel>Escolha a modalidade</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {CALCULADORAS.map(({ id, title, icon: Icon }) => (
              <DropdownMenuItem key={id} onSelect={() => onSimular(id)} className="cursor-pointer gap-2">
                <Icon size={16} className="text-primary shrink-0" />
                <span className="text-sm whitespace-normal">{title}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
};
