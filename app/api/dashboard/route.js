import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { syncRentals } from "@/lib/rentalSync";

export async function GET() {
  let conn;
  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();

    await syncRentals(conn);
    await conn.commit();
    await conn.beginTransaction();

    const data = {};
    const [[{ count: totalLoc }]] = await conn.execute("SELECT COUNT(*) as count FROM locations");
    const [[{ count: totalCli }]] = await conn.execute("SELECT COUNT(*) as count FROM clients");
    data.totalUbicaciones = Number(totalLoc);
    data.totalClientes = Number(totalCli);

    const [[{ count: activeRentals }]] = await conn.execute(
      "SELECT COUNT(DISTINCT locationId) AS count FROM rentals WHERE CURDATE() BETWEEN startDate AND endDate"
    );
    data.chupetesActivos = Number(activeRentals);
    data.totalChupetes = data.totalUbicaciones;

    const [upcomingRows] = await conn.execute(`
      SELECT endDate FROM rentals
      WHERE CURDATE() BETWEEN startDate AND endDate
        AND endDate BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 30 DAY)
    `);
    data.proximosAVencer = upcomingRows.length;

    const [[{ count: rentedCount }]] = await conn.execute(
      "SELECT COUNT(*) AS count FROM locations WHERE status = 'rented'"
    );
    data.chupetesVencidos = Math.max(0, Number(rentedCount) - Number(activeRentals));

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

    await conn.commit();
    return NextResponse.json(data);
  } catch (e) {
    conn?.rollback?.();
    console.error("Dashboard error:", e);
    return NextResponse.json(
      { success: false, message: "Error al obtener el dashboard.", error: e.message },
      { status: 500 }
    );
  } finally {
    conn?.release();
  }
}
