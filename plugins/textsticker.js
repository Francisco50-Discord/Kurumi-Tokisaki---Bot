// ============================================================
//   Kurumi Tokisaki - TextSticker Command
// ============================================================

import { getTempPath } from "../lib/utils.js";
import { config } from "../config/settings.js";
import fs from "fs";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

async function imageToSticker(inputPath, outputPath) {
  await execAsync(
    `ffmpeg -i "${inputPath}" -vf "scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x00000000" -vcodec libwebp -lossless 0 -compression_level 6 -q:v 50 -loop 0 -preset picture -an -vsync 0 "${outputPath}" -y`,
    { timeout: 30000 }
  );
  return outputPath;
}

const handler = async (m, { args, body, conn, usedPrefix }) => {
  if (!body) {
    return m.reply(
      `✦━【 📝 *STICKER DE TEXTO* 】━✦\n\n` +
      `📝 Crea un sticker con texto personalizado.\n` +
      `💡 Sintaxis: \`${usedPrefix}textsticker <texto>\`\n` +
      `📌 Ejemplo: \`${usedPrefix}textsticker Hola mundo\``
    );
  }

  await m.reply(`⏳ *Creando sticker de texto...*`);

  try {
    const inputPath = getTempPath("png");
    const outputPath = getTempPath("webp");

    const text = body.replace(/'/g, "\\'").slice(0, 100);
    await execAsync(
      `ffmpeg -f lavfi -i color=c=0x1a1a2e:size=512x512:rate=1 -vf "drawtext=text='${text}':fontcolor=white:fontsize=40:x=(w-text_w)/2:y=(h-text_h)/2:font=DejaVu-Sans-Bold:borderw=3:bordercolor=black" -frames:v 1 "${inputPath}" -y`,
      { timeout: 15000 }
    );

    await imageToSticker(inputPath, outputPath);

    if (!fs.existsSync(outputPath)) throw new Error("No se generó el sticker");

    await conn.sendMessage(m.chatId, { sticker: fs.readFileSync(outputPath) }, { quoted: m });

    fs.unlinkSync(inputPath);
    fs.unlinkSync(outputPath);
  } catch (err) {
    await m.reply(`✦━【 ❌ *ERROR* 】━✦\n\nError al crear el sticker de texto.`);
    throw err;
  }
};

handler.command = /^(textsticker|tsticker|stickertexto)$/i;
handler.description = "Crear sticker de texto";
handler.category = "stickers";

export default handler;
