import { formatCurrency } from './currency';
import { AmortizationRow } from '@/components/AmortizationTable';
import { getNextBusinessDay, countBusinessDays } from './holidays';
import { getCDI } from './cdi';

export interface CalculationInput {
  valor: number;
  prazo: number;
  dataContrato: string;
  carencia?: number; // legado (compatibilidade) - equivale a carenciaPrincipal se informado sozinho
  carenciaPrincipal?: number;
  carenciaTotal?: number;
  taxaFixa: number;
  incluirTAC?: boolean;
}


export interface CalculationResult {
  valorTAC?: number;
  custoEstruturacao?: number;
  totalFinanciamento: number;
  valorPrimeiraParcela: number;
  valorPosCarencia: number;
  totalJuros: number;
  totalParcelas: number;
  amortizationData: AmortizationRow[];
  chartLabels: string[];
  chartData: number[];
  summary: { label: string; value: string }[];
}

// Helper para gerar datas de vencimento (dia 15 do mês seguinte, ajustado p/ próximo dia útil)
const buildDueDates = (dataContratoObj: Date, prazo: number): Date[] => {
  const dueDates: Date[] = [];
  let tempDate = new Date(dataContratoObj);
  tempDate.setHours(0, 0, 0, 0);
  for (let i = 1; i <= prazo; i++) {
    let nextMonthIndex = tempDate.getMonth() + 1;
    let nextYear = tempDate.getFullYear();
    if (nextMonthIndex > 11) { nextMonthIndex = 0; nextYear += 1; }
    let dp = new Date(nextYear, nextMonthIndex, 15);
    dp.setHours(0, 0, 0, 0);
    dp = getNextBusinessDay(dp);
    dueDates.push(dp);
    tempDate = dp;
  }
  return dueDates;
};

