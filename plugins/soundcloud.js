// ============================================================
//   Kurumi Tokisaki - SoundCloud Downloader Command
//   API: Multi-provider SoundCloud Downloader (Siputzx, Agatz, yt-search)
// ============================================================

import axios from "axios";
import yts from "yt-search";

const handler = async (m, { body, conn, usedPrefix, command }) => {
  if (!body || !body.trim()) {
    return m.reply(
      `✦━【 ☁️ *SOUNDCLOUD DOWNLOADER* 】━✦\n\n` +
      `📝 Descarga pistas de audio de SoundCloud.\n` +
      `💡 Sintaxis: \`${usedPrefix}${command} <url | nombre>\`\n` +
      `📌 Ejemplo: \`${usedPrefix}${command} https://soundcloud.com/artist/track\``
    );
  }

  const query = body.trim();
  await m.reply(`⏳ *Procesando audio de SoundCloud...*`);

  let downloadUrl = null;
  let title = "Pista de SoundCloud";
  let author = "SoundCloud Artist";

  // Provider 1: Siputzx SoundCloud API
  if (/soundcloud\.com/i.test(query)) {
    try {
      const sipRes = await axios.get(`https://api.siputzx.my.id/api/d/soundcloud?url=${encodeURIComponent(query)}`, {
        headers: { "User-Agent": "Mozilla/5.0" },
        timeout: 10000
      });
      const data = sipRes.data?.data || sipRes.data?.result || sipRes.data;
      if (data) {
        downloadUrl = data.download || data.url || data.link || data.audio;
        if (data.title) title = data.title;
        if (data.author || data.artist) author = data.author || data.artist;
      }
    } catch (e) {}
  }

  // Provider 2: Agatz SoundCloud API
  if (!downloadUrl && /soundcloud\.com/i.test(query)) {
    try {
      const agRes = await axios.get(`https://api.agatz.xyz/api/soundcloud?url=${encodeURIComponent(query)}`, {
        headers: { "User-Agent": "Mozilla/5.0" },
        timeout: 10000
      });
      const data = agRes.data?.data || agRes.data?.result || agRes.data;
      if (data) {
        downloadUrl = data.download || data.url || data.link;
        if (data.title) title = data.title;
        if (data.artist) author = data.artist;
      }
    } catch (e) {}
  }

  // Provider 3: Search fallback via YouTube audio stream
  if (!downloadUrl) {
    try {
      const searchQuery = query.replace(/https?:\/\/soundcloud\.com\/[^\s]+/i, "").trim() || query;
      const searchRes = await yts(searchQuery);
      const firstVid = searchRes.videos?.[0];
      if (firstVid) {
        title = firstVid.title;
        author = firstVid.author?.name || author;
        const sipYt = await axios.get(`https://api.siputzx.my.id/api/s/youtube?query=${encodeURIComponent(firstVid.url)}`, { timeout: 8000 });
        const sipData = sipYt.data?.data?.[0] || sipYt.data?.[0];
        if (sipData) {
          downloadUrl = sipData.mp3 || sipData.audio || sipData.download;
        }
      }
    } catch (e) {}
  }

  if (!downloadUrl) {
    return m.reply(`❌ No se pudo procesar la pista de SoundCloud.`);
  }

  try {
    const caption =
      `✦━【 ☁️ *SOUNDCLOUD DOWNLOADER* 】━✦\n\n` +
      `🎵 *Pista:* ${title}\n` +
      `👤 *Artista:* ${author}\n\n` +
      `✨ *Kurumi Tokisaki*`;

    const audioBuffer = await axios.get(downloadUrl, {
      responseType: "arraybuffer",
      headers: { "User-Agent": "Mozilla/5.0" },
      timeout: 30000
    });

    await conn.sendMessage(
      m.chatId,
      {
        audio: Buffer.from(audioBuffer.data),
        mimetype: "audio/mp4",
        ptt: false,
        caption
      },
      { quoted: m }
    );
  } catch (err) {
    console.error("Error en SoundCloud downloader:", err.message);
    await m.reply(`❌ Error al descargar de SoundCloud: ${err.message}`);
  }
};

handler.command = /^(soundcloud|sc|scdl|soundclouddl)$/i;
handler.description = "Descargar pistas de audio de SoundCloud";
handler.category = "descargas";

export default handler;

