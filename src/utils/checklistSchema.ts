import { Pessoa } from "./docFormats";

export type ChecklistType = "as" | "cdt" | "outorga" | "bacen";
export type CarenciaTipo = "total" | "principal" | "total_e_principal";
export type SimNao = "Sim" | "Não";

export const CDT_FIEL_DEPOSITARIO =
  "TODOS EMPREENDIMENTOS LTDA - Banco 332 - Ag 0001 - CC 1107634854";

// Documentos AS — numeração fixa 1..6
export const AS_DOCS: string[] = [
  "Contrato / Estatuto Social / Atas / Eleição da Diretoria",
  "Cartão CNPJ",
  "Carta Bacen",
  "Extrato de recebíveis dos últimos 12 meses com valores e comprovantes",
  "IR dos sócios",
  "Documento de identificação dos representantes legais / avalistas — e caso aplicável, dos cônjuges + certidão de casamento",
];

// Documentos CDT — numeração dinâmica na ordem dos marcados
export const CDT_DOCS: string[] = [
  "Quantidade de famílias atendidas com histórico de entrada e saída dos últimos 12 meses",
  "Contrato / Estatuto Social / Atas / Eleição da Diretoria",
  "Cartão CNPJ",
  "Contrato da franquia",
  "Carta Bacen",
  "Relação de matrículas dos afiliados (com valores)",
  "IR dos sócios",
  "Histórico de repasse mensal dos últimos 24 meses + comprovante de TED + comprovante de repasse",
  "Documento de identificação dos representantes legais / avalistas — e caso aplicável, dos cônjuges + certidão de casamento",
];

export const CL_OBSERVACOES: string[] = [
  "Lembrando que todos os assinantes devem possuir certificado digital válido para assinar;",
  "Se o Avalista indicado for também representante legal, informar somente o nome completo e estado civil no campo avalista;",
  "Se o avalista indicado for casado; ou em união estável, será necessário o envio de cópia da certidão de casamento; ou de união estável, bem como cópia do documento de identificação do cônjuge;",
  "Se o avalista indicado for casado; ou em união estável, será necessário o envio da Outorga Uxória (outorga para aval devidamente preenchida e assinada);",
  "O envio da Outorga para Aval somente é dispensado, nos casos que o avalista indicado for casado em regime de separação de bens; ou nos casos em que for solteiro, viúvo etc;",
  "Verificar se no contrato social da Franquia existe alguma vedação para realização de empréstimos;",
  "Confirmar antes com a Franquia se todos os documentos e informações estão atualizados.",
];

export interface AsState {
  razaoSocial: string;
  cnpj: string;
  regional: string;
  representantes: Pessoa[];
  avalistas: Pessoa[];
  dadosBancarios: string;
  fielDepositario: string;
  fielNA: boolean;
  opValor: string;
  opTaxa: string;
  opPrazo: string;
  opCarencia: string;
  opCarenciaTipo: CarenciaTipo;
  opCarenciaTotalMeses: string;      // usado quando tipo = total_e_principal
  opCarenciaPrincipalMeses: string;  // usado quando tipo = total_e_principal
  expansao: SimNao;
  preAprovada: SimNao;
  media12: string;
  docs: Record<string, boolean>;
}

export interface CdtState {
  razaoSocial: string;
  cnpj: string;
  regional: string;
  representantes: Pessoa[];
  avalistas: Pessoa[];
  dadosBancarios: string;
  opValor: string;
  opTaxa: string;
  opCDI: boolean;
  opPrazo: string;
  opCarencia: string;
  opCarenciaTipo: CarenciaTipo;
  opCarenciaTotalMeses: string;
  opCarenciaPrincipalMeses: string;
  expansao: SimNao;
  preAprovada: SimNao;
  qtdCartoes: string;
  docs: Record<string, boolean>;
}

export interface OutorgaState {
  localAssinatura: string;
  conjugeTratamento: "a Sra." | "o Sr.";
  conjugeNome: string;
  conjugeNacionalidade: string;
  conjugeProfissao: string;
  conjugeRG: string;
  conjugeOrgaoRG: string;
  conjugeCPF: string;
  conjugeEndereco: string;
  regimeBens:
    | "solteiro(a)"
    | "comunhão parcial de bens"
    | "comunhão universal de bens"
    | "separação total de bens"
    | "separação obrigatória de bens"
    | "participação final nos aquestos";
  avalistaTratamento: "o Sr." | "a Sra.";
  avalistaNome: string;
  avalistaNacionalidade: string;
  avalistaProfissao: string;
  avalistaRG: string;
  avalistaOrgaoRG: string;
  avalistaCPF: string;
  avalistaEndereco: string;
  emitenteNome: string;
  emitenteEndereco: string;
  emitenteCnpj: string;
}


