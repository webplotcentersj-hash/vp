import { NextResponse } from "next/server";
import pool from "@/lib/db";

/**
 * GET /api/public-selections?session=xxx
 * Devuelve: selectedIds (de esa sesión) y countsByLocation (cuántas personas marcaron cada ubicación).
 */
export async function GET(request) {
  try {
    const sessionId = request.nextUrl?.searchParams?.get("session");
    let selectedIds = [];
    if (sessionId && sessionId.length <= 64) {
      const [rows] = await pool.execute(
        "SELECT location_id FROM public_location_selections WHERE session_id = ? ORDER BY location_id ASC",
        [sessionId]
      );
      selectedIds = (rows || []).map((r) => Number(r.location_id)).filter(Number.isFinite);
    }

    const [countRows] = await pool.execute(
      "SELECT location_id, COUNT(DISTINCT session_id) AS total FROM public_location_selections GROUP BY location_id"
    );
    const countsByLocation = {};
    (countRows || []).forEach((r) => {
      const id = Number(r.location_id);
      if (Number.isFinite(id)) countsByLocation[id] = Number(r.total) || 0;
    });

    const totalPeople = await pool.execute(
      "SELECT COUNT(DISTINCT session_id) AS n FROM public_location_selections"
    ).then(([[r]]) => Number(r?.n) || 0);

    return NextResponse.json({
      selectedIds,
      countsByLocation,
      totalSessionsWithSelections: totalPeople,
    });
  } catch (e) {
    console.error("public-selections GET:", e);
    return NextResponse.json(
      { error: "Error al obtener selecciones.", selectedIds: [], countsByLocation: {}, totalSessionsWithSelections: 0 },
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
