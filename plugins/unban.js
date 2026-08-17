// ============================================================
//   Kurumi Tokisaki - Unban Command
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
      `✦━【 🔓 *UNBAN* 】━✦\n\n` +
      `📝 Desbanea a un usuario del bot.\n` +
      `💡 Sintaxis: \`${usedPrefix}unban @usuario\` o responde a su mensaje\n` +
      `📌 Ejemplo: \`${usedPrefix}unban @529852270023\``
    );
  }

  const user = getUser(targetJid);
  if (!user || !user.banned) {
    return m.reply(
      `⚠️ *Atención*\n────────\n@${targetJid.split("@")[0]} no está baneado.`,
      { mentions: [targetJid] }
    );
  }

  updateUser(targetJid, { banned: 0 });
  await m.reply(
    `✦━【 🔓 *USUARIO DESBANEADO* 】━✦\n\n` +
    `👤 @${targetJid.split("@")[0]} ha sido desbaneado del bot.`,
    { mentions: [targetJid] }
  );
};

handler.command = /^(unban|desbanear)$/i;
handler.description = "Desbanear a un usuario";
handler.category = "admin";
handler.owner = true;

export default handler;
