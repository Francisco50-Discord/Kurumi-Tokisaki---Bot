// ============================================================
//   Kurumi Tokisaki - Antilink Command
// ============================================================

import { getGroup, updateGroup } from "../lib/database.js";

const handler = async (m, { args, chatId, isGroup, isAdmin, isOwner }) => {
  if (!isGroup) return m.reply(`❌ Solo en grupos.`);
  if (!isAdmin && !isOwner) return m.reply(`❌ Solo administradores.`);

  const action = args[0]?.toLowerCase();
  const enable = ["on", "activar"].includes(action);
  const disable = ["off", "desactivar"].includes(action);

  if (!enable && !disable) {
    const groupConfig = getGroup(chatId);
    return m.reply(
      `✦━【 🔗 *ANTILINK* 】━✦\n\n` +
      `◈ *Estado:* ${groupConfig?.antilink ? "✅ Activado" : "❌ Desactivado"}\n\n` +
      `💡 *Uso:*\n` +
      `• \`!antilink on\` para activar\n` +
      `• \`!antilink off\` para desactivar`
    );
  }

  updateGroup(chatId, { antilink: enable ? 1 : 0 });
  await m.reply(enable ? `✅ *Antilink activado*` : `✅ *Antilink desactivado*`);
};

handler.command = /^(antilink)$/i;
handler.description = "Activar/desactivar antilink";
handler.category = "grupo";
handler.group = true;
handler.admin = true;

export default handler;
