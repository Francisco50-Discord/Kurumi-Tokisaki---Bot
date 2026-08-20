// ============================================================
//   Kurumi Tokisaki - Ban Command
//   Silencia al bot en el grupo actual
// ============================================================

import { getGroup, updateGroup } from "../lib/database.js";

const handler = async (m, { chatId }) => {
  const groupConfig = getGroup(chatId);

  if (groupConfig?.mute === 1 || groupConfig?.mute === true) {
    return m.reply(
      `✦━【 🔇 *BOT YA SILENCIADO* 】━✦\n\n` +
      `El bot ya está silenciado en este grupo.\n` +
      `Cualquier participante puede usar \`/unban\` para reactivarlo.`
    );
  }

  updateGroup(chatId, { mute: 1 });
  await m.reply(
    `✦━【 🔇 *BOT SILENCIADO* 】━✦\n\n` +
    `El bot permanecerá en silencio en este grupo.\n` +
    `Solo se procesará \`/unban\` para volver a la normalidad.`
  );
};

handler.command = /^(ban|banear)$/i;
handler.description = "Silenciar al bot en el grupo actual";
handler.category = "grupo";
handler.group = true;
handler.admin = true;

export default handler;
