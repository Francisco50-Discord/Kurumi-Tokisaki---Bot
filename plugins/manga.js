// ============================================================
//   Kurumi Tokisaki - Manga Search Command
// ============================================================

import axios from "axios";
import { translateToSpanish } from "../lib/translator.js";

const GENRE_MAP = {
  "Action": "Acción",
  "Adventure": "Aventura",
  "Comedy": "Comedia",
  "Drama": "Drama",
  "Ecchi": "Ecchi",
  "Fantasy": "Fantasía",
  "Horror": "Terror",
  "Mystery": "Misterio",
  "Psychological": "Psicológico",
  "Romance": "Romance",
  "Sci-Fi": "Ciencia Ficción",
  "Slice of Life": "Recuentos de la Vida",
  "Sports": "Deportes",
  "Supernatural": "Sobrenatural",
  "Thriller": "Suspenso"
};

const STATUS_MAP = {
  "FINISHED": "Finalizado",
  "RELEASING": "En publicación",
  "NOT_YET_RELEASED": "Próximamente",
  "CANCELLED": "Cancelado",
  "HIATUS": "En pausa",
  "Publishing": "En publicación",
  "Finished": "Finalizado"
};

const FORMAT_MAP = {
  "MANGA": "Manga",
  "NOVEL": "Novela Ligera",
  "ONE_SHOT": "One-Shot"
};

function translateGenres(genresList) {
  if (!genresList || !Array.isArray(genresList)) return "N/A";
  return genresList.map(g => GENRE_MAP[g] || g).join(", ");
}

async function anilistSearchManga(query) {
  const graphQuery = `
    query ($search: String) {
      Media (search: $search, type: MANGA, isAdult: false) {
        id
        title { romaji english native }
        description(asHtml: false)
        coverImage { large extraLarge }
        averageScore
        status
        chapters
        volumes
        format
        genres
        staff { nodes { name { full } } }
        siteUrl
      }
    }
  `;

  try {
    const res = await axios.post("https://graphql.anilist.co", {
      query: graphQuery,
      variables: { search: query },
    }, { timeout: 12000 });
    return res.data?.data?.Media;
  } catch (e) {
    return null;
  }
}

