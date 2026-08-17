// ============================================================
//   Kurumi Tokisaki - Random Number Command
// ============================================================

import { randomInt } from "../lib/utils.js";

const handler = async (m, { args, usedPrefix }) => {
  const min = parseInt(args[0]) || 1;
  const max = parseInt(args[1]) || 100;

  if (min >= max) {
    return m.reply(`❌ El mínimo debe ser menor que el máximo.\nUso: ${usedPrefix}random <min> <max>`);
  }

  const result = randomInt(min, max);
  await m.reply(
    `✦━【 🎲 *NÚMERO ALEATORIO* 】━✦\n\n` +
    `🎲 Entre *${min}* y *${max}*\n\n` +
    `🎯 Resultado: *${result}*`
  );
};

handler.command = /^(random|aleatorio|numero|número)$/i;
handler.description = "Generar número aleatorio";
handler.category = "juegos";

export default handler;
