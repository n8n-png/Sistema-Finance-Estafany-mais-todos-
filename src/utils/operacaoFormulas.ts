/**
 * Regras de negócio da operação de crédito, confirmadas com a área em 04/09/2026.
 *
 * Ficam isoladas aqui, sem dependência de React nem de banco, por dois motivos:
 * são as regras que, se errarem, produzem número errado em documento que vai
 * para o fundo; e assim podem ser testadas contra os exemplos reais que a
 * Lavínia enviou (`operacaoFormulas.test.ts`).
 */

// ---------------------------------------------------------------------------
// Taxa
// ---------------------------------------------------------------------------

export type TipoTaxa = "pre" | "pos";

/**
 * Monta o rótulo da taxa exibido no painel.
 *
 * Regra da Lavínia (04/09): *"Valor da taxa é a porcentagem de juros. Tipo de
 * taxa é pós-fixada/pré-fixada... Quando for pós, tem CDI incluso no cálculo."*
 *
 * O HubSpot guarda os dois separados: "Valor da Taxa" (número) e "Tipo de Taxa"
 * (pré/pós). O painel exibe combinado.
 */
export const montarRotuloTaxa = (percentualAoMes: number, tipo: TipoTaxa): string => {
  const numero = percentualAoMes.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return tipo === "pos" ? `${numero}% a.m. + CDI` : `${numero}% a.m.`;
};

/**
 * Normaliza o valor de "Tipo de Taxa" vindo do HubSpot.
 *
 * "PRÉ/PÓS" conta como pós — é a mesma regra que a planilha da área usa ao
 * gerar o ID da operação, e a anotação na própria planilha diz "cola: pré-pos é pós".
 */
