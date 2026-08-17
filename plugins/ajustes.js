// ============================================================
//   Kurumi Tokisaki - Panel de Ajustes de Grupo
// ============================================================

import { getGroup } from "../lib/database.js";

const state = (enabled) => enabled ? "✅ Activado" : "❌ Desactivado";

const handler = async (m, { chatId, isGroup, usedPrefix }) => {
  if (!isGroup) {
    return m.reply("✦━【 ❌ *ERROR* 】━✦\n\nEste panel solo está disponible en grupos.");
  }

  const group = getGroup(chatId);
  const nsfwOn = group?.nsfw === 1 || group?.nsfw === true;
  const antilinkOn = group?.antilink === 1 || group?.antilink === true;
  const welcomeOn = group?.welcome === 1 || group?.welcome === true;
  const goodbyeOn = group?.goodbye === 1 || group?.goodbye === true;
  const aiVal = group?.ai_command_enabled;
  const aiOn = aiVal === 1 || aiVal === true || aiVal === "1" || aiVal === "on" || aiVal === "true";
  const aiMode = "Solo por comando";

  return m.reply(
    `✦━【 ⚙️ *AJUSTES DEL GRUPO* 】━✦\n\n` +
    `🔞 *NSFW:* ${state(nsfwOn)}\n` +
    `🔗 *Antilink:* ${state(antilinkOn)}\n` +
    `🌸 *Bienvenida:* ${state(welcomeOn)}\n` +
    `🥀 *Despedida:* ${state(goodbyeOn)}\n` +
    `✨ *IA:* ${state(aiOn)}\n` +
    `💬 *Modo IA:* ${aiMode}\n\n` +
    `🔐 *Solo administradores pueden modificar estos ajustes:*\n` +
    `• \`${usedPrefix}nsfw on/off\`\n` +
    `• \`${usedPrefix}antilink on/off\`\n` +
    `• \`${usedPrefix}bienvenida on/off\`\n` +
    `• \`${usedPrefix}despedida on/off\`\n` +
    `• \`${usedPrefix}ia on/off\` — IA solo por comando\n` +
    `• \`${usedPrefix}personalidad <nombre>\`\n` +
    `• \`${usedPrefix}restablecerajustes confirmar\` — Restaurar todos los ajustes\n\n` +
    `📌 Para \`${usedPrefix}grupo abrir\` o \`${usedPrefix}grupo cerrar\`, el administrador también debe haber hecho administrador al bot.`
  );
};

handler.command = /^(ajustes|ajuste|configgrupo|settingsgrupo)$/i;
handler.description = "Ver los ajustes y permisos del grupo";
handler.category = "grupo";
handler.group = true;

export default handler;
