import { NextResponse } from "next/server";
import pool from "@/lib/db";

function formatLocation(row) {
  const { lat, lng, ...rest } = row;
  return {
    ...rest,
    id: Number(row.id),
    coordinates: { lat: Number(lat), lng: Number(lng) },
  };
}

export async function GET() {
  try {
    const [rows] = await pool.execute("SELECT * FROM locations ORDER BY id ASC");
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
