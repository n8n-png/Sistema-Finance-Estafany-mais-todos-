import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { FileDown, Loader2, Copy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import {
  BacenState,
  emptyBacen,
  AsState,
  CdtState,
  BACEN_PARAG_2,
  BACEN_ITENS,
  BACEN_RODAPE,
  buildBacenText,
} from "@/utils/checklistSchema";
import { mascaraCNPJ, mascaraCPF, nomeProprio, dataPorExtenso } from "@/utils/docFormats";
import { useChecklist } from "@/hooks/useChecklist";
import { exportBacenPDF } from "@/utils/checklistExport";
import { exportBacenDOCX } from "@/utils/checklistDocx";
import { ExportButtons } from "./ExportButtons";
import { SectionCard } from "./SectionCard";

interface Props {
  cnpj: string;
  operacaoId?: string | null;
  razaoSocial?: string;
}

export const CartaBacenForm = ({ cnpj, operacaoId, razaoSocial }: Props) => {
  const { state, patch, loading, saving } = useChecklist<BacenState>({
    cnpj,
    operacaoId,
    checklistType: "bacen",
    empty: emptyBacen,
  });
  const [copiando, setCopiando] = useState(false);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground justify-center">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
      </div>
    );
  }

  const copiarDaEmpresa = async () => {
    setCopiando(true);
    try {
      const { data, error } = await supabase
        .from("operacoes_ativas")
        .select("cnpj, franquia")
        .eq("cnpj", cnpj)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        toast({
          title: "Empresa não encontrada",
          description: "Não localizei este CNPJ nas operações ativas.",
          variant: "destructive",
        });
        return;
      }
      patch({
        razaoSocial: (data.franquia || state.razaoSocial || "").toUpperCase(),
        cnpj: mascaraCNPJ(data.cnpj || cnpj),
      });
      toast({
        title: "Dados da empresa copiados",
        description: "Razão social e CNPJ preenchidos automaticamente.",
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

  const copiarDoChecklist = async (tipo: "as" | "cdt") => {
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
      if (!s) {
        toast({
          title: `Nenhum checklist ${tipo.toUpperCase()} salvo`,
          description: "Preencha o checklist primeiro para poder copiar os dados.",
          variant: "destructive",
        });
        return;
      }
      const rep = s.representantes?.[0];
      patch({
        razaoSocial: s.razaoSocial || state.razaoSocial,
        cnpj: s.cnpj || state.cnpj,
        representanteNome: rep?.nome || state.representanteNome,
        representanteCPF: rep?.cpf || state.representanteCPF,
      });
      toast({
        title: "Dados copiados",
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

  const complete =
    !!state.razaoSocial &&
    !!state.cnpj &&
    !!state.cidade &&
    !!state.representanteNome &&
    !!state.representanteCPF;

  const renderPreviewText = () => {
    const raw = buildBacenText(state, false);
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
            ({inner.slice(7)})
          </span>,
        );
      } else {
        parts.push(
          <strong key={i++} className="text-primary">
            {inner}
          </strong>,
        );
      }
      last = m.index + m[0].length;
    }
    if (last < raw.length) parts.push(raw.slice(last));
    return parts;
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2 items-start">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Autorização de consulta ao SCR (Carta Bacen)
          </p>
          <Badge variant="outline" className="text-[10px]">
            {saving ? "Salvando…" : "Salvo automaticamente"}
          </Badge>
        </div>

        <Card className="p-3 bg-muted/40 space-y-2">
          <p className="text-xs text-muted-foreground">Autopreenchimento:</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full"
            disabled={copiando}
            onClick={copiarDaEmpresa}
          >
            <Copy className="h-3.5 w-3.5 mr-1.5" /> Copiar dados da Empresa
          </Button>
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={copiando}
              onClick={() => copiarDoChecklist("as")}
            >
              <Copy className="h-3.5 w-3.5 mr-1.5" /> Copiar do Checklist AS
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={copiando}
              onClick={() => copiarDoChecklist("cdt")}
            >
              <Copy className="h-3.5 w-3.5 mr-1.5" /> Copiar do Checklist CDT
            </Button>
          </div>
        </Card>

        <SectionCard numero={1} titulo="Dados do franqueado" complete={complete}>
          <div className="space-y-1.5">
            <Label className="text-xs">Razão social</Label>
            <Input
              tabIndex={1}
              value={state.razaoSocial}
              onChange={(e) => patch({ razaoSocial: e.target.value.toUpperCase() })}
              placeholder="RAZÃO SOCIAL DO FRANQUEADO"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label className="text-xs">CNPJ</Label>
              <Input
                tabIndex={2}
                value={state.cnpj}
                onChange={(e) => patch({ cnpj: mascaraCNPJ(e.target.value) })}
                placeholder="00.000.000/0000-00"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Cidade</Label>
              <Input
                tabIndex={3}
                value={state.cidade}
                onChange={(e) => patch({ cidade: e.target.value })}
                placeholder="Ex: Ribeirão Preto/SP"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Nome do representante legal</Label>
            <Input
              tabIndex={4}
              value={state.representanteNome}
              onChange={(e) =>
                patch({ representanteNome: nomeProprio(e.target.value).toUpperCase() })
              }
              placeholder="NOME COMPLETO"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">CPF do representante legal</Label>
            <Input
              tabIndex={5}
              value={state.representanteCPF}
              onChange={(e) => patch({ representanteCPF: mascaraCPF(e.target.value) })}
              placeholder="000.000.000-00"
              inputMode="numeric"
            />
          </div>
        </SectionCard>

        <ExportButtons
          onPdf={() => exportBacenPDF(state, razaoSocial)}
          onDocx={() => exportBacenDOCX(state, razaoSocial)}
          pdfLabel="Baixar PDF da Carta Bacen"
        />
      </div>

      {/* Preview fixo */}
      <div className="lg:sticky lg:top-4 lg:self-start lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
          Pré-visualização do documento
        </p>
        <div className="relative bg-[hsl(38,50%,97%)] text-[hsl(45,10%,15%)] shadow-card rounded-md p-8 border border-border">
          <div className="absolute inset-3 border border-primary/30 pointer-events-none rounded-sm" />
          <div className="relative space-y-3 text-[11px] leading-relaxed">
            <h3 className="text-center text-sm font-bold uppercase">
              Autorização para Consulta ao Sistema de Informação de Crédito (SCR) e Cadastro
            </h3>
            <p className="text-justify" style={{ hyphens: "auto" }}>
              {renderPreviewText()}
            </p>
            <p className="text-justify">{BACEN_PARAG_2}</p>
            <ol className="list-decimal list-inside space-y-1 text-justify">
              {BACEN_ITENS.map((it, idx) => (
                <li key={idx}>{it}</li>
              ))}
            </ol>
            <p className="pt-2">
              {state.cidade ? (
                <strong className="text-primary">{state.cidade}</strong>
              ) : (
                <span className="text-destructive font-semibold">(CIDADE)</span>
              )}
              , {dataPorExtenso()}.
            </p>
            <div className="pt-8 space-y-1">
              <div className="border-t border-foreground/70 pt-1 max-w-xs mx-auto text-center">
                {state.representanteNome ? (
                  <strong className="text-primary">{state.representanteNome}</strong>
                ) : (
                  <span className="text-destructive font-semibold">
                    (NOME DO REPRESENTANTE LEGAL)
                  </span>
                )}
              </div>
              <div className="max-w-xs mx-auto text-center">
                {state.representanteCPF ? (
                  <strong className="text-primary">{state.representanteCPF}</strong>
                ) : (
                  <span className="text-destructive font-semibold">
                    (CPF DO REPRESENTANTE LEGAL)
                  </span>
                )}
              </div>
            </div>
            <div className="pt-6 border-t border-foreground/30 text-[9px] text-center text-muted-foreground space-y-0.5">
              {BACEN_RODAPE.map((l) => (
                <p key={l}>{l}</p>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
