// ============================================================
//   Kurumi Tokisaki - Ban Command
// ============================================================

import { getUser, updateUser } from "../lib/database.js";

const handler = async (m, { args, isOwner, usedPrefix }) => {
  if (!isOwner) return m.reply(`✦━【 ❌ *ERROR* 】━✦\n\nSolo el owner puede usar este comando.`);

  const quoted = m.message?.extendedTextMessage?.contextInfo;
  const mentioned = m.mentionedJid?.[0] || m.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
  const targetNum = args.length > 0 ? args.join("").replace(/[^0-9]/g, "") : "";
  const targetJid = mentioned || (targetNum ? (targetNum + "@s.whatsapp.net") : quoted?.participant);

  if (!targetJid || targetJid.startsWith("undefined")) {
    return m.reply(
      `✦━【 🚫 *BAN* 】━✦\n\n` +
      `📝 Banea a un usuario del bot.\n` +
      `💡 Sintaxis: \`${usedPrefix}ban @usuario\` o responde a su mensaje\n` +
      `📌 Ejemplo: \`${usedPrefix}ban @529852270023\``
    );
  }

  const user = getUser(targetJid);
  if (user?.banned) {
    return m.reply(
      `⚠️ *Atención*\n────────\n@${targetJid.split("@")[0]} ya está baneado.`,
      { mentions: [targetJid] }
    );
  }

  updateUser(targetJid, { banned: 1 });
  await m.reply(
    `✦━【 🚫 *USUARIO BANEADO* 】━✦\n\n` +
    `👤 @${targetJid.split("@")[0]} ha sido baneado del bot.`,
    { mentions: [targetJid] }
  );
};

handler.command = /^(ban|banear)$/i;
handler.description = "Banear a un usuario del bot";
handler.category = "admin";
handler.owner = true;

export default handler;
