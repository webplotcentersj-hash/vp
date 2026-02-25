"use client";

import { useState, useRef, useEffect } from "react";
import { apiCall } from "@/lib/api";

export default function IAPage() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", text }]);
    setLoading(true);
    try {
      const res = await apiCall("gemini", "POST", {
        contents: text,
        systemInstruction: "Eres PlotBot, asistente de Vía Pública Plot Center. Responde de forma breve y útil.",
      });
      const reply = res?.text || "No pude generar una respuesta.";
      setMessages((m) => [...m, { role: "ia", text: reply }]);
    } catch (err) {
      setMessages((m) => [...m, { role: "ia", text: `Error: ${err.message}` }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <h1 className="text-2xl font-bold text-black mb-4">Asistente IA</h1>
      <div className="flex-1 bg-white rounded-xl border border-stone-200 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <p className="text-black text-center py-8">Escribe un mensaje para hablar con el asistente.</p>
          )}
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                msg.role === "user"
                  ? "ml-auto bg-orange-600 text-white rounded-br-md"
                  : "bg-stone-100 text-black rounded-bl-md"
              }`}
            >
              <p className="whitespace-pre-wrap text-sm">{msg.text}</p>
            </div>
          ))}
          {loading && (
            <div className="bg-stone-100 rounded-2xl rounded-bl-md px-4 py-3 max-w-[85%]">
              <p className="text-black text-sm">Pensando...</p>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
        <div className="p-4 border-t border-stone-200 flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="Pregúntale algo a la IA..."
            className="flex-1 px-4 py-3 border border-stone-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
          />
          <button
            onClick={send}
            disabled={loading}
            className="px-5 py-3 bg-orange-600 text-white rounded-xl hover:bg-orange-700 disabled:opacity-50"
          >
            Enviar
          </button>
        </div>
      </div>
    </div>
  );
}
