import { NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import pool from "@/lib/db";

const MARGIN = 50;
const LINE_HEIGHT = 16;
const TITLE_SIZE = 18;
const SECTION_TITLE_SIZE = 12;
const BODY_SIZE = 10;
const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

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
    const [rows] = await pool.execute("SELECT id, address, reference, measurements, lat, lng, status FROM locations ORDER BY id ASC");
    const locations = rows.map((r) => ({
      id: r.id,
      address: r.address ?? "",
      reference: r.reference ?? "",
      measurements: r.measurements ?? "",
      lat: r.lat != null ? Number(r.lat) : null,
      lng: r.lng != null ? Number(r.lng) : null,
      status: r.status === "available" ? "Disponible" : "Alquilado",
    }));

    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

    let page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    let y = PAGE_HEIGHT - MARGIN;

    const drawText = (text, opts = {}) => {
      const { size = BODY_SIZE, bold = false, color = rgb(0, 0, 0) } = opts;
      const f = bold ? fontBold : font;
      const lines = wrapText(f, text, CONTENT_WIDTH, size);
      for (const line of lines) {
        if (y < MARGIN + LINE_HEIGHT) {
          page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
          y = PAGE_HEIGHT - MARGIN;
        }
        page.drawText(line, { x: MARGIN, y, size, font: f, color });
        y -= LINE_HEIGHT;
      }
    };

    const drawLine = () => {
      if (y < MARGIN + LINE_HEIGHT) {
        page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
        y = PAGE_HEIGHT - MARGIN;
      }
      y -= 4;
    };

    // Título
    drawText("Informe detallado de ubicaciones", { size: TITLE_SIZE, bold: true });
    drawText(`Generado el ${new Date().toLocaleDateString("es-AR", { dateStyle: "long" })} a las ${new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}`, { size: BODY_SIZE, color: rgb(0.3, 0.3, 0.3) });
    y -= LINE_HEIGHT;
    drawText(`Total: ${locations.length} ubicación(es)`, { size: SECTION_TITLE_SIZE, bold: true });
    drawLine();
    y -= 8;

    for (const loc of locations) {
      if (y < MARGIN + 120) {
        page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
        y = PAGE_HEIGHT - MARGIN;
      }
      drawText(`Chupete N° ${loc.id}`, { size: SECTION_TITLE_SIZE, bold: true, color: rgb(0.2, 0.4, 0.6) });
      y -= 4;
      drawText(`Dirección: ${loc.address}`);
      drawText(`Referencia: ${loc.reference || "—"}`);
      drawText(`Medidas: ${loc.measurements || "—"}`);
      drawText(`Coordenadas: Lat ${loc.lat != null ? loc.lat : "—"}, Lng ${loc.lng != null ? loc.lng : "—"}`);
      if (loc.lat != null && loc.lng != null) {
        drawText(`Ver en mapa: https://www.google.com/maps?q=${loc.lat},${loc.lng}`, { size: 9, color: rgb(0.2, 0.4, 0.8) });
      }
      drawText(`Estado: ${loc.status}`);
      y -= 12;
    }

    const pdfBytes = await doc.save();
    return new NextResponse(pdfBytes, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="ubicaciones-${new Date().toISOString().slice(0, 10)}.pdf"`,
        "Content-Length": String(pdfBytes.length),
      },
    });
  } catch (e) {
    console.error("Export PDF locations:", e);
    return NextResponse.json(
      { success: false, message: "Error al generar el PDF.", error: e.message },
      { status: 500 }
    );
  }
}
