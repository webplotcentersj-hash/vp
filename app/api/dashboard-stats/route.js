import { NextResponse } from "next/server";
import pool from "@/lib/db-campaigns";

export async function GET() {
  try {
    const [[campaigns]] = await pool.execute(`
      SELECT COUNT(*) as total_campaigns,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_campaigns,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_campaigns,
        SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) as draft_campaigns
      FROM campaigns
    `);
    const [[metricsFromTable]] = await pool.execute(`
      SELECT SUM(cm.impressions) as total_impressions, SUM(cm.clicks) as m_clicks, SUM(cm.conversions) as m_conversions
      FROM campaign_metrics cm INNER JOIN campaigns c ON cm.campaign_id = c.id
    `);
    const [[realClicksRow]] = await pool.execute("SELECT COUNT(*) as total FROM campaign_link_clicks");
    const [[realConvRow]] = await pool.execute("SELECT COALESCE(SUM(conversions), 0) as total FROM campaign_links");
    const realClicks = Number(realClicksRow?.total ?? 0);
    const realConversions = Number(realConvRow?.total ?? 0);
    const totalImpressions = Number(metricsFromTable?.total_impressions) || 0;
    const metrics = {
      total_impressions: totalImpressions,
      total_clicks: realClicks,
      total_conversions: realConversions,
      global_ctr: totalImpressions > 0 ? (realClicks / totalImpressions) * 100 : 0,
      global_conversion_rate: realClicks > 0 ? (realConversions / realClicks) * 100 : 0,
    };
    const [[links]] = await pool.execute(`
      SELECT COUNT(*) as total_links, SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active_links
      FROM campaign_links
    `);
    const [topCampaigns] = await pool.execute(`
      SELECT c.id, c.name, c.status,
        (SELECT COUNT(*) FROM campaign_link_clicks clc WHERE clc.campaign_id = c.id) as real_clicks,
        (SELECT COALESCE(SUM(conversions), 0) FROM campaign_links cl WHERE cl.campaign_id = c.id) as total_conversions,
        (SELECT COUNT(DISTINCT location_id) FROM campaign_locations cloc WHERE cloc.campaign_id = c.id) as num_locations
      FROM campaigns c
      ORDER BY real_clicks DESC
      LIMIT 10
    `);
    const [trend30] = await pool.execute(`
      SELECT DATE(clc.clicked_at) as date, COUNT(*) as clicks
      FROM campaign_link_clicks clc
      WHERE clc.clicked_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
      GROUP BY DATE(clc.clicked_at) ORDER BY date ASC
    `);
    const [statusDistribution] = await pool.execute(`
      SELECT status, COUNT(*) as count FROM campaigns GROUP BY status
    `);
    const data = {
      campaigns: campaigns || {},
      metrics: metrics || {},
      links: links || {},
      top_campaigns: topCampaigns || [],
      trend_30_days: trend30 || [],
      status_distribution: statusDistribution || [],
    };
    return NextResponse.json({ success: true, data, generated_at: new Date().toISOString() });
  } catch (e) {
    console.error("Dashboard-stats error:", e);
    return NextResponse.json(
      { success: false, message: "Error al obtener estadísticas", error: e.message },
      { status: 500 }
    );
  }
}
