import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileDown, Loader2, Copy } from "lucide-react";
import { useState } from "react";
import { OutorgaState, buildOutorgaText, emptyOutorga, AsState, CdtState, outorgaRegimeCurto } from "@/utils/checklistSchema";
import { mascaraCPF, mascaraRG, mascaraCNPJ, nomeProprio } from "@/utils/docFormats";

import { useChecklist } from "@/hooks/useChecklist";
import { PillGroup } from "./PillGroup";
import { exportOutorgaPDF } from "@/utils/checklistExport";
import { exportOutorgaDOCX } from "@/utils/checklistDocx";
import { ExportButtons } from "./ExportButtons";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface Props {
  cnpj: string;
  operacaoId?: string | null;
  razaoSocial?: string;
}

const Field = ({
  label,
  value,
  onChange,
  placeholder,
  mask,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  mask?: (v: string) => string;
}) => (
  <div className="space-y-1.5">
    <Label className="text-xs">{label}</Label>
    <Input
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(mask ? mask(e.target.value) : e.target.value)}
    />
  </div>
);

// Converte texto com marcadores __VAL__ / __EMPTY::LABEL__ em spans (preview).
const renderOutorgaHtml = (state: OutorgaState) => {
  const raw = buildOutorgaText(state, false);
  const parts: React.ReactNode[] = [];
  const regex = /__(EMPTY::[^_]+|[^_]+)__/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = regex.exec(raw)) !== null) {
    if (m.index > last) parts.push(raw.slice(last, m.index));
    const inner = m[1];
    if (inner.startsWith("EMPTY::")) {
      parts.push(
        <span
          key={i++}
          className="inline-block px-1 rounded bg-destructive/10 text-destructive font-semibold"
        >
          [{inner.slice(7)}]
        </span>
      );
    } else {
      parts.push(
        <strong key={i++} className="text-primary">
          {inner}
        </strong>
      );
    }
    last = m.index + m[0].length;
  }
  if (last < raw.length) parts.push(raw.slice(last));
  return parts;
};

