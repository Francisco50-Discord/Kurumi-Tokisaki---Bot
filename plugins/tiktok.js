// ============================================================
//   Kurumi Tokisaki - TikTok Downloader Command
//   API: TikWM (https://www.tikwm.com/api/)
// ============================================================

import axios from "axios";

const handler = async (m, { body, conn, usedPrefix, command }) => {
  if (!body || !body.trim()) {
    return m.reply(
      `✦━【 🎵 *TIKTOK DOWNLOADER* 】━✦\n\n` +
      `📝 Descarga videos de TikTok sin marca de agua.\n` +
      `💡 Sintaxis: \`${usedPrefix}${command} <url>\`\n` +
      `📌 Ejemplo: \`${usedPrefix}${command} https://www.tiktok.com/@user/video/123456789\``
    );
  }

  const url = body.trim();
  if (!/tiktok\.com/i.test(url)) {
    return m.reply(`❌ Proporciona un enlace válido de TikTok.`);
  }

  await m.reply(`⏳ *Procesando video de TikTok...*`);

  try {
    const apiUrl = `https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`;
    const res = await axios.get(apiUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
      },
      timeout: 15000
    });

    if (!res.data || res.data.code !== 0 || !res.data.data) {
      return m.reply(`❌ No se pudo procesar el video de TikTok. Revisa el enlace.`);
    }

    const data = res.data.data;
    const videoUrl = data.play || data.wmplay;
    const title = data.title || "Video de TikTok";
    const author = data.author?.nickname || data.author?.unique_id || "TikTok User";
    const duration = data.duration ? `${data.duration}s` : "N/A";
    const likes = data.digg_count ? data.digg_count.toLocaleString() : "N/A";

    const caption =
      `✦━【 🎵 *TIKTOK DOWNLOADER* 】━✦\n\n` +
      `📝 *Título:* ${title}\n` +
      `👤 *Autor:* ${author}\n` +
      `⏱️ *Duración:* ${duration}\n` +
      `❤️ *Likes:* ${likes}\n\n` +
      `✨ *Kurumi Tokisaki*`;

    // Descargar buffer del video
    const videoBuffer = await axios.get(videoUrl, {
      responseType: "arraybuffer",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
      },
      timeout: 20000
    });

    await conn.sendMessage(
      m.chatId,
      {
        video: Buffer.from(videoBuffer.data),
        caption,
        mimetype: "video/mp4"
      },
      { quoted: m }
    );
  } catch (err) {
    console.error("Error en TikTok downloader:", err.message);
    await m.reply(`❌ Error al descargar de TikTok: ${err.message}`);
  }
};

handler.command = /^(tiktok|tt|tiktokdl|ttdl)$/i;
handler.description = "Descargar videos de TikTok sin marca de agua";
handler.category = "descargas";

export default handler;
