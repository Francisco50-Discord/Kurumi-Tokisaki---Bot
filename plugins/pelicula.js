// ============================================================
//   Kurumi Tokisaki - Película & Serie Command (Precision v6.1)
// ============================================================

import axios from "axios";
import { truncate } from "../lib/utils.js";
import { translateToSpanish } from "../lib/translator.js";

const genreMap = {
  "Action": "Acción", "Adventure": "Aventura", "Animation": "Animación",
  "Biography": "Biografía", "Comedy": "Comedia", "Crime": "Crimen",
  "Documentary": "Documental", "Drama": "Drama", "Family": "Familia",
  "Fantasy": "Fantasía", "Horror": "Terror", "Musical": "Musical",
  "Mystery": "Misterio", "Romance": "Romance", "Sci-Fi": "Ciencia Ficción",
  "Thriller": "Suspenso", "War": "Guerra", "Western": "Oeste",
};

const translateGenre = (genre) => {
  if (!genre || genre === "N/A") return "N/A";
  return genre.split(", ").map(g => genreMap[g.trim()] || g.trim()).join(", ");
};

function scoreCandidate(item, queryWords, cleanQuery) {
  let score = 0;
  const titleLower = item.l ? item.l.toLowerCase() : "";
  const cleanTitle = titleLower.replace(/[^a-z0-9]/g, " ");

  // Types: HUGE bonus for actual feature movies and major TV series
  if (item.q === "feature") score += 400;
  else if (item.q === "TV series" || item.q === "series") score += 350;
  else if (item.q === "TV mini-series") score += 300;
  else if (item.q === "TV movie") score += 150;
  else score += 10;

  // Has poster
  if (item.i?.imageUrl) score += 100;

  // Title exact match
  if (cleanTitle.trim() === cleanQuery.trim()) score += 200;
  if (cleanTitle.startsWith(cleanQuery)) score += 100;

  // Word match
  for (const w of queryWords) {
    if (w.length > 1 && cleanTitle.includes(w)) {
      score += 40;
    }
  }

  // Handle sequel numbers (e.g. 2, 3, 4, 9)
  const numMatch = cleanQuery.match(/\b([2-9]|10)\b/);
  if (numMatch) {
    const num = numMatch[0];
    if (cleanTitle.includes(num) || (num === "2" && (titleLower.includes("ii") || titleLower.includes("part 2") || titleLower.includes("way of water")))) {
      score += 100;
    }
  }

  return score;
}

