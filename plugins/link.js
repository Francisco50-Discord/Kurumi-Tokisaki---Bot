// ============================================================
//   Kurumi Tokisaki - Link Command
// ============================================================

const handler = async (m, { conn, chatId, isGroup }) => {
  if (!isGroup) return m.reply(`✦━【 ❌ *ERROR* 】━✦\n\nSolo en grupos.`);

  try {
    const code = await conn.groupInviteCode(chatId);
    await m.reply(
      `✦━【 *ENLACE DEL GRUPO* 】━✦\n\n` +
      `🔗 https://chat.whatsapp.com/${code}`
    );
  } catch (err) {
    await m.reply(`✦━【 ❌ *ERROR* 】━✦\n\nNo se pudo obtener el enlace. Asegúrate de que el bot sea administrador del grupo.`);
  }
};

handler.command = /^(link|enlace|invite)$/i;
handler.description = "Obtener enlace de invitación del grupo";
handler.category = "grupo";
handler.group = true;
handler.admin = true;
handler.botAdmin = true;

export default handler;
