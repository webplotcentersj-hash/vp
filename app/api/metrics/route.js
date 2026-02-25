import { NextResponse } from "next/server";
import pool from "@/lib/db-campaigns";

export async function GET(request) {
  try {
    const campaignId = request.nextUrl.searchParams.get("campaign_id");
    if (!campaignId) {
      const [rows] = await pool.execute(`
        SELECT c.id, c.name, c.status,
          SUM(cm.impressions) as impressions,
          SUM(cm.clicks) as clicks,
          SUM(cm.conversions) as conversions,
          AVG(cm.engagement_rate) as engagement
        FROM campaigns c
        LEFT JOIN campaign_metrics cm ON c.id = cm.campaign_id
        GROUP BY c.id
        ORDER BY c.created_at DESC
      `);
      return NextResponse.json(rows);
    }
    const [totalsRows] = await pool.execute(
      `SELECT SUM(impressions) as total_impressions, SUM(clicks) as total_clicks, SUM(conversions) as total_conversions,
        SUM(reach) as total_reach, AVG(engagement_rate) as avg_engagement,
        CASE WHEN SUM(impressions) > 0 THEN (SUM(clicks) / SUM(impressions)) * 100 ELSE 0 END as ctr,
        CASE WHEN SUM(clicks) > 0 THEN (SUM(conversions) / SUM(clicks)) * 100 ELSE 0 END as conversion_rate
       FROM campaign_metrics WHERE campaign_id = ?`,
      [campaignId]
    );
    const [daily] = await pool.execute(
      "SELECT date, impressions, clicks, conversions, reach, engagement_rate, notes FROM campaign_metrics WHERE campaign_id = ? ORDER BY date DESC LIMIT 30",
      [campaignId]
    );
    const [events] = await pool.execute(
      `SELECT event_type, COUNT(*) as count, DATE(created_at) as date FROM campaign_events 
       WHERE campaign_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
       GROUP BY event_type, DATE(created_at) ORDER BY date DESC`,
      [campaignId]
    );
    const [links] = await pool.execute(
      `SELECT cl.id, cl.name, cl.url, cl.clicks, cl.conversions,
        COUNT(DISTINCT clc.id) as total_clicks_detailed,
        COUNT(DISTINCT DATE(clc.clicked_at)) as active_days,
        CASE WHEN cl.clicks > 0 THEN (cl.conversions / cl.clicks) * 100 ELSE 0 END as conversion_rate
       FROM campaign_links cl
       LEFT JOIN campaign_link_clicks clc ON cl.id = clc.link_id
       WHERE cl.campaign_id = ? GROUP BY cl.id ORDER BY cl.clicks DESC`,
      [campaignId]
    );
    return NextResponse.json({
      totals: totalsRows[0] || {},
      daily,
      events,
      links,
    });
  } catch (e) {
    console.error("Metrics GET:", e);
    return NextResponse.json(
      { success: false, message: "Error al obtener métricas.", error: e.message },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    if (body.campaign_id == null) {
      return NextResponse.json({ success: false, message: "campaign_id requerido" }, { status: 400 });
    }
    const date = body.date || new Date().toISOString().slice(0, 10);
    const impressions = Number(body.impressions) || 0;
    const clicks = Number(body.clicks) || 0;
    const conversions = Number(body.conversions) || 0;
    const reach = Number(body.reach) || 0;
    const engagementRate = Number(body.engagement_rate) || 0;
    const notes = body.notes ?? "";
    await pool.execute(
      `INSERT INTO campaign_metrics (campaign_id, date, impressions, clicks, conversions, reach, engagement_rate, notes) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE impressions = VALUES(impressions), clicks = VALUES(clicks), conversions = VALUES(conversions), reach = VALUES(reach), engagement_rate = VALUES(engagement_rate), notes = VALUES(notes)`,
      [body.campaign_id, date, impressions, clicks, conversions, reach, engagementRate, notes]
    );
    return NextResponse.json({ success: true, message: "Métricas registradas" });
  } catch (e) {
    console.error("Metrics POST:", e);
    return NextResponse.json(
      { success: false, message: "Error al registrar métricas.", error: e.message },
      { status: 500 }
    );
  }
}