const handler = async (m, { body, conn, usedPrefix }) => {
  if (!body || !body.trim()) {
    return m.reply(
      `✦━【 🎬 *PELÍCULA / SERIE* 】━✦\n\n` +
      `📝 Busca información exacta de cualquier película o serie.\n` +
      `💡 Sintaxis: \`${usedPrefix}pelicula <nombre o término>\`\n` +
      `📌 Ejemplos:\n` +
      `  \`${usedPrefix}pelicula Inception\`\n` +
      `  \`${usedPrefix}pelicula Harry Potter y la piedra filosofal\`\n` +
      `  \`${usedPrefix}pelicula Avatar 2\`\n` +
      `  \`${usedPrefix}pelicula Stranger Things\``
    );
  }

  const query = body.trim();
  const cleanQuery = query.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();
  const queryWords = cleanQuery.split(/\s+/).filter(Boolean);

  try {
    let candidates = [];

    // 1. Búsqueda directa por IMDB Suggestion
    try {
      const firstChar = cleanQuery[0] || "a";
      const imdbUrl = `https://v3.sg.media-imdb.com/suggestion/${firstChar}/${encodeURIComponent(query)}.json`;
      const res = await axios.get(imdbUrl, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
        timeout: 7000
      });
      const items = (res.data?.d || []).filter(i => i.id && i.id.startsWith("tt"));
      candidates.push(...items);
    } catch (e) {}

    // 2. Búsqueda con consulta traducida a inglés para títulos en español
    try {
      const transRes = await axios.get(
        `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=t&q=${encodeURIComponent(query)}`,
        { timeout: 5000 }
      );
      const enQuery = transRes.data?.[0]?.[0]?.[0];
      if (enQuery && enQuery.toLowerCase() !== query.toLowerCase()) {
        const cleanEn = enQuery.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();
        const firstChar = cleanEn[0] || "a";
        const imdbUrl = `https://v3.sg.media-imdb.com/suggestion/${firstChar}/${encodeURIComponent(enQuery)}.json`;
        const res = await axios.get(imdbUrl, {
          headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
          timeout: 7000
        });
        const items = (res.data?.d || []).filter(i => i.id && i.id.startsWith("tt"));
        candidates.push(...items);
      }
    } catch (e) {}

    // 3. Deduplicar y puntuar candidatos
    const uniqueMap = new Map();
    for (const item of candidates) {
      if (!uniqueMap.has(item.id)) {
        uniqueMap.set(item.id, item);
      }
    }

    const scored = Array.from(uniqueMap.values()).map(item => ({
      item,
      score: scoreCandidate(item, queryWords, cleanQuery)
    }));

    scored.sort((a, b) => b.score - a.score);

    let bestMatch = scored[0]?.item || null;
    let otherMatches = scored.slice(1, 4).map(s => s.item);

    // 4. Obtener detalles completos desde OMDB usando imdbID o búsqueda por título
    let omdbData = null;
    if (bestMatch?.id) {
      try {
        const omdbRes = await axios.get(
          `https://www.omdbapi.com/?i=${bestMatch.id}&plot=full&apikey=trilogy`,
          { timeout: 8000 }
        );
        if (omdbRes.data?.Response === "True") {
          omdbData = omdbRes.data;
        }
      } catch (e) {}
    }

    if (!omdbData) {
      try {
        const omdbRes = await axios.get(
          `https://www.omdbapi.com/?t=${encodeURIComponent(query)}&plot=full&apikey=trilogy`,
          { timeout: 8000 }
        );
        if (omdbRes.data?.Response === "True") {
          omdbData = omdbRes.data;
        }
      } catch (e) {}
    }

    if (!omdbData && !bestMatch) {
      return m.reply(`❌ No se encontró ninguna película o serie para "${query}".`);
    }

    const title = omdbData?.Title || bestMatch?.l || query;
    const year = omdbData?.Year || bestMatch?.y || "";
    const yearText = year ? ` (${year})` : "";
    const rawPlot = omdbData?.Plot && omdbData.Plot !== "N/A" ? omdbData.Plot : "Sin sinopsis disponible.";
    const translatedPlot = await translateToSpanish(rawPlot);

    const typeMap = {
      "movie": "Película",
      "feature": "Película",
      "series": "Serie de TV",
      "TV series": "Serie de TV",
      "TV mini-series": "Miniserie de TV",
      "TV movie": "Película para TV",
      "game": "Videojuego",
      "episode": "Episodio"
    };
    const contentType = typeMap[bestMatch?.q || omdbData?.Type] || "Película / Serie";

    const genres = omdbData?.Genre ? translateGenre(omdbData.Genre) : "N/A";
    const director = omdbData?.Director && omdbData.Director !== "N/A" ? await translateToSpanish(omdbData.Director) : "N/A";
    const actors = omdbData?.Actors && omdbData.Actors !== "N/A" ? omdbData.Actors : "N/A";
    const country = omdbData?.Country && omdbData.Country !== "N/A" ? await translateToSpanish(omdbData.Country) : "N/A";
    const awards = omdbData?.Awards && omdbData.Awards !== "N/A" ? await translateToSpanish(omdbData.Awards) : "Ninguno";
    const rating = omdbData?.imdbRating && omdbData.imdbRating !== "N/A" ? `⭐ ${omdbData.imdbRating}/10` : "N/A";
    const runtime = omdbData?.Runtime && omdbData.Runtime !== "N/A" ? omdbData.Runtime : (omdbData?.totalSeasons ? `${omdbData.totalSeasons} temporada(s)` : "N/A");

    let responseText =
      `✦━【 🎬 *${(`${title}${yearText}`).toUpperCase()}* 】━✦\n\n` +
      `📝 ${truncate(translatedPlot, 550)}\n\n` +
      `◈ *Tipo:* 🍿 ${contentType}\n` +
      `◈ *Género:* 🎭 ${genres}\n` +
      `◈ *Calificación:* ${rating}\n` +
      `◈ *Duración/Temporadas:* ⏱️ ${runtime}\n` +
      `◈ *Director:* 🎬 ${director}\n` +
      `◈ *Reparto:* 👥 ${truncate(actors, 150)}\n` +
      `◈ *País:* 🌐 ${country}\n` +
      `◈ *Premios:* 🏆 ${awards}\n` +
      (bestMatch?.id ? `\n🔗 https://www.imdb.com/title/${bestMatch.id}/` : "");

    if (otherMatches.length > 0) {
      responseText += `\n\n📌 *Otros resultados relacionados:*\n`;
      for (const om of otherMatches) {
        responseText += `• *${om.l}* ${om.y ? `(${om.y})` : ""}\n`;
      }
    }

    // 5. Descargar póster oficial en alta calidad
    let imageBuffer = null;
    const posterCandidates = [
      bestMatch?.i?.imageUrl,
      omdbData?.Poster !== "N/A" ? omdbData?.Poster : null
    ].filter(Boolean);

    for (const posterUrl of posterCandidates) {
      try {
        const imgRes = await axios.get(posterUrl, {
          responseType: "arraybuffer",
          headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
          timeout: 8000
        });
        if (imgRes.data && imgRes.data.length > 1000) {
          imageBuffer = Buffer.from(imgRes.data);
          break;
        }
      } catch (e) {}
    }

    // Fallback de búsqueda de póster si no se encontró
    if (!imageBuffer) {
      try {
        const pUrl = `https://www.pinterest.es/search/pins/?q=${encodeURIComponent(title + " movie poster")}`;
        const pRes = await axios.get(pUrl, {
          headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
          timeout: 6000
        });
        const matches = [...pRes.data.matchAll(/(https:\/\/i\.pinimg\.com\/(?:736x|originals|564x)\/[a-f0-9\/]+\.(?:jpg|png|jpeg|webp))/gi)];
        if (matches.length > 0) {
          const imgRes = await axios.get(matches[0][1], { responseType: "arraybuffer", timeout: 6000 });
          imageBuffer = Buffer.from(imgRes.data);
        }
      } catch (e) {}
    }

    if (imageBuffer) {
      await conn.sendMessage(m.chatId, { image: imageBuffer, caption: responseText }, { quoted: m });
      return;
    }

    await m.reply(responseText);
  } catch (err) {
    await m.reply(`❌ *Error al buscar la película.* Ocurrió un fallo en la consulta.`);
  }
};

handler.command = /^(pelicula|película|movie|film|serie)$/i;
handler.description = "Buscar información precisa de una película o serie";
handler.category = "busqueda";
handler.cooldown = 5;

export default handler;