// Motor genérico Price com DU 252 e duas fases de carência
// Fase 1 (carenciaTotal): parcela = 0, juros capitalizam
// Fase 2 (carenciaPrincipal): parcela = juros, saldo intacto
// Fase 3: Price nas parcelas restantes
export const runPriceDU252 = (opts: {
  saldoInicial: number;
  prazo: number;
  carenciaTotal: number;
  carenciaPrincipal: number;
  dataContrato: string;
  taxaMensal: number; // taxa a.m. em decimal
  acrescimoParcela?: number;
}) => {
  const {
    saldoInicial, prazo, carenciaTotal, carenciaPrincipal,
    dataContrato, taxaMensal, acrescimoParcela = 0,
  } = opts;

  const totalCarencia = carenciaTotal + carenciaPrincipal;
  const parcelasRestantes = prazo - totalCarencia;
  if (parcelasRestantes <= 0) {
    throw new Error('Parcelas restantes inválidas (verifique prazo e carências).');
  }

  const taxaAnual = Math.pow(1 + taxaMensal, 12) - 1;
  const taxaDiaria = Math.pow(1 + taxaAnual, 1 / 252) - 1;

  const dataContratoObj = new Date(dataContrato);
  dataContratoObj.setHours(0, 0, 0, 0);
  const dueDates = buildDueDates(dataContratoObj, prazo);

  // Saldo pós-carência total (juros capitalizam)
  let saldoPosCT = saldoInicial;
  for (let i = 0; i < carenciaTotal; i++) {
    const prev = i === 0 ? dataContratoObj : dueDates[i - 1];
    const du = countBusinessDays(prev, dueDates[i]);
    const juros = saldoPosCT * (Math.pow(1 + taxaDiaria, du) - 1);
    saldoPosCT += juros;
  }
  // Fase 2 não altera saldo (paga só juros)
  const saldoPosCarencia = saldoPosCT;

  // Estimativa inicial da parcela (média de DU)
  let totalDUAmort = 0;
  for (let i = totalCarencia; i < prazo; i++) {
    const prev = i === 0 ? dataContratoObj : dueDates[i - 1];
    totalDUAmort += countBusinessDays(prev, dueDates[i]);
  }
  const avgDU = totalDUAmort / parcelasRestantes;
  const taxaMedia = Math.pow(1 + taxaDiaria, avgDU) - 1;
  let parcelaRegular = (saldoPosCarencia * taxaMedia) / (1 - Math.pow(1 + taxaMedia, -parcelasRestantes));

  // Refinamento iterativo
  for (let iter = 0; iter < 30; iter++) {
    let simSaldo = saldoPosCarencia;
    for (let i = totalCarencia; i < prazo; i++) {
      const prev = i === 0 ? dataContratoObj : dueDates[i - 1];
      const du = countBusinessDays(prev, dueDates[i]);
      const juros = simSaldo * (Math.pow(1 + taxaDiaria, du) - 1);
      simSaldo -= (parcelaRegular - juros);
    }
    if (Math.abs(simSaldo) < 0.01) break;
    parcelaRegular += simSaldo / parcelasRestantes;
  }

  parcelaRegular += acrescimoParcela;

  // Execução final
  let saldo = saldoInicial;
  let totalJuros = 0;
  let totalParcelasValue = 0;
  let valorPrimeiraParcela = 0;
  let valorPosCarencia = 0;
  let duAcumulados = 0;

  const amortizationData: AmortizationRow[] = [];
  const chartLabels: string[] = [];
  const chartData: number[] = [];

  let dataAtual = new Date(dataContratoObj);

  for (let i = 1; i <= prazo; i++) {
    const dataProxima = dueDates[i - 1];
    const du = countBusinessDays(dataAtual, dataProxima);
    duAcumulados += du;

    const jurosMes = saldo * (Math.pow(1 + taxaDiaria, du) - 1);
    let amortizacao = 0;
    let parcelaMes = 0;

    if (i <= carenciaTotal) {
      // Carência total: não paga nada, juros capitalizam
      parcelaMes = 0;
      saldo += jurosMes;
    } else if (i <= totalCarencia) {
      // Carência do principal: paga só juros
      parcelaMes = jurosMes;
    } else {
      amortizacao = parcelaRegular - jurosMes;
      parcelaMes = parcelaRegular;
      saldo -= amortizacao;
      if (saldo < 0) saldo = 0;
    }

    totalJuros += jurosMes;
    totalParcelasValue += parcelaMes;

    if (i === 1) valorPrimeiraParcela = parcelaMes;
    if (i === totalCarencia + 1) valorPosCarencia = parcelaMes;

    amortizationData.push({
      month: i,
      dueDate: dataProxima.toLocaleDateString('pt-BR'),
      payment: formatCurrency(parcelaMes),
      interest: formatCurrency(jurosMes),
      principal: formatCurrency(amortizacao),
      balance: formatCurrency(saldo),
      isGracePeriod: i <= totalCarencia,
      businessDays: du,
      accumulatedBusinessDays: duAcumulados,
    });

    chartLabels.push(`Mês ${i}`);
    chartData.push(parseFloat(saldo.toFixed(2)));

    dataAtual = dataProxima;
  }

  return {
    totalJuros, totalParcelasValue, valorPrimeiraParcela, valorPosCarencia,
    amortizationData, chartLabels, chartData,
  };
};

// Cálculo para Amor Saúde
export const calculateAmorSaude = (input: CalculationInput): CalculationResult => {
  const { valor, prazo, taxaFixa, dataContrato, incluirTAC = true } = input;
  const carenciaTotal = input.carenciaTotal ?? 0;
  const carenciaPrincipal = input.carenciaPrincipal ?? input.carencia ?? 0;

  const valorTAC = incluirTAC ? valor / 0.98 : valor;
  const totalFinanciamento = valorTAC;

  const acrescimo = valor * 0.00005731;
  const engine = runPriceDU252({
    saldoInicial: totalFinanciamento,
    prazo,
    carenciaTotal,
    carenciaPrincipal,
    dataContrato,
    taxaMensal: taxaFixa / 100,
    acrescimoParcela: acrescimo,
  });

  const totalCar = carenciaTotal + carenciaPrincipal;
  const summary = [
    { label: "VALOR SOLICITADO", value: formatCurrency(valor) },
    { label: "TOTAL DE PARCELAS", value: prazo.toString() },
    { label: "CARÊNCIA TOTAL (meses)", value: carenciaTotal.toString() },
    { label: "CARÊNCIA DO PRINCIPAL (meses)", value: carenciaPrincipal.toString() },
    ...(totalCar > 0 ? [{ label: "VALOR APROX. PARCELA COM CARÊNCIA", value: formatCurrency(engine.valorPrimeiraParcela) }] : []),
    { label: "VALOR APROX. PARCELA SEM CARÊNCIA", value: formatCurrency(engine.valorPosCarencia) },
    { label: "JUROS TOTAL", value: formatCurrency(engine.totalJuros) },
    { label: "TOTAL FINANCIAMENTO", value: formatCurrency(totalFinanciamento) },
    { label: "TAXA A.M.", value: `${taxaFixa.toFixed(2)}%` }
  ];

  return {
    valorTAC,
    custoEstruturacao: valorTAC - valor,
    totalFinanciamento,
    valorPrimeiraParcela: engine.valorPrimeiraParcela,
    valorPosCarencia: engine.valorPosCarencia,
    totalJuros: engine.totalJuros,
    totalParcelas: engine.totalParcelasValue,
    amortizationData: engine.amortizationData,
    chartLabels: engine.chartLabels,
    chartData: engine.chartData,
    summary
  };
};

