import { NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET() {
  try {
    const [rows] = await pool.execute("SELECT * FROM clients ORDER BY name ASC");
    return NextResponse.json(rows);
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
    const { name, email, phone } = await request.json();
    const [result] = await pool.execute(
      "INSERT INTO clients (name, email, phone) VALUES (?, ?, ?)",
      [name || "", email || "", phone || ""]
    );
    return NextResponse.json({
      success: true,
      message: "Cliente creado con éxito.",
      id: result.insertId,
    });
  } catch (e) {
    console.error("Clients POST:", e);
    return NextResponse.json(
      { success: false, message: "Error al crear cliente.", error: e.message },
      { status: 500 }
    );
  }
}

export async function PUT(request) {
  try {
    const { id, name, email, phone } = await request.json();
    await pool.execute("UPDATE clients SET name = ?, email = ?, phone = ? WHERE id = ?", [
      name,
      email,
      phone,
      id,
    ]);
    return NextResponse.json({ success: true, message: "Cliente actualizado con éxito." });
  } catch (e) {
    console.error("Clients PUT:", e);
    return NextResponse.json(
      { success: false, message: "Error al actualizar.", error: e.message },
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
