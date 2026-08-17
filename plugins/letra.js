// ============================================================
//   Kurumi Tokisaki - Letra Command
// ============================================================

import axios from "axios";
import { truncate } from "../lib/utils.js";

const handler = async (m, { body, conn, usedPrefix }) => {
  if (!body) {
    return m.reply(
      `✦━【 *LETRA* 】━✦\n` +
      `\n\n` +
      `📝 Busca la letra de\n` +
      `   una canción.\n` +
      `💡 Sintaxis:\n` +
      `   \`${usedPrefix}letra <artista - canción>\`\n` +
      `📌 Ejemplos:\n` +
      `   \`${usedPrefix}letra Luis Fonsi - Despacito\`\n` +
      `   \`${usedPrefix}letra Bad Bunny - Tití Me Preguntó\`\n` +
      ``
    );
  }

  let artist = "";
  let title = body;

  if (body.includes(" - ")) {
    const parts = body.split(" - ");
    artist = parts[0].trim();
    title = parts.slice(1).join(" - ").trim();
  }

  try {
    const lrclibRes = await axios.get(
      `https://lrclib.net/api/search?q=${encodeURIComponent(body)}`,
      { timeout: 15000 }
    );
    if (lrclibRes.data && lrclibRes.data.length > 0) {
      const track = lrclibRes.data[0];
      if (track.syncedLyrics || track.plainLyrics) {
        const lyrics = track.syncedLyrics || track.plainLyrics;
        const cleanLyrics = lyrics.replace(/\[\d{2}:\d{2}\.\d{2,3}\]\s*/g, "").trim();
        const truncatedLyrics = truncate(cleanLyrics, 3000);
        const responseText =
          `✦━【 *${(`${track.trackName || title}`).toUpperCase()}* 】━✦\n` +
          `\n\n` +
          (track.artistName ? `👤 ${track.artistName}\n` : "") +
          `${truncatedLyrics}${cleanLyrics.length > 3000 ? "\n\n...(letra truncada)" : ""}\n` +
          ``;

        try {
          const itunesRes = await axios.get(
            `https://itunes.apple.com/search?term=${encodeURIComponent(`${track.artistName} ${track.trackName}`)}&entity=song&limit=1`,
            { timeout: 10000 }
          );
          const itunesTrack = itunesRes.data?.results?.[0];
          if (itunesTrack?.artworkUrl100) {
            const artworkUrl = itunesTrack.artworkUrl100.replace("100x100", "600x600");
            await conn.sendMessage(m.chatId, { image: { url: artworkUrl }, caption: responseText }, { quoted: m });
            return;
          }
        } catch (e) {}
        await m.reply(responseText);
        return;
      }
    }
  } catch (e) {}

  try {
    let lyricsUrl = artist
      ? `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`
      : `https://api.lyrics.ovh/suggest/${encodeURIComponent(body)}`;

    if (!artist) {
      const suggestRes = await axios.get(lyricsUrl, { timeout: 15000 });
      const suggestions = suggestRes.data?.data;

      if (suggestions && suggestions.length > 0) {
        const song = suggestions[0];
        artist = song.artist?.name || "";
        title = song.title || body;
        lyricsUrl = `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`;
      }
    }

    const res = await axios.get(lyricsUrl, { timeout: 15000 });
    const lyrics = res.data?.lyrics;

    if (!lyrics) throw new Error("No lyrics found");

    const cleanLyrics = lyrics.replace(/\r\n/g, "\n").trim();
    const truncatedLyrics = truncate(cleanLyrics, 3000);

    const responseText =
      `✦━【 *${title.toUpperCase()}* 】━✦\n` +
      `\n\n` +
      (artist ? `👤 ${artist}\n` : "") +
      `${truncatedLyrics}${cleanLyrics.length > 3000 ? "\n\n...(letra truncada)" : ""}\n` +
      ``;

    try {
      const itunesRes = await axios.get(
        `https://itunes.apple.com/search?term=${encodeURIComponent(`${artist} ${title}`)}&entity=song&limit=1`,
        { timeout: 10000 }
      );
      const track = itunesRes.data?.results?.[0];
      if (track?.artworkUrl100) {
        const artworkUrl = track.artworkUrl100.replace("100x100", "600x600");
        await conn.sendMessage(m.chatId, { image: { url: artworkUrl }, caption: responseText }, { quoted: m });
        return;
      }
    } catch (e) {}

    await m.reply(responseText);
  } catch (err) {
    try {
      const geniusRes = await axios.get(
        `https://search.ononoki.org/search?q=${encodeURIComponent(body + " lyrics site:genius.com")}&format=json&language=en`,
        { timeout: 10000 }
      );
      if (geniusRes.data?.results?.length > 0) {
        const geniusUrl = geniusRes.data.results[0].url;
        return m.reply(
          `✦━【 *${(`${title || body}`).toUpperCase()}* 】━✦\n` +
          `\n\n` +
          `No se encontró la letra\n` +
          `directamente, pero puedes\n` +
          `verla aquí:\n` +
          `🔗 ${geniusUrl}\n` +
          ``
        );
      }
    } catch (e) {}

    await m.reply(`✦━【 ❌ *ERROR* 】━✦\n\nNo se encontró la letra de "${body}".\n\n💡 Intenta con el formato: *artista - canción*`);
  }
};

handler.command = /^(letra|lyrics|lyric|cancion letra|buscarletra)$/i;
handler.description = "Buscar letra de una canción";
handler.category = "busqueda";
handler.cooldown = 5;

export default handler;
