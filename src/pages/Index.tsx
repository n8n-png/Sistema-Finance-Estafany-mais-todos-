import { CreditHeader } from "@/components/CreditHeader";
import { CreditForm, FormField } from "@/components/CreditForm";
import { ResultsSummary } from "@/components/ResultsSummary";
import { AmortizationTable } from "@/components/AmortizationTable";
import { BalanceChart } from "@/components/BalanceChart";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { calculateQIA, calculateRecebiveis, calculateAmorSaude, calculateExpansaoAmorSaude, getExpansaoAmorSaudeSpread, CalculationResult } from "@/utils/calculations";
import { getCDI } from "@/utils/cdi";
import { useToast } from "@/hooks/use-toast";
import { generatePDF } from "@/utils/pdfExport";
import { Button } from "@/components/ui/button";
import { FileDown, CreditCard as CreditCardIcon, Eye, HeartPulse, Sprout, AlertCircle } from "lucide-react";
import { LimitesList } from "@/components/limites/LimitesList";
import { ClienteDetalhes } from "@/components/limites/ClienteDetalhes";
import { ClienteLimite } from "@/hooks/useLimites";
import { SolicitarAnaliseButton } from "@/components/SolicitarAnaliseButton";
import { ClienteSelector, Segmento } from "@/components/limites/ClienteSelector";
import { DashboardKPIs } from "@/components/home/DashboardKPIs";
import { usePageAccess } from "@/hooks/usePageAccess";
import { HomeFooter } from "@/components/home/HomeFooter";


const TIPO_GARANTIA_MAP: Record<string, string> = {
  qia: "QIA - Cartão de TODOS",
  recebiveis: "Recebíveis - Visão de TODOS",
  amorSaude: "Recebíveis - Amor Saúde",
  expansaoAmorSaude: "Recebíveis - Expansão Amor Saúde",
};

type CalculatorType = 'qia' | 'recebiveis' | 'amorSaude' | 'expansaoAmorSaude' | 'limitesList' | 'limitesDetail' | null;

