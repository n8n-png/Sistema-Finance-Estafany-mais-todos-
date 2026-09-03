import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { CalculationResult } from './calculations';
import logoUrl from '@/assets/maistodos-logo.png';

// MaisTODOS brand colors
const PURPLE: [number, number, number] = [114, 0, 214];   // #7200D6
const GREEN: [number, number, number] = [112, 224, 0];    // #70E000
const WHITE: [number, number, number] = [255, 255, 255];
const DARK: [number, number, number] = [30, 30, 40];
const GRAY: [number, number, number] = [120, 120, 130];
const LIGHT_BG: [number, number, number] = [248, 248, 252];
const STRIPE_BG: [number, number, number] = [245, 240, 255];

const loadLogoDataUrl = async (): Promise<{ dataUrl: string; width: number; height: number }> => {
  const res = await fetch(logoUrl);
  const blob = await res.blob();
  const dataUrl: string = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
  const dims = await new Promise<{ width: number; height: number }>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.width, height: img.height });
    img.onerror = reject;
    img.src = dataUrl;
  });
  return { dataUrl, ...dims };
};

// ── Lexend font loader (cached) ──
const LEXEND_URLS = {
  normal: 'https://cdn.jsdelivr.net/fontsource/fonts/lexend@latest/latin-400-normal.ttf',
  bold: 'https://cdn.jsdelivr.net/fontsource/fonts/lexend@latest/latin-700-normal.ttf',
};
let lexendCache: { normal: string; bold: string } | null = null;

const fetchAsBase64 = async (url: string): Promise<string> => {
  const res = await fetch(url);
  const buf = await res.arrayBuffer();
  let binary = '';
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
};

const registerLexend = async (doc: jsPDF) => {
  try {
    if (!lexendCache) {
      const [normal, bold] = await Promise.all([
        fetchAsBase64(LEXEND_URLS.normal),
        fetchAsBase64(LEXEND_URLS.bold),
      ]);
      lexendCache = { normal, bold };
    }
    doc.addFileToVFS('Lexend-Regular.ttf', lexendCache.normal);
    doc.addFont('Lexend-Regular.ttf', 'Lexend', 'normal');
    doc.addFileToVFS('Lexend-Bold.ttf', lexendCache.bold);
    doc.addFont('Lexend-Bold.ttf', 'Lexend', 'bold');
    return true;
  } catch (e) {
    console.warn('Falha ao carregar fonte Lexend, usando fallback', e);
    return false;
  }
};

