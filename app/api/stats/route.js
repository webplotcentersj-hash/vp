import { NextResponse } from "next/server";
import { query } from "@/lib/db";

const PRICE_PER_RENTAL = 5000;

export async function GET() {
  try {
    const [[{ count: totalLoc }]] = await query(
      "SELECT COUNT(*) as count FROM locations"
    );
    const [[{ count: activeRentals }]] = await query(
      "SELECT COUNT(DISTINCT locationId) as count FROM rentals WHERE CURDATE() BETWEEN startDate AND endDate"
    );
    const total_locations = Number(totalLoc);
    const occupancy_rate =
      total_locations > 0
        ? Math.round((activeRentals / total_locations) * 10000) / 100
        : 0;

    const monthly_revenue_rows = await query(`
      SELECT DATE_FORMAT(startDate, '%Y-%m') as month, COUNT(*) as rental_count
      FROM rentals
      WHERE startDate >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
      GROUP BY month
      ORDER BY month ASC
    `);
    const monthly_revenue = monthly_revenue_rows.map((r) => ({
      month: r.month,
      revenue: Number(r.rental_count) * PRICE_PER_RENTAL,
    }));

    const topClientRows = await query(`
      SELECT c.name, COUNT(r.id) as rental_count
      FROM rentals r
      JOIN clients c ON r.clientId = c.id
      GROUP BY r.clientId
      ORDER BY rental_count DESC
      LIMIT 1
    `);
    const top_client = topClientRows[0]
      ? { name: topClientRows[0].name, rental_count: Number(topClientRows[0].rental_count) }
      : { name: "N/A", rental_count: 0 };

    return NextResponse.json({
      occupancy_rate,
      locations_status: {
        rented: Number(activeRentals),
        available: total_locations - Number(activeRentals),
      },
      monthly_revenue,
      top_client,
    });
  } catch (e) {
    console.error("Stats error:", e);
    return NextResponse.json(
      { success: false, message: "Error en estadísticas.", error: e.message },
      { status: 500 }
    );
  }
}