// Helper: spread da Expansão Amor Saúde baseado no valor solicitado
// Regra comercial: até R$ 1,3 milhão sugere 1,20% a.m.; acima de R$ 1,3 milhão sugere 0,99% a.m.
export const getExpansaoAmorSaudeSpread = (valor: number): number => {
  return valor > 1_300_000 ? 0.0099 : 0.012;
};

// Cálculo para Expansão Amor Saúde: CDI + spread, Price DU 252
export const calculateExpansaoAmorSaude = (input: CalculationInput): CalculationResult => {
  const { valor, prazo, dataContrato, incluirTAC = true, taxaFixa } = input;
  const carenciaTotal = input.carenciaTotal ?? 0;
  const carenciaPrincipal = input.carenciaPrincipal ?? input.carencia ?? 0;

  if (prazo > 48) throw new Error('Prazo máximo é 48 meses.');
  if (carenciaTotal + carenciaPrincipal > 12) throw new Error('Soma das carências máxima é 12 meses.');

  const spread = getExpansaoAmorSaudeSpread(valor);
  const CDI_mensal = Math.pow(1 + getCDI(), 1 / 12) - 1;
  // O input de taxa da Expansão representa o spread sugerido/editado (0,99% ou 1,20%), não a taxa total.
  const spreadInformado = taxaFixa && taxaFixa > 0 ? taxaFixa / 100 : spread;
  const taxaMensalTotal = CDI_mensal + spreadInformado;
  const usouManual = Math.abs(spreadInformado - spread) > 0.000001;

  const valorTAC = incluirTAC ? valor / 0.98 : valor;
  const custoEstruturacao = valorTAC - valor;
  const totalFinanciamento = valorTAC;

  const engine = runPriceDU252({
    saldoInicial: totalFinanciamento,
    prazo,
    carenciaTotal,
    carenciaPrincipal,
    dataContrato,
    taxaMensal: taxaMensalTotal,
  });

  const taxaAMPct = (taxaMensalTotal * 100).toFixed(2);
  const spreadPct = (spreadInformado * 100).toFixed(2).replace('.', ',');
  const totalCar = carenciaTotal + carenciaPrincipal;

  const summary = [
    { label: "VALOR SOLICITADO", value: formatCurrency(valor) },
    { label: "TOTAL DE PARCELAS", value: prazo.toString() },
    { label: "CARÊNCIA TOTAL (meses)", value: carenciaTotal.toString() },
    { label: "CARÊNCIA DO PRINCIPAL (meses)", value: carenciaPrincipal.toString() },
    ...(totalCar > 0 ? [{ label: "VALOR APROX. PARCELA COM CARÊNCIA", value: formatCurrency(engine.valorPrimeiraParcela) }] : []),
    { label: "VALOR APROX. PARCELA SEM CARÊNCIA", value: formatCurrency(engine.valorPosCarencia) },
    { label: "JUROS TOTAL", value: formatCurrency(engine.totalJuros) },
    { label: "TOTAL FINANCIAMENTO", value: formatCurrency(totalFinanciamento) },
    { label: "TAXA A.M.", value: `${taxaAMPct}% (CDI + ${spreadPct}%${usouManual ? ' manual' : ''})` },
  ];

  return {
    valorTAC,
    custoEstruturacao,
    totalFinanciamento,
    valorPrimeiraParcela: engine.valorPrimeiraParcela,
    valorPosCarencia: engine.valorPosCarencia,
    totalJuros: engine.totalJuros,
    totalParcelas: engine.totalParcelasValue,
    amortizationData: engine.amortizationData,
    chartLabels: engine.chartLabels,
    chartData: engine.chartData,
    summary,
  };
};

