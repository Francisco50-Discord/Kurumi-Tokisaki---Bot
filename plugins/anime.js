// ============================================================
//   Kurumi Tokisaki - Anime Search Command
// ============================================================

import axios from "axios";
import { truncate, sleep } from "../lib/utils.js";
import { translateToSpanish } from "../lib/translator.js";

const GENRE_MAP = {
  "Action": "Acción",
  "Adventure": "Aventura",
  "Comedy": "Comedia",
  "Drama": "Drama",
  "Ecchi": "Ecchi",
  "Fantasy": "Fantasía",
  "Horror": "Terror",
  "Mahou Shoujo": "Chicas Mágicas",
  "Mecha": "Mecha/Robots",
  "Music": "Música",
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
  "RELEASING": "En emisión",
  "NOT_YET_RELEASED": "Próximamente",
  "CANCELLED": "Cancelado",
  "HIATUS": "En pausa",
  "Currently Airing": "En emisión",
  "Finished Airing": "Finalizado",
  "Not yet aired": "Próximamente"
};

const FORMAT_MAP = {
  "TV": "Serie TV",
  "TV_SHORT": "Serie Corta TV",
  "MOVIE": "Película",
  "SPECIAL": "Especial",
  "OVA": "OVA",
  "ONA": "ONA (Web)",
  "MUSIC": "Video Musical"
};

function translateGenres(genresList) {
  if (!genresList || !Array.isArray(genresList)) return "N/A";
  return genresList.map(g => GENRE_MAP[g] || g).join(", ");
}