export interface BacenState {
  razaoSocial: string;
  cnpj: string;
  cidade: string;
  representanteNome: string;
  representanteCPF: string;
}

export const emptyAs = (): AsState => ({
  razaoSocial: "",
  cnpj: "",
  regional: "",
  representantes: [{ nome: "", cpf: "", email: "" }],
  avalistas: [{ nome: "", cpf: "", email: "", regime: "" }],
  dadosBancarios: "",
  fielDepositario: CDT_FIEL_DEPOSITARIO,
  fielNA: false,
  opValor: "",
  opTaxa: "",
  opPrazo: "",
  opCarencia: "",
  opCarenciaTipo: "total",
  opCarenciaTotalMeses: "",
  opCarenciaPrincipalMeses: "",
  expansao: "Não",
  preAprovada: "Não",
  media12: "",
  docs: Object.fromEntries(AS_DOCS.map((_, i) => [String(i + 1), false])),
});

export const emptyCdt = (): CdtState => ({
  razaoSocial: "",
  cnpj: "",
  regional: "",
  representantes: [{ nome: "", cpf: "", email: "" }],
  avalistas: [{ nome: "", cpf: "", email: "", regime: "" }],
  dadosBancarios: "",
  opValor: "",
  opTaxa: "",
  opCDI: false,
  opPrazo: "",
  opCarencia: "",
  opCarenciaTipo: "total",
  opCarenciaTotalMeses: "",
  opCarenciaPrincipalMeses: "",
  expansao: "Não",
  preAprovada: "Não",
  qtdCartoes: "",
  docs: {},
});

export const emptyOutorga = (): OutorgaState => ({
  localAssinatura: "",
  conjugeTratamento: "a Sra.",
  conjugeNome: "",
  conjugeNacionalidade: "",
  conjugeProfissao: "",
  conjugeRG: "",
  conjugeOrgaoRG: "",
  conjugeCPF: "",
  conjugeEndereco: "",
  regimeBens: "comunhão parcial de bens",
  avalistaTratamento: "o Sr.",
  avalistaNome: "",
  avalistaNacionalidade: "",
  avalistaProfissao: "",
  avalistaRG: "",
  avalistaOrgaoRG: "",
  avalistaCPF: "",
  avalistaEndereco: "",
  emitenteNome: "",
  emitenteEndereco: "",
  emitenteCnpj: "",
});


export const emptyBacen = (): BacenState => ({
  razaoSocial: "",
  cnpj: "",
  cidade: "",
  representanteNome: "",
  representanteCPF: "",
});

// ————————————————————————————————————————————————————
// Helpers
// ————————————————————————————————————————————————————

export const pessoasToLines = (pessoas: Pessoa[], comRegime: boolean): string => {
  const blocos: string[] = [];
  for (const p of pessoas) {
    const linhas: string[] = [];
    if (p.nome) linhas.push(p.nome);
    if (p.cpf) linhas.push(p.cpf);
    if (p.email) linhas.push(p.email);
    if (comRegime && p.regime) linhas.push(`(${p.regime})`);
    if (linhas.length) blocos.push(linhas.join("\n"));
  }
  return blocos.join("\n\n");
};

// Constrói a linha "36x SENDO 12 MESES DE CARÊNCIA TOTAL"
const linhaPrazoCarencia = (
  prazo: string,
  tipo: CarenciaTipo,
  car: string,
  carTotal: string,
  carPrincipal: string,
): string => {
  if (!prazo) return "";
  const base = `${prazo}x`;
  const plural = (n: string) => (n === "1" ? "MÊS" : "MESES");
  if (tipo === "total_e_principal") {
    const t = carTotal.trim();
    const p = carPrincipal.trim();
    if (!t && !p) return base;
    const partes: string[] = [];
    if (t) partes.push(`${t} ${plural(t)} DE CARÊNCIA TOTAL`);
    if (p) partes.push(`${p} ${plural(p)} DE CARÊNCIA PRINCIPAL`);
    return `${base} SENDO ${partes.join(" E ")}`;
  }
  if (!car) return base;
  const label = tipo === "principal" ? "PRINCIPAL" : "TOTAL";
  return `${base} SENDO ${car} ${plural(car)} DE CARÊNCIA ${label}`;
};