export const generatePDF = async (results: CalculationResult, calculatorTitle: string) => {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 18;
  const contentWidth = pageWidth - margin * 2;

  // ── Load logo + Lexend font in parallel ──
  let logo: { dataUrl: string; width: number; height: number } | null = null;
  const [, lexendOk] = await Promise.all([
    loadLogoDataUrl().then(l => { logo = l; }).catch(e => console.warn('Falha ao carregar logo MaisTODOS', e)),
    registerLexend(doc),
  ]);
  const FONT = lexendOk ? 'Lexend' : 'helvetica';

  // ── Solid purple top bar ──
  const barHeight = 3;
  doc.setFillColor(...PURPLE);
  doc.rect(0, 0, pageWidth, barHeight, 'F');

  // ── Institutional Header ──
  const headerTop = barHeight + 6;
  const logoH = 14;
  const logoW = logo ? (logo.width / logo.height) * logoH : 0;
  if (logo) {
    doc.addImage(logo.dataUrl, 'PNG', margin, headerTop, logoW, logoH);
  }

  // Date (top right, discreet)
  const now = new Date();
  const dataSimulacao = now.toLocaleDateString('pt-BR');
  doc.setFont(FONT, 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...GRAY);
  doc.text(`Data da Simulação: ${dataSimulacao}`, pageWidth - margin, headerTop + 5, { align: 'right' });

  // Titles (centered)
  const titleY = headerTop + logoH + 10;
  doc.setFont(FONT, 'bold');
  doc.setFontSize(20);
  doc.setTextColor(...PURPLE);
  doc.text('Simulação de Crédito', pageWidth / 2, titleY, { align: 'center' });

  doc.setFont(FONT, 'normal');
  doc.setFontSize(13);
  doc.setTextColor(126, 126, 126); // #7E7E7E
  doc.text(calculatorTitle, pageWidth / 2, titleY + 7, { align: 'center' });

  // Separator
  doc.setDrawColor(...PURPLE);
  doc.setLineWidth(0.4);
  doc.line(margin, titleY + 11, pageWidth - margin, titleY + 11);

  // ── Summary section ──
  let y = titleY + 19;
  doc.setFont(FONT, 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...PURPLE);
  doc.text('Resumo do Financiamento', margin, y);
  y += 7;

  const midX = pageWidth / 2;
  const cardPadding = 3;
  const cardHeight = 14;
  const cardWidth = contentWidth / 2 - 3;

  results.summary.forEach((item, index) => {
    const isLeft = index % 2 === 0;
    const x = isLeft ? margin : midX + 2;

    doc.setFillColor(...LIGHT_BG);
    doc.roundedRect(x, y - 4, cardWidth, cardHeight, 2, 2, 'F');

    doc.setFont(FONT, 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...GRAY);
    doc.text(item.label, x + cardPadding, y);

    doc.setFont(FONT, 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...DARK);
    doc.text(item.value, x + cardPadding, y + 6);

    if (!isLeft || index === results.summary.length - 1) {
      y += cardHeight + 3;
    }
  });

  y += 6;

  // ── Schedule title ──
  doc.setFont(FONT, 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...PURPLE);
  doc.text('Cronograma de Parcelas', margin, y);
  y += 6;

  // ── Amortization table ──
  const tableData = results.amortizationData.map(row => [
    String(row.month),
    row.dueDate || '-',
    row.payment,
    row.interest,
    row.principal,
    row.balance
  ]);

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin, top: barHeight + 6 },
    head: [['Mês', 'Vencimento', 'Parcela', 'Juros', 'Amortização', 'Saldo Devedor']],
    body: tableData,
    theme: 'striped',
    headStyles: {
      fillColor: PURPLE,
      textColor: WHITE,
      fontStyle: 'bold',
      fontSize: 9,
      cellPadding: 4,
      halign: 'center',
      lineWidth: 0,
    },
    bodyStyles: {
      fontSize: 8.5,
      cellPadding: 3.5,
      textColor: DARK,
      lineWidth: 0,
    },
    alternateRowStyles: {
      fillColor: STRIPE_BG,
    },
    styles: {
      font: FONT,
      lineWidth: 0,
      overflow: 'linebreak',
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 14 },
      1: { halign: 'center', cellWidth: 30 },
      2: { halign: 'right' },
      3: { halign: 'right' },
      4: { halign: 'right' },
      5: { halign: 'right' },
    },
    didDrawPage: (data) => {
      const pageHeight = doc.internal.pageSize.getHeight();

      // Solid purple top bar on every page
      doc.setFillColor(...PURPLE);
      doc.rect(0, 0, pageWidth, barHeight, 'F');

      // Footer separator
      doc.setDrawColor(220, 220, 225);
      doc.setLineWidth(0.2);
      doc.line(margin, pageHeight - 20, pageWidth - margin, pageHeight - 20);

      // Legal note
      doc.setFont(FONT, 'normal');
      doc.setFontSize(7);
      doc.setTextColor(160, 160, 165);

      const dataFormatada = now.toLocaleString('pt-BR');
      const notaLegal = `Nota Legal: Esta simulação é apenas um indicativo e não constitui uma oferta vinculante. Os valores e taxas apresentados podem sofrer variações conforme análise de crédito, flutuações do CDI e taxas de mercado vigentes na data da contratação. Gerado em: ${dataFormatada}.`;

      const lines = doc.splitTextToSize(notaLegal, contentWidth);
      doc.text(lines, margin, pageHeight - 16);
    },
  });

  doc.save('simulacao-credito.pdf');
};
