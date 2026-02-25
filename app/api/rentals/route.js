import { NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET() {
  try {
    const [rows] = await pool.execute(`
      SELECT r.id, r.locationId, r.clientId, r.startDate, r.endDate,
             l.address as locationAddress, c.name as clientName
      FROM rentals r
      JOIN locations l ON r.locationId = l.id
      JOIN clients c ON r.clientId = c.id
      ORDER BY r.endDate ASC
    `);
    const rentals = rows.map((r) => ({
      ...r,
      id: Number(r.id),
      locationId: Number(r.locationId),
      clientId: Number(r.clientId),
    }));
    return NextResponse.json(rentals);
  } catch (e) {
    console.error("Rentals GET:", e);
    return NextResponse.json(
      { success: false, message: "Error al obtener alquileres.", error: e.message },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  let conn;
  try {
    const body = await request.json();
    conn = await pool.getConnection();
    await conn.beginTransaction();
    const [ins] = await conn.execute(
      "INSERT INTO rentals (locationId, clientId, startDate, endDate) VALUES (?, ?, ?, ?)",
      [body.locationId, body.clientId, body.startDate, body.endDate]
    );
    await conn.execute("UPDATE locations SET status = 'rented' WHERE id = ?", [body.locationId]);
    await conn.commit();
    return NextResponse.json({
      success: true,
      message: "Alquiler creado con éxito.",
      id: ins.insertId,
    });
  } catch (e) {
    conn?.rollback?.();
    console.error("Rentals POST:", e);
    return NextResponse.json(
      { success: false, message: "Error al crear alquiler.", error: e.message },
      { status: 500 }
    );
  } finally {
    conn?.release?.();
  }
}

export async function PUT(request) {
  let conn;
  try {
    const body = await request.json();
    if (body.action === "end") {
      conn = await pool.getConnection();
      await conn.beginTransaction();
      const [[r]] = await conn.execute("SELECT locationId FROM rentals WHERE id = ?", [body.id]);
      const locationId = r?.locationId;
      await conn.execute("DELETE FROM rentals WHERE id = ?", [body.id]);
      if (locationId) await conn.execute("UPDATE locations SET status = 'available' WHERE id = ?", [locationId]);
      await conn.commit();
      conn.release();
      return NextResponse.json({ success: true, message: "Alquiler finalizado con éxito." });
    }
    await pool.execute(
      "UPDATE rentals SET locationId = ?, clientId = ?, startDate = ?, endDate = ? WHERE id = ?",
      [body.locationId, body.clientId, body.startDate, body.endDate, body.id]
    );
    return NextResponse.json({ success: true, message: "Alquiler actualizado con éxito." });
  } catch (e) {
    conn?.rollback?.();
    conn?.release?.();
    console.error("Rentals PUT:", e);
    return NextResponse.json(
      { success: false, message: "Error al actualizar.", error: e.message },
      { status: 500 }
    );
  }
}
