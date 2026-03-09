import jsPDF from "jspdf";

// ---- PDF Export ----
export function exportTableToPDF(
  title: string,
  headers: string[],
  rows: string[][],
  filename: string
) {
  const doc = new jsPDF({ orientation: "landscape" });
  const pageWidth = doc.internal.pageSize.getWidth();
  
  // Title
  doc.setFontSize(16);
  doc.text(title, 14, 20);
  doc.setFontSize(8);
  doc.text(`Exporté le ${new Date().toLocaleDateString("fr-FR")} à ${new Date().toLocaleTimeString("fr-FR")}`, 14, 28);

  // Table
  const colWidth = (pageWidth - 28) / headers.length;
  let y = 36;
  
  // Header row
  doc.setFillColor(30, 64, 175);
  doc.rect(14, y, pageWidth - 28, 8, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  headers.forEach((h, i) => {
    doc.text(h, 16 + i * colWidth, y + 5.5, { maxWidth: colWidth - 4 });
  });
  y += 10;

  // Data rows
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(7);
  rows.forEach((row, ri) => {
    if (y > doc.internal.pageSize.getHeight() - 15) {
      doc.addPage();
      y = 20;
    }
    if (ri % 2 === 0) {
      doc.setFillColor(245, 245, 250);
      doc.rect(14, y - 1, pageWidth - 28, 7, "F");
    }
    row.forEach((cell, ci) => {
      doc.text(String(cell ?? "—"), 16 + ci * colWidth, y + 4, { maxWidth: colWidth - 4 });
    });
    y += 7;
  });

  doc.save(filename);
}

// ---- CSV/Excel Export ----
export function exportTableToCSV(
  headers: string[],
  rows: string[][],
  filename: string
) {
  const BOM = "\uFEFF"; // UTF-8 BOM for Excel compatibility
  const csvContent = BOM + [
    headers.join(";"),
    ...rows.map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(";"))
  ].join("\n");
  
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
