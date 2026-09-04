import { describe, expect, it } from "vitest";
import {
  calcularValorLiquidoPrevisto,
  divergenciaDeposito,
  gerarIdOperacao,
  houveDivergencia,
  mapearLinhaCredito,
  montarRotuloTaxa,
  normalizarTipoTaxa,
  podeGerarIdOperacao,
  serialExcel,
  siglaTipoOperacao,
} from "./operacaoFormulas";

describe("ID da operação", () => {
  /**
   * Os cinco casos abaixo vieram da planilha real da área, enviada pela Lavínia
   * em 04/09/2026. São a única prova de que a fórmula foi reproduzida
   * corretamente — se algum falhar, o ID gravado no HubSpot sai errado.
   */
  const casosReais = [
    { unidade: "IBIUNA", cnpj: "45015296000152", data: "2026-08-28", tipo: "PRÉ", esperado: "PF46262IBI45" },
    { unidade: "CRICIUMA", cnpj: "28425083000180", data: "2026-08-28", tipo: "PRÉ", esperado: "PF46262CRI28" },
    { unidade: "ARAGUAINA", cnpj: "34639495000115", data: "2026-06-29", tipo: "PRÉ/PÓS", esperado: "POS46202ARA34" },
    { unidade: "SERRINHA", cnpj: "42343918000183", data: "2026-07-24", tipo: "PRÉ/PÓS", esperado: "POS46227SER42" },
    { unidade: "GUARATINGUETA", cnpj: "22941234000176", data: "2026-07-29", tipo: "PRÉ/PÓS", esperado: "POS46232GUA22" },
  ];

  it.each(casosReais)("reproduz $esperado ($unidade)", ({ unidade, cnpj, data, tipo, esperado }) => {
    const [ano, mes, dia] = data.split("-").map(Number);
    expect(
      gerarIdOperacao({
        tipoOperacao: tipo,
        dataDesembolso: new Date(ano, mes - 1, dia),
        unidade,
        cnpj,
      }),
    ).toBe(esperado);
  });

  it("aceita CNPJ com máscara", () => {
    const semMascara = gerarIdOperacao({
      tipoOperacao: "PRÉ",
      dataDesembolso: new Date(2026, 7, 28),
      unidade: "IBIUNA",
      cnpj: "45015296000152",
    });
    const comMascara = gerarIdOperacao({
      tipoOperacao: "PRÉ",
      dataDesembolso: new Date(2026, 7, 28),
      unidade: "IBIUNA",
      cnpj: "45.015.296/0001-52",
    });
    expect(comMascara).toBe(semMascara);
  });

  it("normaliza acento e caixa da unidade", () => {
    expect(
      gerarIdOperacao({
        tipoOperacao: "PRÉ",
        dataDesembolso: new Date(2026, 7, 28),
        unidade: "Guaratinguetá",
        cnpj: "22941234000176",
      }),
    ).toBe("PF46262GUA22");
  });

  /** O risco de colisão é conhecido e precisa ficar visível no teste. */
  it("gera o MESMO id para operações diferentes que coincidem nos componentes", () => {
    const base = { tipoOperacao: "PRÉ", dataDesembolso: new Date(2026, 7, 28), cnpj: "45015296000152" };
    expect(gerarIdOperacao({ ...base, unidade: "IBIUNA" })).toBe(
      gerarIdOperacao({ ...base, unidade: "IBIUNA MATRIZ" }),
    );
  });

  it("recusa gerar quando falta dado", () => {
    const completo = {
      tipoOperacao: "PRÉ",
      dataDesembolso: new Date(2026, 7, 28),
      unidade: "IBIUNA",
      cnpj: "45015296000152",
    };
    expect(podeGerarIdOperacao(completo)).toBe(true);
    expect(podeGerarIdOperacao({ ...completo, unidade: "" })).toBe(false);
    expect(podeGerarIdOperacao({ ...completo, cnpj: "4" })).toBe(false);
    expect(podeGerarIdOperacao({ ...completo, tipoOperacao: "OUTRA COISA" })).toBe(false);
  });
});

