// ============================================================
//   Kurumi Tokisaki - Minar Command
// ============================================================

import { getUser, addCoins, addExp, getCooldown, setCooldown } from "../lib/database.js";
import { randomInt } from "../lib/utils.js";

const handler = async (m, { sender }) => {
  const remaining = getCooldown(sender, "mine");
  if (remaining > 0) {
    const minutes = Math.ceil(remaining / 60000);
    return m.reply(`✦━【 ⛏️ *MINAR EN COOLDOWN* 】━✦\n\n⏳ Espera *${minutes} minutos* antes de volver a minar.\n\n✨ *Kurumi Tokisaki*`);
  }

  setCooldown(sender, "mine", 2700);

  const resources = [
    { name: "Piedra", emoji: "🪨", value: 10, rarity: "Común" },
    { name: "Carbón", emoji: "⬛", value: 25, rarity: "Común" },
    { name: "Hierro", emoji: "🔩", value: 60, rarity: "Poco común" },
    { name: "Oro", emoji: "🪙", value: 150, rarity: "Raro" },
    { name: "Diamante", emoji: "💎", value: 500, rarity: "Épico" },
    { name: "Esmeralda", emoji: "💚", value: 800, rarity: "Legendario" },
  ];

  const weights = [35, 30, 20, 10, 4, 1];
  const rand = Math.random() * 100;
  let cumulative = 0;
  let found = resources[0];

  for (let i = 0; i < resources.length; i++) {
    cumulative += weights[i];
    if (rand < cumulative) {
      found = resources[i];
      break;
    }
  }

  addCoins(sender, found.value);
  addExp(sender, 12);

  await m.reply(
    `✦━【 *¡MINAR!* 】━✦\n\n\n` +
    `${found.emoji} Encontraste: *${found.name}*\n` +
    `✨ Rareza: ${found.rarity}\n` +
    `🪙 +${found.value} monedas\n` +
    `⭐ +12 EXP\n` +
    ``
  );
};

handler.command = /^(minar|mine|mineria|minería)$/i;
handler.description = "Ir a minar recursos";
handler.category = "rpg";
handler.register = true;

export default handler;
