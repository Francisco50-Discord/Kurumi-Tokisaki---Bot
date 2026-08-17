// ============================================================
//   Kurumi Tokisaki - Dar Monedas Command
// ============================================================

import { addCoins } from "../lib/database.js";
import { resolveTargetJid } from "../lib/utils.js";

const handler = async (m, { conn, args, isOwner, usedPrefix }) => {
  if (!isOwner) return m.reply(`✦━【 ❌ *ERROR* 】━✦\n\nSolo el owner puede usar este comando.`);

  let targetJid = await resolveTargetJid(m, args, conn);
  const amount = parseInt(args[1] || args[0]);

  if (!targetJid || isNaN(amount)) {
    return m.reply(
      `✦━【 *DARMONEDAS* 】━✦\n` +
      `\n\n` +
      `📝 Da monedas a un usuario.\n` +
      `💡 Sintaxis:\n` +
      `   \`${usedPrefix}darmonedas @usuario <cantidad>\`\n` +
      `📌 Ejemplo:\n` +
      `   \`${usedPrefix}darmonedas @usuario 1000\`\n` +
      ``
    );
  }

  addCoins(targetJid, amount);

  await m.reply(
    `✦━【 *MONEDAS ENTREGADAS* 】━✦\n` +
    `\n\n` +
    `Se dieron *${amount}* monedas\n` +
    `a @${targetJid.split("@")[0]}\n` +
    ``,
    { mentions: [targetJid] }
  );
};

handler.command = /^(darmonedas|givecoins|addcoins)$/i;
handler.description = "Dar monedas a un usuario";
handler.category = "admin";
handler.owner = true;

export default handler;
