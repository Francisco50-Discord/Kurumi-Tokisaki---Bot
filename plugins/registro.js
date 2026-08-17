// ============================================================
//   Kurumi Tokisaki - Registro RPG Command
//   v20.0: Usa helper centralizado lib/profilePicture.js
// ============================================================

import { getUser, updateUser } from "../lib/database.js";
import { config } from "../config/settings.js";
import { sendProfilePictureMessage } from "../lib/profilePicture.js";

const handler = async (m, { conn, sender }) => {
  const user = getUser(sender);

  if (user.registered) {
    const text =
      `✦━【 📋 *REGISTRO* 】━✦\n\n` +
      `✅ *¡Ya estás registrado!*\n` +
      `👤 *Nombre:* ${user.name || "Usuario"}\n` +
      `⭐ *Nivel:* ${user.level || 1}\n` +
      `💰 *Monedas:* ${(user.coins || 0).toLocaleString()}\n\n` +
      `👤 Usa *!perfil* para ver tus datos.\n` +
      ``;

    // v21.0: helper con cascada URL → buffer → avatar por defecto → texto
    return await sendProfilePictureMessage(conn, m.chatId, sender, text, {
      mentions: [sender],
      quoted: m,
      fallbackJid: m.chatId,
    });
  }

  const rawName = m.pushName || m.sender.split("@")[0];
  const realName = rawName.length > 15 ? rawName.slice(0, 14) + "…" : rawName;

  const initialCoins = Math.max(500, user.coins || 0);

  updateUser(sender, {
    name: realName,
    registered: true,
    registered_at: new Date().toISOString(),
    level: user.level || 1,
    exp: user.exp || 0,
    coins: initialCoins,
    health: user.health || 100,
    max_health: user.max_health || 100,
    attack: user.attack || 10,
    defense: user.defense || 5,
    speed: user.speed || 10,
    class: user.class || "Novato",
  });

  const welcomeText =
    `✦━【 ⚔️ *RPG KURUMI* 】━✦\n\n` +
    `✨ *¡Bienvenido al RPG!*\n` +
    `👤 *Nombre:* ${realName}\n` +
    `⚔️ *Clase:* ${user.class || "Novato"}\n` +
    `⭐ *Nivel:* ${user.level || 1}\n` +
    `💰 *Monedas:* ${initialCoins.toLocaleString()}\n\n` +
    `🗺️ Usa *!perfil* y *!menu*\n` +
    `   para comenzar tu aventura!\n` +
    ``;

  // v21.0: helper con cascada URL → buffer → avatar por defecto → texto
  await sendProfilePictureMessage(conn, m.chatId, sender, welcomeText, {
    mentions: [sender],
    quoted: m,
    fallbackJid: m.chatId,
  });
};

handler.command = /^(registro|register|registrar|reg)$/i;
handler.description = "Registrarse en el sistema RPG";
handler.category = "rpg";

export default handler;