// Cálculo para QIA (juros compostos mensais - sem DU)
export const calculateQIA = (input: CalculationInput): CalculationResult => {
  const { valor, prazo, taxaFixa, dataContrato, incluirTAC = true } = input;
  const carenciaTotal = input.carenciaTotal ?? 0;
  const carenciaPrincipal = input.carenciaPrincipal ?? input.carencia ?? 0;
  const totalCar = carenciaTotal + carenciaPrincipal;

  const taxaFixaDecimal = taxaFixa / 100;
  const CDI_mensal = Math.pow(1 + getCDI(), 1/12) - 1;
  const jurosMensal = taxaFixaDecimal + CDI_mensal;

  const custoEstruturacao = incluirTAC ? (valor / 0.98) * 0.02 : 0;
  const totalFinanciamento = valor + custoEstruturacao;
  let saldo = totalFinanciamento;

  // saldo pós-carência total
  for (let i = 0; i < carenciaTotal; i++) {
    saldo += saldo * jurosMensal;
  }
  const saldoPosCT = saldo;

  const parcelasRestantes = prazo - totalCar;
  if (parcelasRestantes <= 0) throw new Error('Parcelas restantes inválidas (verifique prazo e carências).');
  const parcelaRegular = (saldoPosCT * jurosMensal) / (1 - Math.pow(1 + jurosMensal, -parcelasRestantes));

  // Reset e executa timeline completa
  saldo = totalFinanciamento;
  let totalJuros = 0;
  let totalParcelasValue = 0;
  let totalAmortizacao = 0;
  let parcelaComCarencia = 0;
  const parcelaSemCarencia = parcelaRegular;

  const amortizationData: AmortizationRow[] = [];
  const chartLabels: string[] = [];
  const chartData: number[] = [];

  const dataContratoObj = new Date(dataContrato);
  dataContratoObj.setHours(0,0,0,0);
  let dataAtual = new Date(dataContratoObj);

  for (let i = 1; i <= prazo; i++) {
    let nextMonthIndex = dataAtual.getMonth() + 1;
    let nextYear = dataAtual.getFullYear();
    if(nextMonthIndex > 11){ nextMonthIndex = 0; nextYear += 1; }
    const dataProxima = new Date(nextYear, nextMonthIndex, 15);
    dataProxima.setHours(0,0,0,0);

    const jurosMes = saldo * jurosMensal;
    let amortizacao = 0;
    let parcelaMes = 0;

    if (i <= carenciaTotal) {
      parcelaMes = 0;
      saldo += jurosMes;
    } else if (i <= totalCar) {
      parcelaMes = jurosMes;
      if (i === carenciaTotal + 1) parcelaComCarencia = parcelaMes;
    } else {
      amortizacao = parcelaRegular - jurosMes;
      parcelaMes = parcelaRegular;
      saldo -= amortizacao;
      if (saldo < 0) saldo = 0;
    }

    totalJuros += jurosMes;
    totalParcelasValue += parcelaMes;
    totalAmortizacao += amortizacao;

    amortizationData.push({
      month: i,
      dueDate: dataProxima.toLocaleDateString('pt-BR'),
      payment: formatCurrency(parcelaMes),
      interest: formatCurrency(jurosMes),
      principal: formatCurrency(amortizacao),
      balance: formatCurrency(saldo),
      isGracePeriod: i <= totalCar
    });

    chartLabels.push(`Mês ${i}`);
    chartData.push(parseFloat(saldo.toFixed(2)));
    dataAtual = dataProxima;
  }

  const taxaEfetivaAM = (jurosMensal * 100).toFixed(2);

  const summary = [
    { label: "VALOR SOLICITADO", value: formatCurrency(valor) },
    { label: "TOTAL FINANCIAMENTO", value: formatCurrency(totalFinanciamento) },
    { label: "PRAZO DO CONTRATO", value: `${prazo} meses` },
    { label: "CARÊNCIA TOTAL (meses)", value: carenciaTotal.toString() },
    { label: "CARÊNCIA DO PRINCIPAL (meses)", value: carenciaPrincipal.toString() },
    ...(totalCar > 0 ? [{ label: "VALOR APROX. PARCELA COM CARÊNCIA", value: formatCurrency(parcelaComCarencia) }] : []),
    { label: "VALOR APROX. PARCELA SEM CARÊNCIA", value: formatCurrency(parcelaSemCarencia) },
    { label: "JUROS TOTAL", value: formatCurrency(totalJuros) },
    { label: "TAXA A.M.", value: `${taxaEfetivaAM}%` }
  ];

  return {
    custoEstruturacao,
    totalFinanciamento,
    valorPrimeiraParcela: totalParcelasValue > 0 ? totalParcelasValue / prazo : 0,
    valorPosCarencia: parcelaRegular,
    totalJuros,
    totalParcelas: totalParcelasValue,
    amortizationData,
    chartLabels,
    chartData,
    summary
  };
};

