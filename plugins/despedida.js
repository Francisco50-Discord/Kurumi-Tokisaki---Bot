// ============================================================
//   Kurumi Tokisaki - Despedida Command
// ============================================================

import { getGroup, updateGroup } from "../lib/database.js";

const handler = async (m, { args, chatId, isGroup, isAdmin, isOwner }) => {
  if (!isGroup) return m.reply(`✦━【 ❌ *ERROR* 】━✦\n\nSolo en grupos.`);
  if (!isAdmin && !isOwner) return m.reply(`✦━【 ❌ *ERROR* 】━✦\n\nSolo administradores.`);

  const action = args[0]?.toLowerCase();
  const enable = ["on", "activar"].includes(action);
  const disable = ["off", "desactivar"].includes(action);

  if (!enable && !disable) {
    const groupConfig = getGroup(chatId);
    const isGoodbyeOn = groupConfig?.goodbye === 1 || groupConfig?.goodbye === true;
    return m.reply(
      `✦━【 🥀 *DESPEDIDA* 】━✦\n` +
      `\n` +
      `Estado: ${isGoodbyeOn ? "✅ Activada" : "❌ Desactivada"}\n` +
      `\n\n` +
      `Usa:\n` +
      `  • \`!despedida on\` para activar\n` +
      `  • \`!despedida off\` para desactivar`
    );
  }

  updateGroup(chatId, { goodbye: enable ? 1 : 0 });
  await m.reply(enable ? `✅ *Despedida activada*` : `✅ *Despedida desactivada*`);
};

handler.command = /^(despedida|goodbye)$/i;
handler.description = "Configurar mensaje de despedida";
handler.category = "grupo";
handler.group = true;
handler.admin = true;

export default handler;
