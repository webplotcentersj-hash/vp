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
    const [[metrics]] = await pool.execute(`
      SELECT SUM(cm.impressions) as total_impressions, SUM(cm.clicks) as total_clicks,
        SUM(cm.conversions) as total_conversions,
        CASE WHEN SUM(cm.impressions) > 0 THEN (SUM(cm.clicks) / SUM(cm.impressions)) * 100 ELSE 0 END as global_ctr,
        CASE WHEN SUM(cm.clicks) > 0 THEN (SUM(cm.conversions) / SUM(cm.clicks)) * 100 ELSE 0 END as global_conversion_rate
      FROM campaign_metrics cm INNER JOIN campaigns c ON cm.campaign_id = c.id
    `);
    const [[links]] = await pool.execute(`
      SELECT COUNT(*) as total_links, SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active_links
      FROM campaign_links
    `);
    const [topCampaigns] = await pool.execute(`
      SELECT c.id, c.name, c.status, SUM(cm.conversions) as total_conversions, COUNT(DISTINCT cl.id) as num_locations
      FROM campaigns c
      LEFT JOIN campaign_metrics cm ON c.id = cm.campaign_id
      LEFT JOIN campaign_locations cl ON c.id = cl.campaign_id
      GROUP BY c.id ORDER BY total_conversions DESC LIMIT 5
    `);
    const [trend30] = await pool.execute(`
      SELECT DATE(cm.date) as date, SUM(cm.impressions) as impressions, SUM(cm.clicks) as clicks, SUM(cm.conversions) as conversions
      FROM campaign_metrics cm
      WHERE cm.date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
      GROUP BY DATE(cm.date) ORDER BY date ASC
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
