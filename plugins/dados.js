// ============================================================
//   Kurumi Tokisaki - Dados Command
// ============================================================

import { randomInt } from "../lib/utils.js";

const handler = async (m, { args }) => {
  const sides = parseInt(args[0]) || 6;
  const count = parseInt(args[1]) || 1;

  if (sides < 2 || sides > 100) {
    return m.reply(`✦━【 ❌ *ERROR* 】━✦\n\nEl dado debe tener entre 2 y 100 caras.`);
  }
  if (count < 1 || count > 10) {
    return m.reply(`✦━【 ❌ *ERROR* 】━✦\n\nPuedes tirar entre 1 y 10 dados.`);
  }

  const rolls = Array.from({ length: count }, () => randomInt(1, sides));
  const total = rolls.reduce((a, b) => a + b, 0);

  let response = `✦━【 *TIRADA DE DADOS* 】━✦\n\n`;
  response += `🎲 ${count} dado${count > 1 ? "s" : ""} de ${sides} caras\n`;
  response += `Resultado: ${rolls.join(", ")}`;
  if (count > 1) response += `\nTotal: *${total}*`;
  response += `\n`;

  await m.reply(response);
};

handler.command = /^(dado|dados|dice)$/i;
handler.description = "Tirar dados";
handler.category = "juegos";

export default handler;
