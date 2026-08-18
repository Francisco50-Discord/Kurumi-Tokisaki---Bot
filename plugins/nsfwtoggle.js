// ============================================================
//   Kurumi Tokisaki - NSFW Toggle Command
//   ────────────────────────
//   Command: nsfw
//   Toggle NSFW on/off in group, list categories
// ============================================================

import { config } from "../config/settings.js";
import { getGroup, updateGroup, getUser, updateUser } from "../lib/database.js";

// ─── Category list (for display) ───
const CATEGORY_LIST = [
  "hentai", "hentaigif", "nsfwwaifu", "nsfwneko",
  "blowjob", "anal", "boobs", "ass", "pussy", "cumshot", "feet",
  "yuri", "ahegao", "succubus", "thighs", "paizuri",
  "ecchi", "kuni", "keta", "erok", "lewd", "holoero"
];

// ─── Handler ───
const handler = async (m, { args, chatId, isGroup, isAdmin, isOwner, sender, usedPrefix }) => {
  const p = usedPrefix || "!";
  const action = args[0]?.toLowerCase();

  // ──── LISTA DE CATEGORÍAS (Acceso público) ────
  if (action === "lista" || action === "list" || action === "categorias") {
    return m.reply(
      `✦━【 🔞 *CATEGORÍAS NSFW* 】━✦\n` +
      `🔞 *Comandos NSFW:* \n` +
      CATEGORY_LIST.map((c) => `  • ${p}${c}`).join("\n") +
      `\n\n` +
      `💡 En grupos, estos comandos solo funcionan después de que un administrador active NSFW con \`${p}nsfw on\`.\n` +
      ``
    );
  }

  if (config.nsfwEnabled === false) {
    return m.reply("✦━【 🔞 *NSFW NO DISPONIBLE* 】━✦\n\nEsta función está deshabilitada globalmente en el bot.");
  }

  // ──── CHAT PRIVADO ────
  if (!isGroup) {
    const user = getUser(sender);
    const isPrivateOn = user?.nsfw === true && config.nsfwPrivateEnabled !== false;

    if (!action || !["on", "off", "activar", "desactivar"].includes(action)) {
      const status = isPrivateOn ? "✅ Activado" : "❌ Desactivado";
      return m.reply(
        `✦━【 🔞 *NSFW EN CHAT PRIVADO* 】━✦\n` +
        `Estado actual: ${status}\n` +
        `\n` +
        `💡 Comandos:\n` +
        `  • ${p}nsfw on — Activar\n` +
        `  • ${p}nsfw off — Desactivar\n` +
        `  • ${p}nsfw lista — Ver categorías\n` +
        ``
      );
    }

    const enable = ["on", "activar"].includes(action);
    updateUser(sender, { nsfw: enable });

    return m.reply(enable
      ? `✦━【 🔞 *NSFW ACTIVADO* 】━✦\n\nLos comandos NSFW ya están disponibles para ti en chat privado.\n\n✨ *Kurumi Tokisaki*`
      : `✦━【 🔞 *NSFW DESACTIVADO* 】━✦\n\nLos comandos NSFW ya no están disponibles para ti en chat privado.\n\n✨ *Kurumi Tokisaki*`
    );
  }

  // ──── EN GRUPOS (Requiere Admin) ────
  if (!isAdmin && !isOwner) {
    return m.reply(
      `✦━【 ❌ *PERMISO REQUERIDO* 】━✦\n\nSolo los administradores pueden activar o desactivar NSFW en este grupo.\n\nPide a un administrador que use \`${p}nsfw on\` o \`${p}nsfw off\`.`
    );
  }

  const groupConfig = getGroup(chatId);

  if (!action || !["on", "off", "activar", "desactivar"].includes(action)) {
    const isNsfwOn = Boolean(groupConfig?.nsfw === 1 || groupConfig?.nsfw === true);
    const status = isNsfwOn ? "✅ Activado" : "❌ Desactivado";
    return m.reply(
      `✦━【 🔞 *NSFW EN ESTE GRUPO* 】━✦\n` +
      `Estado actual: ${status}\n` +
      `\n` +
      `💡 Comandos:\n` +
      `  • ${p}nsfw on — Activar\n` +
      `  • ${p}nsfw off — Desactivar\n` +
      `  • ${p}nsfw lista — Ver categorías\n` +
      ``
    );
  }

  const enable = ["on", "activar"].includes(action);

  updateGroup(chatId, { nsfw: enable ? 1 : 0 });

  if (enable) {
    await m.reply(
      `✦━【 🔞 *NSFW ACTIVADO* 】━✦\n\nLos comandos NSFW ya están disponibles en este grupo.\n\n✨ *Kurumi Tokisaki*`
    );
  } else {
    await m.reply(
      `✦━【 🔞 *NSFW DESACTIVADO* 】━✦\n\nLos comandos NSFW han sido desactivados en este grupo.\n\n✨ *Kurumi Tokisaki*`
    );
  }
};

handler.command = /^(nsfw)$/i;
handler.description = "Activar/desactivar NSFW (grupo o privado)";
handler.category = "nsfw";

export default handler;
