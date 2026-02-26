import { NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import pool from "@/lib/db";

// A1 landscape (841 x 594 mm) en puntos: ~2384 x 1684 pt
const PAGE_WIDTH = 2384;
const PAGE_HEIGHT = 1684;
const MARGIN = 80;
const TITLE_SIZE = 48;
const HEADER_SIZE = 22;
const CELL_SIZE = 18;
const ROW_HEIGHT = 44;
const SUBTITLE_SIZE = 14;

function wrapText(font, text, maxWidth, size) {
  const words = String(text || "").split(/\s+/);
  const lines = [];
  let current = "";
  for (const w of words) {
    const test = current ? `${current} ${w}` : w;
    const width = font.widthOfTextAtSize(test, size);
    if (width > maxWidth && current) {
      lines.push(current);
      current = w;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

export async function GET() {
  try {
    const [rows] = await pool.execute(
      "SELECT id, address, reference, measurements, lat, lng, status FROM locations ORDER BY id ASC"
    );
    const locations = rows.map((r) => ({
      id: r.id,
      address: r.address ?? "",
      reference: r.reference ?? "",
      measurements: r.measurements ?? "",
      status: r.status === "available" ? "Disponible" : "Alquilado",
    }));

    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

    const contentWidth = PAGE_WIDTH - MARGIN * 2;
    const colN = 120;
    const colDir = colN + 140;
    const colRef = colDir + Math.min(contentWidth - 140 - 120 - 120, 420);
    const colEstado = PAGE_WIDTH - MARGIN - 140;

    let page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    let y = PAGE_HEIGHT - MARGIN;

    const addPageIfNeeded = () => {
      if (y < MARGIN + ROW_HEIGHT * 2) {
        page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
        y = PAGE_HEIGHT - MARGIN;
        drawRow(page, "N°", "Dirección", "Referencia", "Estado", { bold: true, bg: { r: 0.9, g: 0.45, b: 0.1 } });
        y -= 8;
      }
    };

    const drawRow = (p, n, dir, ref, estado, opts = {}) => {
      const { bold = false, bg = null } = opts;
      const f = bold ? fontBold : font;
      const size = bold ? HEADER_SIZE : CELL_SIZE;
      if (bg) {
        p.drawRectangle({
          x: MARGIN,
          y: y - ROW_HEIGHT + 8,
          width: contentWidth,
          height: ROW_HEIGHT,
          color: rgb(bg.r, bg.g, bg.b),
        });
      }
      p.drawText(String(n), { x: MARGIN + 16, y: y - 24, size, font: f, color: rgb(0, 0, 0) });
      const dirLines = wrapText(f, dir, colRef - colDir - 20, size);
      for (let i = 0; i < dirLines.length && i < 2; i++) {
        p.drawText(dirLines[i], { x: colDir, y: y - 24 - i * (size + 4), size, font: f, color: rgb(0, 0, 0) });
      }
      const refLines = wrapText(f, ref, colEstado - colRef - 20, size);
      for (let i = 0; i < refLines.length && i < 2; i++) {
        p.drawText(refLines[i], { x: colRef, y: y - 24 - i * (size + 4), size, font: f, color: rgb(0, 0, 0) });
      }
      p.drawText(String(estado), { x: colEstado, y: y - 24, size, font: f, color: rgb(0, 0, 0) });
      y -= ROW_HEIGHT;
    };

    // Título solo en primera página
    page.drawText("Ubicaciones - Plot Center", {
      x: MARGIN,
      y,
      size: TITLE_SIZE,
      font: fontBold,
      color: rgb(0.15, 0.15, 0.2),
    });
    y -= TITLE_SIZE + 12;

    page.drawText(
      `Gran formato · ${locations.length} ubicación(es) · ${new Date().toLocaleDateString("es-AR", { dateStyle: "long" })}`,
      {
        x: MARGIN,
        y,
        size: SUBTITLE_SIZE,
        font,
        color: rgb(0.4, 0.4, 0.45),
      }
    );
    y -= SUBTITLE_SIZE + 24;

    drawRow(page, "N°", "Dirección", "Referencia", "Estado", { bold: true, bg: { r: 0.9, g: 0.45, b: 0.1 } });
    y -= 8;

    for (const loc of locations) {
      addPageIfNeeded();
      drawRow(page, loc.id, loc.address || "—", loc.reference || "—", loc.status);
    }

    // Pie en última página
    const lastPage = doc.getPages().slice(-1)[0];
    lastPage.drawText(
      `Documento generado el ${new Date().toLocaleString("es-AR")} · Vía Pública Plot Center`,
      {
        x: MARGIN,
        y: MARGIN + 30,
        size: 11,
        font,
        color: rgb(0.5, 0.5, 0.55),
      }
    );

    const pdfBytes = await doc.save();
    return new NextResponse(pdfBytes, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="ubicaciones-gran-formato-${new Date().toISOString().slice(0, 10)}.pdf"`,
        "Content-Length": String(pdfBytes.length),
      },
    });
  } catch (e) {
    console.error("Export PDF gran formato:", e);
    return NextResponse.json(
      { success: false, message: "Error al generar el PDF.", error: e.message },
      { status: 500 }
    );
  }
}
