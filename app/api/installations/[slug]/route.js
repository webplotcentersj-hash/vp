import { NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET(request, context) {
  try {
    const params = await context.params;
    const slug = params?.slug;
    if (!slug || typeof slug !== "string" || slug.length > 40) {
      return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    }

    const [lists] = await pool.execute(
      "SELECT id, title, public_slug FROM installation_lists WHERE public_slug = ? LIMIT 1",
      [slug]
    );
    if (!lists?.length) {
      return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    }
    const list = lists[0];
    const listId = Number(list.id);

    const [items] = await pool.execute(
      `
      SELECT loc.id, loc.address, loc.reference, loc.lat, loc.lng,
        CASE WHEN ic.location_id IS NULL THEN 0 ELSE 1 END AS installed,
        ic.marked_at AS markedAt
      FROM installation_list_locations ill
      INNER JOIN locations loc ON loc.id = ill.location_id
      LEFT JOIN installation_completed ic ON ic.list_id = ill.list_id AND ic.location_id = ill.location_id
      WHERE ill.list_id = ?
      ORDER BY loc.id ASC
      `,
      [listId]
    );

    const locations = (items || []).map((row) => {
      const lat = row.lat != null ? Number(row.lat) : null;
      const lng = row.lng != null ? Number(row.lng) : null;
      return {
        id: Number(row.id),
        address: row.address ?? "",
        reference: row.reference ?? "",
        installed: Number(row.installed) === 1,
        markedAt: row.markedAt ? String(row.markedAt) : null,
        lat: Number.isFinite(lat) ? lat : null,
        lng: Number.isFinite(lng) ? lng : null,
      };
    });

    const installedCount = locations.filter((l) => l.installed).length;

    return NextResponse.json({
      title: list.title ?? "",
      publicSlug: list.public_slug,
      locations,
      total: locations.length,
      installedCount,
    });
  } catch (e) {
    console.error("installations slug GET:", e);
    return NextResponse.json({ error: "Error al cargar." }, { status: 500 });
  }
}

export async function PATCH(request, context) {
  try {
    const params = await context.params;
    const slug = params?.slug;
    if (!slug || typeof slug !== "string" || slug.length > 40) {
      return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    }

    const body = await request.json();
    const locationId = parseInt(body.locationId, 10);
    const installed = body.installed === true;
    if (!Number.isFinite(locationId) || locationId < 1) {
      return NextResponse.json({ error: "locationId inválido" }, { status: 400 });
    }

    const [lists] = await pool.execute(
      "SELECT id FROM installation_lists WHERE public_slug = ? LIMIT 1",
      [slug]
    );
    if (!lists?.length) {
      return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    }
    const listId = Number(lists[0].id);

    const [belongs] = await pool.execute(
      "SELECT 1 FROM installation_list_locations WHERE list_id = ? AND location_id = ? LIMIT 1",
      [listId, locationId]
    );
    if (!belongs?.length) {
      return NextResponse.json({ error: "Ubicación no está en esta lista" }, { status: 400 });
    }

    if (installed) {
      await pool.execute(
        `INSERT INTO installation_completed (list_id, location_id, marked_at)
         VALUES (?, ?, NOW())
         ON DUPLICATE KEY UPDATE marked_at = NOW()`,
        [listId, locationId]
      );
    } else {
      await pool.execute("DELETE FROM installation_completed WHERE list_id = ? AND location_id = ?", [
        listId,
        locationId,
      ]);
    }

    return NextResponse.json({ success: true, locationId, installed });
  } catch (e) {
    console.error("installations slug PATCH:", e);
    return NextResponse.json({ error: e.message || "Error" }, { status: 500 });
  }
}
