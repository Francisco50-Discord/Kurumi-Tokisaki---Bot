// ============================================================
//   Kurumi Tokisaki - Daily Command
// ============================================================

import { getUser, updateUser, addCoins, addExp } from "../lib/database.js";

const handler = async (m, { sender }) => {
  const user = getUser(sender);
  const now = new Date();
  const lastDaily = user.last_daily ? new Date(user.last_daily) : null;

  if (lastDaily) {
    const diff = now - lastDaily;
    const hours = diff / 3600000;

    if (hours < 24) {
      const remaining = 24 - hours;
      const h = Math.floor(remaining);
      const min = Math.floor((remaining - h) * 60);
      return m.reply(
        `✦━【 *DAILY* 】━✦\n` +
        `\n\n` +
        `⚠️ Ya reclamaste tu\n` +
        `   recompensa diaria.\n` +
        `Vuelve en *${h}h ${min}m*\n\n` +
        `🔥 Racha: ${user.daily_streak || 0} días\n` +
        ``
      );
    }
  }

  let streak = user.daily_streak || 0;
  if (lastDaily) {
    const diff = now - lastDaily;
    const hours = diff / 3600000;
    streak = hours < 48 ? streak + 1 : 1;
  } else {
    streak = 1;
  }

  const baseCoins = 200;
  const streakBonus = Math.min(streak * 20, 500);
  const totalCoins = baseCoins + streakBonus;
  const exp = 50 + streak * 5;

  addCoins(sender, totalCoins);
  addExp(sender, exp);
  updateUser(sender, {
    last_daily: now.toISOString(),
    daily_streak: streak,
  });

  const streakEmoji = streak >= 30 ? "🔥🔥🔥" : streak >= 14 ? "🔥🔥" : streak >= 7 ? "🔥" : "✨";

  await m.reply(
    `✦━【 *¡RECOMPENSA DIARIA!* 】━✦\n` +
    `\n\n` +
    `🪙 Monedas: +*${totalCoins}*\n` +
    `⭐ EXP: +*${exp}*\n\n` +
    `${streakEmoji} Racha: *${streak} día${streak !== 1 ? "s" : ""}*\n` +
    (streak >= 7 ? `🎉 Bonus de racha: +${streakBonus} monedas!\n` : "") +
    `\n¡Vuelve mañana para\n` +
    `   mantener tu racha!\n` +
    ``
  );
};

handler.command = /^(daily|diario|recompensa|claim)$/i;
handler.description = "Reclamar recompensa diaria";
handler.category = "daily";
handler.register = true;

export default handler;