// AS: formato multi-linha (uma informação por linha), com SENDO
export const asOperacaoTexto = (s: AsState): string => {
  const linhas: string[] = [];
  if (s.opValor) linhas.push(s.opValor);
  const lc = linhaPrazoCarencia(
    s.opPrazo,
    s.opCarenciaTipo,
    s.opCarencia,
    s.opCarenciaTotalMeses,
    s.opCarenciaPrincipalMeses,
  );
  if (lc) linhas.push(lc);
  if (s.opTaxa) linhas.push(`${s.opTaxa}% a.m.`);
  linhas.push("CRÉDITO GARANTIA DE RECEBÍVEIS");
  linhas.push("2% de TAC incluída");
  return linhas.join("\n");
};

// CDT: mesmo formato + opção CDI
export const cdtOperacaoTexto = (s: CdtState): string => {
  const linhas: string[] = [];
  if (s.opValor) linhas.push(s.opValor);
  const lc = linhaPrazoCarencia(
    s.opPrazo,
    s.opCarenciaTipo,
    s.opCarencia,
    s.opCarenciaTotalMeses,
    s.opCarenciaPrincipalMeses,
  );
  if (lc) linhas.push(lc);
  if (s.opTaxa) linhas.push(`${s.opTaxa}% a.m.${s.opCDI ? " + CDI" : ""}`);
  linhas.push("2% de TAC incluída");
  return linhas.join("\n");
};

export const cdtDocsStatus = (docs: Record<string, boolean>): string[] => {
  const status: string[] = [];
  let n = 0;
  for (let i = 0; i < CDT_DOCS.length; i++) {
    if (docs[String(i)]) {
      n++;
      status.push(`Documento anexo – ${n}`);
    } else {
      status.push("PENDENTE");
    }
  }
  return status;
};

export const asItens = (s: AsState): [string, string][] => [
  ["REGIONAL", s.regional],
  ["REPRESENTANTES LEGAIS\n(NOME / CPF / E-MAIL)", pessoasToLines(s.representantes, false)],
  [
    "AVALISTAS (SÓCIOS)\nESTADO CIVIL E/OU REGIME DE CASAMENTO\n(DADOS DOS AVALISTAS - NOME / CPF / E-MAIL)",
    pessoasToLines(s.avalistas, true),
  ],
  ["DADOS BANCÁRIOS DO FRANQUEADO", s.dadosBancarios],
  ["FIEL DEPOSITÁRIO + DADOS BANCÁRIOS", s.fielNA ? "Não se aplica" : s.fielDepositario],
  ["DADOS DA OPERAÇÃO (VOLUME / PRAZO / TAXA)", asOperacaoTexto(s)],
  ["PROJETO DE CLÍNICAS EM EXPANSÃO?", s.expansao],
  ["OPERAÇÃO PRÉ APROVADA?", s.preAprovada],
  ["MÉDIA DOS 12 MESES (RECEBÍVEIS CRÉDITO)", s.media12 ? `${s.media12}/mês` : ""],
];

export const cdtItens = (s: CdtState): [string, string][] => [
  ["REGIONAL", s.regional],
  [
    "REPRESENTANTES LEGAIS\n(NOME / CPF / E-MAIL) = AVALISTA",
    pessoasToLines(s.representantes, false),
  ],
  [
    "AVALISTAS (SÓCIOS)\nESTADO CIVIL E / OU REGIME DE CASAMENTO (DADOS DOS AVALISTAS - NOME / CPF / E-MAIL)",
    pessoasToLines(s.avalistas, true),
  ],
  ["DADOS BANCÁRIOS DO FRANQUEADO", s.dadosBancarios],
  ["FIEL DEPOSITÁRIO + DADOS BANCÁRIOS", CDT_FIEL_DEPOSITARIO],
  ["DADOS DA OPERAÇÃO (VOLUME / PRAZO / TAXA)", cdtOperacaoTexto(s)],
  ["PROJETO DE CLÍNICAS EM EXPANSÃO?", s.expansao],
  ["OPERAÇÃO PRÉ APROVADA?", s.preAprovada],
  ["QUANTIDADE DE CARTÕES EMITIDOS PELO FRANQUEADO", s.qtdCartoes],
];

