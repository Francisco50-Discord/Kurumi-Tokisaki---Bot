// ============================================================
//   Kurumi Tokisaki - Bienvenida Command
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
    return m.reply(
      `✦━【 🌸 *BIENVENIDA* 】━✦\n` +
      `\n` +
      `Estado: ${groupConfig?.welcome ? "✅ Activada" : "❌ Desactivada"}\n` +
      `\n\n` +
      `Usa:\n` +
      `  • \`!bienvenida on\` para activar\n` +
      `  • \`!bienvenida off\` para desactivar`
    );
  }

  updateGroup(chatId, { welcome: enable ? 1 : 0 });
  await m.reply(enable ? `✅ *Bienvenida activada*` : `✅ *Bienvenida desactivada*`);
};

handler.command = /^(bienvenida|welcome)$/i;
handler.description = "Configurar mensaje de bienvenida";
handler.category = "grupo";
handler.group = true;
handler.admin = true;

export default handler;
