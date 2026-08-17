import axios from "axios";

const TRANSLATION_CACHE_TTL_MS = 10 * 60_000;
const TRANSLATION_CACHE_MAX = 200;
const translationCache = new Map();
const TRANSLATION_TIMEOUT_MS = 5_000;

function getCachedTranslation(text) {
  const entry = translationCache.get(text);
  if (!entry) return null;
  if (Date.now() - entry.timestamp >= TRANSLATION_CACHE_TTL_MS) {
    translationCache.delete(text);
    return null;
  }
  return entry.value;
}

function setCachedTranslation(text, value) {
  translationCache.delete(text);
  translationCache.set(text, { value, timestamp: Date.now() });
  while (translationCache.size > TRANSLATION_CACHE_MAX) {
    translationCache.delete(translationCache.keys().next().value);
  }
}

async function googleTranslate(cleanedText) {
  const gtxUrl = "https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=es&dt=t&q=" + encodeURIComponent(cleanedText);
  const res = await axios.get(gtxUrl, { timeout: TRANSLATION_TIMEOUT_MS });
  const translated = res.data?.[0]?.map((item) => item?.[0]).filter(Boolean).join("").trim();
  if (!translated) throw new Error("Google Translate no devolvió texto");
  return translated;
}

async function myMemoryTranslate(cleanedText) {
  const mmUrl = "https://api.mymemory.translated.net/get?q=" + encodeURIComponent(cleanedText) + "&langpair=en|es";
  const res = await axios.get(mmUrl, { timeout: TRANSLATION_TIMEOUT_MS });
  const translated = res.data?.responseData?.translatedText?.trim();
  if (!translated || translated === cleanedText) throw new Error("MyMemory no devolvió una traducción válida");
  return translated;
}

/**
 * Traduce un texto al español usando servicios gratuitos por HTTP en paralelo.
 * No utiliza modelos de IA.
 * @param {string} text
 * @returns {Promise<string>}
 */
export async function translateToSpanish(text) {
  if (!text || typeof text !== "string") return text || "Sin información disponible.";
  const cleanedText = text.replace(/<[^>]*>/g, "").trim();
  if (!cleanedText || cleanedText.startsWith("Sin ")) return cleanedText || "Sin información disponible.";

  const cached = getCachedTranslation(cleanedText);
  if (cached) return cached;

  try {
    const translated = await Promise.any([
      googleTranslate(cleanedText),
      myMemoryTranslate(cleanedText),
    ]);
    setCachedTranslation(cleanedText, translated);
    return translated;
  } catch (e) {
    return cleanedText;
  }
}
