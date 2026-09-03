import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
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
import logoUrl from "@/assets/maistodos-logo.png";
import { checklistFileName } from "./checklistFileName";

const NAVY: [number, number, number] = [22, 34, 63];
const GOLD_LIGHT: [number, number, number] = [201, 169, 105];
const ERROR: [number, number, number] = [163, 67, 47];
const INK: [number, number, number] = [20, 20, 20];
const LINE: [number, number, number] = [60, 60, 60];
const HEAD_BG: [number, number, number] = [225, 225, 225];

// Cache do logo para não recarregar a cada export
let logoCache: { dataUrl: string; width: number; height: number } | null = null;
const loadLogo = async () => {
  if (logoCache) return logoCache;
  try {
    const res = await fetch(logoUrl);
    const blob = await res.blob();
    const dataUrl: string = await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onloadend = () => resolve(r.result as string);
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
    const dims = await new Promise<{ width: number; height: number }>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.width, height: img.height });
      img.onerror = reject;
      img.src = dataUrl;
    });
    logoCache = { dataUrl, ...dims };
    return logoCache;
  } catch {
    return null;
  }
};

// Desenha a logo no canto superior esquerdo, retorna a altura consumida
const drawLogoHeader = (doc: jsPDF, margin: number): number => {
  if (!logoCache) return 0;
  const targetH = 22;
  const targetW = (logoCache.width / logoCache.height) * targetH;
  doc.addImage(logoCache.dataUrl, "PNG", margin, margin - 6, targetW, targetH);
  return targetH + 4;
};

// ————————————————————————————————————————————————————
// Checklist AS
// ————————————————————————————————————————————————————
export const exportAsPDF = async (s: AsState, razaoSocialFallback?: string) => {
  await loadLogo();
  const doc = new jsPDF({ unit: "pt", format: "a4", orientation: "portrait" });
  const CM = 28.3465;
  const MARGIN = 2 * CM;
  const PAGE_W = doc.internal.pageSize.getWidth();
  let y = MARGIN + drawLogoHeader(doc, MARGIN);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("CHECK-LIST – FIDC MAIS TODOS", PAGE_W / 2, y, { align: "center" });
  y += 14;
  doc.setFont("helvetica", "italic");
  doc.setFontSize(10);
  doc.text("Análise de Operação (AS)", PAGE_W / 2, y, { align: "center" });
  y += 16;

  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    theme: "grid",
    styles: {
      font: "helvetica",
      fontSize: 8.5,
      cellPadding: 4,
      lineColor: LINE,
      lineWidth: 0.6,
      textColor: INK,
    },
    columnStyles: { 0: { cellWidth: (PAGE_W - 2 * MARGIN) * 0.46, fontStyle: "bold" } },
    body: [
      ["RAZÃO SOCIAL COMPLETA", s.razaoSocial || "—"],
      ["CNPJ", s.cnpj || "—"],
    ],
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;

  const body: [string, string][] = [];
  asItens(s).forEach(([lbl, val]) => body.push([lbl, val || "—"]));
  AS_DOCS.forEach((nome, i) => {
    const num = String(i + 1);
    body.push([
      nome.toUpperCase(),
      s.docs[num] ? `Documento anexo – ${num}` : "PENDENTE",
    ]);
  });

  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    theme: "grid",
    styles: {
      font: "helvetica",
      fontSize: 8.5,
      cellPadding: 4,
      lineColor: LINE,
      lineWidth: 0.6,
      textColor: INK,
    },
    headStyles: { fillColor: HEAD_BG, textColor: INK, fontStyle: "bold" },
    columnStyles: { 0: { cellWidth: (PAGE_W - 2 * MARGIN) * 0.46, fontStyle: "bold" } },
    head: [["ITENS VERIFICADOS", "PREENCHER INFORMAÇÕES"]],
    body,
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 1 && data.cell.raw === "PENDENTE") {
        data.cell.styles.textColor = ERROR;
        data.cell.styles.fontStyle = "bold";
      }
    },
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 14;

  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    theme: "grid",
    styles: {
      font: "helvetica",
      fontSize: 8,
      cellPadding: 4,
      lineColor: LINE,
      lineWidth: 0.6,
      textColor: INK,
      fontStyle: "bold",
    },
    head: [["OBSERVAÇÕES:"]],
    headStyles: { fillColor: HEAD_BG, textColor: INK, fontStyle: "bold" },
    body: CL_OBSERVACOES.map((o) => [`•  ${o}`]),
  });

  doc.save(checklistFileName(s.razaoSocial || razaoSocialFallback, "pdf"));
};

