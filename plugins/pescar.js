// ============================================================
//   Kurumi Tokisaki - Pescar Command
// ============================================================

import { getUser, addCoins, addExp, getCooldown, setCooldown } from "../lib/database.js";
import { randomInt } from "../lib/utils.js";

const handler = async (m, { sender }) => {
  const remaining = getCooldown(sender, "fish");
  if (remaining > 0) {
    const minutes = Math.ceil(remaining / 60000);
    return m.reply(`✦━【 🎣 *PESCAR* 】━✦\n\n⏳ Espera *${minutes} minutos*.`);
  }

  setCooldown(sender, "fish", 1800);

  const fish = [
    { name: "Sardina", emoji: "🐟", value: 20, rarity: "Común" },
    { name: "Salmón", emoji: "🐠", value: 50, rarity: "Poco común" },
    { name: "Atún", emoji: "🐡", value: 100, rarity: "Raro" },
    { name: "Tiburón", emoji: "🦈", value: 300, rarity: "Épico" },
    { name: "Ballena", emoji: "🐋", value: 1000, rarity: "Legendario" },
    { name: "Bota vieja", emoji: "👢", value: 1, rarity: "Basura" },
    { name: "Tesoro", emoji: "💎", value: 500, rarity: "Mítico" },
  ];

  const weights = [40, 25, 15, 10, 2, 5, 3];
  const rand = Math.random() * 100;
  let cumulative = 0;
  let caught = fish[0];

  for (let i = 0; i < fish.length; i++) {
    cumulative += weights[i];
    if (rand < cumulative) {
      caught = fish[i];
      break;
    }
  }

  addCoins(sender, caught.value);
  addExp(sender, 10);

  await m.reply(
    `✦━【 🎣 *¡PESCAR!* 】━✦\n\n` +
    `◈ Atrapaste: ${caught.emoji} *${caught.name}*\n` +
    `◈ Rareza: *${caught.rarity}*\n` +
    `◈ Recompensa: 🪙 *+${caught.value} monedas* | ⭐ *+10 EXP*`
  );
};

handler.command = /^(pescar|fish|pesca)$/i;
handler.description = "Ir a pescar";
handler.category = "rpg";
handler.register = true;

export default handler;
