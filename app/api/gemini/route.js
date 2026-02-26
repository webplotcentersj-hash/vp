import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash-exp";

const DEFAULT_SYSTEM =
  "Eres PlotBot, asistente de Vía Pública Plot Center. La app gestiona campañas publicitarias, ubicaciones (chupetes), links trackables, QR y métricas de clicks. Ayudás con dudas sobre campañas, ubicaciones, métricas, cómo crear links o ver estadísticas. Responde de forma breve y útil en español.";

/**
 * POST /api/gemini
 * Body: { contents: string } o { contents: string, systemInstruction?: string, messages?: [{ role: "user"|"ia", text: string }] }
 * Si se envía messages, se usa el último mensaje como contents y el resto como historial en el prompt.
 */
export async function POST(request) {
  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY no configurada en el servidor." },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();
    let { contents, systemInstruction, messages } = body;
    const system = systemInstruction && typeof systemInstruction === "string" ? systemInstruction : DEFAULT_SYSTEM;

    if (Array.isArray(messages) && messages.length > 0) {
      const last = messages[messages.length - 1];
      if (last?.role === "user" && typeof last.text === "string") {
        const prev = messages.slice(0, -1);
        const history = prev
          .map((m) => (m.role === "user" ? `Usuario: ${m.text}` : `PlotBot: ${m.text}`))
          .join("\n");
        contents = history ? `Historial de la conversación:\n${history}\n\nNueva pregunta del usuario:\n${last.text}` : last.text;
      }
    }

    if (!contents || typeof contents !== "string") {
      return NextResponse.json(
        { error: "Se requiere 'contents' (string) o 'messages' con último mensaje de usuario." },
        { status: 400 }
      );
    }

    const options = {
      model: MODEL,
      contents,
      systemInstruction: system,
    };

    const response = await ai.models.generateContent(options);

    const text = response?.text ?? "";
    return NextResponse.json({ text, success: true });
  } catch (err) {
    console.error("Error en /api/gemini:", err);
    return NextResponse.json(
      {
        error: err?.message || "Error al llamar a Gemini",
        success: false,
      },
      { status: 500 }
    );
  }
}