const Index = () => {
  const [activeCalculator, setActiveCalculator] = useState<CalculatorType>(null);
  const [results, setResults] = useState<CalculationResult | null>(null);
  const [lastInput, setLastInput] = useState<{ valor: number; prazo: number; taxa: number; carencia: number } | null>(null);
  const [selectedCliente, setSelectedCliente] = useState<ClienteLimite | null>(null);
  const [formValuesSnapshot, setFormValuesSnapshot] = useState<Record<string, string>>({});
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const indicadoresAccess = usePageAccess("indicadores_home");


  // Navegação pelo menu lateral (?calc=...) — apenas UX, sem alterar a lógica das calculadoras.
  useEffect(() => {
    const calc = searchParams.get("calc");
    const valid = ["qia", "recebiveis", "amorSaude", "expansaoAmorSaude", "limitesList"];
    if (calc && valid.includes(calc)) {
      setActiveCalculator(calc as CalculatorType);
      setResults(null);
      if (calc === "limitesList") setSelectedCliente(null);
    } else {
      setActiveCalculator(null);
      setResults(null);
    }
  }, [searchParams]);

  const calculators = [
    {
      id: 'qia' as const,
      pageKey: 'qia',
      title: 'QIA como Garantia - Cartão de TODOS',
      description: 'Antecipação com o fluxo do clube como garantia',
      icon: CreditCardIcon,
      disabled: false,
    },
    {
      id: 'recebiveis' as const,
      pageKey: 'recebiveis',
      title: 'Recebíveis como Garantia - Visão de TODOS',
      description: 'Crédito lastreado no faturamento futuro de cartões',
      icon: Eye,
      disabled: false,
    },
    {
      id: 'amorSaude' as const,
      pageKey: 'amor_saude',
      title: 'Recebíveis como Garantia - Amor Saúde',
      description: 'Operação dedicada às clínicas da rede',
      icon: HeartPulse,
      disabled: false,
    },
    {
      id: 'expansaoAmorSaude' as const,
      pageKey: 'expansao_amor_saude',
      title: 'Recebíveis como Garantia - Expansão Amor Saúde',
      description: 'Linha de expansão com CDI + spread e TAC opcional',
      icon: Sprout,
      badge: 'Novo',
      disabled: false,
    },
  ];

  const getFormFields = (type: CalculatorType): FormField[] => {
    const baseFields: FormField[] = [
      { id: 'valor', label: 'Valor solicitado', type: 'number', placeholder: 'R$' },
      { id: 'prazo', label: 'Prazo do contrato (meses)', type: 'number', placeholder: 'Meses' },
      { id: 'dataContrato', label: 'Data do contrato', type: 'date' },
      { id: 'taxaFixa', label: 'Taxa fixa (% ao mês)', type: 'number', placeholder: 'Ex: 1.2', step: '0.01' }
    ];

    const carenciaFields: FormField[] = [
      { id: 'carenciaTotal', label: 'Carência total (meses)', type: 'number', placeholder: 'Não paga nada', max: 12 },
      { id: 'carenciaPrincipal', label: 'Carência do principal (meses)', type: 'number', placeholder: 'Só paga juros', max: 12 },
    ];

    switch (type) {
      case 'qia':
      case 'amorSaude':
        return [...baseFields, ...carenciaFields];
      case 'expansaoAmorSaude': {
        const t = expansaoTaxaTotalPct(formValuesSnapshot.valor || '');
        const hint = t
          ? `Sugestão de spread: ${t.spreadPct}% a.m. + CDI. Edite se quiser.`
          : 'Sugestão de spread: 1,20% a.m. para valores até R$ 1.300.000 e 0,99% a.m. para valores acima de R$ 1.300.000, sempre + CDI.';
        return [
          { id: 'valor', label: 'Valor solicitado', type: 'number', placeholder: 'R$' },
          { id: 'prazo', label: 'Prazo do contrato (meses)', type: 'number', placeholder: 'Máx. 48', max: 48 },
          { id: 'dataContrato', label: 'Data do contrato', type: 'date' },
          { id: 'taxaFixa', label: 'Spread (% ao mês)', type: 'number', placeholder: 'Ex: 1,20', step: '0.01', hint },
          { id: 'carenciaTotal', label: 'Carência total (meses)', type: 'number', placeholder: 'Não paga nada', max: 12 },
          { id: 'carenciaPrincipal', label: 'Carência do principal (meses)', type: 'number', placeholder: 'Só paga juros', max: 12 },
        ];
      }
      case 'recebiveis':
        return [...baseFields, ...carenciaFields];
      default:
        return baseFields;
    }
  };

  // Para Expansão Amor Saúde: o campo editável sugere somente o spread mensal.
  // Regra comercial: até R$ 1,3 milhão = 1,20% a.m.; acima de R$ 1,3 milhão = 0,99% a.m.; sempre + CDI no cálculo.
  const expansaoTaxaTotalPct = (valorStr: string): { taxaAM: number; spreadPct: string } | null => {
    const valor = parseFloat(valorStr) || 0;
    if (!valor) return null;
    const spread = getExpansaoAmorSaudeSpread(valor);
    const cdiMensal = Math.pow(1 + getCDI(), 1 / 12) - 1;
    return {
      taxaAM: (cdiMensal + spread) * 100,
      spreadPct: (spread * 100).toFixed(2).replace('.', ','),
    };
  };

  // Guarda a última taxa sugerida para permitir auto-atualização quando o valor cruza a faixa,
  // sem sobrescrever uma taxa manualmente editada pelo usuário.
  const lastSuggestedTaxa = useRef<string>('');

  // Auto-atualiza a taxa sugerida da Expansão Amor Saúde conforme o valor da operação.
  // Se o campo estiver vazio OU ainda contém a última sugestão (não foi editado manualmente),
  // atualiza para a nova sugestão baseada na faixa.
  const computeDerivedValues = (values: Record<string, string>): Record<string, string> => {
    if (activeCalculator !== 'expansaoAmorSaude') return {};
    const valor = parseFloat(values.valor || '') || 0;
    if (valor <= 0) return {};
    const t = expansaoTaxaTotalPct(values.valor || '');
    if (!t) return {};
    const suggested = t.spreadPct.replace(',', '.');
    const current = (values.taxaFixa || '').trim();
    if (current === '' || current === lastSuggestedTaxa.current) {
      lastSuggestedTaxa.current = suggested;
      if (current !== suggested) return { taxaFixa: suggested };
    }
    return {};
  };

  // Validação em tempo real da carência (todas as calculadoras): soma ≤ 12 meses.
  const carenciaError = (() => {
    if (!activeCalculator || activeCalculator === 'limitesList' || activeCalculator === 'limitesDetail') {
      return null;
    }
    const ct = parseInt(formValuesSnapshot.carenciaTotal || '0') || 0;
    const cp = parseInt(formValuesSnapshot.carenciaPrincipal || '0') || 0;
    if (ct > 12 || cp > 12 || ct + cp > 12) {
      return 'O limite máximo permitido para carência (total e principal somadas) é de 12 meses.';
    }
    return null;
  })();

  const handleCalculate = (values: Record<string, string>, incluirTAC?: boolean, _extras?: Record<string, boolean>) => {
    try {
      const isExpansao = activeCalculator === 'expansaoAmorSaude';
      const input = {
        valor: parseFloat(values.valor) || 0,
        prazo: parseInt(values.prazo) || 0,
        dataContrato: values.dataContrato || '',
        carenciaPrincipal: parseInt(values.carenciaPrincipal) || 0,
        carenciaTotal: parseInt(values.carenciaTotal) || 0,
        taxaFixa: parseFloat(values.taxaFixa) || 0,
        incluirTAC: incluirTAC ?? true,
      };


      // Validação básica
      if (!input.valor || !input.prazo || !input.taxaFixa || !input.dataContrato) {
        toast({
          title: "Erro",
          description: "Por favor, preencha todos os campos obrigatórios!",
          variant: "destructive"
        });
        return;
      }

      if (isExpansao) {
        if (input.prazo > 48) {
          toast({ title: "Erro", description: "Prazo máximo é 48 meses.", variant: "destructive" });
          return;
        }
      }

      // Teto de carência (todas as calculadoras): soma total + principal ≤ 12 meses.
      if (
        input.carenciaTotal > 12 ||
        input.carenciaPrincipal > 12 ||
        input.carenciaTotal + input.carenciaPrincipal > 12
      ) {
        toast({
          title: "Erro",
          description: "O limite máximo permitido para carência (total e principal somadas) é de 12 meses.",
          variant: "destructive",
        });
        return;
      }

      let result: CalculationResult;

      switch (activeCalculator) {
        case 'qia':
          result = calculateQIA(input);
          break;
        case 'recebiveis':
          result = calculateRecebiveis(input);
          break;
        case 'amorSaude':
          result = calculateAmorSaude(input);
          break;
        case 'expansaoAmorSaude':
          result = calculateExpansaoAmorSaude(input);
          break;
        default:
          throw new Error('Calculadora não encontrada');
      }

      setResults(result);
      setLastInput({ valor: input.valor, prazo: input.prazo, taxa: input.taxaFixa, carencia: input.carenciaTotal + input.carenciaPrincipal });

      toast({
        title: "Sucesso",
        description: "Cálculo realizado com sucesso!",
        variant: "default"
      });

      // Scroll para os resultados
      setTimeout(() => {
        document.getElementById('results')?.scrollIntoView({ behavior: 'smooth' });
      }, 100);

    } catch (error) {
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Erro ao realizar o cálculo. Verifique os dados inseridos.",
        variant: "destructive"
      });
      console.error('Calculation error:', error);
    }
  };

  const handleBackToHome = () => {
    setSearchParams({});
    setActiveCalculator(null);
    setResults(null);
  };

  const isLimitesView = activeCalculator === 'limitesList' || activeCalculator === 'limitesDetail';
  const isCalculatorView = activeCalculator && !isLimitesView;

  return (
    <div className="min-h-screen bg-background">
      <CreditHeader title="Painel de Crédito PJ" />

      {!activeCalculator && (
        <div className="container mx-auto px-4 py-8">
          {indicadoresAccess.hasAccess && <DashboardKPIs />}
          <p className="max-w-6xl mx-auto text-sm text-muted-foreground">
            Use o menu lateral para acessar as calculadoras e os módulos operacionais.
          </p>
        </div>
      )}



      {!activeCalculator && <HomeFooter />}

      {isLimitesView && (
        <div className="container mx-auto px-4 py-8 max-w-3xl">
          {activeCalculator === 'limitesList' && (
            <LimitesList
              onBack={handleBackToHome}
              onSelect={(c) => {
                setSelectedCliente(c);
                setActiveCalculator('limitesDetail');
              }}
            />
          )}
          {activeCalculator === 'limitesDetail' && selectedCliente && (
            <ClienteDetalhes
              cliente={selectedCliente}
              onBack={() => setActiveCalculator('limitesList')}
              onSimular={(calc) => {
                setSearchParams({ calc });
              }}
            />
          )}
        </div>
      )}

      {isCalculatorView && (
        <div className="container mx-auto px-4 py-8 space-y-8">
          <div className="flex justify-center mb-6">
            <button
              onClick={handleBackToHome}
              className="text-primary hover:text-primary/80 font-semibold text-lg transition-colors"
            >
              ← Voltar para seleção de calculadoras
            </button>
          </div>

          
          {/* Regras de Negócio */}
          {activeCalculator && (
            <div className="bg-muted/50 border border-border rounded-lg p-4 mb-6">
              <h3 className="text-sm font-semibold text-foreground mb-2">Regras de Negócio</h3>
              <div className="text-sm text-muted-foreground space-y-1">
                {activeCalculator === 'qia' && (
                  <>
                    <p>• Taxa: 1,2% a.m + CDI</p>
                    <p>• Até 36x com 6 meses de carência de principal</p>
                  </>
                )}
                {activeCalculator === 'recebiveis' && (
                  <>
                    <p>• Taxa: 0,99% + CDI</p>
                    <p>• Até 36x com 12 meses de carência (7 total e 5 do principal)</p>
                  </>
                )}
                {activeCalculator === 'amorSaude' && (
                  <>
                    <p>• Taxa: 2,19% pré fixada</p>
                    <p>• Até 24x com 6 meses de carência de principal</p>
                  </>
                )}
                {activeCalculator === 'expansaoAmorSaude' && (() => {
                  const valorStr = formValuesSnapshot.valor || '';
                  const t = expansaoTaxaTotalPct(valorStr);
                  return (
                    <>
                      <p>
                        • Taxa: {t ? `${t.spreadPct}% a.m. + CDI` : '1,20% a.m. + CDI para valores até R$ 1.300.000,00; 0,99% a.m. + CDI para valores acima de R$ 1.300.000,00'}
                      </p>
                      <p>• Até 48x com até 12 meses de carência</p>
                    </>
                  );
                })()}
              </div>
            </div>
          )}

          {(() => {
            const segmentoMap: Record<string, Segmento> = {
              qia: "CDT",
              recebiveis: "VDT",
              amorSaude: "AMORSAUDE",
              expansaoAmorSaude: "AMORSAUDE",
            };
            const segmento = activeCalculator ? segmentoMap[activeCalculator] : undefined;
            if (!segmento) return null;
            return (
              <div className="w-full max-w-6xl mx-auto px-4">
                <ClienteSelector
                  segmento={segmento}
                  selected={selectedCliente}
                  onSelect={setSelectedCliente}
                />
              </div>
            );
          })()}

          {carenciaError && (
            <div
              role="alert"
              className="w-full max-w-6xl mx-auto px-4"
            >
              <div className="flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/10 text-destructive px-4 py-3 text-sm font-medium">
                <AlertCircle size={18} className="mt-0.5 shrink-0" />
                <span>{carenciaError}</span>
              </div>
            </div>
          )}

          <CreditForm
            title={calculators.find(c => c.id === activeCalculator)?.title || ''}
            fields={getFormFields(activeCalculator)}
            onCalculate={handleCalculate}
            showTAC={activeCalculator === 'qia' || activeCalculator === 'amorSaude' || activeCalculator === 'expansaoAmorSaude'}
            extraCheckboxes={[]}
            computeDerivedValues={activeCalculator === 'expansaoAmorSaude' ? computeDerivedValues : undefined}
            onValuesChange={setFormValuesSnapshot}
          />


          {results && (
            <div id="results" className="space-y-8">
              <div className="flex flex-wrap gap-3 justify-center">
                <Button
                  variant="gradient"
                  size="lg"
                  onClick={() => generatePDF(results, calculators.find(c => c.id === activeCalculator)?.title || '')}
                >
                  <FileDown className="mr-2" size={20} />
                  Baixar Proposta (PDF)
                </Button>
                {selectedCliente && lastInput && activeCalculator && TIPO_GARANTIA_MAP[activeCalculator] && (
                  <SolicitarAnaliseButton
                    cnpj={selectedCliente.cnpj}
                    nomeCliente={selectedCliente.unidade || selectedCliente.grupo || ""}
                    grupo={selectedCliente.grupo || ""}
                    socios={selectedCliente.socios || ""}
                    totalComCarencia={selectedCliente.total_com_carencia ?? 0}
                    totalSemCarencia={selectedCliente.total_sem_carencia ?? 0}
                    tipoGarantia={TIPO_GARANTIA_MAP[activeCalculator]}
                    valorSimulado={lastInput.valor}
                    taxaJuros={lastInput.taxa}
                    numeroParcelas={lastInput.prazo}
                    carencia={lastInput.carencia}
                  />
                )}
              </div>
              <ResultsSummary
                title="Resumo do Financiamento"
                items={results.summary}
              />
              
              <AmortizationTable
                data={results.amortizationData}
                totals={{
                  totalPayments: new Intl.NumberFormat('pt-BR', {
                    style: 'currency',
                    currency: 'BRL'
                  }).format(results.totalParcelas),
                  totalInterest: new Intl.NumberFormat('pt-BR', {
                    style: 'currency',
                    currency: 'BRL'
                  }).format(results.totalJuros),
                  totalPrincipal: new Intl.NumberFormat('pt-BR', {
                    style: 'currency',
                    currency: 'BRL'
                  }).format(
                    activeCalculator === 'recebiveis' 
                      ? results.amortizationData.reduce((sum, row) => {
                          // Remove formatação e converte para número
                          const principal = parseFloat(row.principal.replace(/[R$\s.]/g, '').replace(',', '.'));
                          return sum + (isNaN(principal) ? 0 : principal);
                        }, 0)
                      : results.totalFinanciamento
                  )
                }}
              />
              
              <BalanceChart
                labels={results.chartLabels}
                data={results.chartData}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Index;
