// ============================================================
//   Kurumi Tokisaki - TextSticker Command
// ============================================================

import { getTempPath } from "../lib/utils.js";
import fs from "fs";
import sharp from "sharp";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function wrapText(value, maxChars = 18, maxLines = 6) {
  const words = String(value).replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  const lines = [];
  let current = "";

  for (const word of words) {
    if (word.length > maxChars) {
      if (current) {
        lines.push(current);
        current = "";
      }
      for (let index = 0; index < word.length; index += maxChars) {
        lines.push(word.slice(index, index + maxChars));
      }
      continue;
    }

    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxChars) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }

  if (current) lines.push(current);
  return (lines.length ? lines : ["Texto"]).slice(0, maxLines);
}

async function createTextImage(text, outputPath) {
  const lines = wrapText(text.slice(0, 100));
  const lineHeight = 52;
  const firstLineY = 256 - ((lines.length - 1) * lineHeight) / 2 + 14;
  const tspans = lines
    .map((line, index) => `<tspan x="256" dy="${index === 0 ? 0 : lineHeight}">${escapeXml(line)}</tspan>`)
    .join("");

  const svg = `
    <svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
      <rect width="512" height="512" fill="#1a1a2e"/>
      <text x="256" y="${firstLineY}" text-anchor="middle"
        font-family="DejaVu Sans, sans-serif" font-size="40" font-weight="700"
        fill="#ffffff" stroke="#000000" stroke-width="3" paint-order="stroke"
        dominant-baseline="alphabetic">${tspans}</text>
    </svg>`;

  await sharp(Buffer.from(svg)).png().toFile(outputPath);
  return outputPath;
}

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

  let inputPath;
  let outputPath;
  try {
    inputPath = getTempPath("png");
    outputPath = getTempPath("webp");

    await createTextImage(body, inputPath);
    await imageToSticker(inputPath, outputPath);

    if (!fs.existsSync(outputPath)) throw new Error("No se generó el sticker");

    await conn.sendMessage(m.chatId, { sticker: fs.readFileSync(outputPath) }, { quoted: m });
  } catch (err) {
    await m.reply(`✦━【 ❌ *ERROR* 】━✦\n\nError al crear el sticker de texto.`);
    throw err;
  } finally {
    for (const filePath of [inputPath, outputPath]) {
      if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
  }
};

handler.command = /^(textsticker|tsticker|stickertexto)$/i;
handler.description = "Crear sticker de texto";
handler.category = "stickers";

export default handler;
export { createTextImage, imageToSticker };
