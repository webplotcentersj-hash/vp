import { NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET(request, context) {
  try {
    const routeParams = await context.params;
    const id = routeParams?.id;
    const photoId = parseInt(id, 10);
    if (!Number.isFinite(photoId) || photoId < 1) {
      return NextResponse.json({ error: "Inválido" }, { status: 400 });
    }

    const slug = request.nextUrl.searchParams.get("slug");
    if (!slug || typeof slug !== "string" || slug.length > 40) {
      return NextResponse.json({ error: "slug requerido" }, { status: 400 });
    }

    const [rows] = await pool.execute(
      `SELECT ap.data, ap.mime_type, l.public_slug
       FROM installation_audit_photos ap
       INNER JOIN installation_lists l ON l.id = ap.list_id
       WHERE ap.id = ?`,
      [photoId]
    );
    if (!rows?.length) {
      return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    }
    const row = rows[0];
    if (row.public_slug !== slug) {
      return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    }

    const mime = row.mime_type || "image/jpeg";
    const data = row.data;
    if (!data || !Buffer.isBuffer(data)) {
      return NextResponse.json({ error: "Sin datos" }, { status: 404 });
    }

    return new NextResponse(data, {
      status: 200,
      headers: {
        "Content-Type": mime,
        "Cache-Control": "public, max-age=300, s-maxage=300",
      },
    });
  } catch (e) {
    console.error("audit-photo GET:", e);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}
