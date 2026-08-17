// ============================================================
//   Kurumi Tokisaki - Revoke Command
// ============================================================

const handler = async (m, { conn, chatId, isGroup, isAdmin, isOwner }) => {
  if (!isGroup) return m.reply(`✦━【 ❌ *ERROR* 】━✦\n\nSolo en grupos.`);
  if (!isAdmin && !isOwner) return m.reply(`✦━【 ❌ *ERROR* 】━✦\n\nSolo administradores.`);

  try {
    await conn.groupRevokeInvite(chatId);
    const newCode = await conn.groupInviteCode(chatId);
    await m.reply(
      `✦━【 🔄 *ENLACE REVOCADO* 】━✦\n\n` +
      `Se ha generado un nuevo enlace:\n` +
      `🔗 https://chat.whatsapp.com/${newCode}`
    );
  } catch (err) {
    await m.reply(`✦━【 ❌ *ERROR* 】━✦\n\nNo se pudo revocar el enlace.`);
    throw err;
  }
};

handler.command = /^(revoke|revocar|newlink)$/i;
handler.description = "Revocar y generar nuevo enlace del grupo";
handler.category = "grupo";
handler.group = true;
handler.admin = true;
handler.botAdmin = true;

export default handler;