// ————————————————————————————————————————————————————
// Checklist CDT
// ————————————————————————————————————————————————————
export const exportCdtPDF = async (s: CdtState, razaoSocialFallback?: string) => {
  await loadLogo();
  const doc = new jsPDF({ unit: "pt", format: "a4", orientation: "portrait" });
  const CM = 28.3465;
  const MARGIN = 2 * CM;
  const PAGE_W = doc.internal.pageSize.getWidth();
  let y = MARGIN + drawLogoHeader(doc, MARGIN);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("CHECK-LIST – FIDC MAIS TODOS", PAGE_W / 2, y, { align: "center" });
  y += 14;
  doc.setFont("helvetica", "italic");
  doc.setFontSize(10);
  doc.text("Cartão de TODOS (CDT)", PAGE_W / 2, y, { align: "center" });
  y += 16;

  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    theme: "grid",
    styles: {
      font: "helvetica",
      fontSize: 8.5,
      cellPadding: 4,
      lineColor: LINE,
      lineWidth: 0.6,
      textColor: INK,
    },
    columnStyles: { 0: { cellWidth: (PAGE_W - 2 * MARGIN) * 0.46, fontStyle: "bold" } },
    body: [
      ["RAZÃO SOCIAL COMPLETA", s.razaoSocial || "—"],
      ["CNPJ", s.cnpj || "—"],
    ],
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;

  const body: [string, string][] = [];
  cdtItens(s).forEach(([lbl, val]) => body.push([lbl, val || "—"]));
  const status = cdtDocsStatus(s.docs);
  CDT_DOCS.forEach((nome, i) => body.push([nome.toUpperCase(), status[i]]));

  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    theme: "grid",
    styles: {
      font: "helvetica",
      fontSize: 8.5,
      cellPadding: 4,
      lineColor: LINE,
      lineWidth: 0.6,
      textColor: INK,
    },
    headStyles: { fillColor: HEAD_BG, textColor: INK, fontStyle: "bold" },
    columnStyles: { 0: { cellWidth: (PAGE_W - 2 * MARGIN) * 0.46, fontStyle: "bold" } },
    head: [["ITENS VERIFICADOS", "PREENCHER INFORMAÇÕES"]],
    body,
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 1 && data.cell.raw === "PENDENTE") {
        data.cell.styles.textColor = ERROR;
        data.cell.styles.fontStyle = "bold";
      }
    },
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 14;

  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    theme: "grid",
    styles: {
      font: "helvetica",
      fontSize: 8,
      cellPadding: 4,
      lineColor: LINE,
      lineWidth: 0.6,
      textColor: INK,
      fontStyle: "bold",
    },
    head: [["OBSERVAÇÕES:"]],
    headStyles: { fillColor: HEAD_BG, textColor: INK, fontStyle: "bold" },
    body: CL_OBSERVACOES.map((o) => [`•  ${o}`]),
  });

  doc.save(checklistFileName(s.razaoSocial || razaoSocialFallback, "pdf"));
};

