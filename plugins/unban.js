// ============================================================
//   Kurumi Tokisaki - Unban Command
//   Reactiva al bot en el grupo actual
// ============================================================

import { getGroup, updateGroup } from "../lib/database.js";

const handler = async (m, { chatId }) => {
  const groupConfig = getGroup(chatId);

  if (!(groupConfig?.mute === 1 || groupConfig?.mute === true)) {
    return m.reply(
      `✦━【 🔊 *BOT ACTIVO* 】━✦\n\n` +
      `El bot ya está funcionando con normalidad en este grupo.`
    );
  }

  updateGroup(chatId, { mute: 0 });
  await m.reply(
    `✦━【 🔊 *BOT REACTIVADO* 】━✦\n\n` +
    `El bot vuelve a responder con normalidad a usuarios y administradores.`
  );
};

handler.command = /^(unban|desbanear)$/i;
handler.description = "Reactivar al bot en el grupo actual";
handler.category = "grupo";
handler.group = true;
handler.admin = true;

export default handler;
