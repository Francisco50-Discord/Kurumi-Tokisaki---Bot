// ============================================================
//   Kurumi Tokisaki - Dungeon Command
// ============================================================

import { getUser, addCoins, addExp, addItem, checkLevelUp, getCooldown, setCooldown, updateUser } from "../lib/database.js";
import { randomInt, randomElement, sleep } from "../lib/utils.js";

const DUNGEONS = [
  { name: "Cueva de los Goblins", minLevel: 1, difficulty: 1, rewards: { coins: [50, 150], exp: [30, 80], items: ["Poción de Vida"] } },
  { name: "Bosque Maldito", minLevel: 3, difficulty: 2, rewards: { coins: [100, 300], exp: [60, 150], items: ["Espada de Hierro", "Escudo de Madera"] } },
  { name: "Torre del Mago", minLevel: 5, difficulty: 3, rewards: { coins: [200, 500], exp: [100, 250], items: ["Amuleto Mágico"] } },
  { name: "Castillo Oscuro", minLevel: 8, difficulty: 4, rewards: { coins: [400, 800], exp: [200, 400], items: ["Espada de Acero", "Armadura de Hierro"] } },
  { name: "Abismo Eterno", minLevel: 12, difficulty: 5, rewards: { coins: [700, 1500], exp: [400, 800], items: ["Arco Élfico", "Grimorio Oscuro"] } },
];

const handler = async (m, { args, sender, usedPrefix }) => {
  const cooldownTime = 1800;
  const remaining = getCooldown(sender, "dungeon");

  if (remaining > 0) {
    const minutes = Math.ceil(remaining / 60000);
    return m.reply(`✦━【 🏰 *DUNGEON* 】━✦\n\n⏳ Espera *${minutes} minutos*.`);
  }

  const user = getUser(sender);
  const availableDungeons = DUNGEONS.filter((d) => d.minLevel <= user.level);

  if (availableDungeons.length === 0) {
    return m.reply("❌ No tienes el nivel suficiente. Sube de nivel primero.");
  }

  if (!args[0]) {
    let dungeonList = `✦━【 🏰 *MAZMORRAS* 】━✦\n\n`;
    availableDungeons.forEach((d, i) => {
      dungeonList += `» ${i + 1}. *${d.name}*\n`;
      dungeonList += `   📊 Nivel: ${d.minLevel} | ⚔️ Dif: ${"⭐".repeat(d.difficulty)}\n`;
    });
    dungeonList += `\n💡 Usa *${usedPrefix}dungeon <número>*`;
    return m.reply(dungeonList);
  }

  const dungeonIndex = parseInt(args[0]) - 1;
  if (isNaN(dungeonIndex) || dungeonIndex < 0 || dungeonIndex >= availableDungeons.length) {
    return m.reply("❌ Número de mazmorra inválido.");
  }

  const dungeon = availableDungeons[dungeonIndex];

  await m.reply(`✦━【 🏰 *DUNGEON* 】━✦\n\n🏰 Entrando: *${dungeon.name}*\n⚔️ Explorando...\n¡Encontraste enemigos!`);
  await sleep(2000);

  const playerPower = user.attack + user.defense + user.speed + user.level * 5;
  const dungeonPower = dungeon.difficulty * 30 + randomInt(-10, 10);
  const success = playerPower > dungeonPower || Math.random() < 0.4;

  setCooldown(sender, "dungeon", cooldownTime);

  if (success) {
    const coins = randomInt(...dungeon.rewards.coins);
    const exp = randomInt(...dungeon.rewards.exp);
    const item = Math.random() < 0.3 ? randomElement(dungeon.rewards.items) : null;

    addCoins(sender, coins);
    addExp(sender, exp);
    if (item) addItem(sender, item, "equipment");

    const levelResult = checkLevelUp(sender);

    let result = `✦━【 🏆 *¡VICTORIA!* 】━✦\n\n`;
    result += `◈ Mazmorra: *${dungeon.name}*\n`;
    result += `◈ Recompensa: 🪙 *+${coins} monedas* | ⭐ *+${exp} EXP*\n`;
    if (item) result += `◈ Ítem: 🎁 *${item}*\n`;
    if (levelResult.leveledUp) result += `\n🎉 *¡SUBISTE AL NIVEL ${levelResult.newLevel}!*`;

    await m.reply(result);
  } else {
    const hpLost = randomInt(20, 50);
    updateUser(sender, { health: Math.max(1, user.health - hpLost) });

    await m.reply(
      `✦━【 💀 *¡DERROTA!* 】━✦\n\n` +
      `◈ Mazmorra: *${dungeon.name}*\n` +
      `◈ HP perdido: ❤️ *${hpLost}*\n\n` +
      `¡Vuelve más fuerte! Usa *!tienda* para pociones.`
    );
  }
};

handler.command = /^(dungeon|mazmorra|explorar|raid)$/i;
handler.description = "Explorar una mazmorra";
handler.category = "rpg";
handler.register = true;

export default handler;
