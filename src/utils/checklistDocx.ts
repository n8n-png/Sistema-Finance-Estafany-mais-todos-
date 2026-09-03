import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import {
  AS_DOCS,
  AsState,
  BACEN_ITENS,
  BACEN_PARAG_2,
  BACEN_RODAPE,
  BacenState,
  CDT_DOCS,
  CL_OBSERVACOES,
  CdtState,
  OUTORGA_BOLD,
  OutorgaState,

  asItens,
  buildBacenText,
  buildOutorgaText,
  cdtDocsStatus,
  cdtItens,
} from "./checklistSchema";
import { dataPorExtenso } from "./docFormats";
import { checklistFileName } from "./checklistFileName";

const CONTENT_W = 9360;
const COL = [4300, 5060];

const border = { style: BorderStyle.SINGLE, size: 1, color: "999999" };
const cellBorders = { top: border, bottom: border, left: border, right: border };
const margins = { top: 80, bottom: 80, left: 120, right: 120 };

const cell = (text: string, index: number, opts?: { bold?: boolean; head?: boolean }) =>
  new TableCell({
    borders: cellBorders,
    margins,
    width: { size: COL[index], type: WidthType.DXA },
    shading: opts?.head ? { fill: "E1E1E1", type: ShadingType.CLEAR } : undefined,
    children: [
      new Paragraph({
        children: [new TextRun({ text, bold: opts?.bold || opts?.head })],
      }),
    ],
  });

const kvTable = (rows: [string, string][], head?: [string, string]) =>
  new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: COL,
    rows: [
      ...(head
        ? [
            new TableRow({
              children: [cell(head[0], 0, { head: true }), cell(head[1], 1, { head: true })],
            }),
          ]
        : []),
      ...rows.map(
        (r) =>
          new TableRow({
            children: [cell(r[0], 0, { bold: true }), cell(r[1] || "—", 1)],
          }),
      ),
    ],
  });

const title = (text: string) =>
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 80 },
    children: [new TextRun({ text, bold: true, size: 28 })],
  });

const subtitle = (text: string) =>
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 240 },
    children: [new TextRun({ text, italics: true, size: 22 })],
  });

const spacer = () => new Paragraph({ children: [new TextRun("")] });

const baseDoc = (children: (Paragraph | Table)[]) =>
  new Document({
    styles: { default: { document: { run: { font: "Arial", size: 20 } } } },
    sections: [
      {
        properties: {
          page: {
            size: { width: 12240, height: 15840 },
            margin: { top: 1134, right: 1440, bottom: 1134, left: 1440 },
          },
        },
        children,
      },
    ],
  });

