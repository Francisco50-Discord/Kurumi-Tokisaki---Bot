// ============================================================
//   Kurumi Tokisaki - Robar Command
// ============================================================

import { getUser, addCoins, removeCoins, addExp, getCooldown, setCooldown } from "../lib/database.js";
import { randomInt, resolveTargetJid, areJidsEqual } from "../lib/utils.js";

const handler = async (m, { conn, args, sender, isGroup, usedPrefix }) => {
  const cooldownTime = 7200;
  const remaining = getCooldown(sender, "rob");

  if (remaining > 0) {
    const hours = Math.ceil(remaining / 3600000);
    return m.reply(`✦━【 🦹 *ROBAR* 】━✦\n\n⏳ Espera *${hours} hora${hours !== 1 ? "s" : ""}*.`);
  }

  let targetJid = await resolveTargetJid(m, args, conn);

  if (!targetJid) {
    if (!isGroup) {
      targetJid = conn.user?.id ? (conn.user.id.split(":")[0] + "@s.whatsapp.net") : "bot@s.whatsapp.net";
    } else {
      return m.reply(`✦━【 🦹 *ROBAR* 】━✦\n\n🦹 Uso: *${usedPrefix}robar @usuario*`);
    }
  }

  if (areJidsEqual(targetJid, sender)) {
    return m.reply("❌ No puedes robarte a ti mismo.");
  }

  const target = getUser(targetJid);
  const targetCoins = target ? target.coins : 500;
  if (targetCoins < 50) {
    return m.reply("❌ Ese usuario no tiene suficientes monedas para robar.");
  }

  setCooldown(sender, "rob", cooldownTime);

  const success = Math.random() < 0.5;

  if (success) {
    const stolen = randomInt(50, Math.min(200, targetCoins));
    addCoins(sender, stolen);
    if (target) removeCoins(targetJid, stolen);
    addExp(sender, 20);

    await m.reply(
      `✦━【 🦹 *¡ROBO EXITOSO!* 】━✦\n\n` +
      `◈ Le robaste *${stolen} monedas* a @${targetJid.split("@")[0]}\n` +
      `◈ Recompensa: ⭐ *+20 EXP*`,
      { mentions: [targetJid] }
    );
  } else {
    const fine = randomInt(50, 150);
    removeCoins(sender, fine);

    await m.reply(
      `✦━【 👮 *¡TE ATRAPARON!* 】━✦\n\n` +
      `◈ Intentaste robar a @${targetJid.split("@")[0]}\n` +
      `◈ Multa: 💰 *${fine} monedas*`,
      { mentions: [targetJid] }
    );
  }
};

handler.command = /^(robar|rob)$/i;
handler.description = "Robar monedas a otro usuario";
handler.category = "rpg";
handler.register = true;

export default handler;
