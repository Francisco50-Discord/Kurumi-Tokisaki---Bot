// ============================================================
//   Kurumi Tokisaki - Facebook Downloader Command
//   API: Multi-provider Facebook Downloader (Siputzx & Agatz)
// ============================================================

import axios from "axios";
import { fbdl, fbdl2 } from "ruhend-scraper";

const handler = async (m, { body, conn, usedPrefix, command }) => {
  if (!body || !body.trim()) {
    return m.reply(
      `✦━【 📘 *FACEBOOK DOWNLOADER* 】━✦\n\n` +
      `📝 Descarga videos de Facebook en HD / SD.\n` +
      `💡 Sintaxis: \`${usedPrefix}${command} <url>\`\n` +
      `📌 Ejemplo: \`${usedPrefix}${command} https://www.facebook.com/watch/?v=123456789\``
    );
  }

  const url = body.trim();
  if (!/facebook\.com|fb\.watch/i.test(url)) {
    return m.reply(`❌ Proporciona un enlace válido de Facebook.`);
  }

  await m.reply(`⏳ *Procesando video de Facebook...*`);

  let videoUrl = null;
  let title = "Video de Facebook";

  // Se mantienen los mismos proveedores, pero se usa el primer enlace válido.
  // Así una API lenta ya no retrasa a las demás cuando otra responde antes.
  const providerResult = await Promise.any([
    async () => {
      const sipRes = await axios.get(`https://api.siputzx.my.id/api/d/facebook?url=${encodeURIComponent(url)}`, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
        timeout: 10000
      });
      const data = sipRes.data?.status && sipRes.data?.data;
      const resultUrl = Array.isArray(data?.downloads) && data.downloads.length > 0
        ? data.downloads[0]?.url || data.downloads[1]?.url
        : data?.urls?.hd || data?.urls?.sd || (Array.isArray(data?.urls) ? data.urls[0]?.url : null);
      if (!resultUrl) throw new Error("Siputzx no devolvió un video.");
      return { videoUrl: resultUrl, title: data?.title || title };
    },
    async () => {
      const agRes = await axios.get(`https://api.agatz.xyz/api/facebook?url=${encodeURIComponent(url)}`, {
        headers: { "User-Agent": "Mozilla/5.0" },
        timeout: 10000
      });
      const data = agRes.data?.data || agRes.data?.result || agRes.data;
      const resultUrl = data?.hd || data?.sd || (Array.isArray(data) ? data[0]?.url || data[0] : null) || data?.url;
      if (!resultUrl) throw new Error("Agatz no devolvió un video.");
      return { videoUrl: resultUrl, title: data?.title || title };
    },
    async () => {
      const ruh = await fbdl(url);
      const resultUrl = ruh?.hd || ruh?.sd || ruh?.url;
      if (!resultUrl) throw new Error("Ruhend no devolvió un video.");
      return { videoUrl: resultUrl, title };
    }
  ].map(async (provider) => provider())).catch(() => null);

  if (providerResult) {
    videoUrl = providerResult.videoUrl;
    title = providerResult.title || title;
  }

  if (!videoUrl) {
    return m.reply(`❌ No se pudo obtener el video de Facebook. Verifica que la publicación sea pública.`);
  }

  try {
    const caption =
      `✦━【 📘 *FACEBOOK DOWNLOADER* 】━✦\n\n` +
      `📝 *Título:* ${title}\n\n` +
      `✨ *Kurumi Tokisaki*`;

    const videoBuffer = await axios.get(videoUrl, {
      responseType: "arraybuffer",
      headers: { "User-Agent": "Mozilla/5.0" },
      timeout: 25000
    });

    await conn.sendMessage(
      m.chatId,
      { video: Buffer.from(videoBuffer.data), caption, mimetype: "video/mp4" },
      { quoted: m }
    );
  } catch (err) {
    console.error("Error en Facebook downloader:", err.message);
    await m.reply(`❌ Error al descargar el archivo de video: ${err.message}`);
  }
};

handler.command = /^(facebook|fb|fbdl|fbvideo)$/i;
handler.description = "Descargar videos de Facebook";
handler.category = "descargas";

export default handler;

