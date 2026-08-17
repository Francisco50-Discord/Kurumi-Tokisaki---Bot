// ============================================================
//   Kurumi Tokisaki - Gay Meter Command
// ============================================================

import { randomInt, normalizeJid, resolveTargetJid } from "../lib/utils.js";

const handler = async (m, { conn, args, sender }) => {
  const targetJid = (await resolveTargetJid(m, args, conn)) || normalizeJid(sender);
  const targetNum = targetJid.split("@")[0].split(":")[0];

  const percentage = randomInt(0, 100);
  const filledCount = Math.floor(percentage / 10);
  const bar = "🌈".repeat(filledCount) + "⬜".repeat(10 - filledCount);

  await m.reply(
    `✦━【 *¿QUÉ TAN GAY ERES?* 】━✦\n\n` +
    `@${targetNum}\n\n` +
    `${bar}\n\n` +
    `📊 Resultado: *${percentage}%*`,
    { mentions: [targetJid] }
  );
};

handler.command = /^(gay|gaymeter)$/i;
handler.description = "Medidor de gay";
handler.category = "misc";

export default handler;