// Cálculo para Recebíveis
export const calculateRecebiveis = (input: CalculationInput): CalculationResult => {
  const { valor, prazo, carenciaPrincipal = 0, carenciaTotal = 0, taxaFixa, dataContrato } = input;

  const taxaFixaDecimal = taxaFixa / 100;
  const CDI_mensal = Math.pow(1 + getCDI(), 1/12) - 1;
  const jurosMensal = taxaFixaDecimal + CDI_mensal;

  // Custo de emissão: gross-up com divisor 0.973502 (TAC 2% + Grafeno 0.35196%)
  const valorBruto = valor / 0.973502;
  const custoEmissaoTotal = Math.max(valorBruto - valor, 345); // piso R$ 345
  const custoEstruturacao = custoEmissaoTotal;

  let totalFinanciamento = valor + custoEmissaoTotal;
  let saldo = totalFinanciamento;

  let parcelaRegular = 0; // só será definida quando necessário

  let totalJuros = 0;
  let totalParcelasValue = 0;
  let totalAmortizacao = 0;
  let parcelaComCarencia = 0;
  let parcelaSemCarencia = 0;

  const amortizationData: AmortizationRow[] = [];
  const chartLabels: string[] = [];
  const chartData: number[] = [];

  // Data do contrato
  let dataContratoObj = new Date(dataContrato);
  dataContratoObj.setHours(0,0,0,0);
  let dataAtual = new Date(dataContratoObj);
  dataAtual.setHours(0,0,0,0);

  for (let i = 1; i <= prazo; i++) {
    let jurosMes = 0;
    let amortizacao = 0;
    let parcelaMes = 0;

    // próxima parcela: sempre dia 15 do próximo mês
    let nextMonthIndex = dataAtual.getMonth() + 1;
    let nextYear = dataAtual.getFullYear();
    if(nextMonthIndex > 11){
      nextMonthIndex = 0;
      nextYear += 1;
    }
    let dataProxima = new Date(nextYear, nextMonthIndex, 15);
    dataProxima.setHours(0,0,0,0);

    if (carenciaTotal > 0 && i <= carenciaTotal) {
      // carência total: parcela zerada, mas juros capitalizados
      jurosMes = saldo * jurosMensal;
      saldo += jurosMes;

      // recalcula parcela ao fim da carência total
      if (i === carenciaTotal) {
        let parcelasRestantes = prazo - carenciaTotal - carenciaPrincipal;
        parcelaRegular = (saldo * jurosMensal) / (1 - Math.pow(1 + jurosMensal, -parcelasRestantes));
        // O saldo após carência total é o que precisa ser amortizado
        totalAmortizacao = saldo;
      }
    } else if (carenciaPrincipal > 0 && i <= carenciaTotal + carenciaPrincipal) {
      // só paga juros
      jurosMes = saldo * jurosMensal;
      parcelaMes = jurosMes;

      // se não houver carência total, define parcela ao fim da carência principal
      if (i === carenciaTotal + carenciaPrincipal && parcelaRegular === 0) {
        let parcelasRestantes = prazo - carenciaTotal - carenciaPrincipal;
        parcelaRegular = (saldo * jurosMensal) / (1 - Math.pow(1 + jurosMensal, -parcelasRestantes));
        // Se não teve carência total, a amortização é o saldo atual
        if (totalAmortizacao === 0) totalAmortizacao = saldo;
      }

      // captura valor da primeira parcela com carência (só juros) 
      if (i === carenciaTotal + 1) parcelaComCarencia = parcelaMes;
    } else {
      // amortização normal
      // se não teve nenhuma carência, parcela já deve ser definida no início
      if (parcelaRegular === 0) {
        let parcelasRestantes = prazo - i + 1;
        parcelaRegular = (saldo * jurosMensal) / (1 - Math.pow(1 + jurosMensal, -parcelasRestantes));
        // Se não teve carência, a amortização é o valor total do financiamento
        if (totalAmortizacao === 0) totalAmortizacao = totalFinanciamento;
      }

      jurosMes = saldo * jurosMensal;
      amortizacao = parcelaRegular - jurosMes;
      parcelaMes = parcelaRegular;
      saldo -= amortizacao;
      if (saldo < 0) saldo = 0;
    }

    // Todos os juros (capitalizados e pagos) fazem parte dos juros totais
    totalJuros += jurosMes;
    
    totalParcelasValue += parcelaMes;

    amortizationData.push({
      month: i,
      dueDate: dataProxima.toLocaleDateString('pt-BR'),
      payment: formatCurrency(parcelaMes),
      interest: formatCurrency(jurosMes),
      principal: formatCurrency(amortizacao),
      balance: formatCurrency(saldo),
      isGracePeriod: i <= carenciaTotal + carenciaPrincipal
    });

    chartLabels.push(`Mês ${i}`);
    chartData.push(parseFloat(saldo.toFixed(2)));
    
    dataAtual = dataProxima;
  }

  // Define parcelaSemCarencia como parcelaRegular final
  parcelaSemCarencia = parcelaRegular;

  const totalCarencia = carenciaTotal + carenciaPrincipal;
  const taxaEfetivaAM = (jurosMensal * 100).toFixed(2);

  const summary = [
    { label: "VALOR SOLICITADO", value: formatCurrency(valor) },
    { label: "CUSTO DE EMISSÃO", value: formatCurrency(custoEmissaoTotal), tooltip: "Comissão, Impostos e Taxas" },
    { label: "TOTAL FINANCIAMENTO", value: formatCurrency(totalFinanciamento) },
    { label: "PRAZO DO CONTRATO", value: `${prazo} meses` },
    { label: "CARÊNCIA TOTAL (meses)", value: carenciaTotal.toString() },
    { label: "CARÊNCIA PRINCIPAL (meses)", value: carenciaPrincipal.toString() },
    ...(totalCarencia > 0 ? [{ label: "VALOR APROX. PARCELA COM CARÊNCIA", value: formatCurrency(parcelaComCarencia) }] : []),
    { label: "VALOR APROX. PARCELA SEM CARÊNCIA", value: formatCurrency(parcelaSemCarencia) },
    { label: "JUROS TOTAL", value: formatCurrency(totalJuros) },
    { label: "AMORTIZAÇÃO TOTAL", value: formatCurrency(totalAmortizacao) },
    { label: "TAXA A.M.", value: `${taxaEfetivaAM}%` }
  ];

  return {
    custoEstruturacao,
    totalFinanciamento,
    valorPrimeiraParcela: totalParcelasValue > 0 ? totalParcelasValue / prazo : 0,
    valorPosCarencia: parcelaRegular,
    totalJuros,
    totalParcelas: totalParcelasValue,
    amortizationData,
    chartLabels,
    chartData,
    summary
  };
};

