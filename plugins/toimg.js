// ============================================================
//   Kurumi Tokisaki - ToImg Command (sticker to image)
// ============================================================

import { getTempPath, getMediaBuffer } from "../lib/utils.js";
import fs from "fs";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

const handler = async (m, { conn, usedPrefix }) => {
  const messageContent =
    m.message?.ephemeralMessage?.message ||
    m.message?.viewOnceMessage?.message ||
    m.message;

  const contextInfo = m.message?.extendedTextMessage?.contextInfo;
  const quotedMessage = contextInfo?.quotedMessage;

  let hasSticker = !!(messageContent?.stickerMessage || quotedMessage?.stickerMessage);

  if (!hasSticker) {
    return m.reply(
      `✦━【 🖼️ *STICKER A IMAGEN* 】━✦\n\n` +
      `📝 Convierte un sticker a imagen PNG.\n` +
      `💡 Sintaxis: Responde a un sticker con \`${usedPrefix}toimg\``
    );
  }

  await m.reply(`⏳ *Convirtiendo sticker a imagen...*`);

  try {
    let buffer = null;

    try {
      buffer = await getMediaBuffer(m);
    } catch (e) {}

    if (!buffer && quotedMessage?.stickerMessage) {
      try {
        const { downloadContentFromMessage } = await import("@whiskeysockets/baileys");
        const stream = await downloadContentFromMessage(quotedMessage.stickerMessage, "sticker");
        const chunks = [];
        for await (const chunk of stream) {
          chunks.push(chunk);
        }
        buffer = Buffer.concat(chunks);
      } catch (e) {}
    }

    if (!buffer || buffer.length === 0) {
      return m.reply(`✦━【 ❌ *ERROR* 】━✦\n\nNo se pudo obtener el sticker.`);
    }

    const inputPath = getTempPath("webp");
    const outputPath = getTempPath("png");

    fs.writeFileSync(inputPath, buffer);

    await execAsync(`ffmpeg -i "${inputPath}" -y "${outputPath}"`, { timeout: 15000 });

    if (!fs.existsSync(outputPath) || fs.statSync(outputPath).size === 0) {
      try {
        const sharp = (await import("sharp")).default;
        const pngBuffer = await sharp(inputPath).png().toBuffer();
        fs.writeFileSync(outputPath, pngBuffer);
      } catch (sharpErr) {
        throw new Error("No se pudo convertir el sticker a imagen");
      }
    }

    if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0) {
      await conn.sendMessage(
        m.chatId,
        { image: fs.readFileSync(outputPath), caption: `✦━【 🖼️ *STICKER → IMAGEN* 】━✦\n\n🖼️ Sticker convertido con éxito.` },
        { quoted: m }
      );
    } else {
      throw new Error("No se generó la imagen");
    }

    try { fs.unlinkSync(inputPath); } catch (e) {}
    try { fs.unlinkSync(outputPath); } catch (e) {}
  } catch (err) {
    await m.reply(`✦━【 ❌ *ERROR* 】━✦\n\nError al convertir el sticker a imagen.`);
    throw err;
  }
};

handler.command = /^(toimg|stickertoimg|sticker2img|toimage)$/i;
handler.description = "Convertir sticker a imagen";
handler.category = "stickers";

export default handler;
