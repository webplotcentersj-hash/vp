import { NextResponse } from "next/server";
import pool from "@/lib/db";

/**
 * GET /api/public-selections?session=xxx
 * Devuelve los IDs de ubicaciones seleccionados para esa sesión.
 */
export async function GET(request) {
  try {
    const sessionId = request.nextUrl?.searchParams?.get("session");
    if (!sessionId || sessionId.length > 64) {
      return NextResponse.json({ selectedIds: [] });
    }
    const [rows] = await pool.execute(
      "SELECT location_id FROM public_location_selections WHERE session_id = ? ORDER BY location_id ASC",
      [sessionId]
    );
    const selectedIds = (rows || []).map((r) => Number(r.location_id)).filter(Number.isFinite);
    return NextResponse.json({ selectedIds });
  } catch (e) {
    console.error("public-selections GET:", e);
    return NextResponse.json(
      { error: "Error al obtener selecciones.", selectedIds: [] },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/public-selections
 * Body: { sessionId: string, selectedIds: number[] }
 * Reemplaza las selecciones de esa sesión por la lista dada.
 */
export async function PUT(request) {
  try {
    const body = await request.json();
    const { sessionId, selectedIds } = body;
    if (!sessionId || typeof sessionId !== "string" || sessionId.length > 64) {
      return NextResponse.json({ error: "sessionId inválido" }, { status: 400 });
    }
    const ids = Array.isArray(selectedIds)
      ? selectedIds.map((id) => parseInt(id, 10)).filter((id) => Number.isFinite(id) && id > 0)
      : [];

    const conn = await pool.getConnection();
    try {
      await conn.execute("DELETE FROM public_location_selections WHERE session_id = ?", [sessionId]);
      if (ids.length > 0) {
        const placeholders = ids.map(() => "(?, ?)").join(", ");
        const values = ids.flatMap((id) => [sessionId, id]);
        await conn.execute(
          `INSERT INTO public_location_selections (session_id, location_id) VALUES ${placeholders}`,
          values
        );
      }
      return NextResponse.json({ success: true, selectedIds: ids });
    } finally {
      conn.release();
    }
  } catch (e) {
    console.error("public-selections PUT:", e);
    return NextResponse.json(
      { error: "Error al guardar selecciones." },
      { status: 500 }
    );
  }
}
