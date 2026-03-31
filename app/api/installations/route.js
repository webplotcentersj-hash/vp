import { NextResponse } from "next/server";
import crypto from "crypto";
import pool from "@/lib/db";

export async function GET() {
  try {
    const [rows] = await pool.execute(`
      SELECT l.id, l.public_slug AS publicSlug, l.title, l.created_at AS createdAt,
        (SELECT COUNT(*) FROM installation_list_locations ill WHERE ill.list_id = l.id) AS totalLocations,
        (SELECT COUNT(*) FROM installation_completed ic WHERE ic.list_id = l.id) AS installedCount
      FROM installation_lists l
      ORDER BY l.created_at DESC
    `);
    return NextResponse.json(
      (rows || []).map((r) => ({
        id: Number(r.id),
        publicSlug: r.publicSlug,
        title: r.title ?? "",
        createdAt: r.createdAt,
        totalLocations: Number(r.totalLocations) || 0,
        installedCount: Number(r.installedCount) || 0,
      }))
    );
  } catch (e) {
    console.error("installations GET:", e);
    return NextResponse.json(
      { success: false, message: e.message || "Error al listar instalaciones." },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const title = typeof body.title === "string" ? body.title.trim().slice(0, 255) : "";
    const locationIds = Array.isArray(body.locationIds)
      ? [...new Set(body.locationIds.map((id) => parseInt(id, 10)).filter((n) => Number.isFinite(n) && n > 0))]
      : [];
    if (locationIds.length === 0) {
      return NextResponse.json({ success: false, message: "Elegí al menos una ubicación." }, { status: 400 });
    }

    const publicSlug = crypto.randomBytes(16).toString("hex");
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [ins] = await conn.execute(
        "INSERT INTO installation_lists (public_slug, title) VALUES (?, ?)",
        [publicSlug, title || "Instalación"]
      );
      const listId = ins.insertId;
      if (!listId) throw new Error("No se pudo crear la lista.");

      const placeholders = locationIds.map(() => "(?, ?)").join(", ");
      const values = locationIds.flatMap((lid) => [listId, lid]);
      await conn.execute(
        `INSERT IGNORE INTO installation_list_locations (list_id, location_id) VALUES ${placeholders}`,
        values
      );
      await conn.commit();
      return NextResponse.json({ success: true, id: listId, publicSlug });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  } catch (e) {
    console.error("installations POST:", e);
    return NextResponse.json(
      { success: false, message: e.message || "Error al crear lista." },
      { status: 500 }
    );
  }
}

export async function DELETE(request) {
  try {
    const id = request.nextUrl?.searchParams?.get("id");
    const numId = parseInt(id, 10);
    if (!Number.isFinite(numId) || numId < 1) {
      return NextResponse.json({ success: false, message: "id inválido" }, { status: 400 });
    }
    const [r] = await pool.execute("DELETE FROM installation_lists WHERE id = ?", [numId]);
    if (r.affectedRows < 1) {
      return NextResponse.json({ success: false, message: "No encontrada." }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("installations DELETE:", e);
    return NextResponse.json({ success: false, message: e.message }, { status: 500 });
  }
}
