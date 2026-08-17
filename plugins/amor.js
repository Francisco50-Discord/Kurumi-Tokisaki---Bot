// ============================================================
//   Kurumi Tokisaki - Amor Command
// ============================================================

import { randomInt, normalizeJid, resolveTargetJid } from "../lib/utils.js";

const handler = async (m, { conn, args, sender, isGroup, usedPrefix }) => {
  let target = await resolveTargetJid(m, args, conn);

  if (!target) {
    if (!isGroup) {
      target = conn.user?.id ? normalizeJid(conn.user.id) : "bot@s.whatsapp.net";
    } else {
      return m.reply(
        `✦━【 *AMOR* 】━✦\n\n` +
        `📝 Calcula compatibilidad amorosa.\n` +
        `💡 Sintaxis: \`${usedPrefix}amor @usuario\` o responde a su mensaje`
      );
    }
  }

  const normSender = normalizeJid(sender);
  const senderNum = normSender.split("@")[0].split(":")[0];
  const targetNum = target.split("@")[0].split(":")[0];

  const percentage = randomInt(1, 100);
  const hearts = "❤️".repeat(Math.max(1, Math.floor(percentage / 10)));

  let veredict = "Quizás necesiten más tiempo... 🤔";
  if (percentage >= 80) veredict = "¡Son perfectos el uno para el otro! 💑";
  else if (percentage >= 50) veredict = "¡Hay química entre ustedes! 💕";

  await m.reply(
    `✦━【 *¿CUÁNTO SE AMAN?* 】━✦\n\n` +
    `@${senderNum} + @${targetNum}\n\n` +
    `${hearts}\n\n` +
    `💯 Compatibilidad: *${percentage}%*\n\n` +
    `${veredict}`,
    { mentions: [normSender, target] }
  );
};

handler.command = /^(amor|love|compat|compatibilidad)$/i;
handler.description = "Ver compatibilidad de amor";
handler.category = "misc";

export default handler;
