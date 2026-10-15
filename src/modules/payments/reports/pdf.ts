import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { today } from "../../../lib/finance";
import type { ReceiptReport } from "./data";
export function createReceiptPdf(
  report: ReceiptReport,
  panelName: string,
  filters: string[],
) {
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
    compress: true,
  });
  const width = doc.internal.pageSize.getWidth();
  const margin = 12;
  const usable = width - margin * 2;
  const green: [number, number, number] = [22, 116, 98];
  const ink: [number, number, number] = [30, 53, 49];
  const clean = (value: string) => value.replace(/\u00a0/g, " ");
  const issued = new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date());
  doc.setProperties({
    title: `SafeNota - ${report.title}`,
    subject: panelName,
    creator: "SafeNota",
  });
  function header() {
    doc.setFillColor(...green);
    doc.rect(0, 0, width, 3, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.setTextColor(...green);
    doc.text("SafeNota", margin, 12);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...ink);
    doc.text(`Emitido em ${issued}`, width - margin, 12, { align: "right" });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text(report.title, margin, 23);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(doc.splitTextToSize(panelName, usable).slice(0, 1), margin, 29);
  }
  header();
  report.summaries.forEach((summary, index) => {
    const cardWidth = (usable - 12) / 3;
    const x = margin + index * (cardWidth + 6);
    doc.setFillColor(239, 246, 243);
    doc.roundedRect(x, 35, cardWidth, 20, 2, 2, "F");
    doc.setTextColor(...ink);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(summary.label, x + 4, 42);
    doc.setFontSize(15);
    doc.setFont("helvetica", "bold");
    doc.text(clean(summary.value), x + 4, 51);
  });
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(95, 111, 106);
  const scope = doc
    .splitTextToSize(
      `Filtros: ${filters.length ? filters.join(" · ") : "Todos os registros deste painel"}`,
      usable,
    )
    .slice(0, 3);
  doc.text(scope, margin, 62);
  autoTable(doc, {
    startY: 65 + scope.length * 4,
    margin: { top: 35, left: margin, right: margin, bottom: 17 },
    head: [report.headers],
    body: report.rows.map((row) => row.map(clean)),
    styles: {
      font: "helvetica",
      fontSize: 8,
      cellPadding: 3,
      textColor: ink,
      overflow: "linebreak",
      lineColor: [220, 231, 226],
      lineWidth: 0.1,
    },
    headStyles: { fillColor: green, textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [248, 250, 249] },
    columnStyles:
      report.type === "pending"
        ? {
            0: { cellWidth: 60 },
            1: { cellWidth: 61 },
            2: { cellWidth: 27 },
            3: { cellWidth: 26 },
            4: { cellWidth: 33, halign: "right" },
            5: { cellWidth: 33, halign: "right" },
            6: { cellWidth: 33, halign: "right", fontStyle: "bold" },
          }
        : {
            0: { cellWidth: 25 },
            1: { cellWidth: 45 },
            2: { cellWidth: 85 },
            3: { cellWidth: 58 },
            4: { cellWidth: 25 },
            5: { cellWidth: 35, halign: "right", fontStyle: "bold" },
          },
    rowPageBreak: "avoid",
    didParseCell: (hook) => {
      if (
        hook.section === "body" &&
        report.overdueRows.includes(hook.row.index)
      ) {
        hook.cell.styles.fillColor = [255, 240, 238];
      }
    },
    didDrawPage: () => header(),
  });
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page);
    const y = doc.internal.pageSize.getHeight() - 10;
    doc.setDrawColor(210, 224, 217);
    doc.line(margin, y - 4, width - margin, y - 4);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(95, 111, 106);
    doc.text("SafeNota · Controle de recebimentos", margin, y);
    doc.text(`Página ${page} de ${pages}`, width - margin, y, {
      align: "right",
    });
  }
  return doc;
}
export function downloadReceiptPdf(
  report: ReceiptReport,
  panelName: string,
  filters: string[],
) {
  const panel =
    panelName
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) || "painel";
  createReceiptPdf(report, panelName, filters).save(
    `SafeNota-${report.type === "paid" ? "pagos" : "pendentes"}-${panel}-${today()}.pdf`,
  );
}
