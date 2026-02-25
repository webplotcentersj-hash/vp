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
    const [realClicksRow] = await pool.execute(
      "SELECT COUNT(*) as total FROM campaign_link_clicks WHERE campaign_id = ?",
      [campaignId]
    );
    const [realConversionsRow] = await pool.execute(
      "SELECT COALESCE(SUM(conversions), 0) as total FROM campaign_links WHERE campaign_id = ?",
      [campaignId]
    );
    const realClicks = Number(realClicksRow[0]?.total ?? 0);
    const realConversions = Number(realConversionsRow[0]?.total ?? 0);
    const manual = totalsRows[0] || {};
    const totalImpressions = Number(manual.total_impressions) || 0;
    const ctr = totalImpressions > 0 ? (realClicks / totalImpressions) * 100 : (realClicks > 0 ? null : 0);
    const conversionRate = realClicks > 0 ? (realConversions / realClicks) * 100 : null;
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
    let linksRows;
    try {
      [linksRows] = await pool.execute(
        `SELECT cl.id, cl.name, cl.url, cl.short_code, cl.location_id, cl.conversions,
          COUNT(clc.id) as clicks
         FROM campaign_links cl
         LEFT JOIN campaign_link_clicks clc ON cl.id = clc.link_id
         WHERE cl.campaign_id = ? GROUP BY cl.id, cl.name, cl.url, cl.short_code, cl.location_id, cl.conversions ORDER BY clicks DESC`,
        [campaignId]
      );
    } catch (_) {
      [linksRows] = await pool.execute(
        `SELECT cl.id, cl.name, cl.url, cl.short_code, cl.conversions,
          COUNT(clc.id) as clicks
         FROM campaign_links cl
         LEFT JOIN campaign_link_clicks clc ON cl.id = clc.link_id
         WHERE cl.campaign_id = ? GROUP BY cl.id, cl.name, cl.url, cl.short_code, cl.conversions ORDER BY clicks DESC`,
        [campaignId]
      );
    }
    const links = linksRows.map((r) => ({ ...r, clicks: Number(r.clicks || 0), conversions: Number(r.conversions || 0) }));

    const [clicksByDateRows] = await pool.execute(
      `SELECT DATE(clc.clicked_at) as date, COUNT(*) as clicks
       FROM campaign_link_clicks clc
       WHERE clc.campaign_id = ? AND clc.clicked_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
       GROUP BY DATE(clc.clicked_at) ORDER BY date ASC`,
      [campaignId]
    );

    const [recentClicksRows] = await pool.execute(
      `SELECT clc.id, clc.link_id, clc.referrer, clc.user_agent, clc.clicked_at, clc.ip_address,
        cl.name as link_name, cl.location_id
       FROM campaign_link_clicks clc
       JOIN campaign_links cl ON cl.id = clc.link_id
       WHERE clc.campaign_id = ?
       ORDER BY clc.clicked_at DESC LIMIT 100`,
      [campaignId]
    );

    const [referrerCounts] = await pool.execute(
      `SELECT COALESCE(NULLIF(TRIM(clc.referrer), ''), '(directo)') as referrer, COUNT(*) as total
       FROM campaign_link_clicks clc
       WHERE clc.campaign_id = ? AND clc.clicked_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
       GROUP BY COALESCE(NULLIF(TRIM(clc.referrer), ''), '(directo)')
       ORDER BY total DESC LIMIT 10`,
      [campaignId]
    );

    const totals = {
      ...manual,
      total_clicks: realClicks,
      total_conversions: realConversions,
      ctr: ctr != null ? ctr : manual.ctr,
      conversion_rate: conversionRate != null ? conversionRate : manual.conversion_rate,
    };
    return NextResponse.json({
      totals,
      daily,
      events,
      links,
      clicksByDate: clicksByDateRows || [],
      recentClicks: recentClicksRows || [],
      referrerCounts: referrerCounts || [],
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
