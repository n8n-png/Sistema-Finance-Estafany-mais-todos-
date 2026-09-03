import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";

export interface FormField {
  id: string;
  label: string;
  type: string;
  placeholder?: string;
  step?: string;
  readOnly?: boolean;
  max?: number;
  hint?: string;
}

interface ExtraCheckbox {
  id: string;
  label: string;
  defaultChecked?: boolean;
}

interface CreditFormProps {
  title: string;
  fields: FormField[];
  onCalculate: (values: Record<string, string>, incluirTAC?: boolean, extras?: Record<string, boolean>) => void;
  showTAC?: boolean;
  extraCheckboxes?: ExtraCheckbox[];
  computeDerivedValues?: (values: Record<string, string>) => Record<string, string>;
  onValuesChange?: (values: Record<string, string>) => void;
}

export const CreditForm = ({
  title,
  fields,
  onCalculate,
  showTAC = false,
  extraCheckboxes = [],
  computeDerivedValues,
  onValuesChange,
}: CreditFormProps) => {
  const [values, setValues] = useState<Record<string, string>>({});
  const [incluirTAC, setIncluirTAC] = useState(true);
  const [extras, setExtras] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(extraCheckboxes.map((c) => [c.id, !!c.defaultChecked]))
  );


  const handleInputChange = (id: string, value: string) => {
    setValues((prev) => ({ ...prev, [id]: value }));
  };

  useEffect(() => {
    if (!computeDerivedValues) return;
    const derived = computeDerivedValues(values);
    const changed = Object.entries(derived).some(([k, v]) => values[k] !== v);
    if (changed) setValues((prev) => ({ ...prev, ...derived }));
  }, [values, computeDerivedValues]);

  useEffect(() => {
    onValuesChange?.(values);
  }, [values, onValuesChange]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onCalculate(values, showTAC ? incluirTAC : undefined, extras);
  };


  return (
    <div className="w-full max-w-6xl mx-auto p-4 space-y-6">
      <div className="bg-primary text-primary-foreground p-6 rounded-lg text-center">
        <h2 className="text-2xl font-bold">{title}</h2>
      </div>

      <Card className="p-6 bg-card shadow-card">
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {fields.map((field) => {
            const isValor = field.id === 'valor';
            const displayValue = isValor && values[field.id]
              ? (() => {
                  const n = parseFloat(values[field.id]);
                  return isNaN(n) ? '' : n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                })()
              : (values[field.id] || "");
            return (
              <div key={field.id} className="space-y-2">
                <Label htmlFor={field.id} className="text-primary font-semibold">
                  {field.label}
                </Label>
                <Input
                  id={field.id}
                  type={isValor || field.readOnly ? "text" : field.type}
                  inputMode={isValor ? "numeric" : undefined}
                  placeholder={isValor ? "R$ 0,00" : field.placeholder}
                  step={field.step}
                  max={field.max}
                  readOnly={field.readOnly}
                  value={displayValue}
                  onChange={(e) => {
                    if (isValor) {
                      const digits = e.target.value.replace(/\D/g, '');
                      const numeric = digits ? (parseInt(digits, 10) / 100).toString() : '';
                      handleInputChange(field.id, numeric);
                    } else {
                      handleInputChange(field.id, e.target.value);
                    }
                  }}
                  className={
                    field.readOnly
                      ? "border-input bg-muted cursor-not-allowed"
                      : "border-input focus:ring-primary focus:border-primary"
                  }
                />
                {field.hint && (
                  <p className="text-xs text-muted-foreground">{field.hint}</p>
                )}
              </div>
            );
          })}

          {showTAC && (
            <div className="flex items-center space-x-2 self-end pb-1">
              <Checkbox
                id="incluirTAC"
                checked={incluirTAC}
                onCheckedChange={(checked) => setIncluirTAC(checked === true)}
              />
              <label
                htmlFor="incluirTAC"
                className="text-xs font-medium text-muted-foreground cursor-pointer select-none"
              >
                Incluir TAC
              </label>
            </div>
          )}

          {extraCheckboxes.map((cb) => (
            <div key={cb.id} className="flex items-center space-x-2 self-end pb-1">
              <Checkbox
                id={cb.id}
                checked={!!extras[cb.id]}
                onCheckedChange={(checked) =>
                  setExtras((prev) => ({ ...prev, [cb.id]: checked === true }))
                }
              />
              <label
                htmlFor={cb.id}
                className="text-xs font-medium text-muted-foreground cursor-pointer select-none"
              >
                {cb.label}
              </label>
            </div>
          ))}

          <div className="md:col-span-2 lg:col-span-3">

            <Button type="submit" variant="success" size="lg" className="w-full text-lg py-3">
              Calcular
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
};