describe("serial de data do Excel", () => {
  it("converte as datas dos casos reais", () => {
    expect(serialExcel(new Date(2026, 7, 28))).toBe(46262);
    expect(serialExcel(new Date(2026, 5, 29))).toBe(46202);
    expect(serialExcel(new Date(2026, 6, 24))).toBe(46227);
  });

  it("usa a mesma origem do Excel", () => {
    expect(serialExcel(new Date(1900, 0, 1))).toBe(2);
  });
});

describe("sigla do tipo de operação", () => {
  it.each([
    ["PÓS", "POS"],
    ["PRÉ", "PF"],
    ["PRÉ/PÓS", "POS"],
    ["FUMAÇA", "FUM"],
    ["pré", "PF"],
    ["", "SEM TIPO DE OP."],
    ["qualquer outra", "SEM TIPO DE OP."],
  ])("%s vira %s", (entrada, esperado) => {
    expect(siglaTipoOperacao(entrada)).toBe(esperado);
  });
});

describe("rótulo da taxa", () => {
  it("pré-fixada não menciona CDI", () => {
    expect(montarRotuloTaxa(2.19, "pre")).toBe("2,19% a.m.");
  });

  it("pós-fixada acrescenta CDI", () => {
    expect(montarRotuloTaxa(2.19, "pos")).toBe("2,19% a.m. + CDI");
  });

  it("mantém duas casas decimais", () => {
    expect(montarRotuloTaxa(1.2, "pos")).toBe("1,20% a.m. + CDI");
  });

  it.each([
    ["PÓS", "pos"],
    ["PRÉ", "pre"],
    ["PRÉ/PÓS", "pos"],
    ["pós-fixada", "pos"],
    ["pré-fixada", "pre"],
  ])("normaliza %s", (entrada, esperado) => {
    expect(normalizarTipoTaxa(entrada)).toBe(esperado);
  });

  it("devolve nulo quando não reconhece", () => {
    expect(normalizarTipoTaxa("")).toBeNull();
    expect(normalizarTipoTaxa(null)).toBeNull();
  });
});

describe("valores da operação", () => {
  /** Operação real enviada pela Lavínia em 04/09. */
  const BRUTO = 102040.82;
  const TAC = 2040.82;
  const LIQUIDO = 100000;

  it("líquido previsto é bruto menos TAC", () => {
    expect(calcularValorLiquidoPrevisto(BRUTO, TAC)).toBe(LIQUIDO);
  });

  it("não acumula erro de ponto flutuante", () => {
    expect(calcularValorLiquidoPrevisto(1020.41, 20.41)).toBe(1000);
  });

  it("depósito correto não gera divergência", () => {
    expect(houveDivergencia(LIQUIDO, LIQUIDO)).toBe(false);
  });

  /**
   * O caso que motivou a Story 3.7: a Valora depositou o valor da TAC em vez do
   * valor da operação.
   */
  it("detecta o erro que aconteceu de verdade", () => {
    expect(houveDivergencia(LIQUIDO, TAC)).toBe(true);
    expect(divergenciaDeposito(LIQUIDO, TAC)).toBe(-97959.18);
  });

  it("tolera diferença de um centavo", () => {
    expect(houveDivergencia(1000, 1000.01)).toBe(false);
    expect(houveDivergencia(1000, 1000.02)).toBe(true);
  });
});

describe("linha de crédito a partir do HubSpot", () => {
  it("reconhece QIA", () => {
    expect(mapearLinhaCredito("Recebíveis como Garantia - QIA")).toBe("QIA");
  });

  it("trata 'Recebíveis como Garantia' sem sufixo como Amor Saúde", () => {
    expect(mapearLinhaCredito("Recebíveis como Garantia")).toBe("Amor Saúde");
  });

  /** Produtos de outro fundo: não pertencem a este painel. */
  it.each(["Imóvel em Garantia", "Antecipação Recebíveis de Venda", "Financiamento Imobiliário"])(
    "ignora %s (outro fundo)",
    (produto) => {
      expect(mapearLinhaCredito(produto)).toBeNull();
    },
  );

  it("devolve nulo para vazio", () => {
    expect(mapearLinhaCredito("")).toBeNull();
    expect(mapearLinhaCredito(null)).toBeNull();
  });
});
