// ============================================================
//   Kurumi Tokisaki - Screenshot Command
// ============================================================

import axios from "axios";
import { isValidUrl } from "../lib/utils.js";

const handler = async (m, { args, conn, usedPrefix }) => {
  let inputUrl = args[0] ? args[0].trim() : "";

  if (!inputUrl) {
    return m.reply(
      `✦━【 📸 *SCREENSHOT* 】━✦\n\n` +
      `📝 Captura la pantalla de un sitio web.\n` +
      `💡 Sintaxis: \`${usedPrefix}screenshot <URL>\`\n` +
      `📌 Ejemplos:\n` +
      `  \`${usedPrefix}screenshot google.com\`\n` +
      `  \`${usedPrefix}screenshot https://github.com\``
    );
  }

  // Prepend https:// si no incluye protocolo
  if (!/^https?:\/\//i.test(inputUrl)) {
    inputUrl = "https://" + inputUrl;
  }

  if (!isValidUrl(inputUrl)) {
    return m.reply(`❌ *URL inválida*\n────────\nPor favor ingresa un dominio o URL válida.`);
  }

  await m.reply(`⏳ *Capturando pantalla de ${inputUrl}...*`);

  try {
    let imageBuffer = null;

    // 1. Intentar WordPress mshots
    try {
      const wpUrl = `https://s.wordpress.com/mshots/v1/${encodeURIComponent(inputUrl)}?w=1280&h=800`;
      const res = await axios.get(wpUrl, {
        responseType: "arraybuffer",
        timeout: 9000,
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" }
      });
      if (res.data && res.data.length > 5000) {
        imageBuffer = Buffer.from(res.data);
      }
    } catch (e) {}

    // 2. Fallback: Microlink
    if (!imageBuffer) {
      try {
        const microRes = await axios.get(`https://api.microlink.io/?url=${encodeURIComponent(inputUrl)}&screenshot=true`, { timeout: 9000 });
        const imgUrl = microRes.data?.data?.screenshot?.url;
        if (imgUrl) {
          const imgRes = await axios.get(imgUrl, { responseType: "arraybuffer", timeout: 9000 });
          if (imgRes.data && imgRes.data.length > 5000) {
            imageBuffer = Buffer.from(imgRes.data);
          }
        }
      } catch (e) {}
    }

    // 3. Fallback: Thum.io
    if (!imageBuffer) {
      try {
        const thumUrl = `https://image.thum.io/get/width/1200/crop/800/noanimate/${inputUrl}`;
        const thumRes = await axios.get(thumUrl, {
          responseType: "arraybuffer",
          timeout: 9000,
          headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" }
        });
        if (thumRes.data && thumRes.data.length > 5000) {
          imageBuffer = Buffer.from(thumRes.data);
        }
      } catch (e) {}
    }

    if (!imageBuffer) {
      return m.reply(`✦━【 ❌ *ERROR* 】━✦\n\nNo se pudo obtener la captura de pantalla de ${inputUrl}. Verifica que la web exista y sea accesible.`);
    }

    await conn.sendMessage(
      m.chatId,
      {
        image: imageBuffer,
        caption: `✦━【 📸 *CAPTURA WEB* 】━✦\n\n🌐 *Sitio:* ${inputUrl}`,
      },
      { quoted: m }
    );
  } catch (err) {
    await m.reply(`✦━【 ❌ *ERROR* 】━✦\n\nOcurrió un error al procesar la captura de pantalla.`);
  }
};

handler.command = /^(screenshot|captura|web2img)$/i;
handler.description = "Captura de pantalla de un sitio web";
handler.category = "herramientas";

export default handler;
