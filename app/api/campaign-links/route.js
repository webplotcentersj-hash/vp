import { NextResponse } from "next/server";
import pool, { query } from "@/lib/db-campaigns";

function genShortCode(len = 8) {
  const chars = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let code = "";
  for (let i = 0; i < len; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

async function uniqueShortCode() {
  for (let i = 0; i < 10; i++) {
    const code = genShortCode();
    const rows = await query("SELECT id FROM campaign_links WHERE short_code = ?", [code]);
    if (rows.length === 0) return code;
  }
  return genShortCode(8);
}

export async function GET(request) {
  try {
    const campaignId = request.nextUrl.searchParams.get("campaign_id");
    if (!campaignId) {
      return NextResponse.json({ success: false, message: "campaign_id requerido" }, { status: 400 });
    }
    const rows = await query(
      `SELECT l.*, 
        COUNT(DISTINCT lc.id) as total_clicks,
        DATE(MAX(lc.clicked_at)) as last_click_date
       FROM campaign_links l
       LEFT JOIN campaign_link_clicks lc ON l.id = lc.link_id
       WHERE l.campaign_id = ?
       GROUP BY l.id
       ORDER BY l.created_at ASC`,
      [campaignId]
    );
    return NextResponse.json(rows);
  } catch (e) {
    console.error("Campaign links GET:", e);
    return NextResponse.json(
      { success: false, message: "Error.", error: e.message },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    if (!body.campaign_id || !body.name || !body.url) {
      return NextResponse.json({ success: false, message: "Faltan campos requeridos" }, { status: 400 });
    }
    const shortCode = await uniqueShortCode();
    const notes = body.notes ?? "";
    const isActive = body.is_active ?? 1;
    const [result] = await pool.execute(
      "INSERT INTO campaign_links (campaign_id, name, url, short_code, notes, is_active) VALUES (?, ?, ?, ?, ?, ?)",
      [body.campaign_id, body.name, body.url, shortCode, notes, isActive]
    );
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const trackingUrl = `${baseUrl}/api/track?c=${shortCode}`;
    return NextResponse.json({
      success: true,
      message: "Link creado exitosamente",
      id: result.insertId,
      short_code: shortCode,
      tracking_url: trackingUrl,
    });
  } catch (e) {
    console.error("Campaign links POST:", e);
    return NextResponse.json(
      { success: false, message: "Error al crear link.", error: e.message },
      { status: 500 }
    );
  }
}

export async function PUT(request) {
  try {
    const body = await request.json();
    if (!body.id) {
      return NextResponse.json({ success: false, message: "ID de link requerido" }, { status: 400 });
    }
    await pool.execute(
      "UPDATE campaign_links SET name = ?, url = ?, notes = ?, is_active = ? WHERE id = ?",
      [body.name, body.url, body.notes ?? "", body.is_active ?? 1, body.id]
    );
    return NextResponse.json({ success: true, message: "Link actualizado exitosamente" });
  } catch (e) {
    console.error("Campaign links PUT:", e);
    return NextResponse.json(
      { success: false, message: "Error al actualizar.", error: e.message },
      { status: 500 }
    );
  }
}

export async function DELETE(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const id = body.id ?? request.nextUrl?.searchParams?.get("id");
    if (!id) {
      return NextResponse.json({ success: false, message: "ID de link requerido" }, { status: 400 });
    }
    await pool.execute("DELETE FROM campaign_links WHERE id = ?", [id]);
    return NextResponse.json({ success: true, message: "Link eliminado exitosamente" });
  } catch (e) {
    console.error("Campaign links DELETE:", e);
    return NextResponse.json(
      { success: false, message: "Error al eliminar.", error: e.message },
      { status: 500 }
    );
  }
}
