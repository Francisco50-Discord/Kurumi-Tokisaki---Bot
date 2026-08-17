// ============================================================
//   Kurumi Tokisaki - Wikipedia Command
// ============================================================

import axios from "axios";
import { truncate } from "../lib/utils.js";

const handler = async (m, { body, conn, usedPrefix }) => {
  if (!body) {
    return m.reply(
      `✦━【 📚 *WIKIPEDIA* 】━✦\n\n` +
      `📝 Busca información en Wikipedia en español.\n` +
      `💡 Sintaxis: \`${usedPrefix}wikipedia <tema>\`\n` +
      `📌 Ejemplo: \`${usedPrefix}wikipedia Albert Einstein\``
    );
  }

  // v21.0: Wikipedia 2026 bloquea UAs genéricos de navegador (403).
  // Policy oficial de Wikimedia exige UA con info de contacto del bot.
  const BROWSER_HEADERS = {
    "User-Agent": "KurumiTokisakiBot/5.0 (Node.js; +https://github.com/francisco/kurumi-bot)",
    "Accept": "application/json,text/html,*/*;q=0.8",
    "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
  };

  try {
    const searchRes = await axios.get(
      `https://es.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(body)}&format=json&srlimit=5&utf8=1`,
      { timeout: 15000, headers: BROWSER_HEADERS }
    );

    const searchResults = searchRes.data?.query?.search;

    if (!searchResults || searchResults.length === 0) {
      return m.reply(`✦━【 ❌ *ERROR* 】━✦\n\nNo se encontró información en Wikipedia.`);
    }

    const firstTitle = searchResults[0].title;
    const summaryRes = await axios.get(
      `https://es.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(firstTitle)}`,
      { timeout: 15000, headers: BROWSER_HEADERS }
    );

    const data = summaryRes.data;

    if (data.type === "disambiguation") {
      let response = `✦━【 ⚠️ *DESAMBIGUACIÓN* 】━✦\n\nHay múltiples resultados para *"${body}"*:\n\n`;
      searchResults.slice(0, 5).forEach((r, i) => {
        response += `» *${i + 1}. ${r.title}*\n`;
      });
      response += `\n💡 Por favor sé más específico en tu búsqueda.`;
      return m.reply(response);
    }

    const response =
      `✦━【 📚 *${data.title.toUpperCase()}* 】━✦\n\n` +
      `📝 ${truncate(data.extract || "Sin extracto disponible", 1000)}\n\n` +
      `🔗 ${data.content_urls?.desktop?.page || ""}`;

    if (data.thumbnail?.source) {
      try {
        await conn.sendMessage(m.chatId, { image: { url: data.thumbnail.source }, caption: response }, { quoted: m });
        return;
      } catch (e) {}
    }
    await m.reply(response);
  } catch (err) {
    await m.reply(`✦━【 ❌ *ERROR* 】━✦\n\nNo se encontró información en Wikipedia.`);
    throw err;
  }
};

handler.command = /^(wikipedia|wiki|enciclopedia)$/i;
handler.description = "Buscar en Wikipedia";
handler.category = "busqueda";
handler.cooldown = 5;

export default handler;
