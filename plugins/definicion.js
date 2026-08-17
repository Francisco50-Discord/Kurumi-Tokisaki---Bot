// ============================================================
//   Kurumi Tokisaki - Definición Command
// ============================================================

import axios from "axios";
import { truncate } from "../lib/utils.js";

const handler = async (m, { args, body, usedPrefix }) => {
  if (!body) {
    return m.reply(
      `✦━【 *DEFINICIÓN* 】━✦\n` +
      `\n\n` +
      `📝 Busca la definición de\n` +
      `   una palabra.\n` +
      `💡 Sintaxis:\n` +
      `   \`${usedPrefix}definicion <palabra>\`\n` +
      `📌 Ejemplo:\n` +
      `   \`${usedPrefix}definicion amor\`\n` +
      ``
    );
  }

  await m.reply(`⏳ *Buscando definición de "${body}"...*`);

  // v21.0: Wikimedia bloquea UAs genéricos de navegador en 2026 (403).
  // Policy oficial exige UA con info de contacto del bot.
  const BROWSER_HEADERS = {
    "User-Agent": "KurumiTokisakiBot/5.0 (Node.js; +https://github.com/francisco/kurumi-bot)",
    "Accept": "application/json,text/html,*/*;q=0.8",
    "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
  };

  // Método 1: Wiktionary en español (v20.0 — requiere User-Agent navegador)
  try {
    const wikiRes = await axios.get(
      `https://es.wiktionary.org/w/api.php?action=query&titles=${encodeURIComponent(body)}&prop=extracts&exintro=true&format=json&utf8=1&redirects=1`,
      { timeout: 15000, headers: BROWSER_HEADERS }
    );

    const pages = wikiRes.data?.query?.pages;
    if (pages) {
      const pageId = Object.keys(pages)[0];
      const extract = pages[pageId]?.extract;
      if (extract && pageId !== "-1") {
        const cleanText = extract.replace(/<[^>]*>/g, "").trim();
        return m.reply(
          `✦━【 *${body.toUpperCase()}* 】━✦\n` +
          `\n\n` +
          `${truncate(cleanText, 600)}\n` +
          ``
        );
      }
    }
  } catch (e) {}

  // Método 2: dictionaryapi.dev (inglés)
  try {
    const res = await axios.get(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(body)}`,
      { timeout: 15000, headers: { "User-Agent": "Mozilla/5.0" } }
    );

    const data = res.data[0];
    if (data?.word && data?.meanings?.length) {
      let response = `✦━【 *${data.word.toUpperCase()}* 】━✦\n\n\n`;
      for (const meaning of data.meanings.slice(0, 3)) {
        response += `📌 *${meaning.partOfSpeech}*\n`;
        for (const def of meaning.definitions.slice(0, 2)) {
          response += `• ${truncate(def.definition, 200)}\n`;
          if (def.example) response += `  _Ejemplo: "${def.example}"_\n`;
        }
        response += "\n";
      }
      response += ``;
      return m.reply(response);
    }
  } catch (e) {}

  // Método 3: Wikipedia (resumen corto) como fallback
  try {
    const wikiRes = await axios.get(
      `https://es.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(body)}`,
      { timeout: 12000, headers: BROWSER_HEADERS }
    );
    if (wikiRes.data?.extract) {
      return m.reply(
        `✦━【 *${body.toUpperCase()}* 】━✦\n` +
        `\n\n` +
        `${truncate(wikiRes.data.extract, 600)}\n` +
        ``
      );
    }
  } catch (e) {}

  await m.reply(`✦━【 ❌ *ERROR* 】━✦\n\nNo se encontró la definición de "${body}".\n\n💡 Intenta con una palabra más común.`);
};

handler.command = /^(definicion|definición|define|significado|diccionario)$/i;
handler.description = "Definición de una palabra";
handler.category = "busqueda";
handler.cooldown = 5;

export default handler;
