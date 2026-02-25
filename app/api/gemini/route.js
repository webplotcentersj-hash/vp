import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash-exp";

/**
 * POST /api/gemini
 * Body: { contents: string } o { contents: string, systemInstruction?: string }
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
    const { contents, systemInstruction } = body;

    if (!contents || typeof contents !== "string") {
      return NextResponse.json(
        { error: "Se requiere 'contents' (string) en el body." },
        { status: 400 }
      );
    }

    const options = {
      model: MODEL,
      contents,
    };
    if (systemInstruction && typeof systemInstruction === "string") {
      options.systemInstruction = systemInstruction;
    }

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
