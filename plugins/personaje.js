// ============================================================
//   Kurumi Tokisaki - Character Search Command
// ============================================================

import axios from "axios";
import { translateToSpanish } from "../lib/translator.js";

async function anilistSearchChar(query) {
  const graphQuery = `
    query ($search: String) {
      Character (search: $search) {
        id
        name { full native alternative }
        description(asHtml: false)
        image { large medium }
        favourites
        media(page: 1, perPage: 3) {
          nodes { title { romaji english } type }
        }
        siteUrl
      }
    }
  `;

  try {
    const res = await axios.post("https://graphql.anilist.co", {
      query: graphQuery,
      variables: { search: query },
    }, {
      timeout: 12000,
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
      }
    });
    return res.data?.data?.Character;
  } catch (e) {
    return null;
  }
}

// v21.0: Jikan v4 caído en 2026 (504). Kitsu reemplaza como fallback para personajes.
async function kitsuSearchChar(query) {
  try {
    const res = await axios.get(
      `https://kitsu.io/api/edge/characters?filter[name]=${encodeURIComponent(query)}&page[limit]=1`,
      {
        timeout: 12000,
        headers: {
          "Accept": "application/vnd.api+json",
          "User-Agent": "KurumiTokisakiBot/5.0 (Node.js; +https://github.com/francisco/kurumi-bot)",
        },
      }
    );
    return res.data?.data?.[0];
  } catch (e) {
    return null;
  }
}

const handler = async (m, { body, conn, usedPrefix }) => {
  if (!body) {
    return m.reply(
      `✦━【 👤 *BÚSQUEDA DE PERSONAJE* 】━✦\n\n` +
      `📝 Busca información e imagen de un personaje.\n` +
      `💡 Sintaxis: \`${usedPrefix}personaje <nombre>\`\n` +
      `📌 Ejemplo: \`${usedPrefix}personaje Naruto Uzumaki\``
    );
  }

  try {
    const firstResult = await Promise.any([
      anilistSearchChar(body).then((data) => data
        ? { source: "anilist", data }
        : Promise.reject(new Error("AniList sin resultados"))),
      kitsuSearchChar(body).then((data) => data
        ? { source: "kitsu", data }
        : Promise.reject(new Error("Kitsu sin resultados"))),
    ]).catch(() => null);
    const char = firstResult?.source === "anilist" ? firstResult.data : null;
    const kitsuChar = firstResult?.source === "kitsu" ? firstResult.data : null;

    if (char) {
      const name = char.name?.full || body;
      const nameNative = char.name?.native || "";
      const animeList = char.media?.nodes?.map((n) => n.title?.romaji || n.title?.english).filter(Boolean).slice(0, 3).join(", ") || "N/A";

      let rawDesc = (char.description || "Sin biografía o descripción disponible.").replace(/<[^>]*>/g, "").trim();
      rawDesc = await translateToSpanish(rawDesc);
      if (rawDesc.length > 400) rawDesc = rawDesc.substring(0, 400) + "...";

      const response =
        `✦━【 👤 *${name.toUpperCase()}* 】━✦\n\n` +
        (nameNative ? `🇯🇵 *Nombre original:* ${nameNative}\n` : "") +
        `📝 *Descripción:* ${rawDesc}\n\n` +
        `✦━【 📌 *INFORMACIÓN EN ESPAÑOL* 】━✦\n` +
        `◈ *Favoritos:* ❤️ ${char.favourites?.toLocaleString() || 0}\n` +
        `◈ *Aparece en:* 📺 ${animeList}\n\n` +
        `🔗 *Enlace:* ${char.siteUrl}`;

      const imageUrl = char.image?.large || char.image?.medium;
      if (imageUrl) {
        return await conn.sendMessage(m.chatId, { image: { url: imageUrl }, caption: response }, { quoted: m });
      } else {
        return await m.reply(response);
      }
    }

    // Fallback a Kitsu (v21.0 — Jikan caído)
    if (kitsuChar) {
      const attrs = kitsuChar.attributes || {};
      const name = attrs.name || body;
      const nameJp = attrs.names?.ja_jp || "";

      let rawDesc = (attrs.description || "Sin biografía disponible.").replace(/<[^>]*>/g, "").trim();
      rawDesc = await translateToSpanish(rawDesc);
      if (rawDesc.length > 400) rawDesc = rawDesc.substring(0, 400) + "...";

      const response =
        `✦━【 👤 *${name.toUpperCase()}* 】━✦\n\n` +
        (nameJp ? `🇯🇵 *Japonés:* ${nameJp}\n` : "") +
        `📝 *Biografía:* ${rawDesc}\n\n` +
        `🔗 *Enlace:* https://kitsu.io/characters/${kitsuChar.id}`;

      const imageUrl = attrs.image?.original || attrs.image?.large;
      if (imageUrl) {
        return await conn.sendMessage(m.chatId, { image: { url: imageUrl }, caption: response }, { quoted: m });
      } else {
        return await m.reply(response);
      }
    }

    await m.reply(`❌ No se encontró el personaje "${body}". Intenta con otro nombre.`);

  } catch (err) {
    console.error("Error en personaje command:", err);
    await m.reply(`❌ *Error al realizar la búsqueda del personaje.*`);
  }
};

handler.command = /^(personaje|character|char)$/i;
handler.description = "Buscar información de un personaje de anime con imagen y datos en español";
handler.category = "anime";
handler.cooldown = 4;

export default handler;
