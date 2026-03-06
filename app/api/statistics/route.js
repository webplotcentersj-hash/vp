import { NextResponse } from "next/server";
import poolCampaigns from "@/lib/db-campaigns";
import poolMain from "@/lib/db";

/**
 * GET /api/statistics
 * Estadísticas unificadas: campañas activas + ubicaciones + clicks por ubicación.
 */
export async function GET() {
  try {
    const [campaignsData, locationsData] = await Promise.allSettled([
      getCampaignsStats(),
      getLocationsStats(),
    ]);

    const campaigns = campaignsData.status === "fulfilled" ? campaignsData.value : null;
    const locations = locationsData.status === "fulfilled" ? locationsData.value : null;

    if (!campaigns && !locations) {
      const err = campaignsData.reason || locationsData.reason;
      return NextResponse.json(
        { success: false, message: "Error al obtener estadísticas.", error: err?.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      campaigns: campaigns || {},
      locations: locations || { total: 0, available: 0, by_status: [] },
      generated_at: new Date().toISOString(),
    });
  } catch (e) {
    console.error("Statistics error:", e);
    return NextResponse.json(
      { success: false, message: "Error al obtener estadísticas.", error: e.message },
      { status: 500 }
    );
  }
}

async function getCampaignsStats() {
  const pool = poolCampaigns;
  const [[campaigns]] = await pool.execute(`
    SELECT COUNT(*) as total_campaigns,
      SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_campaigns,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_campaigns,
      SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) as draft_campaigns
    FROM campaigns
  `);
  const [[realClicksRow]] = await pool.execute("SELECT COUNT(*) as total FROM campaign_link_clicks");
  const [[realConvRow]] = await pool.execute("SELECT COALESCE(SUM(conversions), 0) as total FROM campaign_links");
  const realClicks = Number(realClicksRow?.total ?? 0);
  const realConversions = Number(realConvRow?.total ?? 0);
  const [topCampaigns] = await pool.execute(`
    SELECT c.id, c.name, c.status,
      (SELECT COUNT(*) FROM campaign_link_clicks clc WHERE clc.campaign_id = c.id) as real_clicks,
      (SELECT COALESCE(SUM(conversions), 0) FROM campaign_links cl WHERE cl.campaign_id = c.id) as total_conversions,
      (SELECT COUNT(DISTINCT location_id) FROM campaign_locations cloc WHERE cloc.campaign_id = c.id) as num_locations
    FROM campaigns c
    ORDER BY real_clicks DESC
  `);
  const [trend30] = await pool.execute(`
    SELECT DATE(clc.clicked_at) as date, COUNT(*) as clicks
    FROM campaign_link_clicks clc
    WHERE clc.clicked_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
    GROUP BY DATE(clc.clicked_at) ORDER BY date ASC
  `);
  let trendByHour = [];
  try {
    const [rowsByHour] = await pool.execute(`
      SELECT DATE_FORMAT(clc.clicked_at, '%Y-%m-%d %H:00') as hour_bucket, COUNT(*) as clicks
      FROM campaign_link_clicks clc
      WHERE clc.clicked_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
      GROUP BY hour_bucket ORDER BY hour_bucket ASC
    `);
    const now = new Date();
    const slots = [];
    for (let i = 23; i >= 0; i--) {
      const t = new Date(now);
      t.setHours(t.getHours() - i, 0, 0, 0);
      const key = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")} ${String(t.getHours()).padStart(2, "0")}:00`;
      slots.push({ hour_label: `${String(t.getHours()).padStart(2, "0")}:${String(t.getMinutes()).padStart(2, "0")}`, hour_key: key, clicks: 0 });
    }
    const byKey = {};
    (rowsByHour || []).forEach((r) => {
      byKey[r.hour_bucket] = Number(r.clicks ?? 0);
    });
    trendByHour = slots.map((s) => ({ ...s, clicks: byKey[s.hour_key] ?? 0 }));
  } catch (_) {}

  const [statusDistribution] = await pool.execute(`
    SELECT status, COUNT(*) as count FROM campaigns GROUP BY status
  `);
  let topLocationsByClicks = [];
  try {
    const [rows] = await pool.execute(`
      SELECT cl.location_id, COUNT(*) as clicks
      FROM campaign_link_clicks clc
      JOIN campaign_links cl ON cl.id = clc.link_id
      WHERE cl.location_id IS NOT NULL
      GROUP BY cl.location_id
      ORDER BY clicks DESC
      LIMIT 50
    `);
    const raw = rows || [];
    if (raw.length > 0) {
      const ids = raw.map((r) => r.location_id).filter(Boolean);
      let details = [];
      try {
        const placeholders = ids.map(() => "?").join(",");
        const [locRows] = await poolMain.execute(
          `SELECT id, address, lat, lng FROM locations WHERE id IN (${placeholders})`,
          ids
        );
        const byId = {};
        (locRows || []).forEach((r) => {
          const lat = r.lat != null ? Number(r.lat) : null;
          const lng = r.lng != null ? Number(r.lng) : null;
          if (Number.isFinite(lat) && Number.isFinite(lng)) {
            byId[r.id] = { address: r.address || "", lat, lng };
          }
        });
        topLocationsByClicks = raw.map((r) => ({
          location_id: r.location_id,
          clicks: Number(r.clicks ?? 0),
          address: byId[r.location_id]?.address,
          lat: byId[r.location_id]?.lat,
          lng: byId[r.location_id]?.lng,
        })).filter((x) => x.lat != null && x.lng != null);
      } catch (_) {
        topLocationsByClicks = raw.map((r) => ({ location_id: r.location_id, clicks: Number(r.clicks ?? 0) }));
      }
    }
  } catch (_) {}

  const [[links]] = await pool.execute(`
    SELECT COUNT(*) as total_links, SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active_links
    FROM campaign_links
  `);

  return {
    campaigns: campaigns || {},
    metrics: {
      total_clicks: realClicks,
      total_conversions: realConversions,
      global_conversion_rate: realClicks > 0 ? Math.round((realConversions / realClicks) * 10000) / 100 : 0,
    },
    links: links || {},
    top_campaigns: topCampaigns || [],
    trend_30_days: trend30 || [],
    trend_by_hour: trendByHour,
    status_distribution: statusDistribution || [],
    top_locations_by_clicks: topLocationsByClicks,
  };
}

async function getLocationsStats() {
  try {
    const [rows] = await poolMain.execute(
      "SELECT status, COUNT(*) as count FROM locations GROUP BY status"
    );
    const by_status = rows || [];
    const total = by_status.reduce((s, r) => s + Number(r.count || 0), 0);
    const available = by_status.find((r) => r.status === "available")?.count ?? 0;
    const rented = by_status.find((r) => r.status === "rented")?.count ?? 0;
    const occupancy = total > 0 ? Math.round((Number(rented) / total) * 10000) / 100 : 0;
    return { total, available: Number(available), rented: Number(rented), by_status, occupancy_rate: occupancy };
  } catch (e) {
    console.error("Locations stats:", e);
    return { total: 0, available: 0, rented: 0, by_status: [], occupancy_rate: 0 };
  }
}
