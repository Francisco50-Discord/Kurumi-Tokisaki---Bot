// ============================================================
//   Kurumi Tokisaki - AI Content Generator Helper
//   Generación dinámica con Gemini AI / Pollinations
// ============================================================

import "dotenv/config";
import { GoogleGenAI } from "@google/genai";
import axios from "axios";

let cachedApiKey = "";
let cachedGemini = null;

function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY?.trim() || "";
  if (apiKey !== cachedApiKey) {
    cachedApiKey = apiKey;
    cachedGemini = apiKey ? new GoogleGenAI({ apiKey }) : null;
  }
  return cachedGemini;
}

/**
 * Genera contenido dinámico en español usando la IA.
 * @param {string} prompt - Instrucción para la IA
 * @param {string} fallback - Texto de respaldo en caso de fallo
 * @returns {Promise<string>}
 */
export async function generateTextWithAI(prompt, fallback = "") {
  // 1. Intentar con Gemini AI
  const ai = getGeminiClient();
  if (ai) {
    const models = ["gemini-3.6-flash", "gemini-3.1-flash-lite", "gemini-flash-latest"];
    for (const model of models) {
      try {
        const res = await ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            temperature: 0.9,
          }
        });
        if (res && res.text && res.text.trim()) {
          return res.text.trim();
        }
      } catch (e) {
        // Seguir al siguiente modelo
      }
    }
  }

  // 2. Fallback con Pollinations AI
  try {
    const res = await axios.get(`https://text.pollinations.ai/${encodeURIComponent(prompt)}?model=openai`, {
      timeout: 6000
    });

    if (typeof res.data === "string" && res.data.trim()) return res.data.trim();
    if (res.data?.choices?.[0]?.message?.content) return res.data.choices[0].message.content.trim();
  } catch (e) {
    try {
      const res = await axios.get(`https://text.pollinations.ai/${encodeURIComponent(prompt)}`, {
        timeout: 6000
      });
      if (typeof res.data === "string" && res.data.trim()) return res.data.trim();
    } catch (e2) {}
  }

  return fallback;
}

import { translateToSpanish } from "./translator.js";
export { translateToSpanish };