// ============================================================
// Projeção "para frente" de uma operação ativa a partir da ingestão
// Usa Tabela Price mensal (taxa constante). Como as operações são pós-fixadas,
// a taxa_op da ingestão embute CDI + spread do mês corrente e é usada como
// taxa mensal fixa para projetar as parcelas remanescentes.
// ============================================================
export interface ProjectedRow {
  month: number;
  dueDate: string; // ISO
  payment: number;
  interest: number;
  principal: number;
  balance: number;
}

const addMonthDay15 = (iso: string, k: number): string => {
  const d = new Date(iso + 'T00:00:00');
  const nd = new Date(d.getFullYear(), d.getMonth() + k, 15);
  const yy = nd.getFullYear();
  const mm = String(nd.getMonth() + 1).padStart(2, '0');
  return `${yy}-${mm}-15`;
};

export const projectFromCurrent = (opts: {
  saldoInicial: number;
  parcelasRestantes: number;
  taxaMensal: number; // decimal (ex.: 0.0224)
  proximoVencimento: string; // ISO yyyy-mm-dd
  startMonth: number; // nº da parcela atual (M)
  parcelaReal?: number; // valor real da parcela atual (planilha)
  posFixado?: boolean; // true: reprojeta futuras via Price; false: mantém parcela real constante
}): ProjectedRow[] => {
  const {
    saldoInicial,
    parcelasRestantes,
    taxaMensal,
    proximoVencimento,
    startMonth,
    parcelaReal,
    posFixado = true,
  } = opts;
  if (parcelasRestantes <= 0 || saldoInicial <= 0) return [];
  const i = taxaMensal;
  const pricePmt = (bal: number, n: number) =>
    i > 0 ? (bal * i) / (1 - Math.pow(1 + i, -n)) : bal / n;

  const rows: ProjectedRow[] = [];
  let bal = saldoInicial;
  for (let k = 0; k < parcelasRestantes; k++) {
    let pmt: number;
    if (k === 0 && parcelaReal && parcelaReal > 0) {
      // Parcela atual: usa o valor real da planilha
      pmt = parcelaReal;
    } else if (!posFixado && parcelaReal && parcelaReal > 0) {
      // Pré-fixada: mantém a parcela real constante nas futuras
      pmt = parcelaReal;
    } else {
      // Pós-fixada (ou sem valor real): projeta via Price sobre saldo restante
      pmt = pricePmt(bal, parcelasRestantes - k);
    }
    const juros = bal * i;
    const amort = Math.max(pmt - juros, 0);
    bal = Math.max(bal - amort, 0);
    rows.push({
      month: startMonth + k,
      dueDate: k === 0 ? proximoVencimento : addMonthDay15(proximoVencimento, k),
      payment: pmt,
      interest: juros,
      principal: amort,
      balance: bal,
    });
  }
  return rows;
};

