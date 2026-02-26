import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const MODEL = process.env.GEMINI_MODEL || "gemini-3-flash-preview";
const IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL || "gemini-2.0-flash-preview-image-generation";

function wantsImageGeneration(text) {
  if (!text || typeof text !== "string") return false;
  const t = text.toLowerCase().trim();
  return (
    /\b(generar|crear|hacé|dibujá|generá|haz|crea)\b.*\b(imagen|foto|diseño|afiche|poster|ilustración|dibujo)\b/.test(t) ||
    /\b(imagen|foto|afiche)\b.*\b(para (la )?campaña|de campaña)\b/.test(t)
  );
}

const DEFAULT_SYSTEM = `Eres PlotBot, el asistente creativo y estratégico de Vía Pública Plot Center. Responde siempre en español, con claridad y calidez. Tu rol es triple: (1) Ayudar con el uso del panel, (2) Inspirar y dar ideas creativas para campañas, (3) Aconsejar en función de los datos (ubicaciones, clicks, métricas) que te pasen.

CREATIVIDAD E INSPIRACIÓN PARA CAMPAÑAS
- Proponé ideas de campañas: slogans, conceptos, públicos objetivo, mensajes según producto o temporada.
- Sugerí ángulos creativos (emocional, oferta, curiosidad, urgencia) y cómo adaptarlos a cartelería en la vía pública.
- Si te piden "ideas para una campaña de X", dales 2-3 opciones distintas con slogan sugerido y por qué puede funcionar en cada ubicación.
- Cuando conozcas las ubicaciones (te las pasan en contexto), usalas: sugerí qué mensaje conviene en zonas más transitadas o según la referencia del lugar.

IMÁGENES Y FOTOS PARA CAMPAÑAS
- Podés "crear" imágenes en el sentido de proponer conceptos visuales: describí en detalle la escena, composición, colores, texto sobre la imagen, estilo (minimalista, impactante, etc.) para que el usuario pueda generarla en herramientas de IA (DALL·E, Midjourney, Ideogram, etc.) o brief para un diseñador.
- Si piden "una imagen para mi campaña" o "diseño para un afiche", respondé con una descripción lista para copiar y pegar en un generador de imágenes: incluyé estilo, elementos clave, texto a mostrar, atmósfera y formato (vertical/horizontal para vía pública).
- Podés sugerir variantes (ej. versión día/noche, versión corta de copy) para A/B en distintos chupetes.

USO DE DATOS (UBICACIONES Y CLICKS)
- Si en el mensaje del usuario aparece un bloque "DATOS ACTUALES DEL PANEL", ese es el contexto real: ubicaciones con dirección y número, campañas con sus clicks, totales. Usalo para:
  - Recomendar en qué ubicaciones (por número o zona) lanzar una campaña según tránsito o tipo de público.
  - Analizar qué campañas van mejor (más clicks) y sugerir por qué o qué repetir.
  - Decir cosas como "En el chupete N° X tenés buena performance" o "Concentrá más presupuesto en las ubicaciones que ya te dieron clicks".
- Si no te pasan datos, podés igual dar ideas genéricas y recordar que en el panel pueden ver métricas en Dashboard y en Campañas → [campaña] → Métricas.

CONTEXTO DE LA APP (para dudas de uso)
- Panel: Dashboard, Ubicaciones, Clientes, Alquileres, Estadísticas, Campañas, Asistente IA. "Chupete" = ubicación con número.
- Crear campaña: Campañas → Nueva campaña → elegir ubicaciones en mapa/lista → datos (nombre, producto, fechas) → opcional URL por chupete → Crear. Luego en Editar campaña ves links y QR.
- Links trackables y QR: URL corta que registra clicks y redirige; QR descargable en alta calidad en Editar campaña.
- Ubicaciones: tabla en Ubicaciones, editar con mapa arrastrable; mapa pantalla completa con filtros y búsqueda por número; PDF de informe.
- Métricas: Dashboard (resumen y gráficos); por campaña en Campañas → [campaña] → Métricas (clicks reales, mapa, referrers, últimos clicks).

REGLAS
- Indicá rutas concretas cuando hables del panel (ej. "Campañas → Nueva campaña").
- No inventes pantallas que no existan. Si no sabés algo del panel, decilo y sugerí la sección más relacionada.
- Para temas ajenos al panel o a campañas publicitarias, respondé que solo podés ayudar con Plot Center y con ideas para campañas.`;

