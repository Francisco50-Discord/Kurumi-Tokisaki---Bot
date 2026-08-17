// ============================================================
//   Kurumi Tokisaki - Trabajo Command
// ============================================================

import { getUser, addCoins, addExp, getCooldown, setCooldown } from "../lib/database.js";
import { randomInt, randomElement } from "../lib/utils.js";

const handler = async (m, { sender }) => {
  const cooldownTime = 3600;
  const remaining = getCooldown(sender, "work");

  if (remaining > 0) {
    const minutes = Math.ceil(remaining / 60000);
    return m.reply(`✦━【 ⏳ *TRABAJO EN COOLDOWN* 】━✦\n\n⏳ Ya trabajaste. Vuelve en *${minutes} minutos*.\n\n✨ *Kurumi Tokisaki*`);
  }

  const jobs = [
    { name: "Programador", emoji: "💻", min: 100, max: 300 },
    { name: "Chef", emoji: "👨‍🍳", min: 80, max: 200 },
    { name: "Médico", emoji: "👨‍⚕️", min: 150, max: 400 },
    { name: "Maestro", emoji: "👨‍🏫", min: 90, max: 250 },
    { name: "Músico", emoji: "🎵", min: 60, max: 350 },
    { name: "Artista", emoji: "🎨", min: 70, max: 280 },
    { name: "Mecánico", emoji: "🔧", min: 100, max: 220 },
    { name: "Piloto", emoji: "✈️", min: 200, max: 500 },
  ];

  const job = randomElement(jobs);
  const earned = randomInt(job.min, job.max);

  setCooldown(sender, "work", cooldownTime);
  addCoins(sender, earned);
  addExp(sender, 15);

  await m.reply(
    `✦━【 💼 *TRABAJO* 】━✦\n\n` +
    `${job.emoji} ¡Trabajaste como ${job.name}!\n` +
    `🪙 Ganaste: *${earned} monedas*\n` +
    `⭐ +15 EXP\n\n` +
    `⏰ Próximo trabajo en 1 hora.\n` +
    ``
  );
};

handler.command = /^(trabajo|work|trabajar|ganar)$/i;
handler.description = "Trabajar para ganar monedas";
handler.category = "rpg";
handler.register = true;

export default handler;
