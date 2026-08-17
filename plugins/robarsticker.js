// ============================================================
//   Kurumi Tokisaki - Robar Sticker Command
// ============================================================

import { getTempPath, getMediaBuffer } from "../lib/utils.js";
import fs from "fs";

const handler = async (m, { conn }) => {
  const quoted = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
  if (!quoted?.stickerMessage) {
    return m.reply(
      `✦━【 🎨 *ROBAR STICKER* 】━✦\n\n` +
      `📝 Copia un sticker y lo reenvía con tu pack.\n` +
      `💡 Responde a un sticker con \`!robarsticker\``
    );
  }

  try {
    let buffer = null;

    try {
      const { downloadContentFromMessage } = await import("@whiskeysockets/baileys");
      const stream = await downloadContentFromMessage(quoted.stickerMessage, "sticker");
      const chunks = [];
      for await (const chunk of stream) {
        chunks.push(chunk);
      }
      buffer = Buffer.concat(chunks);
    } catch (e) {
      buffer = await getMediaBuffer(m);
    }

    if (!buffer) return m.reply(`✦━【 ❌ *ERROR* 】━✦\n\nNo se pudo obtener el sticker.`);

    await conn.sendMessage(m.chatId, { sticker: buffer }, { quoted: m });
  } catch (err) {
    await m.reply(`✦━【 ❌ *ERROR* 】━✦\n\nError al robar el sticker.`);
    throw err;
  }
};

handler.command = /^(robarsticker|steal|robasticker|takesticker)$/i;
handler.description = "Robar/guardar un sticker";
handler.category = "stickers";

export default handler;
