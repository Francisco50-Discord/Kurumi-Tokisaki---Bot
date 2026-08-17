// ============================================================
//   Kurumi Tokisaki - Sticker Command
// ============================================================

import { getTempPath, getMediaBuffer, getMediaType } from "../lib/utils.js";
import { config } from "../config/settings.js";
import fs from "fs";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

async function imageToSticker(inputPath, outputPath, options = {}) {
  const { pack = config.stickerPackName, author = config.stickerAuthor } = options;

  await execAsync(
    `ffmpeg -i "${inputPath}" -vf "scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x00000000" -vcodec libwebp -lossless 0 -compression_level 6 -q:v 50 -loop 0 -preset picture -an -vsync 0 "${outputPath}" -y`,
    { timeout: 30000 }
  );

  return outputPath;
}

const handler = async (m, { conn, args, usedPrefix }) => {
  const quoted = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
  const messageContent =
    m.message?.ephemeralMessage?.message ||
    m.message?.viewOnceMessage?.message ||
    m.message;

  const hasMedia =
    messageContent?.imageMessage ||
    messageContent?.videoMessage ||
    messageContent?.stickerMessage ||
    quoted?.imageMessage ||
    quoted?.videoMessage;

  if (!hasMedia) {
    return m.reply(
      `✦━【 🎨 *CREAR STICKER* 】━✦\n\n` +
      `📝 Envía o responde a una imagen o video corto para crear un sticker.\n` +
      `💡 Sintaxis: Responde con \`${usedPrefix}sticker\``
    );
  }

  await m.reply(`⏳ *Creando sticker...*`);

  try {
    const buffer = await getMediaBuffer(m);
    if (!buffer) return m.reply(`✦━【 ❌ *ERROR* 】━✦\n\nNo se pudo obtener el archivo multimedia.`);

    const mediaType = getMediaType(m);
    const isVideo = mediaType === "video";

    const inputPath = getTempPath(isVideo ? "mp4" : "jpg");
    const outputPath = getTempPath("webp");

    fs.writeFileSync(inputPath, buffer);

    if (isVideo) {
      await execAsync(
        `ffmpeg -i "${inputPath}" -vf "scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x00000000,fps=15" -vcodec libwebp -lossless 0 -compression_level 6 -q:v 50 -loop 0 -preset picture -an -vsync 0 "${outputPath}" -y`,
        { timeout: 60000 }
      );
    } else {
      await imageToSticker(inputPath, outputPath, {
        pack: args[0] || config.stickerPackName,
        author: args[1] || config.stickerAuthor,
      });
    }

    if (!fs.existsSync(outputPath)) {
      throw new Error("No se generó el archivo WebP");
    }

    await conn.sendMessage(m.chatId, { sticker: fs.readFileSync(outputPath) }, { quoted: m });

    fs.unlinkSync(inputPath);
    fs.unlinkSync(outputPath);
  } catch (err) {
    await m.reply(`✦━【 ❌ *ERROR* 】━✦\n\nError al crear el sticker. Asegúrate de que ffmpeg esté instalado.`);
    throw err;
  }
};

handler.command = /^(sticker|s|stiker|stic)$/i;
handler.description = "Convertir imagen/video a sticker";
handler.category = "stickers";
handler.cooldown = 5;

export default handler;