export const OutorgaForm = ({ cnpj, operacaoId, razaoSocial }: Props) => {
  const { state, patch, loading, saving } = useChecklist<OutorgaState>({
    cnpj,
    operacaoId,
    checklistType: "outorga",
    empty: emptyOutorga,
  });
  const [copiando, setCopiando] = useState(false);
  const regimeComunhao = outorgaRegimeCurto(state?.regimeBens) !== null;


  if (loading) {
    return (
      <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground justify-center">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando checklist…
      </div>
    );
  }

  const copiarDoAvalista = async (tipo: "as" | "cdt") => {
    setCopiando(true);
    try {
      const { data, error } = await supabase
        .from("operacoes_checklists")
        .select("items_state")
        .eq("estabelecimento_cnpj", cnpj)
        .eq("checklist_type", tipo)
        .eq("operacao_id", operacaoId ?? "")
        .maybeSingle();
      if (error) throw error;
      const s = data?.items_state as unknown as AsState | CdtState | null;
      const av = s?.avalistas?.find((p) => p.nome || p.cpf);
      if (!av) {
        toast({
          title: `Nenhum avalista salvo no ${tipo.toUpperCase()}`,
          description: "Preencha o checklist primeiro.",
          variant: "destructive",
        });
        return;
      }
      patch({
        avalistaNome: nomeProprio(av.nome || state.avalistaNome),
        avalistaCPF: av.cpf || state.avalistaCPF,
      });
      toast({
        title: "Dados do avalista copiados",
        description: `Preenchidos a partir do checklist ${tipo.toUpperCase()}.`,
      });
    } catch (e) {
      toast({
        title: "Erro ao copiar",
        description: (e as Error).message,
        variant: "destructive",
      });
    } finally {
      setCopiando(false);
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2 items-start">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Outorga Uxória — para aval prestado por sócio casado
          </p>
          <Badge variant="outline" className="text-[10px]">
            {saving ? "Salvando…" : "Salvo automaticamente"}
          </Badge>
        </div>

        <Card className="p-4 space-y-3 bg-card">
          <h4 className="text-sm font-semibold text-primary">Cônjuge (outorgante)</h4>

          <div className="space-y-1.5">
            <Label className="text-xs">Estado civil e/ou regime de bens</Label>
            <select
              value={state.regimeBens}
              onChange={(e) => patch({ regimeBens: e.target.value as typeof state.regimeBens })}
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="solteiro(a)">Solteiro(a)</option>
              <option value="comunhão parcial de bens">Casado(a) — comunhão parcial de bens</option>
              <option value="comunhão universal de bens">Casado(a) — comunhão universal de bens</option>
              <option value="separação total de bens">Casado(a) — separação total de bens</option>
              <option value="separação obrigatória de bens">Casado(a) — separação obrigatória de bens</option>
              <option value="participação final nos aquestos">Casado(a) — participação final nos aquestos</option>
            </select>
          </div>

          {state.regimeBens !== "solteiro(a)" && (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs">Tratamento</Label>
                <PillGroup
                  value={state.conjugeTratamento}
                  options={[
                    { value: "a Sra.", label: "a Sra." },
                    { value: "o Sr.", label: "o Sr." },
                  ]}
                  onChange={(v) => patch({ conjugeTratamento: v as "a Sra." | "o Sr." })}
                />
              </div>

              <Field
                label="Nome completo"
                value={state.conjugeNome}
                onChange={(v) => patch({ conjugeNome: nomeProprio(v) })}
              />
              <div className="grid grid-cols-2 gap-2">
                <Field
                  label="Nacionalidade"
                  value={state.conjugeNacionalidade}
                  onChange={(v) => patch({ conjugeNacionalidade: v })}
                  placeholder="brasileira"
                />
                <Field
                  label="Profissão"
                  value={state.conjugeProfissao}
                  onChange={(v) => patch({ conjugeProfissao: v })}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Field
                  label="RG"
                  value={state.conjugeRG}
                  onChange={(v) => patch({ conjugeRG: v })}
                  mask={mascaraRG}
                />
                <Field
                  label="Órgão emissor / UF"
                  value={state.conjugeOrgaoRG}
                  onChange={(v) => patch({ conjugeOrgaoRG: v.toUpperCase() })}
                  placeholder="SSP/SP"
                />
              </div>
              <Field
                label="CPF"
                value={state.conjugeCPF}
                onChange={(v) => patch({ conjugeCPF: v })}
                mask={mascaraCPF}
              />
              <Field
                label="Endereço completo"
                value={state.conjugeEndereco}
                onChange={(v) => patch({ conjugeEndereco: v })}
              />
            </>
          )}
        </Card>

        {!regimeComunhao && (
          <div className="rounded-md border border-yellow-300 bg-yellow-50 px-3 py-2 text-[11px] text-yellow-900">
            A Outorga Uxória normalmente não é exigida para este regime de bens.
          </div>
        )}

        <Card className="p-4 space-y-3 bg-card">
          <h4 className="text-sm font-semibold text-primary">Emitente</h4>
          <Field
            label="Razão social"
            value={state.emitenteNome}
            onChange={(v) => patch({ emitenteNome: v })}
          />
          <Field
            label="Endereço completo"
            value={state.emitenteEndereco}
            onChange={(v) => patch({ emitenteEndereco: v })}
          />
          <Field
            label="CNPJ"
            value={state.emitenteCnpj}
            onChange={(v) => patch({ emitenteCnpj: v })}
            mask={mascaraCNPJ}
          />
        </Card>

        <Card className="p-4 space-y-3 bg-card">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h4 className="text-sm font-semibold text-primary">Avalista (franqueado)</h4>
            {regimeComunhao && (
              <div className="flex gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={copiando}
                  onClick={() => copiarDoAvalista("as")}
                >
                  <Copy className="h-3.5 w-3.5 mr-1" /> AS
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={copiando}
                  onClick={() => copiarDoAvalista("cdt")}
                >
                  <Copy className="h-3.5 w-3.5 mr-1" /> CDT
                </Button>
              </div>
            )}
          </div>
          {regimeComunhao && (
            <p className="text-[10px] text-muted-foreground -mt-2">
              Copiar dados do Franqueado/Avalista salvos em outro checklist.
            </p>
          )}

          <PillGroup
            value={state.avalistaTratamento}
            options={[
              { value: "o Sr.", label: "o Sr." },
              { value: "a Sra.", label: "a Sra." },
            ]}
            onChange={(v) => patch({ avalistaTratamento: v as "o Sr." | "a Sra." })}
          />
          <Field
            label="Nome completo"
            value={state.avalistaNome}
            onChange={(v) => patch({ avalistaNome: nomeProprio(v) })}
          />
          <div className="grid grid-cols-2 gap-2">
            <Field
              label="Nacionalidade"
              value={state.avalistaNacionalidade}
              onChange={(v) => patch({ avalistaNacionalidade: v })}
              placeholder="brasileiro"
            />
            <Field
              label="Profissão"
              value={state.avalistaProfissao}
              onChange={(v) => patch({ avalistaProfissao: v })}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field
              label="RG"
              value={state.avalistaRG}
              onChange={(v) => patch({ avalistaRG: v })}
              mask={mascaraRG}
            />
            <Field
              label="Órgão emissor / UF"
              value={state.avalistaOrgaoRG}
              onChange={(v) => patch({ avalistaOrgaoRG: v.toUpperCase() })}
            />
          </div>
          <Field
            label="CPF"
            value={state.avalistaCPF}
            onChange={(v) => patch({ avalistaCPF: v })}
            mask={mascaraCPF}
          />
          <Field
            label="Endereço completo"
            value={state.avalistaEndereco}
            onChange={(v) => patch({ avalistaEndereco: v })}
          />
        </Card>

        <Card className="p-4 space-y-2 bg-card">
          <h4 className="text-sm font-semibold text-primary">Local e data</h4>
          <Field
            label="Local de assinatura"
            value={state.localAssinatura}
            onChange={(v) => patch({ localAssinatura: v })}
            placeholder="Ex: Ribeirão Preto/SP"
          />
          <p className="text-[11px] text-muted-foreground">
            A data será preenchida automaticamente no PDF (data de hoje, por extenso).
          </p>
        </Card>

        <ExportButtons
          onPdf={() => exportOutorgaPDF(state, razaoSocial)}
          onDocx={() => exportOutorgaDOCX(state, razaoSocial)}
          pdfLabel="Baixar PDF da Outorga"
        />
      </div>

      {/* Pré-visualização do texto legal */}
      <div className="lg:sticky lg:top-4 lg:self-start lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
          Pré-visualização do documento
        </p>
        <div className="relative bg-[hsl(38,50%,97%)] text-[hsl(45,10%,15%)] shadow-card rounded-md p-8 border border-border">
          <div className="absolute inset-3 border border-primary/30 pointer-events-none rounded-sm" />
          <div className="relative">
            <h3 className="text-center text-sm font-bold underline">AUTORIZAÇÃO CONJUGAL</h3>
            <p className="text-center text-[11px] font-bold underline mb-5">
              Outorga Uxória relativa ao Aval
            </p>
            <p
              className="text-[11px] leading-relaxed text-justify font-serif"
              style={{ hyphens: "auto" }}
            >
              {renderOutorgaHtml(state)}
            </p>
            <p className="text-[11px] mt-6">
              {state.localAssinatura || (
                <span className="text-destructive font-semibold">[Local]</span>
              )}
              , <em>data automática no PDF</em>.
            </p>
            <div className="mt-8 text-[11px] space-y-1">
              <p className="font-semibold">
                {state.conjugeNome || (
                  <span className="text-destructive font-semibold">[CÔNJUGE]</span>
                )}
              </p>
              <div className="border-t border-foreground/70 max-w-xs" />
              <p>CPF/ME: {state.conjugeCPF}</p>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};
