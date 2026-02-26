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
        messages: [...messages, { role: "user", text }],
      });
      const reply = res?.text || "No pude generar una respuesta.";
      setMessages((m) => [...m, { role: "ia", text: reply }]);
    } catch (err) {
      setMessages((m) => [...m, { role: "ia", text: `Error: ${err.message}` }]);
    } finally {
      setLoading(false);
    }
  }

  const suggestions = [
    "¿Cómo creo una campaña nueva?",
    "¿Cómo agrego un link trackable por chupete?",
    "¿Dónde veo las métricas de clicks?",
    "¿Cómo descargo el QR en buena calidad?",
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-black">Asistente IA – PlotBot</h1>
        {messages.length > 0 && (
          <button
            type="button"
            onClick={() => setMessages([])}
            className="text-sm px-3 py-1.5 rounded-lg border border-stone-200 text-black hover:bg-stone-100"
          >
            Nueva conversación
          </button>
        )}
      </div>
      <div className="flex-1 bg-white rounded-xl border border-stone-200 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="text-center py-8">
              <p className="text-black mb-4">Escribí un mensaje o elegí una pregunta para empezar.</p>
              <div className="flex flex-wrap justify-center gap-2">
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setInput(s)}
                    className="px-4 py-2 rounded-xl border border-orange-200 bg-orange-50 text-orange-800 text-sm hover:bg-orange-100"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
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
