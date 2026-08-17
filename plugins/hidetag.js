// ============================================================
//   Kurumi Tokisaki - Hidetag Command
// ============================================================

const handler = async (m, { conn, chatId, isGroup, isAdmin, isOwner, body }) => {
  if (!isGroup) return m.reply(`✦━【 ❌ *ERROR* 】━✦\n\nSolo en grupos.`);
  if (!isAdmin && !isOwner) return m.reply(`✦━【 ❌ *ERROR* 】━✦\n\nSolo administradores.`);

  try {
    const metadata = await conn.groupMetadata(chatId);
    // Se usa el LID de cada participante cuando Baileys lo expone en el grupo.
    const participants = metadata.participants.map((p) => p.lid || p.id).filter(Boolean);

    const message = body || "📢 Mención a todos";

    await conn.sendMessage(chatId, {
      text: message,
      mentions: participants,
    });
  } catch (err) {
    await m.reply(`✦━【 ❌ *ERROR* 】━✦\n\nError al mencionar a todos.`);
    throw err;
  }
};

handler.command = /^(hidetag|tagall|todos|everyone|mencionar)$/i;
handler.description = "Mencionar a todos en el grupo";
handler.category = "grupo";
handler.group = true;
handler.admin = true;
handler.cooldown = 30;

export default handler;
