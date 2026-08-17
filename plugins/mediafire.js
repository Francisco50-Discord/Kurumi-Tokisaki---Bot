// ============================================================
//   Kurumi Tokisaki - MediaFire Downloader Command
//   API: Multi-provider MediaFire Downloader (Scraper, Agatz, Siputzx)
// ============================================================

import axios from "axios";

const handler = async (m, { body, conn, usedPrefix, command }) => {
  if (!body || !body.trim()) {
    return m.reply(
      `✦━【 📂 *MEDIAFIRE DOWNLOADER* 】━✦\n\n` +
      `📝 Descarga archivos directos de MediaFire.\n` +
      `💡 Sintaxis: \`${usedPrefix}${command} <url>\`\n` +
      `📌 Ejemplo: \`${usedPrefix}${command} https://www.mediafire.com/file/ed15u9b2m0m87k7/sample.txt/file\``
    );
  }

  const url = body.trim();
  if (!/mediafire\.com/i.test(url)) {
    return m.reply(`❌ Proporciona un enlace válido de MediaFire.`);
  }

  await m.reply(`⏳ *Procesando archivo de MediaFire...*`);

  let downloadUrl = null;
  let fileName = "archivo_mediafire";
  let fileSize = "Desconocido";
  let mimeType = "application/octet-stream";

  // Se conservan el análisis directo y las dos APIs, pero se toma el primer
  // enlace válido sin acumular los timeouts de proveedores lentos.
  const providerResult = await Promise.any([
    async () => {
      const htmlRes = await axios.get(url, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
        timeout: 10000
      });
      const html = htmlRes.data;
      const linkMatch = html.match(/href="([^"]+mediafire\.com\/[^"]+)"/i) || html.match(/https?:\/\/download[0-9]*\.mediafire\.com\/[^\s"'\>]+/i);
      const fileNameMatch = html.match(/class="filename">([^<]+)</i) || html.match(/class="dl-btn-label"[^>]*>([^<]+)</i);
      const resultUrl = linkMatch?.[1] || linkMatch?.[0];
      if (!resultUrl) throw new Error("La página no devolvió un enlace.");
      return { downloadUrl: resultUrl, fileName: fileNameMatch?.[1]?.trim() || fileName, fileSize };
    },
    async () => {
      const agRes = await axios.get(`https://api.agatz.xyz/api/mediafire?url=${encodeURIComponent(url)}`, {
        headers: { "User-Agent": "Mozilla/5.0" },
        timeout: 10000
      });
      const data = agRes.data?.data || agRes.data?.result || agRes.data;
      const resultUrl = data?.link || data?.url || data?.download;
      if (!resultUrl) throw new Error("Agatz no devolvió un enlace.");
      return { downloadUrl: resultUrl, fileName: data.filename || data.nama || fileName, fileSize: data.filesize || data.size || fileSize };
    },
    async () => {
      const sipRes = await axios.get(`https://api.siputzx.my.id/api/d/mediafire?url=${encodeURIComponent(url)}`, {
        headers: { "User-Agent": "Mozilla/5.0" },
        timeout: 10000
      });
      const data = sipRes.data?.data || sipRes.data?.result;
      const resultUrl = data?.link || data?.url || data?.download;
      if (!resultUrl) throw new Error("Siputzx no devolvió un enlace.");
      return { downloadUrl: resultUrl, fileName: data.filename || fileName, fileSize: data.filesize || fileSize };
    }
  ].map(async (provider) => provider())).catch(() => null);

  if (providerResult) {
    downloadUrl = providerResult.downloadUrl;
    fileName = providerResult.fileName || fileName;
    fileSize = providerResult.fileSize || fileSize;
  }

  if (!downloadUrl) {
    return m.reply(`❌ No se pudo obtener el enlace de descarga de MediaFire.`);
  }

  try {
    const caption =
      `✦━【 📂 *MEDIAFIRE DOWNLOADER* 】━✦\n\n` +
      `📝 *Nombre:* ${fileName}\n` +
      `📊 *Tamaño:* ${fileSize}\n\n` +
      `✨ *Kurumi Tokisaki*`;

    const fileBuffer = await axios.get(downloadUrl, {
      responseType: "arraybuffer",
      headers: { "User-Agent": "Mozilla/5.0" },
      timeout: 45000
    });

    await conn.sendMessage(
      m.chatId,
      {
        document: Buffer.from(fileBuffer.data),
        fileName: fileName,
        mimetype: mimeType,
        caption
      },
      { quoted: m }
    );
  } catch (err) {
    console.error("Error en MediaFire downloader:", err.message);
    await m.reply(`❌ Error al descargar el archivo de MediaFire: ${err.message}`);
  }
};

handler.command = /^(mediafire|mf|mfdl|mediafiredl)$/i;
handler.description = "Descargar archivos de MediaFire";
handler.category = "descargas";

export default handler;

