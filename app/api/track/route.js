import { NextResponse } from "next/server";
import pool from "@/lib/db-campaigns";

export async function GET(request) {
  try {
    const shortCode = request.nextUrl.searchParams.get("c");
    if (!shortCode) {
      return new NextResponse("Código de tracking inválido", { status: 400 });
    }
    const [rows] = await pool.execute(
      "SELECT id, campaign_id, url, is_active FROM campaign_links WHERE short_code = ?",
      [shortCode]
    );
    const link = rows[0];
    if (!link || !link.url) {
      return new NextResponse("Link no encontrado", { status: 404 });
    }
    if (link.is_active === 0) {
      return new NextResponse("Este link ha sido desactivado", { status: 410 });
    }
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
    const userAgent = request.headers.get("user-agent") || "";
    const referrer = request.headers.get("referer") || request.headers.get("referrer") || null;
    await pool.execute(
      "INSERT INTO campaign_link_clicks (link_id, campaign_id, ip_address, user_agent, referrer) VALUES (?, ?, ?, ?, ?)",
      [link.id, link.campaign_id, ip, userAgent, referrer]
    );
    return NextResponse.redirect(link.url, 302);
  } catch (e) {
    console.error("Track:", e);
    return new NextResponse("Error al procesar el link", { status: 500 });
  }
}
