import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { parseClientLogoPayload } from "@/lib/clientLogo";

function mapClientRow(row) {
  const hasLogo = Boolean(row.logo_mime && row.logo_data && Buffer.isBuffer(row.logo_data) && row.logo_data.length > 0);
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    hasLogo,
  };
}

export async function GET() {
  try {
    const [rows] = await pool.execute(
      "SELECT id, name, email, phone, logo_mime, logo_data FROM clients ORDER BY name ASC"
    );
    return NextResponse.json(rows.map(mapClientRow));
  } catch (e) {
    console.error("Clients GET:", e);
    return NextResponse.json(
      { success: false, message: "Error al obtener clientes.", error: e.message },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { name, email, phone } = body;
    const logoPayload = parseClientLogoPayload(body);

    const [result] = await pool.execute(
      "INSERT INTO clients (name, email, phone, logo_mime, logo_data) VALUES (?, ?, ?, ?, ?)",
      [
        name || "",
        email || "",
        phone || "",
        logoPayload && !logoPayload.clear ? logoPayload.mimeType : null,
        logoPayload && !logoPayload.clear ? logoPayload.data : null,
      ]
    );
    return NextResponse.json({
      success: true,
      message: "Cliente creado con éxito.",
      id: result.insertId,
    });
  } catch (e) {
    console.error("Clients POST:", e);
    const message = e.message?.includes("Logo") ? e.message : "Error al crear cliente.";
    return NextResponse.json(
      { success: false, message, error: e.message },
      { status: 500 }
    );
  }
}

export async function PUT(request) {
  try {
    const body = await request.json();
    const { id, name, email, phone } = body;
    const logoPayload = parseClientLogoPayload(body);

    if (logoPayload?.clear) {
      await pool.execute(
        "UPDATE clients SET name = ?, email = ?, phone = ?, logo_mime = NULL, logo_data = NULL WHERE id = ?",
        [name, email, phone, id]
      );
    } else if (logoPayload) {
      await pool.execute(
        "UPDATE clients SET name = ?, email = ?, phone = ?, logo_mime = ?, logo_data = ? WHERE id = ?",
        [name, email, phone, logoPayload.mimeType, logoPayload.data, id]
      );
    } else {
      await pool.execute("UPDATE clients SET name = ?, email = ?, phone = ? WHERE id = ?", [
        name,
        email,
        phone,
        id,
      ]);
    }
    return NextResponse.json({ success: true, message: "Cliente actualizado con éxito." });
  } catch (e) {
    console.error("Clients PUT:", e);
    const message = e.message?.includes("Logo") ? e.message : "Error al actualizar.";
    return NextResponse.json(
      { success: false, message, error: e.message },
      { status: 500 }
    );
  }
}

export async function DELETE(request) {
  let conn;
  try {
    let id = request.nextUrl?.searchParams?.get("id");
    if (id == null) try { const body = await request.json(); id = body.id; } catch (_) {}
    id = Number(id);
    if (!id) {
      return NextResponse.json({ success: false, message: "ID inválido." }, { status: 400 });
    }
    conn = await pool.getConnection();
    await conn.beginTransaction();

    const [locs] = await conn.execute("SELECT locationId FROM rentals WHERE clientId = ?", [id]);
    const locationIds = (locs || []).map((r) => r.locationId ?? r.location_id);

    await conn.execute("DELETE FROM rentals WHERE clientId = ?", [id]);
    if (locationIds.length > 0) {
      const ph = locationIds.map(() => "?").join(",");
      await conn.execute(`UPDATE locations SET status = 'available' WHERE id IN (${ph})`, locationIds);
    }
    const [del] = await conn.execute("DELETE FROM clients WHERE id = ?", [id]);
    await conn.commit();

    if (del.affectedRows > 0) {
      return NextResponse.json({ success: true, message: "Cliente y alquileres eliminados." });
    }
    await conn.rollback();
    return NextResponse.json({ success: false, message: "No se encontró el cliente." });
  } catch (e) {
    conn?.rollback?.();
    console.error("Clients DELETE:", e);
    return NextResponse.json(
      { success: false, message: "Error al eliminar.", error: e.message },
      { status: 500 }
    );
  } finally {
    conn?.release?.();
  }
}
