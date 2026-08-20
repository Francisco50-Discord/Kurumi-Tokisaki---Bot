// ============================================================
//   Kurumi Tokisaki - BotInfo Command
// ============================================================

import { config } from "../config/settings.js";
import { getBotJid, sendProfilePictureMessage } from "../lib/profilePicture.js";
import os from "os";

const startTime = Date.now();

const handler = async (m, { conn }) => {
  const uptime = Date.now() - startTime;
  const hours = Math.floor(uptime / 3600000);
  const minutes = Math.floor((uptime % 3600000) / 60000);
  const seconds = Math.floor((uptime % 60000) / 1000);

  const memUsage = process.memoryUsage();
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;

  const info = `
✦━【 🌸 *KURUMI TOKISAKI* 】━✦

◈ *Bot:* ${config.botName}
◈ *Versión:* ${config.version}
◈ *Creador:* ${config.creator}
◈ *Número:* +${config.creatorNumber}

✦━【 💻 *SISTEMA* 】━✦

◈ *OS:* ${os.platform()} ${os.arch()}
◈ *Node:* ${process.version}
◈ *Uptime:* ${hours}h ${minutes}m ${seconds}s
◈ *RAM Heap:* ${(memUsage.heapUsed / 1024 / 1024).toFixed(0)}MB
◈ *RAM Sys:* ${(usedMem / 1024 / 1024 / 1024).toFixed(1)}GB

✦━【 ✨ *CARACTERÍSTICAS* 】━✦

• ✅ IA conversacional
• ✅ Sistema RPG completo
• ✅ Sistema de waifus
• ✅ Juegos interactivos
• ✅ Stickers y multimedia

✦ *${config.botName}* v${config.version}
  `.trim();

  const botJid = getBotJid(conn, config.botNumber);

  await sendProfilePictureMessage(conn, m.chatId, botJid, info, {
    quoted: m,
  });
};

handler.command = /^(botinfo|about|acerca)$/i;
handler.description = "Información del bot";
handler.category = "misc";

export default handler;