// Marcador de negrito usado apenas quando forPdf=true (PDF/DOCX)
export const OUTORGA_BOLD = "\u0001";

export const outorgaRegimeCurto = (regime: OutorgaState["regimeBens"]): string | null => {
  if (regime === "comunhão parcial de bens") return "parcial";
  if (regime === "comunhão universal de bens") return "total";
  return null;
};

// Texto legal Outorga Uxória — modelo oficial (AUTORIZAÇÃO CONJUGAL)
export const buildOutorgaText = (d: OutorgaState, forPdf: boolean): string => {
  const ph = (val: string, label: string) =>
    forPdf ? val || `[${label}]` : `__${val ? val : `EMPTY::${label}`}__`;
  const phB = (val: string, label: string) =>
    forPdf ? OUTORGA_BOLD + (val || `[${label}]`) + OUTORGA_BOLD : ph(val, label);
  const regimeCurto = outorgaRegimeCurto(d.regimeBens);

  return (
    "Para fins do artigo 1.647, III, da Lei nº 10.406, de 10 de janeiro de 2002 (\u201CCódigo Civil\u201D), " +
    ph(d.conjugeTratamento, "Tratamento Cônjuge") + " " +
    ph(d.conjugeNome, "CÔNJUGE") + ", " +
    ph(d.conjugeNacionalidade, "NACIONALIDADE") + ", " +
    ph(d.conjugeProfissao, "PROFISSÃO") +
    ", portador(a) da Cédula de Identidade RG nº " +
    ph(d.conjugeRG, "RG do Cônjuge") + " (" +
    ph(d.conjugeOrgaoRG, "ÓRGÃO EMISSOR") +
    ") e inscrito(a) no Cadastro de Pessoas Físicas do Ministério da Economia (\u201CCPF/ME\u201D) sob nº " +
    ph(d.conjugeCPF, "CPF do Cônjuge") + ", residente e domiciliado(a) na " +
    ph(d.conjugeEndereco, "ENDEREÇO COMPLETO") +
    " (\u201CCÔNJUGE\u201D), casado(a) sob o regime legal de comunhão " +
    (regimeCurto ?? ph("", "parcial/total")) +
    " de bens com " +
    ph(d.avalistaTratamento, "Tratamento Avalista") + " " +
    ph(d.avalistaNome, "AVALISTA") + ", " +
    ph(d.avalistaNacionalidade, "NACIONALIDADE") + ", " +
    ph(d.avalistaProfissao, "PROFISSÃO") +
    ", portador(a) da Cédula de Identidade RG nº " +
    ph(d.avalistaRG, "RG do Avalista") + " (" +
    ph(d.avalistaOrgaoRG, "ÓRGÃO EMISSOR") +
    ") e inscrito(a) no CPF/ME sob nº " +
    ph(d.avalistaCPF, "CPF do Avalista") + ", residente e domiciliado na " +
    ph(d.avalistaEndereco, "ENDEREÇO COMPLETO") +
    " (\u201CFRANQUEADO\u201D), por meio deste instrumento e de forma irrevogável e irretratável, manifesta sua irrestrita e incondicional ciência, anuência e autorização quanto ao aval prestado pelo FRANQUEADO na realização da emissão de Notas Comerciais Escriturais da " +
    phB(d.emitenteNome, "EMITENTE") +
    ", com sede na " +
    phB(d.emitenteEndereco, "ENDEREÇO COMPLETO") +
    ", inscrita no Cadastro Nacional da Pessoa Jurídica do Ministério da Economia (\u201CCNPJ/ME\u201D) sob o nº " +
    phB(d.emitenteCnpj, "CNPJ da Emitente") +
    ", neste ato devidamente representada nos termos do seu contrato social (\u201CEMITENTE\u201D), nos moldes da Lei nº 14.195, de 26 de agosto de 2021 (\u201CLei nº 14.195\u201D), para distribuição pública com esforços restritos, conforme aplicável, em conformidade com o \u201CTermo de Emissão de Notas Comerciais Escriturais para Colocação Privada\u201D, celebrado entre a EMITENTE; o FRANQUEADO (na qualidade de avalista), TODOS EMPRRENDIMENTOS LTDA, sociedade empresária limitada, com sede na cidade de Ipatinga, estado de Minas Gerais, na Rua Dom Pedro II, n° 37, bairro Cidade Nova, CEP 35162-399, inscrita no CNPJ/ME sob o nº 04.644.515/0001-85; a MAISTODOS S.A., sociedade anônima fechada, com sede na Cidade de Ribeirão Preto, Estado de São Paulo, Avenida Presidente Vargas, nº 1.265, sala 1.101, Jardim São Luiz, CEP 14.020-273, inscrita no CNPJ/ME sob o nº 28.101.795/0001-43; e a VALORA RENDA FIXA ESTRUTURADOS LTDA, sociedade limitada com sede na Cidade de São Paulo, Estado de São Paulo, na Avenida Presidente Juscelino Kubitschek, 1830, Conjunto 32, Torre 2, CEP: 04.543-900, inscrita no CNPJ/ME sob o nº 57.369.679/0001-08, na qualidade de gestora do MAIS TODOS FUNDO DE INVESTIMENTO EM DIREITOS CREDITÓRIOS, fundo de investimento em direitos creditórios, constituído sob a forma de condomínio fechado, inscrito no CNPF/ME sob o nº 45.121.220.0001-01."
  );
};


