import { NextResponse } from "next/server";
import pool from "@/lib/db";

function formatLocation(row) {
  const lat = row.lat != null ? Number(row.lat) : null;
  const lng = row.lng != null ? Number(row.lng) : null;
  const rentedBy = row.current_client_name ? String(row.current_client_name).trim() : null;
  const rentedUntilRaw = row.rental_until_display;
  const rentedUntil =
    rentedUntilRaw != null && String(rentedUntilRaw).trim() ? String(rentedUntilRaw).trim() : undefined;
  const clientId = row.current_client_id != null ? Number(row.current_client_id) : null;
  const hasClientLogo = Number(row.current_client_has_logo) === 1;
  return {
    id: Number(row.id),
    address: row.address ?? "",
    reference: row.reference ?? "",
    measurements: row.measurements ?? "",
    status: row.status ?? "available",
    rentedBy: rentedBy || undefined,
    rentedUntil: rentedUntil || undefined,
    rentedByLogo:
      clientId && hasClientLogo ? `/api/clients/logo/${clientId}` : undefined,
    lat,
    lng,
    coordinates: lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : undefined,
  };
}

export async function GET() {
  try {
    const [rows] = await pool.execute(`
      SELECT l.id, l.address, l.reference, l.measurements, l.lat, l.lng, l.status,
        (
          SELECT c.name
          FROM rentals r
          INNER JOIN clients c ON r.clientId = c.id
          WHERE r.locationId = l.id AND CURDATE() BETWEEN r.startDate AND r.endDate
          ORDER BY r.endDate DESC
          LIMIT 1
        ) AS current_client_name,
        (
          SELECT c.id
          FROM rentals r
          INNER JOIN clients c ON r.clientId = c.id
          WHERE r.locationId = l.id AND CURDATE() BETWEEN r.startDate AND r.endDate
          ORDER BY r.endDate DESC
          LIMIT 1
        ) AS current_client_id,
        (
          SELECT IF(c.logo_mime IS NOT NULL AND c.logo_data IS NOT NULL AND LENGTH(c.logo_data) > 0, 1, 0)
          FROM rentals r
          INNER JOIN clients c ON r.clientId = c.id
          WHERE r.locationId = l.id AND CURDATE() BETWEEN r.startDate AND r.endDate
          ORDER BY r.endDate DESC
          LIMIT 1
        ) AS current_client_has_logo,
        (
          SELECT DATE_FORMAT(r.endDate, '%d/%m/%Y')
          FROM rentals r
          WHERE r.locationId = l.id AND CURDATE() BETWEEN r.startDate AND r.endDate
          ORDER BY r.endDate DESC
          LIMIT 1
        ) AS rental_until_display
      FROM locations l
      ORDER BY l.id ASC
    `);
    return NextResponse.json(rows.map(formatLocation));
  } catch (e) {
    console.error("Locations GET:", e);
    return NextResponse.json(
      { success: false, message: "Error al obtener ubicaciones.", error: e.message },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { address, reference, measurements, lat, lng } = body;
    const [result] = await pool.execute(
      "INSERT INTO locations (address, reference, measurements, lat, lng, status) VALUES (?, ?, ?, ?, ?, 'available')",
      [address || "", reference || "", measurements || "", lat, lng]
    );
    return NextResponse.json({
      success: true,
      message: "Ubicación creada con éxito.",
      id: result.insertId,
    });
  } catch (e) {
    console.error("Locations POST:", e);
    return NextResponse.json(
      { success: false, message: "Error al crear ubicación.", error: e.message },
      { status: 500 }
    );
  }
}

export async function PUT(request) {
  try {
    const body = await request.json();
    const { id, address, reference, measurements, lat, lng } = body;
    await pool.execute(
      "UPDATE locations SET address = ?, reference = ?, measurements = ?, lat = ?, lng = ? WHERE id = ?",
      [address, reference, measurements, lat, lng, id]
    );
    return NextResponse.json({ success: true, message: "Ubicación actualizada con éxito." });
  } catch (e) {
    console.error("Locations PUT:", e);
    return NextResponse.json(
      { success: false, message: "Error al actualizar.", error: e.message },
      { status: 500 }
    );
  }
}

export async function DELETE(request) {
  try {
    let id = request.nextUrl?.searchParams?.get("id");
    if (!id) try { const body = await request.json(); id = body.id; } catch (_) {}
    const [result] = await pool.execute("DELETE FROM locations WHERE id = ?", [id]);
    if (result.affectedRows > 0) {
      return NextResponse.json({ success: true, message: "Ubicación eliminada con éxito." });
    }
    return NextResponse.json({ success: false, message: "No se encontró la ubicación." });
  } catch (e) {
    console.error("Locations DELETE:", e);
    return NextResponse.json(
      { success: false, message: "Error al eliminar.", error: e.message },
      { status: 500 }
    );
  }
}