const download = async (doc: Document, fileName: string) => {
  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

const observacoes = () => [
  spacer(),
  new Paragraph({
    spacing: { after: 80 },
    children: [new TextRun({ text: "OBSERVAÇÕES:", bold: true })],
  }),
  ...CL_OBSERVACOES.map(
    (o) =>
      new Paragraph({
        spacing: { after: 40 },
        indent: { left: 240 },
        children: [new TextRun({ text: `•  ${o}`, size: 18 })],
      }),
  ),
];

// —————————————————————————————— AS
export const exportAsDOCX = async (s: AsState, razaoSocialFallback?: string) => {
  const body: [string, string][] = asItens(s).map(([l, v]) => [l, v || "—"]);
  AS_DOCS.forEach((nome, i) => {
    const num = String(i + 1);
    body.push([nome.toUpperCase(), s.docs[num] ? `Documento anexo – ${num}` : "PENDENTE"]);
  });

  const doc = baseDoc([
    title("CHECK-LIST – FIDC MAIS TODOS"),
    subtitle("Análise de Operação (AS)"),
    kvTable([
      ["RAZÃO SOCIAL COMPLETA", s.razaoSocial || razaoSocialFallback || "—"],
      ["CNPJ", s.cnpj || "—"],
    ]),
    spacer(),
    kvTable(body, ["ITENS VERIFICADOS", "PREENCHER INFORMAÇÕES"]),
    ...observacoes(),
  ]);
  await download(doc, checklistFileName(s.razaoSocial || razaoSocialFallback, "docx"));
};

// —————————————————————————————— CDT
export const exportCdtDOCX = async (s: CdtState, razaoSocialFallback?: string) => {
  const body: [string, string][] = cdtItens(s).map(([l, v]) => [l, v || "—"]);
  const status = cdtDocsStatus(s.docs);
  CDT_DOCS.forEach((nome, i) => body.push([nome.toUpperCase(), status[i]]));

  const doc = baseDoc([
    title("CHECK-LIST – FIDC MAIS TODOS"),
    subtitle("Cartão de TODOS (CDT)"),
    kvTable([
      ["RAZÃO SOCIAL COMPLETA", s.razaoSocial || razaoSocialFallback || "—"],
      ["CNPJ", s.cnpj || "—"],
    ]),
    spacer(),
    kvTable(body, ["ITENS VERIFICADOS", "PREENCHER INFORMAÇÕES"]),
    ...observacoes(),
  ]);
  await download(doc, checklistFileName(s.razaoSocial || razaoSocialFallback, "docx"));
};

// —————————————————————————————— Outorga
export const exportOutorgaDOCX = async (d: OutorgaState, razaoSocial?: string) => {
  const raw = buildOutorgaText(d, true);
  const runs = raw
    .split(OUTORGA_BOLD)
    .map((text, i) => ({ text, bold: i % 2 === 1 }))
    .filter((s) => s.text.length > 0)
    .map((s) => new TextRun({ text: s.text, bold: s.bold, size: 22 }));

  const doc = baseDoc([
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 40 },
      children: [new TextRun({ text: "AUTORIZAÇÃO CONJUGAL", bold: true, underline: {}, size: 28 })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 300 },
      children: [
        new TextRun({ text: "Outorga Uxória relativa ao Aval", bold: true, underline: {}, size: 24 }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.JUSTIFIED,
      spacing: { line: 360, after: 240 },
      children: runs,
    }),
    new Paragraph({
      spacing: { before: 360, after: 720 },
      children: [
        new TextRun({ text: `${d.localAssinatura || "[Local]"}, ${dataPorExtenso()}.`, size: 22 }),
      ],
    }),
    new Paragraph({
      children: [new TextRun({ text: d.conjugeNome || "[CÔNJUGE]", bold: true, size: 22 })],
    }),
    new Paragraph({
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "000000", space: 1 } },
      children: [new TextRun("")],
    }),
    new Paragraph({
      spacing: { before: 60 },
      children: [new TextRun({ text: `CPF/ME: ${d.conjugeCPF || ""}`.trim(), size: 22 })],
    }),
  ]);
  await download(
    doc,
    checklistFileName(
      d.emitenteNome || d.avalistaNome || d.conjugeNome || razaoSocial,
      "docx",
      "Outorga Uxória",
    ),
  );
};


// —————————————————————————————— Carta Bacen
export const exportBacenDOCX = async (d: BacenState, razaoSocialFallback?: string) => {
  const doc = baseDoc([
    title("AUTORIZAÇÃO PARA CONSULTA AO SISTEMA DE INFORMAÇÃO DE CRÉDITO (SCR) E CADASTRO"),
    spacer(),
    new Paragraph({
      alignment: AlignmentType.JUSTIFIED,
      spacing: { line: 320, after: 160 },
      children: [new TextRun({ text: buildBacenText(d, true), size: 21 })],
    }),
    new Paragraph({
      alignment: AlignmentType.JUSTIFIED,
      spacing: { line: 320, after: 160 },
      children: [new TextRun({ text: BACEN_PARAG_2, size: 21 })],
    }),
    ...BACEN_ITENS.map(
      (it, i) =>
        new Paragraph({
          alignment: AlignmentType.JUSTIFIED,
          spacing: { after: 60 },
          indent: { left: 240 },
          children: [new TextRun({ text: `${i + 1}. ${it}`, size: 21 })],
        }),
    ),
    new Paragraph({
      spacing: { before: 320, after: 720 },
      children: [new TextRun({ text: `${d.cidade || "(CIDADE)"}, ${dataPorExtenso()}.`, size: 21 })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "000000", space: 1 } },
      children: [new TextRun("")],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: d.representanteNome || "(NOME DO REPRESENTANTE LEGAL)",
          bold: true,
          size: 21,
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 480 },
      children: [
        new TextRun({ text: d.representanteCPF || "(CPF DO REPRESENTANTE LEGAL)", size: 21 }),
      ],
    }),
    ...BACEN_RODAPE.map(
      (l) =>
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: l, size: 16, color: "5A5A5A" })],
        }),
    ),
  ]);
  await download(
    doc,
    checklistFileName(d.razaoSocial || razaoSocialFallback, "docx", "Carta Bacen"),
  );
};
