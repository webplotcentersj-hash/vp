import { NextResponse } from "next/server";
import poolCampaigns from "@/lib/db-campaigns";
import poolMain from "@/lib/db";

export async function GET() {
  try {
    const [rows] = await poolCampaigns.execute(`
      SELECT c.*, 
        COUNT(DISTINCT cl.location_id) as total_locations,
        SUM(cm.impressions) as total_impressions,
        SUM(cm.clicks) as total_clicks,
        SUM(cm.conversions) as total_conversions,
        AVG(cm.engagement_rate) as avg_engagement
      FROM campaigns c
      LEFT JOIN campaign_locations cl ON c.id = cl.campaign_id
      LEFT JOIN campaign_metrics cm ON c.id = cm.campaign_id
      GROUP BY c.id
      ORDER BY c.created_at DESC
    `);
    const campaigns = [];
    for (const row of rows) {
      const [locs] = await poolCampaigns.execute(
        "SELECT location_id, justification FROM campaign_locations WHERE campaign_id = ?",
        [row.id]
      );
      const locations = [];
      for (const loc of locs) {
        try {
          const [[detail]] = await poolMain.execute(
            "SELECT id, address, reference, measurements FROM locations WHERE id = ?",
            [loc.location_id]
          );
          locations.push({
            ...(detail || {}),
            id: loc.location_id,
            address: detail?.address ?? "Detalle no disponible",
            reference: detail?.reference ?? "",
            measurements: detail?.measurements ?? "",
            justification: loc.justification,
          });
        } catch {
          locations.push({
            id: loc.location_id,
            address: "Detalle no disponible",
            reference: "",
            measurements: "",
            justification: loc.justification,
          });
        }
      }
      campaigns.push({ ...row, locations });
    }
    return NextResponse.json(campaigns);
  } catch (e) {
    console.error("Campaigns GET:", e);
    return NextResponse.json(
      { success: false, message: "Error al obtener campañas.", error: e.message },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  let conn;
  try {
    const body = await request.json();
    if (!body.name || !body.startDate || !body.endDate) {
      return NextResponse.json(
        { success: false, message: "Faltan campos requeridos" },
        { status: 400 }
      );
    }
    conn = await poolCampaigns.getConnection();
    await conn.beginTransaction();
    const product = body.product ?? "";
    const audience = body.audience ?? "";
    const slogan = body.slogan ?? "";
    const objective = body.objective ?? "";
    const status = body.status ?? "draft";
    const budget = body.budget !== "" && body.budget != null ? Number(body.budget) : 0;
    const ai_insights = body.ai_insights ?? "";

    const [ins] = await conn.execute(
      `INSERT INTO campaigns (name, product, audience, slogan, objective, status, startDate, endDate, budget, ai_insights) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [body.name, product, audience, slogan, objective, status, body.startDate, body.endDate, budget, ai_insights]
    );
    const campaignId = ins.insertId;
    if (Array.isArray(body.locations) && body.locations.length > 0) {
      for (const loc of body.locations) {
        const locId = Number(loc.id ?? loc.location_id);
        const justification = loc.justification ?? "";
        await conn.execute(
          "INSERT INTO campaign_locations (campaign_id, location_id, justification) VALUES (?, ?, ?)",
          [campaignId, locId, justification]
        );
        const linkUrl = (loc.linkUrl ?? loc.url ?? "").toString().trim();
        if (linkUrl) {
          const linkName = (loc.linkName ?? loc.name ?? `Chupete N° ${locId}`).toString().trim() || `Chupete N° ${locId}`;
          const chars = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
          let shortCode = "";
          for (let i = 0; i < 8; i++) shortCode += chars[Math.floor(Math.random() * chars.length)];
          const [ex] = await conn.execute("SELECT id FROM campaign_links WHERE short_code = ?", [shortCode]);
          if (ex.length > 0) shortCode += chars[Math.floor(Math.random() * chars.length)];
          try {
            await conn.execute(
              "INSERT INTO campaign_links (campaign_id, location_id, name, url, short_code, notes, is_active) VALUES (?, ?, ?, ?, ?, ?, 1)",
              [campaignId, locId, linkName, linkUrl, shortCode, "", 1]
            );
          } catch (err) {
            if (err.message && err.message.includes("location_id")) {
              await conn.execute(
                "INSERT INTO campaign_links (campaign_id, name, url, short_code, notes, is_active) VALUES (?, ?, ?, ?, ?, 1)",
                [campaignId, linkName, linkUrl, shortCode, "", 1]
              );
            } else throw err;
          }
        }
      }
    }
    await conn.commit();
    conn.release();
    return NextResponse.json({ success: true, message: "Campaña creada exitosamente", id: campaignId });
  } catch (e) {
    conn?.rollback?.();
    conn?.release?.();
    console.error("Campaigns POST:", e);
    const msg = e.message || String(e);
    const hint = msg.includes("ECONNREFUSED") || msg.includes("Access denied")
      ? " Revisa en Hostinger: Remote MySQL con Any Host y credenciales en Vercel."
      : msg.includes("Unknown column")
        ? " Ejecutá el SQL en sql/add_location_id_to_campaign_links.sql en tu base de campañas."
        : "";
    return NextResponse.json(
      { success: false, message: `Error al crear campaña.${hint}`, error: msg },
      { status: 500 }
    );
  }
}

export async function PUT(request) {
  let conn;
  try {
    const body = await request.json();
    const id = body.id ?? request.nextUrl?.searchParams?.get("id");
    if (!id) {
      return NextResponse.json({ success: false, message: "ID de campaña requerido" }, { status: 400 });
    }
    conn = await poolCampaigns.getConnection();
    await conn.beginTransaction();
    const product = body.product ?? "";
    const audience = body.audience ?? "";
    const slogan = body.slogan ?? "";
    const objective = body.objective ?? "";
    const status = body.status ?? "draft";
    const budget = body.budget !== "" && body.budget != null ? Number(body.budget) : 0;
    const ai_insights = body.ai_insights ?? "";

    await conn.execute(
      `UPDATE campaigns SET name = ?, product = ?, audience = ?, slogan = ?, objective = ?, status = ?, startDate = ?, endDate = ?, budget = ?, ai_insights = ? WHERE id = ?`,
      [body.name, product, audience, slogan, objective, status, body.startDate, body.endDate, budget, ai_insights, id]
    );
    if (Array.isArray(body.locations)) {
      await conn.execute("DELETE FROM campaign_locations WHERE campaign_id = ?", [id]);
      for (const loc of body.locations) {
        const locId = Number(loc.id ?? loc.location_id);
        const justification = loc.justification ?? "";
        await conn.execute(
          "INSERT INTO campaign_locations (campaign_id, location_id, justification) VALUES (?, ?, ?)",
          [id, locId, justification]
        );
      }
    }
    await conn.commit();
    conn.release();
    return NextResponse.json({ success: true, message: "Campaña actualizada exitosamente" });
  } catch (e) {
    conn?.rollback?.();
    conn?.release?.();
    console.error("Campaigns PUT:", e);
    return NextResponse.json(
      { success: false, message: "Error al actualizar.", error: e.message },
      { status: 500 }
    );
  }
}

export async function DELETE(request) {
  try {
    let id = request.nextUrl?.searchParams?.get("id");
    if (!id) {
      try {
        const body = await request.json();
        id = body.id;
      } catch {}
    }
    if (!id) {
      return NextResponse.json({ success: false, message: "ID de campaña requerido" }, { status: 400 });
    }
    const [result] = await poolCampaigns.execute("DELETE FROM campaigns WHERE id = ?", [id]);
    if (result.affectedRows > 0) {
      return NextResponse.json({ success: true, message: "Campaña eliminada exitosamente" });
    }
    return NextResponse.json({ success: false, message: "Error al eliminar" });
  } catch (e) {
    console.error("Campaigns DELETE:", e);
    return NextResponse.json(
      { success: false, message: "Error al eliminar.", error: e.message },
      { status: 500 }
    );
  }
}
