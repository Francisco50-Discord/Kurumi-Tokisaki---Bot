// ============================================================
//   Kurumi Tokisaki - IQ Test Command
// ============================================================

import { randomInt, normalizeJid, resolveTargetJid } from "../lib/utils.js";

const handler = async (m, { conn, args, sender }) => {
  const targetJid = (await resolveTargetJid(m, args, conn)) || normalizeJid(sender);
  const targetNum = targetJid.split("@")[0].split(":")[0];

  const iq = randomInt(50, 200);
  let label = "🌟 ¡Genio!";

  if (iq < 70) label = "🐌 Necesitas estudiar más";
  else if (iq < 90) label = "😐 Inteligencia promedio baja";
  else if (iq < 110) label = "😊 Inteligencia normal";
  else if (iq < 130) label = "🧠 Por encima del promedio";
  else if (iq < 150) label = "🎓 Muy inteligente";

  await m.reply(
    `✦━【 *TEST DE IQ* 】━✦\n\n` +
    `@${targetNum}\n\n` +
    `📊 Tu IQ: *${iq}*\n` +
    `${label}`,
    { mentions: [targetJid] }
  );
};

handler.command = /^(iq|inteligencia|cociente)$/i;
handler.description = "Test de IQ";
handler.category = "misc";

export default handler;
