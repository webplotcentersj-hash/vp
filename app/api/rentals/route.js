import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { findConflictingLocationIds, syncRentals, withRentalSync } from "@/lib/rentalSync";

function mapRentalRow(r) {
  const today = new Date().toISOString().slice(0, 10);
  const endDate = r.endDate ? String(r.endDate).slice(0, 10) : "";
  const startDate = r.startDate ? String(r.startDate).slice(0, 10) : "";
  let rentalStatus = "activo";
  if (endDate && endDate < today) rentalStatus = "vencido";
  else if (startDate && startDate > today) rentalStatus = "futuro";
  return {
    ...r,
    id: Number(r.id),
    locationId: Number(r.locationId),
    clientId: Number(r.clientId),
    startDate,
    endDate,
    rentalStatus,
  };
}

export async function GET(request) {
  let conn;
  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();
    await syncRentals(conn);
    await conn.commit();

    const scope = request.nextUrl?.searchParams?.get("scope") || "active";
    let where = "";
    if (scope === "active") {
      where = "WHERE r.endDate >= CURDATE()";
    } else if (scope === "expired") {
      where = "WHERE r.endDate < CURDATE()";
    }

    const [rows] = await conn.execute(`
      SELECT r.id, r.locationId, r.clientId, r.startDate, r.endDate,
             l.address AS locationAddress, c.name AS clientName
      FROM rentals r
      JOIN locations l ON r.locationId = l.id
      JOIN clients c ON r.clientId = c.id
      ${where}
      ORDER BY r.endDate ASC, r.locationId ASC
    `);

    return NextResponse.json(rows.map(mapRentalRow));
  } catch (e) {
    conn?.rollback?.();
    console.error("Rentals GET:", e);
    return NextResponse.json(
      { success: false, message: "Error al obtener alquileres.", error: e.message },
      { status: 500 }
    );
  } finally {
    conn?.release?.();
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { clientId, startDate, endDate } = body;
    if (!clientId || !startDate || !endDate) {
      return NextResponse.json(
        { success: false, message: "Cliente y fechas son obligatorios." },
        { status: 400 }
      );
    }
    if (endDate < startDate) {
      return NextResponse.json(
        { success: false, message: "La fecha de fin debe ser posterior o igual a la de inicio." },
        { status: 400 }
      );
    }

    const locationIds = Array.isArray(body.locationIds)
      ? [...new Set(body.locationIds.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0))]
      : body.locationId != null
        ? [Number(body.locationId)]
        : [];

    if (locationIds.length === 0) {
      return NextResponse.json(
        { success: false, message: "Seleccioná al menos una ubicación." },
        { status: 400 }
      );
    }

    const result = await withRentalSync(pool, async (conn) => {
      const ph = locationIds.map(() => "?").join(",");
      const [locRows] = await conn.execute(
        `SELECT id FROM locations WHERE id IN (${ph})`,
        locationIds
      );
      if ((locRows || []).length !== locationIds.length) {
        return { error: "Una o más ubicaciones no existen.", status: 400 };
      }

      const conflicts = await findConflictingLocationIds(conn, locationIds, startDate, endDate);
      if (conflicts.length > 0) {
        return {
          error: `Ya hay alquileres que se superponen en: N° ${conflicts.join(", N° ")}`,
          status: 409,
        };
      }

      const createdIds = [];
      for (const locationId of locationIds) {
        const [ins] = await conn.execute(
          "INSERT INTO rentals (locationId, clientId, startDate, endDate) VALUES (?, ?, ?, ?)",
          [locationId, clientId, startDate, endDate]
        );
        createdIds.push(ins.insertId);
      }

      await syncRentals(conn);

      return { createdIds };
    });

    if (result.error) {
      return NextResponse.json({ success: false, message: result.error }, { status: result.status || 400 });
    }

    const count = result.createdIds.length;
    return NextResponse.json({
      success: true,
      message: count === 1 ? "Alquiler creado con éxito." : `${count} alquileres creados con éxito.`,
      id: result.createdIds[0],
      ids: result.createdIds,
    });
  } catch (e) {
    console.error("Rentals POST:", e);
    return NextResponse.json(
      { success: false, message: "Error al crear alquiler.", error: e.message },
      { status: 500 }
    );
  }
}

export async function PUT(request) {
  try {
    const body = await request.json();

    if (body.action === "end") {
      await withRentalSync(pool, async (conn) => {
        const [[r]] = await conn.execute("SELECT locationId FROM rentals WHERE id = ?", [body.id]);
        if (!r) throw new Error("Alquiler no encontrado.");
        await conn.execute("DELETE FROM rentals WHERE id = ?", [body.id]);
        await syncRentals(conn);
      });
      return NextResponse.json({ success: true, message: "Alquiler finalizado con éxito." });
    }

    const { id, locationId, clientId, startDate, endDate } = body;
    if (!id || !locationId || !clientId || !startDate || !endDate) {
      return NextResponse.json(
        { success: false, message: "Faltan datos para actualizar el alquiler." },
        { status: 400 }
      );
    }
    if (endDate < startDate) {
      return NextResponse.json(
        { success: false, message: "La fecha de fin debe ser posterior o igual a la de inicio." },
        { status: 400 }
      );
    }

    await withRentalSync(pool, async (conn) => {
      const conflicts = await findConflictingLocationIds(
        conn,
        [Number(locationId)],
        startDate,
        endDate,
        Number(id)
      );
      if (conflicts.length > 0) {
        throw Object.assign(new Error("Ya existe otro alquiler en esas fechas para esta ubicación."), {
          status: 409,
        });
      }
      await conn.execute(
        "UPDATE rentals SET locationId = ?, clientId = ?, startDate = ?, endDate = ? WHERE id = ?",
        [locationId, clientId, startDate, endDate, id]
      );
      await syncRentals(conn);
    });

    return NextResponse.json({ success: true, message: "Alquiler actualizado con éxito." });
  } catch (e) {
    console.error("Rentals PUT:", e);
    return NextResponse.json(
      { success: false, message: e.message || "Error al actualizar.", error: e.message },
      { status: e.status || 500 }
    );
  }
}
