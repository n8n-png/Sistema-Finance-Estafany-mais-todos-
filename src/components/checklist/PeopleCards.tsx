import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { X, Plus, Copy } from "lucide-react";
import { Pessoa, mascaraCPF, nomeProprio } from "@/utils/docFormats";
import { toast } from "@/hooks/use-toast";

interface Props {
  titulo: string;
  pessoas: Pessoa[];
  comRegime?: boolean;
  onChange: (next: Pessoa[]) => void;
  sourcePessoas?: Pessoa[];
  sourceLabel?: string;
}

export const PeopleCards = ({
  titulo,
  pessoas,
  comRegime = false,
  onChange,
  sourcePessoas,
  sourceLabel,
}: Props) => {
  const update = (i: number, patch: Partial<Pessoa>) => {
    const next = pessoas.map((p, idx) => (idx === i ? { ...p, ...patch } : p));
    onChange(next);
  };
  const remove = (i: number) => onChange(pessoas.filter((_, idx) => idx !== i));
  const add = () =>
    onChange([
      ...pessoas,
      comRegime
        ? { nome: "", cpf: "", email: "", regime: "" }
        : { nome: "", cpf: "", email: "" },
    ]);

  const copiarDaOrigem = () => {
    if (!sourcePessoas || sourcePessoas.length === 0) return;
    const preenchidas = sourcePessoas.filter((p) => p.nome || p.cpf || p.email);
    if (preenchidas.length === 0) {
      toast({
        title: "Nada para copiar",
        description: `Preencha primeiro ${sourceLabel ?? "os dados de origem"}.`,
        variant: "destructive",
      });
      return;
    }
    onChange(
      preenchidas.map((p) => ({
        nome: p.nome,
        cpf: p.cpf,
        email: p.email,
        ...(comRegime ? { regime: (p as Pessoa).regime ?? "" } : {}),
      }))
    );
    toast({
      title: "Dados copiados",
      description: `Preenchidos a partir d${sourceLabel ? "o(s) " + sourceLabel : "a origem"}.`,
    });
  };

  return (
    <div className="space-y-2">
      {sourcePessoas && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full"
          onClick={copiarDaOrigem}
        >
          <Copy className="h-3.5 w-3.5 mr-1.5" />
          Copiar dados d{sourceLabel ? "o(s) " + sourceLabel : "a origem"}
        </Button>
      )}
      {pessoas.map((p, i) => (
        <div
          key={i}
          className="relative rounded-md border border-border bg-card p-3 space-y-2"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
              {comRegime ? "Avalista" : "Representante"}
            </span>
            {pessoas.length > 1 && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => remove(i)}
                aria-label="Remover"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px] text-muted-foreground">Nome completo</Label>
            <Input
              value={p.nome}
              onChange={(e) => update(i, { nome: nomeProprio(e.target.value).toUpperCase() })}
              placeholder="NOME COMPLETO"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label className="text-[11px] text-muted-foreground">CPF</Label>
              <Input
                value={p.cpf}
                onChange={(e) => update(i, { cpf: mascaraCPF(e.target.value) })}
                placeholder="000.000.000-00"
                inputMode="numeric"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] text-muted-foreground">E-mail</Label>
              <Input
                value={p.email}
                onChange={(e) =>
                  update(i, { email: e.target.value.toLowerCase().replace(/\s/g, "") })
                }
                placeholder="email@exemplo.com"
              />
            </div>
          </div>
          {comRegime && (
            <div className="space-y-1.5">
              <Label className="text-[11px] text-muted-foreground">
                Estado civil e/ou regime de bens
              </Label>
              <select
                value={p.regime ?? ""}
                onChange={(e) => update(i, { regime: e.target.value })}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="">Selecione…</option>
                <option value="solteiro(a)">Solteiro(a)</option>
                <option value="comunhão parcial de bens">Casado(a) – Comunhão parcial de bens</option>
                <option value="comunhão universal de bens">Casado(a) – Comunhão universal de bens</option>
                <option value="separação total de bens">Casado(a) – Separação total de bens</option>
                <option value="separação obrigatória de bens">Casado(a) – Separação obrigatória de bens</option>
                <option value="participação final nos aquestos">Casado(a) – Participação final nos aquestos</option>
                <option value="união estável">União estável</option>
                <option value="viúvo(a)">Viúvo(a)</option>
                <option value="divorciado(a)">Divorciado(a)</option>
              </select>
            </div>
          )}
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full border-dashed"
        onClick={add}
      >
        <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar {comRegime ? "avalista" : "representante"}
      </Button>
    </div>
  );
};
