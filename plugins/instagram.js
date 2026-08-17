// ============================================================
//   Kurumi Tokisaki - Instagram Downloader Command
//   API: Multi-provider Instagram Downloader (Ruhend, Agatz, Siputzx)
// ============================================================

import axios from "axios";
import { igdl, igdl2 } from "ruhend-scraper";

const handler = async (m, { body, conn, usedPrefix, command }) => {
  if (!body || !body.trim()) {
    return m.reply(
      `✦━【 📸 *INSTAGRAM DOWNLOADER* 】━✦\n\n` +
      `📝 Descarga publicaciones, reels o videos de Instagram.\n` +
      `💡 Sintaxis: \`${usedPrefix}${command} <url>\`\n` +
      `📌 Ejemplo: \`${usedPrefix}${command} https://www.instagram.com/p/C-Xyz12/\``
    );
  }

  const url = body.trim();
  if (!/instagram\.com/i.test(url)) {
    return m.reply(`❌ Proporciona un enlace válido de Instagram.`);
  }

  await m.reply(`⏳ *Procesando enlace de Instagram...*`);

  let mediaList = [];

  // Se consultan las mismas fuentes en paralelo; el primer resultado con medios
  // válidos evita que una fuente lenta bloquee a las demás.
  mediaList = await Promise.any([
    async () => {
      const ruh = await igdl(url);
      const result = Array.isArray(ruh) && ruh.length > 0
        ? ruh.map(item => item.url || item.download_url || item).filter(Boolean)
        : Array.isArray(ruh?.data)
          ? ruh.data.map(item => item.url || item).filter(Boolean)
          : ruh?.data?.url ? [ruh.data.url] : [];
      if (!result.length) throw new Error("Ruhend no devolvió medios.");
      return result;
    },
    async () => {
      const agRes = await axios.get(`https://api.agatz.xyz/api/instagram?url=${encodeURIComponent(url)}`, {
        headers: { "User-Agent": "Mozilla/5.0" },
        timeout: 10000
      });
      const data = agRes.data?.data || agRes.data?.result || agRes.data;
      const result = Array.isArray(data)
        ? data.map(item => item.url || item.downloadUrl || item).filter(Boolean)
        : data && typeof data === "object" && data.url ? [data.url] : [];
      if (!result.length) throw new Error("Agatz no devolvió medios.");
      return result;
    },
    async () => {
      const sipRes = await axios.get(`https://api.siputzx.my.id/api/d/igdl?url=${encodeURIComponent(url)}`, {
        headers: { "User-Agent": "Mozilla/5.0" },
        timeout: 10000
      });
      const data = sipRes.data?.data || sipRes.data?.result;
      const result = Array.isArray(data)
        ? data.map(item => item.url || item).filter(Boolean)
        : data?.url ? [data.url] : [];
      if (!result.length) throw new Error("Siputzx no devolvió medios.");
      return result;
    }
  ].map(async (provider) => provider())).catch(() => []);

  if (!mediaList || mediaList.length === 0) {
    return m.reply(`❌ No se pudieron obtener los medios de Instagram. Verifica que la cuenta sea pública.`);
  }

  try {
    const caption =
      `✦━【 📸 *INSTAGRAM DOWNLOADER* 】━✦\n\n` +
      `📌 Media descargada exitosamente.\n\n` +
      `✨ *Kurumi Tokisaki*`;

    // Enviar el primer medio
    const mediaUrl = mediaList[0];
    const mediaBuffer = await axios.get(mediaUrl, {
      responseType: "arraybuffer",
      headers: { "User-Agent": "Mozilla/5.0" },
      timeout: 25000
    });

    const isVideo = mediaUrl.includes(".mp4") || mediaUrl.includes("video");

    if (isVideo) {
      await conn.sendMessage(
        m.chatId,
        { video: Buffer.from(mediaBuffer.data), caption, mimetype: "video/mp4" },
        { quoted: m }
      );
    } else {
      await conn.sendMessage(
        m.chatId,
        { image: Buffer.from(mediaBuffer.data), caption },
        { quoted: m }
      );
    }
  } catch (err) {
    console.error("Error en Instagram downloader:", err.message);
    await m.reply(`❌ Error al descargar el archivo de Instagram: ${err.message}`);
  }
};

handler.command = /^(instagram|ig|igdl|igvideo|igpost)$/i;
handler.description = "Descargar publicaciones y Reels de Instagram";
handler.category = "descargas";

export default handler;

