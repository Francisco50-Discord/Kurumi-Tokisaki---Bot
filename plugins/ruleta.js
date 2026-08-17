// ============================================================
//   Kurumi Tokisaki - Ruleta Rusa Command
// ============================================================

import { randomInt, sleep } from "../lib/utils.js";

const handler = async (m, { conn, chatId, isGroup }) => {
  if (!isGroup) return m.reply(`✦━【 ❌ *ERROR* 】━✦\n\nEste juego solo funciona en grupos.`);

  const chambers = 6;
  const bullet = randomInt(1, chambers);
  const trigger = randomInt(1, chambers);

  await m.reply(
    `✦━【 *RULETA RUSA* 】━✦\n\n🔫 Girando el tambor...\n🎰 Apretando el gatillo...`
  );
  await sleep(2000);

  if (trigger === bullet) {
    await m.reply(
      `✦━【 *¡BANG!* 】━✦\n\n💥 @${m.sender.split("@")[0]} no tuvo suerte...\nLa bala estaba en la recámara ${trigger}!`,
      { mentions: [m.sender] }
    );
  } else {
    await m.reply(
      `✦━【 *¡CLIC!* 】━✦\n\n😮‍💨 @${m.sender.split("@")[0]} sobrevivió!\nLa recámara ${trigger} estaba vacía!`,
      { mentions: [m.sender] }
    );
  }
};

handler.command = /^(ruleta|rusa|russianroulette)$/i;
handler.description = "Jugar a la ruleta rusa";
handler.category = "juegos";
handler.cooldown = 10;

export default handler;
