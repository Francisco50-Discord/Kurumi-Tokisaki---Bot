// ============================================================
//   Kurumi Tokisaki - Stats Command
// ============================================================

import db from "../lib/database.js";
import { plugins } from "../lib/pluginLoader.js";
import { config } from "../config/settings.js";
import { getBotJid, sendProfilePictureMessage } from "../lib/profilePicture.js";
import os from "os";

const handler = async (m, { conn }) => {
  const usersList = Object.values(db.users || {});
  const groupsList = Object.keys(db.groups || {});
  const waifuCount = Object.values(db.waifus || {}).reduce(
    (acc, userMap) => acc + Object.keys(userMap || {}).length,
    0
  );

  const totalUsers = usersList.length;
  const registeredUsers = usersList.filter(u => u.registered).length;
  const totalGroups = groupsList.length;
  const bannedUsers = usersList.filter(u => u.banned === 1).length;
  const totalCommands = usersList.reduce((acc, u) => acc + (u.total_commands || 0), 0);

  const memUsage = process.memoryUsage();
  const uptimeSeconds = process.uptime();
  const days = Math.floor(uptimeSeconds / (3600 * 24));
  const hours = Math.floor((uptimeSeconds % (3600 * 24)) / 3600);
  const minutes = Math.floor((uptimeSeconds % 3600) / 60);
  const seconds = Math.floor(uptimeSeconds % 60);

  const uptimeStr = `${days > 0 ? `${days}d ` : ""}${hours}h ${minutes}m ${seconds}s`;
  const stats =
    `✦━【 📊 *ESTADÍSTICAS* 】━✦\n\n` +
    `◈ *Usuarios totales:* 👥 ${totalUsers}\n` +
    `◈ *Usuarios registrados:* 📜 ${registeredUsers}\n` +
    `◈ *Grupos activos:* 💬 ${totalGroups}\n` +
    `◈ *Baneados:* 🚫 ${bannedUsers}\n` +
    `◈ *Colección total waifus:* 🌸 ${waifuCount}\n` +
    `◈ *Comandos ejecutados:* 📱 ${totalCommands.toLocaleString()}\n` +
    `◈ *Plugins activos:* 🔌 ${plugins.length}\n\n` +
    `✦━【 ⚙️ *SISTEMA & HOSTING* 】━✦\n\n` +
    `◈ *Tiempo en línea:* ⏱️ ${uptimeStr}\n` +
    `◈ *Memoria Heap RAM:* 🧠 ${(memUsage.heapUsed / 1024 / 1024).toFixed(1)} MB\n` +
    `◈ *Memoria Sistema:* 💾 ${(os.freemem() / 1024 / 1024 / 1024).toFixed(2)} GB / ${(os.totalmem() / 1024 / 1024 / 1024).toFixed(2)} GB`;

  const botJid = getBotJid(conn, config.botNumber);

  await sendProfilePictureMessage(conn, m.chatId, botJid, stats, {
    quoted: m,
  });
};

handler.command = /^(stats|estadisticas|estadísticas|botstats)$/i;
handler.description = "Ver estadísticas en tiempo real del bot";
handler.category = "info";

export default handler;
