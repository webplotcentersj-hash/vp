import { NextResponse } from "next/server";
import pool from "@/lib/db";

const MAX_PHOTOS_PER_LOCATION = 12;
const MAX_BYTES = 2 * 1024 * 1024;

async function getSlugFromContext(context) {
  const p = await context.params;
  return p?.slug;
}

async function getListBySlug(slug) {
  if (!slug || typeof slug !== "string" || slug.length > 40) return null;
  const [lists] = await pool.execute(
    "SELECT id FROM installation_lists WHERE public_slug = ? LIMIT 1",
    [slug]
  );
  return lists?.length ? Number(lists[0].id) : null;
}

/** GET: metadatos de fotos por ubicación (sin binarios) */
export async function GET(request, context) {
  try {
    const slug = await getSlugFromContext(context);
    const listId = await getListBySlug(slug);
    if (listId == null) {
      return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    }

    const [rows] = await pool.execute(
      `SELECT id, location_id, mime_type, created_at
       FROM installation_audit_photos
       WHERE list_id = ?
       ORDER BY location_id ASC, id ASC`,
      [listId]
    );

    const byLocation = {};
    for (const r of rows || []) {
      const lid = Number(r.location_id);
      if (!byLocation[lid]) byLocation[lid] = [];
      byLocation[lid].push({
        id: Number(r.id),
        mimeType: r.mime_type ?? "image/jpeg",
        createdAt: r.created_at ? String(r.created_at) : null,
      });
    }

    return NextResponse.json({ photosByLocation: byLocation });
  } catch (e) {
    console.error("audit GET:", e);
    return NextResponse.json({ error: "Error al cargar auditoría." }, { status: 500 });
  }
}

/** POST: subir foto { locationId, imageBase64, mimeType? } */
export async function POST(request, context) {
  try {
    const slug = await getSlugFromContext(context);
    const listId = await getListBySlug(slug);
    if (listId == null) {
      return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    }

    const body = await request.json();
    const locationId = parseInt(body.locationId, 10);
    if (!Number.isFinite(locationId) || locationId < 1) {
      return NextResponse.json({ error: "locationId inválido" }, { status: 400 });
    }

    const [belongs] = await pool.execute(
      "SELECT 1 FROM installation_list_locations WHERE list_id = ? AND location_id = ? LIMIT 1",
      [listId, locationId]
    );
    if (!belongs?.length) {
      return NextResponse.json({ error: "Ubicación no está en esta lista" }, { status: 400 });
    }

    const [[countRow]] = await pool.execute(
      "SELECT COUNT(*) AS c FROM installation_audit_photos WHERE list_id = ? AND location_id = ?",
      [listId, locationId]
    );
    const count = Number(countRow?.c) || 0;
    if (count >= MAX_PHOTOS_PER_LOCATION) {
      return NextResponse.json(
        { error: `Máximo ${MAX_PHOTOS_PER_LOCATION} fotos por chupete.` },
        { status: 400 }
      );
    }

    let b64 = typeof body.imageBase64 === "string" ? body.imageBase64.trim() : "";
    if (b64.includes(",")) b64 = b64.split(",").pop();
    if (!b64) {
      return NextResponse.json({ error: "Falta la imagen." }, { status: 400 });
    }

    let buf;
    try {
      buf = Buffer.from(b64, "base64");
    } catch {
      return NextResponse.json({ error: "Imagen inválida." }, { status: 400 });
    }
    if (buf.length > MAX_BYTES) {
      return NextResponse.json({ error: "Imagen demasiado grande (máx. ~2 MB)." }, { status: 400 });
    }
    if (buf.length < 256) {
      return NextResponse.json({ error: "Imagen demasiado chica o corrupta." }, { status: 400 });
    }

    let mimeType = typeof body.mimeType === "string" ? body.mimeType.split(";")[0].trim() : "";
    if (!mimeType || !mimeType.startsWith("image/")) {
      mimeType = "image/jpeg";
    }

    const [result] = await pool.execute(
      "INSERT INTO installation_audit_photos (list_id, location_id, mime_type, data) VALUES (?, ?, ?, ?)",
      [listId, locationId, mimeType, buf]
    );
    const insertId = result?.insertId;
    if (!insertId) {
      return NextResponse.json({ error: "No se pudo guardar." }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      id: Number(insertId),
      locationId,
      mimeType,
    });
  } catch (e) {
    console.error("audit POST:", e);
    const msg = e?.code === "ER_NO_SUCH_TABLE" ? "Ejecutá sql/installation_audit_photos.sql en la base." : e.message;
    return NextResponse.json({ error: msg || "Error al subir." }, { status: 500 });
  }
}

export const maxDuration = 60;