function buildContextBlock(appData) {
  if (!appData) return "";
  const parts = [];
  if (Array.isArray(appData.locations) && appData.locations.length > 0) {
    parts.push("UBICACIONES (chupetes):\n" + appData.locations.map((l) => `  N° ${l.id}: ${l.address || "Sin dirección"}${l.reference ? ` (${l.reference})` : ""} - ${l.status || "available"}`).join("\n"));
  }
  if (Array.isArray(appData.campaigns) && appData.campaigns.length > 0) {
    parts.push("CAMPAÑAS Y CLICKS:\n" + appData.campaigns.map((c) => `  "${c.name}": ${c.real_clicks ?? 0} clicks, estado: ${c.status}`).join("\n"));
  }
  if (appData.metrics && typeof appData.metrics === "object") {
    const m = appData.metrics;
    parts.push("MÉTRICAS GLOBALES: " + (m.total_clicks ?? 0) + " clicks totales, " + (m.total_conversions ?? 0) + " conversiones, " + (m.total_campaigns ?? 0) + " campañas.");
  }
  if (parts.length === 0) return "";
  return "\n\n--- DATOS ACTUALES DEL PANEL (usá esto para dar recomendaciones) ---\n" + parts.join("\n\n") + "\n--- FIN DATOS ---\n\n";
}

/**
 * POST /api/gemini
 * Body: { contents?, systemInstruction?, messages?, appData? }
 * appData: { locations: [], campaigns: [], metrics: {} } para que el asistente conozca ubicaciones y clicks.
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
    let { contents, systemInstruction, messages, appData } = body;
    const system = systemInstruction && typeof systemInstruction === "string" ? systemInstruction : DEFAULT_SYSTEM;

    if (Array.isArray(messages) && messages.length > 0) {
      const last = messages[messages.length - 1];
      if (last?.role === "user" && typeof last.text === "string") {
        const prev = messages.slice(0, -1);
        const history = prev
          .map((m) => (m.role === "user" ? `Usuario: ${m.text}` : `PlotBot: ${m.text}`))
          .join("\n");
        const contextBlock = buildContextBlock(appData);
        const userPart = contextBlock ? `${contextBlock}Pregunta o pedido del usuario:\n${last.text}` : last.text;
        contents = history ? `Historial de la conversación:\n${history}\n\n${userPart}` : userPart;
      }
    }

    if (!contents || typeof contents !== "string") {
      return NextResponse.json(
        { error: "Se requiere 'contents' (string) o 'messages' con último mensaje de usuario." },
        { status: 400 }
      );
    }

    const lastUserText = Array.isArray(messages) && messages.length > 0 && messages[messages.length - 1]?.role === "user"
      ? messages[messages.length - 1].text
      : contents;
    const useImageModel = wantsImageGeneration(lastUserText);

    let response;
    try {
      if (useImageModel) {
        response = await ai.models.generateContent({
          model: IMAGE_MODEL,
          contents,
          config: {
            systemInstruction: system,
            responseModalities: ["TEXT", "IMAGE"],
          },
        });
      } else {
        response = await ai.models.generateContent({
          model: MODEL,
          contents,
          systemInstruction: system,
        });
      }
    } catch (imageErr) {
      if (useImageModel && (imageErr?.message?.includes("404") || imageErr?.message?.includes("not found"))) {
        const fallback = await ai.models.generateContent({
          model: MODEL,
          contents: contents + "\n\n[El usuario pidió generar una imagen. Como el modelo de imágenes no está disponible, respondé con una descripción detallada lista para usar en DALL·E, Midjourney o Ideogram.]",
          systemInstruction: system,
        });
        const text = fallback?.text ?? "No pude generar una respuesta.";
        return NextResponse.json({ text, success: true });
      }
      throw imageErr;
    }

    const text = response?.text ?? "";
    const images = [];
    const parts = response?.candidates?.[0]?.content?.parts;
    if (Array.isArray(parts)) {
      for (const part of parts) {
        if (part?.inlineData?.data) {
          images.push({
            base64: part.inlineData.data,
            mimeType: part.inlineData.mimeType || "image/png",
          });
        }
      }
    }
    return NextResponse.json({ text, images: images.length ? images : undefined, success: true });
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
