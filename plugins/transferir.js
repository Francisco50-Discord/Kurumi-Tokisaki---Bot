// ============================================================
//   Kurumi Tokisaki - Transferir Command
// ============================================================

import { getUser, removeCoins, addCoins } from "../lib/database.js";
import { resolveTargetJid, areJidsEqual } from "../lib/utils.js";

const handler = async (m, { conn, args, sender, usedPrefix }) => {
  let targetJid = await resolveTargetJid(m, args, conn);
  const amount = parseInt(args[1] || args[0]);

  if (!targetJid || isNaN(amount) || amount <= 0) {
    return m.reply(
      `✦━【 💸 *TRANSFERIR MONEDAS* 】━✦\n\n` +
      `💡 *Uso correcto:*\n` +
      `\`${usedPrefix}transferir @usuario <cantidad>\`\n\n` +
      `📌 *Ejemplo:*\n` +
      `\`${usedPrefix}transferir @1234567890 100\``
    );
  }

  if (areJidsEqual(targetJid, sender)) {
    return m.reply("❌ No puedes transferirte monedas a ti mismo.");
  }

  const user = getUser(sender);
  if ((user.coins || 0) < amount) {
    return m.reply(`❌ No tienes suficientes monedas. Tienes: 🪙 *${(user.coins || 0).toLocaleString()}*`);
  }

  removeCoins(sender, amount);
  addCoins(targetJid, amount);

  await conn.sendMessage(
    m.chatId,
    {
      text:
        `✦━【 💸 *TRANSFERENCIA EXITOSA* 】━✦\n\n` +
        `💸 Enviaste 🪙 *${amount.toLocaleString()} monedas*\n` +
        `👤 a @${targetJid.split("@")[0]}\n\n` +
        `💰 Tus monedas restantes: 🪙 *${(user.coins - amount).toLocaleString()}*`,
      mentions: [targetJid]
    },
    { quoted: m }
  );
};

handler.command = /^(transferir|transfer|enviar|send)$/i;
handler.description = "Transferir monedas a otro usuario";
handler.category = "rpg";
handler.register = true;

export default handler;
