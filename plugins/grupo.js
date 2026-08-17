// ============================================================
//   Kurumi Tokisaki - Group Settings (Open/Close Group & IA)
// ============================================================

import { getGroup, updateGroup } from "../lib/database.js";

const handler = async (m, { conn, args, chatId, isGroup, isAdmin, isOwner, isBotAdmin, usedPrefix }) => {
  if (!isGroup) return m.reply(`✦━【 ❌ ERROR 】━✦\n\nEste comando solo funciona en grupos.`);
  if (!isAdmin && !isOwner) return m.reply(`✦━【 ❌ PERMISO 】━✦\n\nSolo los administradores pueden gestionar el grupo.`);

  const option = (args[0] || "").toLowerCase();
  const subOption = (args[1] || "").toLowerCase();

  if (option === "abrir" || option === "open" || option === "desmutear" || option === "unlock") {
    if (!isBotAdmin) return m.reply(`✦━【 ❌ PERMISO DEL BOT 】━✦\n\nHaz administrador al bot para abrir el grupo.`);
    try {
      await conn.groupSettingUpdate(chatId, "not_announcement");
      return m.reply(
        `✦━【 🔓 *GRUPO ABIERTO* 】━✦\n\n` +
        `Todos los participantes ahora pueden enviar mensajes.`
      );
    } catch (err) {
      return m.reply(`✦━【 ❌ ERROR 】━✦\n\nNo se pudo abrir el grupo.\nVerifica que el bot sea administrador.`);
    }
  }

  if (option === "cerrar" || option === "close" || option === "mutear" || option === "lock") {
    if (!isBotAdmin) return m.reply(`✦━【 ❌ PERMISO DEL BOT 】━✦\n\nHaz administrador al bot para cerrar el grupo.`);
    try {
      await conn.groupSettingUpdate(chatId, "announcement");
      return m.reply(
        `✦━【 🔒 *GRUPO CERRADO* 】━✦\n\n` +
        `Solo los administradores pueden enviar mensajes.`
      );
    } catch (err) {
      return m.reply(`✦━【 ❌ ERROR 】━✦\n\nNo se pudo cerrar el grupo.\nVerifica que el bot sea administrador.`);
    }
  }

  if (option === "ia" || option === "ai") {
    if (subOption === "on" || subOption === "activar" || subOption === "1" || subOption === "enable") {
      updateGroup(chatId, { ai_enabled: 1, ai_command_enabled: 1, ai_mode: "command" });
      return m.reply(`✦━【 ✅ IA ACTIVADA 】━✦\n\n*Modo:* Solo por comando\n\nUsa ${usedPrefix}ia <mensaje>\no ${usedPrefix}kurumi <mensaje>.\nNo respondo a menciones ni mensajes normales.`);
    }
    if (subOption === "off" || subOption === "desactivar" || subOption === "0" || subOption === "disable") {
      updateGroup(chatId, { ai_enabled: 0, ai_command_enabled: 0, ai_mode: "command" });
      return m.reply(`✦━【 ❌ IA DESACTIVADA 】━✦\n\nUsa ${usedPrefix}grupo ia on\npara reactivarla.`);
    }
    if (subOption === "all" || subOption === "todo" || subOption === "chat" || subOption === "mention" || subOption === "mencion" || subOption === "normal") {
      return m.reply(`✦━【 ℹ️ MODO AUTOMÁTICO 】━✦\n\nNo disponible temporalmente.\nUsa ${usedPrefix}ia <mensaje>\no ${usedPrefix}kurumi <mensaje>.`);
    }

    const currentGroup = getGroup(chatId);
    const aiVal = currentGroup?.ai_command_enabled;
    const aiEnabled = aiVal === 1 || aiVal === true || aiVal === "1" || aiVal === "on" || aiVal === "true";

    return m.reply(
      `✦━【 ✨ IA EN GRUPO 】━✦\n\n` +
      `*Estado:* ${aiEnabled ? "✅ Activada" : "❌ Desactivada"}\n` +
      `*Modo:* Solo por comando\n\n` +
      `*Uso:*\n` +
      `• ${usedPrefix}grupo ia on / off\n` +
      `• ${usedPrefix}ia <mensaje>\n` +
      `• ${usedPrefix}kurumi <mensaje>`
    );
  }

  return m.reply(
    `✦━【 ⚙️ *GESTIÓN DE GRUPO* 】━✦\n\n` +
    `📝 Permite abrir o cerrar los mensajes del grupo o gestionar la IA.\n\n` +
    `💡 *Uso:* \`${usedPrefix}grupo abrir\`\n` +
    `        \`${usedPrefix}grupo cerrar\`\n` +
    `        \`${usedPrefix}grupo ia on\` / \`${usedPrefix}grupo ia off\``
  );
};

handler.command = /^(grupo|group)$/i;
handler.description = "Abrir/cerrar chat del grupo o configurar IA del grupo";
handler.category = "grupo";
handler.group = true;
handler.admin = true;

export default handler;