// v21.0: Jikan v4 está caído en 2026 (504 Gateway Timeout recurrente).
// Kitsu API (kitsu.io) soporta también manga.
async function kitsuSearchManga(query) {
  try {
    const res = await axios.get(
      `https://kitsu.io/api/edge/manga?filter[text]=${encodeURIComponent(query)}&page[limit]=1`,
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
      `✦━【 📖 *BÚSQUEDA DE MANGA* 】━✦\n` +
      `\n\n` +
      `📝 Busca información e imagen de un manga.\n` +
      `💡 Sintaxis:\n` +
      `   \`${usedPrefix}manga <nombre>\`\n` +
      `📌 Ejemplo:\n` +
      `   \`${usedPrefix}manga One Piece\`\n` +
      ``
    );
  }

  try {
    const firstResult = await Promise.any([
      anilistSearchManga(body).then((data) => data
        ? { source: "anilist", data }
        : Promise.reject(new Error("AniList sin resultados"))),
      kitsuSearchManga(body).then((data) => data
        ? { source: "kitsu", data }
        : Promise.reject(new Error("Kitsu sin resultados"))),
    ]).catch(() => null);
    const manga = firstResult?.source === "anilist" ? firstResult.data : null;
    const kitsuManga = firstResult?.source === "kitsu" ? firstResult.data : null;

    if (manga) {
      const title = manga.title?.romaji || manga.title?.english || body;
      const titleNative = manga.title?.native || "";
      const genres = translateGenres(manga.genres);
      const authors = manga.staff?.nodes?.map((s) => s.name?.full).filter(Boolean).slice(0, 2).join(", ") || "N/A";
      const score = manga.averageScore ? (manga.averageScore / 10).toFixed(1) : "N/A";

      let rawDesc = (manga.description || "Sin sinopsis disponible.").replace(/<[^>]*>/g, "").trim();
      rawDesc = await translateToSpanish(rawDesc);
      if (rawDesc.length > 400) rawDesc = rawDesc.substring(0, 400) + "...";

      const status = STATUS_MAP[manga.status] || manga.status || "N/A";
      const format = FORMAT_MAP[manga.format] || manga.format || "Manga";

      const response =
        `✦━【 📚 *${title.toUpperCase()}* 】━✦\n` +
        `\n\n` +
        (titleNative ? `🇯🇵 *Nombre original:* ${titleNative}\n` : "") +
        `📝 *Sinopsis:* ${rawDesc}\n\n` +
        `✦━【 📌 *INFORMACIÓN EN ESPAÑOL* 】━✦\n` +
        `⭐ *Puntuación:* ${score}/10\n` +
        `📖 *Formato:* ${format}\n` +
        `📅 *Estado:* ${status}\n` +
        `📄 *Capítulos:* ${manga.chapters || "En publicación / N/A"}\n` +
        `📚 *Volúmenes:* ${manga.volumes || "N/A"}\n` +
        `🎭 *Géneros:* ${genres}\n` +
        `✍️ *Autor/es:* ${authors}\n` +
        `\n\n` +
        `🔗 *Enlace:* ${manga.siteUrl}`;

      const imageUrl = manga.coverImage?.extraLarge || manga.coverImage?.large;
      if (imageUrl) {
        return await conn.sendMessage(m.chatId, { image: { url: imageUrl }, caption: response }, { quoted: m });
      } else {
        return await m.reply(response);
      }
    }

    // Fallback a Kitsu (v21.0 — Jikan v4 caído en 2026)
    if (kitsuManga) {
      const attrs = kitsuManga.attributes || {};
      const title = attrs.canonicalTitle || attrs.titles?.en || attrs.titles?.en_jp || body;
      const titleJp = attrs.titles?.ja_jp || "";
      const score = attrs.averageRating ? (parseFloat(attrs.averageRating) / 10).toFixed(1) : "N/A";
      const status = STATUS_MAP[attrs.status?.toUpperCase()] || attrs.status || "N/A";
      const format = attrs.subtype ? attrs.subtype.toUpperCase() : "MANGA";
      const chapters = attrs.chapterCount || "N/A";
      const volumes = attrs.volumeCount || "N/A";

      let rawDesc = (attrs.synopsis || "Sin sinopsis disponible.").replace(/<[^>]*>/g, "").trim();
      rawDesc = await translateToSpanish(rawDesc);
      if (rawDesc.length > 400) rawDesc = rawDesc.substring(0, 400) + "...";

      const response =
        `✦━【 📚 *${title.toUpperCase()}* 】━✦\n` +
        `\n\n` +
        (titleJp ? `🇯🇵 *Japonés:* ${titleJp}\n` : "") +
        `📝 *Sinopsis:* ${rawDesc}\n\n` +
        `✦━【 📌 *INFORMACIÓN* 】━✦\n` +
        `⭐ *Puntuación:* ${score}/10\n` +
        `📖 *Tipo:* ${format}\n` +
        `📅 *Estado:* ${status}\n` +
        `📄 *Capítulos:* ${chapters}\n` +
        `📚 *Volúmenes:* ${volumes}\n` +
        `\n\n` +
        `🔗 *Enlace:* https://kitsu.io/manga/${kitsuManga.id}`;

      const imageUrl = attrs.posterImage?.large || attrs.posterImage?.original || attrs.posterImage?.medium;
      if (imageUrl) {
        return await conn.sendMessage(m.chatId, { image: { url: imageUrl }, caption: response }, { quoted: m });
      } else {
        return await m.reply(response);
      }
    }

    await m.reply(`✦━【 ❌ *ERROR* 】━✦\n\nNo se encontró el manga "${body}". Comprueba el nombre e intenta de nuevo.`);

  } catch (err) {
    console.error("Error en manga command:", err);
    await m.reply(`✦━【 ❌ *ERROR* 】━✦\n\nError al realizar la búsqueda del manga.`);
  }
};

handler.command = /^(manga|buscarmanga)$/i;
handler.description = "Buscar información de un manga con imagen y datos en español";
handler.category = "anime";
handler.cooldown = 4;

export default handler;
