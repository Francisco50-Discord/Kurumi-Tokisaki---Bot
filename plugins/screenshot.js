// ============================================================
//   Kurumi Tokisaki - Screenshot Command
// ============================================================

import axios from "axios";
import sharp from "sharp";
import { isValidUrl } from "../lib/utils.js";

const MIN_IMAGE_BYTES = 10_000;
const MIN_WIDTH = 600;
const MIN_HEIGHT = 400;
const REQUEST_TIMEOUT = 12_000;

function isPlaceholderText(buffer) {
  const text = buffer.toString("utf8").toLowerCase();
  return text.includes("generating preview") || text.includes("preview unavailable");
}

async function validateScreenshot(data) {
  if (!data) return null;

  const buffer = Buffer.from(data);
  if (buffer.length < MIN_IMAGE_BYTES || isPlaceholderText(buffer)) return null;

  try {
    const metadata = await sharp(buffer).metadata();
    const supportedFormat = new Set(["jpeg", "png", "webp", "gif", "avif"]);
    if (!supportedFormat.has(metadata.format)) return null;
    if (!metadata.width || !metadata.height) return null;
    if (metadata.width < MIN_WIDTH || metadata.height < MIN_HEIGHT) return null;
    return buffer;
  } catch {
    return null;
  }
}

async function captureWithMicrolink(inputUrl) {
  const apiResponse = await axios.get(
    `https://api.microlink.io/?url=${encodeURIComponent(inputUrl)}&screenshot=true`,
    { timeout: REQUEST_TIMEOUT }
  );
  const screenshotUrl = apiResponse.data?.data?.screenshot?.url;
  if (!screenshotUrl) return null;

  const imageResponse = await axios.get(screenshotUrl, {
    responseType: "arraybuffer",
    timeout: REQUEST_TIMEOUT,
    headers: { "User-Agent": "Mozilla/5.0" },
  });
  return validateScreenshot(imageResponse.data);
}

async function captureWithThumIo(inputUrl) {
  const thumUrl = `https://image.thum.io/get/width/1200/crop/800/noanimate/${inputUrl}`;
  const response = await axios.get(thumUrl, {
    responseType: "arraybuffer",
    timeout: REQUEST_TIMEOUT,
    headers: { "User-Agent": "Mozilla/5.0" },
  });
  return validateScreenshot(response.data);
}

async function captureWithWordPress(inputUrl) {
  const wpUrl = `https://s.wordpress.com/mshots/v1/${encodeURIComponent(inputUrl)}?w=1280&h=800`;
  const response = await axios.get(wpUrl, {
    responseType: "arraybuffer",
    timeout: REQUEST_TIMEOUT,
    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
  });
  return validateScreenshot(response.data);
}

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

  if (!/^https?:\/\//i.test(inputUrl)) {
    inputUrl = "https://" + inputUrl;
  }

  if (!isValidUrl(inputUrl)) {
    return m.reply(`❌ *URL inválida*\n────────\nPor favor ingresa un dominio o URL válida.`);
  }

  try {
    let imageBuffer = null;

    // Microlink y Thum.io entregan capturas reales de páginas dinámicas.
    // WordPress queda como último respaldo y también pasa validación visual.
    const providers = [captureWithMicrolink, captureWithThumIo, captureWithWordPress];
    for (const provider of providers) {
      try {
        imageBuffer = await provider(inputUrl);
        if (imageBuffer) break;
      } catch {
        // Probar el siguiente proveedor sin exponer errores internos al chat.
      }
    }

    if (!imageBuffer) {
      return m.reply(
        `✦━【 ❌ *ERROR* 】━✦\n\n` +
        `No se pudo obtener una captura real de ${inputUrl}. ` +
        `Verifica que la web exista y sea accesible.`
      );
    }

    await conn.sendMessage(
      m.chatId,
      {
        image: imageBuffer,
        caption: `✦━【 📸 *CAPTURA WEB* 】━✦\n\n🌐 *Sitio:* ${inputUrl}`,
      },
      { quoted: m }
    );
  } catch {
    await m.reply(`✦━【 ❌ *ERROR* 】━✦\n\nOcurrió un error al procesar la captura de pantalla.`);
  }
};

handler.command = /^(screenshot|captura|web2img)$/i;
handler.description = "Captura de pantalla de un sitio web";
handler.category = "herramientas";

export default handler;