// ————————————————————————————————————————————————————
// Outorga Uxória — PDF vetorial (times, corpo justificado)
// ————————————————————————————————————————————————————
export const exportOutorgaPDF = async (d: OutorgaState, razaoSocial?: string) => {
  await loadLogo();
  const doc = new jsPDF({ unit: "pt", format: "a4", orientation: "portrait" });
  const CM = 28.3465;
  const MARGIN = 2 * CM;
  const PAGE_W = doc.internal.pageSize.getWidth();
  const PAGE_H = doc.internal.pageSize.getHeight();
  const USABLE_W = PAGE_W - 2 * MARGIN;
  const BODY_SIZE = 11;
  const LINE_H = BODY_SIZE * 1.6;

  let y = MARGIN + 6 + drawLogoHeader(doc, MARGIN);
  const checkPage = (needed: number) => {
    if (y + needed > PAGE_H - MARGIN) {
      doc.addPage();
      y = MARGIN + 6;
    }
  };

  const centerUnderlined = (text: string, size: number) => {
    doc.setFont("times", "bold");
    doc.setFontSize(size);
    doc.text(text, PAGE_W / 2, y, { align: "center" });
    const w = doc.getTextWidth(text);
    doc.setLineWidth(0.7);
    doc.line(PAGE_W / 2 - w / 2, y + 2, PAGE_W / 2 + w / 2, y + 2);
  };

  centerUnderlined("AUTORIZAÇÃO CONJUGAL", 14);
  y += 18;
  centerUnderlined("Outorga Uxória relativa ao Aval", 12);
  y += 34;

  doc.setFont("times", "normal");
  doc.setFontSize(BODY_SIZE);

  // Segmentos (negrito para os campos da Emitente) com quebra de linha manual
  const raw = buildOutorgaText(d, true);
  const segments = raw
    .split(OUTORGA_BOLD)
    .map((text, i) => ({ text, bold: i % 2 === 1 }))
    .filter((s) => s.text.length > 0);

  type Piece = { text: string; bold: boolean; w: number };
  type W = { pieces: Piece[]; w: number };
  const measure = (text: string, bold: boolean) => {
    doc.setFont("times", bold ? "bold" : "normal");
    return doc.getTextWidth(text);
  };
  const SPACE_W = measure("a a", false) - measure("aa", false);

  // Palavras podem misturar negrito/normal (ex.: "LTDA," com vírgula fora do negrito)
  const words: W[] = [];
  let prevEndsWithSpace = true;
  for (const seg of segments) {
    const startsWithSpace = /^\s/.test(seg.text);
    const tokens = seg.text.split(/\s+/).filter(Boolean);
    tokens.forEach((t, i) => {
      const piece: Piece = { text: t, bold: seg.bold, w: measure(t, seg.bold) };
      const glue = i === 0 && !startsWithSpace && !prevEndsWithSpace && words.length > 0;
      if (glue) {
        const last = words[words.length - 1];
        last.pieces.push(piece);
        last.w += piece.w;
      } else {
        words.push({ pieces: [piece], w: piece.w });
      }
    });
    if (tokens.length || seg.text.trim()) prevEndsWithSpace = /\s$/.test(seg.text);
  }


  // Quebra de linha gulosa + justificação (exceto última linha)
  const lines: W[][] = [];
  let cur: W[] = [];
  let curW = 0;
  for (const w of words) {
    const add = cur.length ? SPACE_W + w.w : w.w;
    if (curW + add > USABLE_W && cur.length) {
      lines.push(cur);
      cur = [w];
      curW = w.w;
    } else {
      cur.push(w);
      curW += add;
    }
  }
  if (cur.length) lines.push(cur);

  lines.forEach((line, li) => {
    checkPage(LINE_H);
    const isLast = li === lines.length - 1;
    const totalW = line.reduce((s, w) => s + w.w, 0);
    const gap =
      !isLast && line.length > 1 ? (USABLE_W - totalW) / (line.length - 1) : SPACE_W;
    let x = MARGIN;
    for (const w of line) {
      for (const p of w.pieces) {
        doc.setFont("times", p.bold ? "bold" : "normal");
        doc.text(p.text, x, y);
        x += p.w;
      }
      x += gap;
    }
    y += LINE_H;
  });

  doc.setFont("times", "normal");


  checkPage(44 + LINE_H);
  y += 30;
  doc.text(
    `${d.localAssinatura || "[Local]"}, ${dataPorExtenso()}.`,
    MARGIN,
    y
  );

  y += 64;
  checkPage(2 * LINE_H + 20);

  doc.setFont("times", "bold");
  doc.text(d.conjugeNome || "[CÔNJUGE]", MARGIN, y);
  doc.setFont("times", "normal");
  y += 22;
  doc.setLineWidth(0.8);
  doc.line(MARGIN, y, MARGIN + USABLE_W * 0.7, y);
  y += 16;
  doc.text(`CPF/ME: ${d.conjugeCPF || ""}`.trim(), MARGIN, y);


  doc.save(
    checklistFileName(
      d.emitenteNome || d.avalistaNome || d.conjugeNome || razaoSocial,
      "pdf",
      "Outorga Uxória",
    ),
  );
};