// Texto Carta Bacen (verbatim do modelo PDF)
export const buildBacenText = (
  d: BacenState,
  forPdf: boolean,
): string => {
  const ph = (val: string, label: string) =>
    forPdf ? val || `(${label})` : `__${val ? val : `EMPTY::${label}`}__`;
  return (
    "Eu, " + ph(d.razaoSocial, "RAZÃO SOCIAL") +
    ", inscrito(a) no CNPJ sob o nº " + ph(d.cnpj, "CNPJ") +
    ", através de seu representante legal. em virtude de operação de crédito, de qualquer natureza, pleiteada junto à empresa Valora Gestão de Investimentos Ltda , inscrita no CNPJ nº 07.559.989/0001-17, e suas filiais, autorizo à NAGRO CRÉDITO AGRO LTDA, inscrita no CNPJ sob o nº 22.165.622/0001-02, a consultar, a qualquer tempo, os débitos e responsabilidades decorrentes de operações com características de crédito e as informações e os registros de medidas judiciais que em meu nome e de minhas empresas, que constem ou venham a constar do Sistema de Informações de Crédito (SCR), gerido pelo Banco Central do Brasil - Bacen, ou dos sistemas que venham a complementá-lo ou a substituí-lo."
  );
};

export const BACEN_PARAG_2 =
  "Autorizo também à NAGRO CRÉDITO AGRO LTDA. a compartilhar os dados desta consulta exclusivamente com a Valora Gestão de Investimentos Ltda, na qual estou pleiteando operação de crédito, de qualquer natureza. Declaro ainda, ser de meu conhecimento que:";

export const BACEN_ITENS: string[] = [
  "As consultas em meu nome no SCR poderão ser realizadas com base na presente autorização;",
  "O SCR tem por finalidades prover informações ao Banco Central do Brasil, para fins de monitoramento e supervisão a que estão expostas do crédito no sistema financeiro e para o exercício de suas atividades de fiscalização e propiciar o intercâmbio de informações entre instituições financeiras com o objetivo de subsidiar decisões de crédito e de negócios, conforme definido no § 1º do art. 1º da Lei Complementar nº 105, de 10 de janeiro de 2001, sobre o montante de responsabilidades de clientes em operações de crédito;",
  "Poderei ter acesso aos dados constantes em meu nome no SCR por meio do sistema \u201Cregistrato\u201D do Banco Central do Brasil - Bacen;",
  "Pedidos de correções, de exclusões e de manifestações de discordância quanto às informações constantes do SCR deverão ser dirigidas ao BACEN ou à instituição responsável pela remessa das informações, por meio de requerimento escrito e fundamentado, ou, quando for o caso, pela respectiva decisão judicial;",
  "Mais informações sobre o SCR poderei obter em consulta a página na internet do Banco Central: www.bcb.gov.br",
];

export const BACEN_RODAPE = [
  "Valora Gestão de Investimentos Ltda - CNPJ: 07.559.989/0001-17",
  "Rua Iguatemi, 448 – 13º andar – Itaim Bibi",
  "São Paulo/SP – CEP 01451-010",
];
