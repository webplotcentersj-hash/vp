import { NextResponse } from "next/server";
import crypto from "crypto";
import pool from "@/lib/db";

function normalizeLocationIds(raw) {
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.map((id) => parseInt(id, 10)).filter((n) => Number.isFinite(n) && n > 0))];
}

export async function GET(request) {
  try {
    const detailId = request.nextUrl?.searchParams?.get("id");
    if (detailId != null && detailId !== "") {
      const numId = parseInt(detailId, 10);
      if (!Number.isFinite(numId) || numId < 1) {
        return NextResponse.json({ success: false, message: "id inválido" }, { status: 400 });
      }
      const [rows] = await pool.execute(
        "SELECT id, public_slug AS publicSlug, title FROM installation_lists WHERE id = ? LIMIT 1",
        [numId]
      );
      if (!rows?.length) {
        return NextResponse.json({ success: false, message: "No encontrada." }, { status: 404 });
      }
      const [locs] = await pool.execute(
        "SELECT location_id FROM installation_list_locations WHERE list_id = ? ORDER BY location_id ASC",
        [numId]
      );
      return NextResponse.json({
        id: numId,
        publicSlug: rows[0].publicSlug,
        title: rows[0].title ?? "",
        locationIds: (locs || []).map((r) => Number(r.location_id)),
      });
    }

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
    const locationIds = normalizeLocationIds(body.locationIds);
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

export async function PUT(request) {
  let conn;
  try {
    const body = await request.json();
    const id = parseInt(body.id ?? request.nextUrl?.searchParams?.get("id"), 10);
    if (!Number.isFinite(id) || id < 1) {
      return NextResponse.json({ success: false, message: "id inválido" }, { status: 400 });
    }

    const hasTitle = typeof body.title === "string";
    const hasLocs = Array.isArray(body.locationIds);
    if (!hasTitle && !hasLocs) {
      return NextResponse.json({ success: false, message: "Indicá al menos título o ubicaciones." }, { status: 400 });
    }

    const [existsRows] = await pool.execute("SELECT id FROM installation_lists WHERE id = ? LIMIT 1", [id]);
    if (!existsRows?.length) {
      return NextResponse.json({ success: false, message: "No encontrada." }, { status: 404 });
    }

    if (hasLocs) {
      const locationIds = normalizeLocationIds(body.locationIds);
      if (locationIds.length === 0) {
        return NextResponse.json({ success: false, message: "Elegí al menos una ubicación." }, { status: 400 });
      }
    }

    conn = await pool.getConnection();
    await conn.beginTransaction();

    if (hasTitle) {
      const t = body.title.trim().slice(0, 255) || "Instalación";
      await conn.execute("UPDATE installation_lists SET title = ? WHERE id = ?", [t, id]);
    }

    if (hasLocs) {
      const locationIds = normalizeLocationIds(body.locationIds);
      await conn.execute("DELETE FROM installation_list_locations WHERE list_id = ?", [id]);
      const placeholders = locationIds.map(() => "(?, ?)").join(", ");
      const values = locationIds.flatMap((lid) => [id, lid]);
      await conn.execute(
        `INSERT IGNORE INTO installation_list_locations (list_id, location_id) VALUES ${placeholders}`,
        values
      );
      const locPh = locationIds.map(() => "?").join(",");
      await conn.execute(
        `DELETE FROM installation_completed WHERE list_id = ? AND location_id NOT IN (${locPh})`,
        [id, ...locationIds]
      );
    }

    await conn.commit();
    conn.release();
    conn = null;
    return NextResponse.json({ success: true });
  } catch (e) {
    if (conn) {
      try {
        await conn.rollback();
      } catch {}
      conn.release();
    }
    console.error("installations PUT:", e);
    return NextResponse.json({ success: false, message: e.message || "Error al actualizar." }, { status: 500 });
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
