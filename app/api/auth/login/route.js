import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function POST(request) {
  try {
    const { email, password } = await request.json();
    if (!email || !password) {
      return NextResponse.json(
        { success: false, message: "Email y contraseña son requeridos." },
        { status: 400 }
      );
    }

    const rows = await query("SELECT password FROM users WHERE email = ?", [email]);
    if (rows.length !== 1) {
      return NextResponse.json({ success: false, message: "Email o contraseña incorrectos." });
    }

    const stored = rows[0].password;
    if (password !== stored) {
      return NextResponse.json({ success: false, message: "Email o contraseña incorrectos." });
    }

    return NextResponse.json({ success: true, message: "Inicio de sesión exitoso." });
  } catch (e) {
    console.error("Login error:", e);
    return NextResponse.json(
      { success: false, message: "Error en el servidor. Revisa que la base de datos esté configurada (DB_HOST en .env.local)." },
      { status: 500 }
    );
  }
}
