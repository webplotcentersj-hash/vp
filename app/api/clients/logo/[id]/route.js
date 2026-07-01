import { NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET(request, context) {
  try {
    const routeParams = await context.params;
    const clientId = parseInt(routeParams?.id, 10);
    if (!Number.isFinite(clientId) || clientId < 1) {
      return NextResponse.json({ error: "Inválido" }, { status: 400 });
    }

    const [rows] = await pool.execute(
      "SELECT logo_data, logo_mime FROM clients WHERE id = ? LIMIT 1",
      [clientId]
    );
    if (!rows?.length) {
      return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    }

    const row = rows[0];
    const mime = row.logo_mime || "image/png";
    const data = row.logo_data;
    if (!data || !Buffer.isBuffer(data)) {
      return NextResponse.json({ error: "Sin logo" }, { status: 404 });
    }

    return new NextResponse(data, {
      status: 200,
      headers: {
        "Content-Type": mime,
        "Cache-Control": "public, max-age=300, s-maxage=300",
      },
    });
  } catch (e) {
    console.error("client logo GET:", e);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}
