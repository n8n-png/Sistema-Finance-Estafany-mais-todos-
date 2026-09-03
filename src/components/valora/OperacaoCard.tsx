import { Card } from "@/components/ui/card";
import { formatCurrency } from "@/utils/currency";
import { usePreAprovado } from "@/hooks/usePreAprovados";
import {
  diasNaEtapa,
  pendentesAssinatura,
  slaStatus,
  type Operacao,
  type LinhaCredito,
} from "@/services/operacoes";


// Badges informativos (linha/fundo) usam tratamento neutro — cor fica reservada para SLA e alertas.
const linhaClass: Record<LinhaCredito, string> = {
  QIA: "bg-muted text-muted-foreground",
  "Amor Saúde": "bg-muted text-muted-foreground",
  "Visão de Todos": "bg-muted text-muted-foreground",
};

// Cor reservada para sinalização real de prazo — "ok" fica neutro.
const slaClass = {
  ok: "bg-muted text-muted-foreground",
  atencao: "bg-sla-warn text-secondary-foreground",
  estourado: "bg-sla-late text-primary-foreground",
} as const;

const formatCnpj = (v: string) => {
  const d = v.replace(/\D/g, "");
  return d.length === 14
    ? d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5")
    : v;
};

export const OperacaoCard = ({ op, onClick }: { op: Operacao; onClick: () => void }) => {
  const dias = diasNaEtapa(op);
  const sla = slaStatus(op);
  const pendentes = pendentesAssinatura(op);
  const preAprovado = usePreAprovado(op.cnpj);


  const destaque =
    op.alerta?.tipo === "Reprovado"
      ? "border-2 border-destructive bg-destructive/10"
      : op.alerta?.tipo === "Pendência"
        ? "border-2 border-sla-warn bg-sla-warn/20"
        : "border border-border bg-card";

  return (
    <Card
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onClick()}
      className={`relative box-border flex min-h-[15rem] w-full cursor-pointer flex-col overflow-hidden rounded-md px-2 pb-2 pt-2.5 shadow-sm transition-colors hover:border-foreground/20 ${destaque}`}
    >
      {/* Listra roxa fixa no topo do card — fora do fluxo para não variar a altura visual. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-primary" />

      <div className="mb-1 flex items-start justify-between gap-1.5">
        <div className="min-w-0">
          <h4 className="min-w-0 truncate text-xs font-semibold leading-tight text-foreground">
            {op.unidade}
          </h4>
          {op.cnpj && (
            <p className="truncate text-[11px] leading-tight text-muted-foreground">
              {formatCnpj(op.cnpj)}
            </p>
          )}
        </div>
        <span className={`crm-pill ${slaClass[sla]}`}>{dias}d</span>
      </div>

      <div className="mb-1.5 flex min-w-0 flex-wrap gap-1">
        <span className={`crm-pill ${linhaClass[op.linha]}`}>{op.linha}</span>
        {/* Fundo responsável — TODO: integração real com HubSpot aqui. */}
        <span className="crm-pill border border-border text-muted-foreground">{op.fundo}</span>
        {/* CNPJ presente na base de pré-aprovados. */}
        {preAprovado && <span className="crm-pill bg-sla-ok text-primary-foreground">MVP</span>}
      </div>

      {preAprovado && (
        <p className="mb-1.5 truncate text-xs font-medium text-foreground">
          Limite: {formatCurrency(preAprovado.limite)}
        </p>
      )}


      <div className="grid grid-cols-2 gap-1.5 text-xs">
        <div className="min-w-0">
          <p className="crm-field-label">Valor</p>
          <div className="truncate font-semibold text-foreground">{formatCurrency(op.valor)}</div>
        </div>
        <div className="min-w-0">
          <p className="crm-field-label">Taxa</p>
          <div className="truncate font-medium text-muted-foreground">{op.taxa}</div>
        </div>
      </div>

      {/* Espaçador: mantém altura homogênea quando não há seções condicionais */}
      <div className="flex-1" />

      {op.etapa === "contrato_emitido" && (
        <div className="mt-1.5 border-t border-border pt-1.5">
          <p className="crm-field-label">Pendente de assinatura</p>

          {pendentes.length === 0 ? (
            <p className="text-xs text-foreground">Todas as assinaturas concluídas</p>
          ) : (
            <ul className="space-y-0.5 text-xs leading-snug text-foreground">
              {pendentes.map((s) => (
                <li key={s.id} className="truncate">
                  {s.nome} <span className="text-muted-foreground">— {s.papel}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {op.alerta && (
        <div className="mt-1.5 space-y-1 border-t border-border pt-1.5">
          <span
            className={`crm-pill ${
              op.alerta.tipo === "Reprovado"
                ? "bg-destructive text-destructive-foreground"
                : "bg-sla-warn text-secondary-foreground"
            }`}
          >
            {op.alerta.tipo}
          </span>
          <p className="text-xs leading-snug text-muted-foreground line-clamp-3">{op.alerta.mensagem}</p>

        </div>
      )}
    </Card>
  );
};