async function anilistSearch(query) {
  const graphQuery = `
    query ($search: String) {
      Media (search: $search, type: ANIME, isAdult: false) {
        id
        title { romaji english native }
        description(asHtml: false)
        coverImage { large extraLarge }
        bannerImage
        averageScore
        status
        episodes
        format
        seasonYear
        genres
        studios(isMain: true) { nodes { name } }
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
// Kitsu API (kitsu.io) es la alternativa estable sin API key.
async function kitsuSearch(query) {
  try {
    const res = await axios.get(
      `https://kitsu.io/api/edge/anime?filter[text]=${encodeURIComponent(query)}&page[limit]=1`,
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
      `✦━【 📺 *BÚSQUEDA DE ANIME* 】━✦\n\n` +
      `📝 Busca información e imagen de un anime.\n` +
      `💡 Sintaxis: \`${usedPrefix}anime <nombre>\`\n` +
      `📌 Ejemplo: \`${usedPrefix}anime Naruto\``
    );
  }

  try {
    const firstResult = await Promise.any([
      anilistSearch(body).then((data) => data
        ? { source: "anilist", data }
        : Promise.reject(new Error("AniList sin resultados"))),
      kitsuSearch(body).then((data) => data
        ? { source: "kitsu", data }
        : Promise.reject(new Error("Kitsu sin resultados"))),
    ]).catch(() => null);
    const anime = firstResult?.source === "anilist" ? firstResult.data : null;
    const kitsuAnime = firstResult?.source === "kitsu" ? firstResult.data : null;

    if (anime) {
      const title = anime.title?.romaji || anime.title?.english || body;
      const titleNative = anime.title?.native || "";
      const genres = translateGenres(anime.genres);
      const studios = anime.studios?.nodes?.map((s) => s.name).join(", ") || "N/A";
      const score = anime.averageScore ? (anime.averageScore / 10).toFixed(1) : "N/A";
      
      let rawDesc = (anime.description || "Sin sinopsis disponible.").replace(/<[^>]*>/g, "").trim();
      rawDesc = await translateToSpanish(rawDesc);
      if (rawDesc.length > 400) rawDesc = rawDesc.substring(0, 400) + "...";

      const status = STATUS_MAP[anime.status] || anime.status || "N/A";
      const format = FORMAT_MAP[anime.format] || anime.format || "N/A";

      const response =
        `✦━【 🎌 *${title.toUpperCase()}* 】━✦\n\n` +
        (titleNative ? `🇯🇵 *Nombre original:* ${titleNative}\n` : "") +
        `📝 *Sinopsis:* ${rawDesc}\n\n` +
        `✦━【 📌 *INFORMACIÓN EN ESPAÑOL* 】━✦\n` +
        `◈ *Puntuación:* ⭐ ${score}/10\n` +
        `◈ *Formato:* 📺 ${format}\n` +
        `◈ *Estado:* 📅 ${status}\n` +
        `◈ *Episodios:* 🎬 ${anime.episodes || "En emisión / N/A"}\n` +
        `◈ *Año de emisión:* 📡 ${anime.seasonYear || "N/A"}\n` +
        `◈ *Géneros:* 🎭 ${genres}\n` +
        `◈ *Estudio:* 🏢 ${studios}\n\n` +
        `🔗 *Enlace:* ${anime.siteUrl}`;

      const imageUrl = anime.coverImage?.extraLarge || anime.coverImage?.large;
      if (imageUrl) {
        return await conn.sendMessage(m.chatId, { image: { url: imageUrl }, caption: response }, { quoted: m });
      } else {
        return await m.reply(response);
      }
    }

    // Fallback a Kitsu (v21.0 — Jikan v4 caído en 2026)
    if (kitsuAnime) {
      const attrs = kitsuAnime.attributes || {};
      const title = attrs.canonicalTitle || attrs.titles?.en || attrs.titles?.en_jp || body;
      const titleJp = attrs.titles?.ja_jp || "";
      const score = attrs.averageRating ? (parseFloat(attrs.averageRating) / 10).toFixed(1) : "N/A";
      const status = STATUS_MAP[attrs.status?.toUpperCase()] || attrs.status || "N/A";
      const format = attrs.subtype ? attrs.subtype.toUpperCase() : "N/A";
      const episodes = attrs.episodeCount || "N/A";

      let rawDesc = (attrs.synopsis || "Sin sinopsis disponible.").replace(/<[^>]*>/g, "").trim();
      rawDesc = await translateToSpanish(rawDesc);
      if (rawDesc.length > 400) rawDesc = rawDesc.substring(0, 400) + "...";

      const response =
        `✦━【 🎌 *${title.toUpperCase()}* 】━✦\n\n` +
        (titleJp ? `🇯🇵 *Japonés:* ${titleJp}\n` : "") +
        `📝 *Sinopsis:* ${rawDesc}\n\n` +
        `✦━【 📌 *INFORMACIÓN* 】━✦\n` +
        `◈ *Puntuación:* ⭐ ${score}/10\n` +
        `◈ *Tipo:* 📺 ${format}\n` +
        `◈ *Estado:* 📅 ${status}\n` +
        `◈ *Episodios:* 🎬 ${episodes}\n\n` +
        `🔗 *Enlace:* https://kitsu.io/anime/${kitsuAnime.id}`;

      const imageUrl = attrs.posterImage?.large || attrs.posterImage?.original || attrs.posterImage?.medium;
      if (imageUrl) {
        return await conn.sendMessage(m.chatId, { image: { url: imageUrl }, caption: response }, { quoted: m });
      } else {
        return await m.reply(response);
      }
    }

    await m.reply(`✦━【 ❌ *ERROR* 】━✦\n\nNo se encontró el anime "${body}". Comprueba el nombre e intenta de nuevo.`);

  } catch (err) {
    console.error("Error en anime command:", err);
    await m.reply(`✦━【 ❌ *ERROR* 】━✦\n\nError al realizar la búsqueda del anime.`);
  }
};

handler.command = /^(anime|buscaranime|animeinfo)$/i;
handler.description = "Buscar información de un anime con imagen y datos en español";
handler.category = "anime";
handler.cooldown = 4;

export default handler;
