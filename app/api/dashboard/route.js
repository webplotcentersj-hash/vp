import { NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET() {
  let conn;
  try {
    conn = await pool.getConnection();
    const today = new Date().toISOString().slice(0, 10);
    const thirtyDays = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    // Mantenimiento: ubicaciones con alquileres vencidos -> available, borrar rentals vencidos
    const [expired] = await conn.execute("SELECT locationId FROM rentals WHERE endDate < CURDATE()");
    if (expired.length > 0) {
      const ids = expired.map((r) => r.locationId);
      const placeholders = ids.map(() => "?").join(",");
      await conn.execute(`UPDATE locations SET status = 'available' WHERE id IN (${placeholders})`, ids);
      await conn.execute("DELETE FROM rentals WHERE endDate < CURDATE()");
    }

    const data = {};
    const [[{ count: totalLoc }]] = await conn.execute("SELECT COUNT(*) as count FROM locations");
    const [[{ count: totalCli }]] = await conn.execute("SELECT COUNT(*) as count FROM clients");
    data.totalUbicaciones = Number(totalLoc);
    data.totalClientes = Number(totalCli);

    const [rentals] = await conn.execute("SELECT endDate FROM rentals");
    let active = 0,
      upcoming = 0;
    for (const r of rentals) {
      if (r.endDate >= today) {
        active++;
        if (r.endDate <= thirtyDays) upcoming++;
      }
    }
    data.chupetesActivos = active;
    data.proximosAVencer = upcoming;
    data.totalChupetes = data.totalUbicaciones;
    const [[{ count: rentedCount }]] = await conn.execute(
      "SELECT COUNT(*) as count FROM locations WHERE status = 'rented'"
    );
    data.chupetesVencidos = Math.max(0, Number(rentedCount) - active);

    const [vencimientosProximos] = await conn.execute(`
      SELECT c.name as clientName, l.address as locationAddress, r.endDate, 'Por Vencer' as status
      FROM rentals r
      JOIN clients c ON r.clientId = c.id
      JOIN locations l ON r.locationId = l.id
      WHERE r.endDate BETWEEN CURDATE() AND CURDATE() + INTERVAL 30 DAY
      ORDER BY r.endDate ASC
    `);
    data.vencimientosProximos = vencimientosProximos;

    const [visualizador] = await conn.execute(`
      SELECT c.name as clientName, l.address as locationAddress, r.endDate,
             DATEDIFF(r.endDate, CURDATE()) as days_diff
      FROM rentals r
      JOIN clients c ON r.clientId = c.id
      JOIN locations l ON r.locationId = l.id
      WHERE r.endDate >= CURDATE() AND r.endDate <= CURDATE() + INTERVAL 30 DAY
      ORDER BY days_diff ASC
      LIMIT 5
    `);
    data.visualizadorVencimientos = visualizador;

    return NextResponse.json(data);
  } catch (e) {
    console.error("Dashboard error:", e);
    return NextResponse.json(
      { success: false, message: "Error al obtener el dashboard.", error: e.message },
      { status: 500 }
    );
  } finally {
    conn?.release();
  }
}