// ————————————————————————————————————————————————————
// Carta Bacen — PDF vetorial (times, corpo justificado)
// ————————————————————————————————————————————————————
export const exportBacenPDF = async (d: BacenState, razaoSocialFallback?: string) => {
  await loadLogo();
  const doc = new jsPDF({ unit: "pt", format: "a4", orientation: "portrait" });
  const CM = 28.3465;
  const MARGIN = 2 * CM;
  const PAGE_W = doc.internal.pageSize.getWidth();
  const PAGE_H = doc.internal.pageSize.getHeight();
  const USABLE_W = PAGE_W - 2 * MARGIN;
  const BODY_SIZE = 10.5;
  const LINE_H = BODY_SIZE * 1.55;

  let y = MARGIN + 6 + drawLogoHeader(doc, MARGIN);
  const checkPage = (needed: number) => {
    if (y + needed > PAGE_H - MARGIN) {
      doc.addPage();
      y = MARGIN + 6;
    }
  };

  const writeJustified = (text: string) => {
    doc.setFont("times", "normal");
    doc.setFontSize(BODY_SIZE);
    const lines = doc.splitTextToSize(text, USABLE_W);
    for (let k = 0; k < lines.length; k++) {
      checkPage(LINE_H);
      const isLast = k === lines.length - 1;
      if (isLast) doc.text(lines[k], MARGIN, y);
      else doc.text(lines[k], MARGIN, y, { maxWidth: USABLE_W, align: "justify" });
      y += LINE_H;
    }
  };

  doc.setFont("times", "bold");
  doc.setFontSize(12);
  const titulo =
    "AUTORIZAÇÃO PARA CONSULTA AO SISTEMA DE INFORMAÇÃO DE CRÉDITO (SCR) E CADASTRO";
  const tituloLines = doc.splitTextToSize(titulo, USABLE_W);
  for (const l of tituloLines) {
    doc.text(l, PAGE_W / 2, y, { align: "center" });
    y += 14;
  }
  y += 12;

  writeJustified(buildBacenText(d, true));
  y += 8;
  writeJustified(BACEN_PARAG_2);
  y += 4;

  // Lista numerada
  doc.setFont("times", "normal");
  doc.setFontSize(BODY_SIZE);
  BACEN_ITENS.forEach((it, i) => {
    const prefix = `${i + 1}. `;
    const lines = doc.splitTextToSize(prefix + it, USABLE_W - 8);
    for (const l of lines) {
      checkPage(LINE_H);
      doc.text(l, MARGIN, y);
      y += LINE_H;
    }
    y += 2;
  });

  y += 14;
  checkPage(LINE_H);
  doc.text(
    `${d.cidade || "(CIDADE)"}, ${dataPorExtenso()}.`,
    MARGIN,
    y,
  );
  y += LINE_H * 3;

  // Assinatura
  checkPage(80);
  const sigLineW = USABLE_W * 0.7;
  const sigX1 = PAGE_W / 2 - sigLineW / 2;
  const sigX2 = PAGE_W / 2 + sigLineW / 2;
  doc.setLineWidth(0.8);
  doc.line(sigX1, y, sigX2, y);
  y += 14;
  doc.setFont("times", "bold");
  doc.text(d.representanteNome || "(NOME DO REPRESENTANTE LEGAL)", PAGE_W / 2, y, {
    align: "center",
  });
  y += 12;
  doc.setFont("times", "normal");
  doc.text(d.representanteCPF || "(CPF DO REPRESENTANTE LEGAL)", PAGE_W / 2, y, {
    align: "center",
  });

  // Rodapé fixo no fim da página
  doc.setFontSize(8);
  doc.setTextColor(90, 90, 90);
  let fy = PAGE_H - MARGIN + 6;
  for (let i = BACEN_RODAPE.length - 1; i >= 0; i--) {
    doc.text(BACEN_RODAPE[i], PAGE_W / 2, fy, { align: "center" });
    fy -= 11;
  }

  doc.save(checklistFileName(d.razaoSocial || razaoSocialFallback, "pdf", "Carta Bacen"));
};
