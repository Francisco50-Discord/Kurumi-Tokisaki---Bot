// ============================================================
//   Kurumi Tokisaki - Top Anime Command
// ============================================================

import axios from "axios";

const TOP_ANIME_TIMEOUT_MS = 10_000;

async function anilistGetTopAiring(limit = 5) {
  try {
    const res = await axios.post("https://graphql.anilist.co", {
      query: `
        query ($limit: Int) {
          Page(page: 1, perPage: $limit) {
            media(sort: POPULARITY_DESC, type: ANIME, status: RELEASING, isAdult: false) {
              title { romaji english }
              coverImage { extraLarge large }
              averageScore
              episodes
              genres
              siteUrl
            }
          }
        }
      `,
      variables: { limit },
    }, { timeout: TOP_ANIME_TIMEOUT_MS });
    return res.data?.data?.Page?.media || [];
  } catch (e) {
    return [];
  }
}

async function kitsuGetTopAiring(limit = 5) {
  try {
    const res = await axios.get(
      `https://kitsu.io/api/edge/anime?filter[status]=current&page[limit]=${limit}&sort=-userCount`,
      {
        timeout: TOP_ANIME_TIMEOUT_MS,
        headers: {
          "Accept": "application/vnd.api+json",
          "User-Agent": "KurumiTokisakiBot/5.0 (Node.js; +https://github.com/francisco/kurumi-bot)",
        },
      }
    );
    return res.data?.data || [];
  } catch (e) {
    return [];
  }
}

function formatAnilistTop(animes) {
  let response = `✦━【 🎌 *TOP 5 ANIME EN EMISIÓN* 】━✦\n\n`;
  animes.forEach((a, i) => {
    const title = a.title?.romaji || a.title?.english || "N/A";
    const score = a.averageScore ? (a.averageScore / 10).toFixed(1) : "N/A";
    response += `» *${i + 1}. ${title}*\n`;
    response += `   └ ⭐ *${score}* | 📺 *${a.episodes || "?"} eps* | 🎭 ${a.genres?.slice(0, 3).join(", ") || "N/A"}\n\n`;
  });
  return response;
}

function formatKitsuTop(animes) {
  let response = `✦━【 🎌 *TOP 5 ANIME EN EMISIÓN* 】━✦\n\n`;
  animes.forEach((a, i) => {
    const attrs = a.attributes || {};
    const title = attrs.canonicalTitle || attrs.titles?.en || attrs.titles?.en_jp || "N/A";
    const score = attrs.averageRating ? (parseFloat(attrs.averageRating) / 10).toFixed(1) : "N/A";
    const eps = attrs.episodeCount || "?";
    response += `» *${i + 1}. ${title}*\n`;
    response += `   └ ⭐ *${score}* | 📺 *${eps} eps*\n\n`;
  });
  return response;
}

const handler = async (m, { conn }) => {
  try {
    const firstResult = await Promise.any([
      anilistGetTopAiring(5).then((data) => data.length > 0
        ? { source: "anilist", data }
        : Promise.reject(new Error("AniList sin resultados"))),
      kitsuGetTopAiring(5).then((data) => data.length > 0
        ? { source: "kitsu", data }
        : Promise.reject(new Error("Kitsu sin resultados"))),
    ]).catch(() => null);
    const anilistAnimes = firstResult?.source === "anilist" ? firstResult.data : [];
    const kitsuAnimes = firstResult?.source === "kitsu" ? firstResult.data : [];

    if (anilistAnimes.length > 0) {
      const response = formatAnilistTop(anilistAnimes);
      const topAnime = anilistAnimes[0];
      const imageUrl = topAnime?.coverImage?.extraLarge || topAnime?.coverImage?.large;
      if (imageUrl) {
        try {
          await conn.sendMessage(m.chatId, { image: { url: imageUrl }, caption: response }, { quoted: m });
          return;
        } catch (e) {}
      }
      await m.reply(response);
      return;
    }

    if (kitsuAnimes.length > 0) {
      const response = formatKitsuTop(kitsuAnimes);
      const topAnime = kitsuAnimes[0];
      const imageUrl = topAnime?.attributes?.posterImage?.large || topAnime?.attributes?.posterImage?.original;
      if (imageUrl) {
        try {
          await conn.sendMessage(m.chatId, { image: { url: imageUrl }, caption: response }, { quoted: m });
          return;
        } catch (e) {}
      }
      await m.reply(response);
      return;
    }
  } catch (err) {}

  await m.reply(`✦━【 ❌ *ERROR* 】━✦\n\nError al obtener el top de anime. Intenta de nuevo en unos segundos.`);
};

handler.command = /^(topanime|animetop|mejoresanimes)$/i;
handler.description = "Ver el top de anime en emisión";
handler.category = "anime";
handler.cooldown = 10;

export default handler;
