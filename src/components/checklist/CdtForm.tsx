import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { FileDown, Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import {
  CDT_DOCS,
  CDT_FIEL_DEPOSITARIO,
  CdtState,
  cdtDocsStatus,
  cdtItens,
  emptyCdt,
} from "@/utils/checklistSchema";
import { mascaraCNPJ, mascaraMeses, mascaraMoeda, mascaraTaxa } from "@/utils/docFormats";
import { useChecklist } from "@/hooks/useChecklist";
import { PeopleCards } from "./PeopleCards";
import { PillGroup } from "./PillGroup";
import { DocumentPreview } from "./DocumentPreview";
import { SectionCard } from "./SectionCard";
import { exportCdtPDF } from "@/utils/checklistExport";
import { exportCdtDOCX } from "@/utils/checklistDocx";
import { ExportButtons } from "./ExportButtons";

interface Props {
  cnpj: string;
  operacaoId?: string | null;
  razaoSocial?: string;
}

export const CdtForm = ({ cnpj, operacaoId, razaoSocial }: Props) => {
  const { state, patch, loading, saving } = useChecklist<CdtState>({
    cnpj,
    operacaoId,
    checklistType: "cdt",
    empty: emptyCdt,
  });

  const status = useMemo(() => cdtDocsStatus(state.docs ?? {}), [state.docs]);
  const resolvidos = status.filter((s) => s !== "PENDENTE").length;

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground justify-center">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando checklist…
      </div>
    );
  }

  const setDoc = (idx: string, v: boolean) => patch({ docs: { ...state.docs, [idx]: v } });

  const idComplete = !!state.razaoSocial && !!state.cnpj && !!state.regional;
  const carPreenchida =
    state.opCarenciaTipo === "total_e_principal"
      ? !!state.opCarenciaTotalMeses && !!state.opCarenciaPrincipalMeses
      : !state.opCarencia || !!state.opCarencia;
  const itensComplete =
    state.representantes.every((p) => p.nome && p.cpf && p.email) &&
    state.avalistas.every((p) => p.nome && p.cpf && p.email) &&
    !!state.dadosBancarios &&
    !!state.opValor && !!state.opTaxa && !!state.opPrazo &&
    carPreenchida &&
    !!state.qtdCartoes;
  const docsComplete = resolvidos === CDT_DOCS.length;

  return (
    <div className="grid gap-4 lg:grid-cols-2 items-start">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Cartão de TODOS (CDT) — FIDC Mais Todos
          </p>
          <Badge variant="outline" className="text-[10px]">
            {saving ? "Salvando…" : "Salvo automaticamente"}
          </Badge>
        </div>

        <SectionCard numero={1} titulo="Identificação da franquia" complete={idComplete}>
          <div className="space-y-1.5">
            <Label className="text-xs">Razão social completa</Label>
            <Input
              tabIndex={1}
              value={state.razaoSocial}
              onChange={(e) => patch({ razaoSocial: e.target.value.toUpperCase() })}
              placeholder="Ex: ADMINISTRADORA DE CARTAO DE TODOS BAURU LTDA"
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
              <Label className="text-xs">Regional (UF)</Label>
              <Input
                tabIndex={3}
                value={state.regional}
                onChange={(e) => patch({ regional: e.target.value.toUpperCase() })}
                placeholder="SP"
              />
            </div>
          </div>
        </SectionCard>

        <SectionCard numero={2} titulo="Itens verificados" complete={itensComplete}>
          <div className="space-y-1.5">
            <Label className="text-xs">Representantes legais (= avalista)</Label>
            <PeopleCards
              titulo="Representantes"
              pessoas={state.representantes}
              onChange={(next) => patch({ representantes: next })}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Avalistas (sócios)</Label>
            <PeopleCards
              titulo="Avalistas"
              pessoas={state.avalistas}
              comRegime
              sourcePessoas={state.representantes}
              sourceLabel="Representante Legal"
              onChange={(next) => patch({ avalistas: next })}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Dados bancários do franqueado</Label>
            <Input
              value={state.dadosBancarios}
              onChange={(e) => patch({ dadosBancarios: e.target.value })}
              placeholder="Banco 332 - Ag 0001 - CC 000000000-0"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Fiel depositário + dados bancários</Label>
            <div className="rounded-md bg-primary text-primary-foreground text-xs font-semibold px-3 py-2 leading-snug">
              {CDT_FIEL_DEPOSITARIO}
              <span className="block font-normal opacity-70 text-[10px] mt-0.5">
                fixo em todos os checklists do CDT
              </span>
            </div>
          </div>

          <div className="pt-2 space-y-2 rounded-md bg-muted/40 p-3">
            <Label className="text-xs font-semibold">Dados da operação</Label>
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">
                1) Valor (já com 2% de TAC)
              </Label>
              <Input
                tabIndex={10}
                value={state.opValor}
                onChange={(e) => patch({ opValor: mascaraMoeda(e.target.value) })}
                placeholder="R$ 0,00"
                inputMode="numeric"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">2) Prazo (nº parcelas)</Label>
              <Input
                tabIndex={11}
                value={state.opPrazo}
                onChange={(e) => patch({ opPrazo: mascaraMeses(e.target.value) })}
                placeholder="36"
                inputMode="numeric"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">3) Tipo de carência</Label>
              <PillGroup
                value={state.opCarenciaTipo}
                options={[
                  { value: "total", label: "Total" },
                  { value: "principal", label: "Principal" },
                  { value: "total_e_principal", label: "Total + Principal" },
                ]}
                onChange={(v) =>
                  patch({ opCarenciaTipo: v as CdtState["opCarenciaTipo"] })
                }
              />
            </div>
            {state.opCarenciaTipo === "total_e_principal" ? (
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">
                    Meses de carência TOTAL
                  </Label>
                  <Input
                    tabIndex={12}
                    value={state.opCarenciaTotalMeses}
                    onChange={(e) =>
                      patch({ opCarenciaTotalMeses: mascaraMeses(e.target.value) })
                    }
                    placeholder="12"
                    inputMode="numeric"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">
                    Meses de carência PRINCIPAL
                  </Label>
                  <Input
                    tabIndex={13}
                    value={state.opCarenciaPrincipalMeses}
                    onChange={(e) =>
                      patch({ opCarenciaPrincipalMeses: mascaraMeses(e.target.value) })
                    }
                    placeholder="6"
                    inputMode="numeric"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">
                  4) Meses de carência (das parcelas)
                </Label>
                <Input
                  tabIndex={12}
                  value={state.opCarencia}
                  onChange={(e) => patch({ opCarencia: mascaraMeses(e.target.value) })}
                  placeholder="6"
                  inputMode="numeric"
                />
              </div>
            )}
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">5) Taxa (% a.m.)</Label>
              <Input
                tabIndex={14}
                value={state.opTaxa}
                onChange={(e) => patch({ opTaxa: mascaraTaxa(e.target.value) })}
                placeholder="0,76"
                inputMode="decimal"
              />
            </div>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <Checkbox
                checked={state.opCDI}
                onCheckedChange={(v) => patch({ opCDI: !!v })}
                tabIndex={15}
              />
              6) Taxa acrescida de CDI (+ CDI)
            </label>
            <p className="text-[10px] text-muted-foreground">
              A linha "2% de TAC incluída" sai automaticamente no documento.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Projeto de clínicas em expansão?</Label>
              <PillGroup
                value={state.expansao}
                options={[
                  { value: "Sim", label: "Sim" },
                  { value: "Não", label: "Não" },
                ]}
                onChange={(v) => patch({ expansao: v as "Sim" | "Não" })}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Operação pré-aprovada?</Label>
              <PillGroup
                value={state.preAprovada}
                options={[
                  { value: "Sim", label: "Sim" },
                  { value: "Não", label: "Não" },
                ]}
                onChange={(v) => patch({ preAprovada: v as "Sim" | "Não" })}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">
              Quantidade de cartões emitidos (nº de matrícula)
            </Label>
            <Input
              value={state.qtdCartoes}
              onChange={(e) => patch({ qtdCartoes: e.target.value })}
              placeholder="Ex: 12.345"
            />
          </div>
        </SectionCard>

        <SectionCard
          numero={3}
          titulo={`Documentos anexos (${resolvidos}/${CDT_DOCS.length})`}
          complete={docsComplete}
        >
          <p className="text-[11px] text-muted-foreground">
            A numeração dos anexos é automática, na ordem dos itens marcados. Não marcados saem como{" "}
            <strong>PENDENTE</strong>.
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() =>
                patch({
                  docs: Object.fromEntries(CDT_DOCS.map((_, i) => [String(i), true])),
                })
              }
            >
              Marcar todos
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => patch({ docs: {} })}
            >
              Limpar
            </Button>
          </div>
          {CDT_DOCS.map((nome, i) => {
            const idx = String(i);
            const checked = !!state.docs[idx];
            return (
              <label
                key={idx}
                className={`flex items-start gap-2 rounded-md border p-2.5 cursor-pointer transition-colors ${
                  checked ? "border-primary bg-accent/40" : "border-border bg-background"
                }`}
              >
                <Checkbox
                  checked={checked}
                  onCheckedChange={(v) => setDoc(idx, !!v)}
                  className="mt-0.5"
                />
                <span className="text-xs leading-snug">{nome}</span>
              </label>
            );
          })}
        </SectionCard>

        <ExportButtons
          onPdf={() => exportCdtPDF(state, razaoSocial)}
          onDocx={() => exportCdtDOCX(state, razaoSocial)}
          pdfLabel="Baixar PDF do Checklist CDT"
        />
      </div>

      <div className="lg:sticky lg:top-4 lg:self-start lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto">
        <DocumentPreview
          titulo="Check-list – FIDC Mais Todos"
          subtitulo="Cartão de TODOS (CDT)"
          identificacao={[
            ["RAZÃO SOCIAL COMPLETA", state.razaoSocial],
            ["CNPJ", state.cnpj],
          ]}
          itens={cdtItens(state)}
          docs={CDT_DOCS.map((nome, i) => ({
            label: nome.toUpperCase(),
            status: status[i],
          }))}
        />
      </div>
    </div>
  );
};