// ============================================================
// Projeção Pro-Rata DU (base 252) — modelo do fornecedor
// VLR_PAGAR_k = Amortização_k × ∏(fator_CDI_dia) × ∏(fator_PRE_dia)
// para cada dia útil entre (t0, V_k], onde t0 = data de emissão.
// - Amortização_k: derivada do cronograma Price base (spread pré fixo).
// - fator_PRE_diario = (1 + spread_mensal)^(1/21).
// - fator_CDI_diario: (1 + CDI% do dia) da tabela cdi_daily.
//   Para dias sem dado (feriado/DU ainda não publicado), usa lastCdiFactor.
// ============================================================
export interface ProRataDUInput {
  valorOperacao: number;
  totalParcelas: number;
  dataEmissao: string; // ISO t0
  primeiroVencimento: string; // ISO — âncora dia 15
  spreadMensal: number; // decimal (ex.: 0.0120)
  parcelaAtual: number; // filtra: só retorna parcelas >= parcelaAtual
  cdiDaily: Map<string, number>; // date ISO -> fator diário (1+CDI_dia)
  lastCdiFactor: number; // fallback para dias sem dado
  holidays: Set<string>;
  carenciaMeses?: number;
  carenciaTipo?: 'principal' | 'total';
  cdiAnual?: number; // taxa CDI anual (ex.: 0.1465) para cálculo mensal na carência

}

const isoAddDays = (iso: string, n: number): string => {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
};

const isoDayOfWeek = (iso: string): number => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
};