export const normalizarTipoTaxa = (valor: string | null | undefined): TipoTaxa | null => {
  const t = String(valor ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
  if (!t) return null;
  if (t.includes("pre") && t.includes("pos")) return "pos";
  if (t.includes("pos")) return "pos";
  if (t.includes("pre")) return "pre";
  return null;
};

// ---------------------------------------------------------------------------
// Valores
// ---------------------------------------------------------------------------

/**
 * Valor líquido previsto — o que deveria cair na conta do cliente.
 *
 * Confirmado pela operação real enviada pela Lavínia:
 *   Valor do contrato (102.040,82) = Valor solicitado (100.000,00) + TAC (2.040,82)
 *
 * Portanto: líquido = bruto − TAC.
 *
 * Isso é o **previsto**. O valor efetivamente depositado é informado no
 * desembolso e pode divergir — foi exatamente essa confusão que levou a Valora
 * a depositar errado em 03/09.
 */
export const calcularValorLiquidoPrevisto = (valorBruto: number, valorTac: number): number =>
  Number((valorBruto - valorTac).toFixed(2));

/** Diferença entre o que foi depositado e o que estava previsto. */
export const divergenciaDeposito = (
  valorLiquidoPrevisto: number,
  valorLiquidoDepositado: number,
): number => Number((valorLiquidoDepositado - valorLiquidoPrevisto).toFixed(2));

/**
 * Há divergência relevante entre previsto e depositado?
 *
 * A tolerância de um centavo existe porque arredondamento entre sistemas
 * diferentes produz diferenças que não são erro operacional. Qualquer coisa
 * acima disso é.
 */
export const TOLERANCIA_DEPOSITO = 0.01;

export const houveDivergencia = (
  valorLiquidoPrevisto: number,
  valorLiquidoDepositado: number,
): boolean =>
  Math.abs(divergenciaDeposito(valorLiquidoPrevisto, valorLiquidoDepositado)) > TOLERANCIA_DEPOSITO;

// ---------------------------------------------------------------------------
// ID da Operação
// ---------------------------------------------------------------------------

/**
 * Número de série de data do Excel: dias decorridos desde 30/12/1899.
 *
 * Existe aqui porque o ID da operação, gerado hoje numa planilha, embute esse
 * número — `46262` é 28/08/2026. É um detalhe de implementação do Excel que
 * vazou para dentro de um identificador de negócio; replicamos para manter
 * continuidade com os IDs já emitidos.
 */
const EPOCA_EXCEL = Date.UTC(1899, 11, 30);
const MS_POR_DIA = 86_400_000;

export const serialExcel = (data: Date): number =>
  Math.floor((Date.UTC(data.getFullYear(), data.getMonth(), data.getDate()) - EPOCA_EXCEL) / MS_POR_DIA);

/** Sigla do tipo de operação, conforme a fórmula da planilha. */
export const siglaTipoOperacao = (tipoOp: string | null | undefined): string => {
  const t = String(tipoOp ?? "")
    .toUpperCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
  if (t === "POS") return "POS";
  if (t === "PRE") return "PF";
  if (t === "PRE/POS") return "POS";
  if (t === "FUMACA") return "FUM";
  return "SEM TIPO DE OP.";
};

export interface DadosIdOperacao {
  /** Valor de "TIPO OP": PÓS, PRÉ, PRÉ/PÓS ou FUMAÇA. */
  tipoOperacao: string;
  dataDesembolso: Date;
  unidade: string;
  /** CNPJ com ou sem máscara — só os dígitos são usados. */
  cnpj: string;
}

/**
 * Reproduz a fórmula da planilha da área:
 *
 *   =CONCATENAR(
 *     SE(E2="PÓS";"POS";SE(E2="PRÉ";"PF";SE(E2="PRÉ/PÓS";"POS";SE(E2="FUMAÇA";"FUM";"SEM TIPO DE OP."))));
 *     C2;                → data de desembolso (serial do Excel)
 *     ESQUERDA(A2;3);    → 3 primeiras letras da unidade
 *     ESQUERDA(B2;2)     → 2 primeiros dígitos do CNPJ
 *   )
 *
 * Validada contra os 5 exemplos reais enviados em 04/09 — ver os testes.
 *
 * ⚠️ A regra **não garante unicidade**: duas operações no mesmo dia, de unidades
 * cujo nome começa com as mesmas 3 letras e CNPJ com os mesmos 2 dígitos iniciais
 * produzem o mesmo ID. Quem chama precisa verificar colisão antes de gravar.
 */
export const gerarIdOperacao = (dados: DadosIdOperacao): string => {
  const sigla = siglaTipoOperacao(dados.tipoOperacao);
  const serial = serialExcel(dados.dataDesembolso);
  const unidade = String(dados.unidade ?? "")
    .toUpperCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 3);
  const cnpj = String(dados.cnpj ?? "").replace(/\D/g, "").slice(0, 2);
  return `${sigla}${serial}${unidade}${cnpj}`;
};

/** Faltando qualquer um destes, o ID não pode ser gerado. */
export const podeGerarIdOperacao = (dados: Partial<DadosIdOperacao>): boolean =>
  !!dados.tipoOperacao &&
  !!dados.dataDesembolso &&
  !!String(dados.unidade ?? "").trim() &&
  String(dados.cnpj ?? "").replace(/\D/g, "").length >= 2 &&
  siglaTipoOperacao(dados.tipoOperacao) !== "SEM TIPO DE OP.";

// ---------------------------------------------------------------------------
// Linha de crédito
// ---------------------------------------------------------------------------

export type LinhaCreditoPainel = "QIA" | "Amor Saúde" | "Visão de Todos";

/**
 * Traduz "Tipo de Produto" do HubSpot para a linha de crédito do painel.
 *
 * Definido com a área em 04/09: *"O painel hoje só precisa trabalhar com duas
 * linhas, QIA e Amor Saúde, que são o fundo da Valora. As outras linhas são de
 * outro fundo, que vamos migrar só mais para frente."*
 *
 * Retorna `null` para os produtos do outro fundo — o sync os ignora, porque não
 * são operações deste painel. Ignorar é o comportamento correto: importá-las
 * com uma linha inventada geraria o checklist documental errado.
 */
export const mapearLinhaCredito = (tipoProduto: string | null | undefined): LinhaCreditoPainel | null => {
  const t = String(tipoProduto ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();

  if (!t) return null;
  if (t.includes("qia")) return "QIA";
  if (t.includes("recebiveis como garantia")) return "Amor Saúde";
  return null; // outro fundo: imóvel em garantia, antecipação, financiamento imobiliário
};
