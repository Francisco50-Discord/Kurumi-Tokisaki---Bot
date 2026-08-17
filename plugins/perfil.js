// ============================================================
//   Kurumi Tokisaki - Perfil RPG Command
//   v20.0: Usa helper centralizado lib/profilePicture.js
//   Garantiza que SIEMPRE se envía una imagen (real o avatar
//   por defecto) — nunca undefined.toString() crash.
// ============================================================

import { getUser } from "../lib/database.js";
import { progressBar, resolveTargetJid } from "../lib/utils.js";
import { config } from "../config/settings.js";
import { sendProfilePictureMessage } from "../lib/profilePicture.js";

const CLASSES = {
  Novato: { emoji: "👤", bonus: {} },
  Guerrero: { emoji: "⚔️", bonus: { attack: 5, defense: 3 } },
  Mago: { emoji: "🧙", bonus: { attack: 8, speed: 3 } },
  Arquero: { emoji: "🏹", bonus: { speed: 8, attack: 3 } },
  Sanador: { emoji: "💚", bonus: { defense: 5, health: 20 } },
  Asesino: { emoji: "🗡️", bonus: { attack: 10, speed: 5 } },
  Paladín: { emoji: "🛡️", bonus: { defense: 8, health: 15 } },
  Nigromante: { emoji: "💀", bonus: { attack: 7, defense: 2 } },
};

const handler = async (m, { conn, args, sender }) => {
  const targetSender = (await resolveTargetJid(m, args, conn)) || sender;
  const user = getUser(targetSender);

  if (!user) {
    return m.reply("❌ Usuario no encontrado. Usa *!registro* para crear tu perfil.");
  }

  const classInfo = CLASSES[user.class] || CLASSES.Novato;
  const expNeeded = user.level * 100 + (user.level - 1) * 50;
  const expBar = progressBar(user.exp, expNeeded, 6);
  const hpBar = progressBar(user.health, user.max_health, 6);

  const displayName = user.name && user.name !== "Usuario"
    ? user.name
    : `@${user.id.split("@")[0].split(":")[0]}`;

  const profile = `
✦━【 👤 *PERFIL RPG* 】━✦

◈ *Nombre:* ${displayName}
◈ *Clase:* ${classInfo.emoji} ${user.class}
◈ *Nivel:* ⭐ ${user.level}
◈ *EXP:* ✨ ${expBar} (${user.exp}/${expNeeded})
◈ *HP:* ❤️ ${hpBar} (${user.health}/${user.max_health})
◈ *Ataque:* ⚔️ ${user.attack}
◈ *Defensa:* 🛡️ ${user.defense}
◈ *Velocidad:* ⚡ ${user.speed}
◈ *Monedas:* 💰 ${(user.coins || 0).toLocaleString()}
◈ *Gemas:* 💎 ${user.gems || 0}
◈ *Victorias:* 🏆 ${user.wins || 0}
◈ *Comandos:* 📱 ${user.total_commands || 0}

✦ *${config.botName}*
  `.trim();

  // ─── v21.0: Helper centralizado con cascada URL → buffer → default avatar ───
  // El helper internamente:
  //   1) getProfilePictureUrl(conn, jid) — obtiene URL del CDN
  //   2) sendMessage({ image: { url } }) — Baileys descarga con su stack HTTP
  //   3) Si falla, descargamos buffer manualmente con headers WhatsApp
  //   4) Si falla, avatar por defecto
  //   5) Si todo falla, solo texto
  await sendProfilePictureMessage(conn, m.chatId, targetSender, profile, {
    mentions: [targetSender],
    quoted: m,
    fallbackJid: m.chatId,
  });
};

handler.command = /^(perfil|profile)$/i;
handler.description = "Ver perfil RPG";
handler.category = "rpg";

export default handler;