export const projectProRataDU = (opts: ProRataDUInput): ProjectedRow[] => {
  const {
    valorOperacao,
    totalParcelas: N,
    dataEmissao: t0,
    primeiroVencimento,
    spreadMensal: i,
    parcelaAtual,
    cdiDaily,
    lastCdiFactor,
    holidays,
    carenciaMeses = 0,
    carenciaTipo = 'principal',
    cdiAnual,
  } = opts;
  if (!valorOperacao || !N || !t0 || !primeiroVencimento || !i) return [];

  const CDI_mensal = cdiAnual ? Math.pow(1 + cdiAnual, 1 / 12) - 1 : 0;
  const jurosMensal = i + CDI_mensal;


  const carencia = Math.max(0, Math.min(carenciaMeses, N - 1));

  // 1) Vencimentos (dia 15)
  const dueDates: string[] = [];
  for (let k = 1; k <= N; k++) {
    dueDates.push(k === 1 ? primeiroVencimento : addMonthDay15(primeiroVencimento, k - 1));
  }

  // 2) Fatores diários acumulados (∏CDI × ∏PRE) por data
  const preDiario = Math.pow(1 + i, 1 / 21);
  const isBusiness = (iso: string) => {
    const dow = isoDayOfWeek(iso);
    if (dow === 0 || dow === 6) return false;
    return !holidays.has(iso);
  };
  const factorByDate = new Map<string, { cdi: number; pre: number }>();
  let cdiAcc = 1;
  let preAcc = 1;
  const lastDue = dueDates[N - 1];
  let cursor = isoAddDays(t0, 1);
  while (cursor <= lastDue) {
    if (isBusiness(cursor)) {
      const fc = cdiDaily.get(cursor) ?? lastCdiFactor;
      cdiAcc *= fc;
      preAcc *= preDiario;
    }
    factorByDate.set(cursor, { cdi: cdiAcc, pre: preAcc });
    cursor = isoAddDays(cursor, 1);
  }
  const factorAt = (iso: string) => factorByDate.get(iso) ?? { cdi: 1, pre: 1 };

  // 3) Cronograma base (amortização) — com carência quando houver
  type Base = { month: number; dueDate: string; amort: number; balance: number; payment?: number };
  const base: Base[] = [];

  if (carencia === 0) {
    // Sem carência: cronograma base com spread puro; etapa 4 aplica CDI×PRE.
    const pmt = (valorOperacao * i) / (1 - Math.pow(1 + i, -N));
    let bal = valorOperacao;
    for (let k = 1; k <= N; k++) {
      const juros = bal * i;
      const amort = Math.max(pmt - juros, 0);
      bal = Math.max(bal - amort, 0);
      base.push({ month: k, dueDate: dueDates[k - 1], amort, balance: bal });
    }
  } else if (carenciaTipo === 'principal') {
    // Carência principal: parcela = juros mensais (spread + CDI mensal), saldo intacto.
    for (let k = 1; k <= carencia; k++) {
      const payment = valorOperacao * jurosMensal;
      base.push({ month: k, dueDate: dueDates[k - 1], amort: 0, balance: valorOperacao, payment });
    }
    const nAmort = N - carencia;
    const pmt = (valorOperacao * i) / (1 - Math.pow(1 + i, -nAmort));
    let bal = valorOperacao;
    for (let k = carencia + 1; k <= N; k++) {
      const juros = bal * i;
      const amort = Math.max(pmt - juros, 0);
      bal = Math.max(bal - amort, 0);
      base.push({ month: k, dueDate: dueDates[k - 1], amort, balance: bal });
    }
  } else {
    // Carência total: parcela = 0, juros capitalizam mensalmente (spread + CDI mensal)
    const saldoBase = valorOperacao * Math.pow(1 + jurosMensal, carencia);
    for (let k = 1; k <= carencia; k++) {
      base.push({ month: k, dueDate: dueDates[k - 1], amort: 0, balance: saldoBase, payment: 0 });
    }
    const nAmort = N - carencia;
    const pmt = (saldoBase * i) / (1 - Math.pow(1 + i, -nAmort));
    let bal = saldoBase;
    for (let k = carencia + 1; k <= N; k++) {
      const juros = bal * i;
      const amort = Math.max(pmt - juros, 0);
      bal = Math.max(bal - amort, 0);
      base.push({ month: k, dueDate: dueDates[k - 1], amort, balance: bal });
    }
  }


  // 4) Grace/parcelas com payment pré-computado usam o valor direto;
  //    demais aplicam o fator acumulado CDI×PRE (modelo pro-rata DU).
  const rows: ProjectedRow[] = [];
  for (const row of base) {
    // Havendo carência, exibe todos os meses (inclusive os de carência já vencidos)
    if (row.month < parcelaAtual) continue;
    let payment: number;
    if (row.payment !== undefined) {
      payment = row.payment;
    } else {
      const f = factorAt(row.dueDate);
      payment = row.amort * f.cdi * f.pre;
    }
    rows.push({
      month: row.month,
      dueDate: row.dueDate,
      payment,
      interest: payment - row.amort,
      principal: row.amort,
      balance: row.balance,
    });
  }
  return rows;

};

