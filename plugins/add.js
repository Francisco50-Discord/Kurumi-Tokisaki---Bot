// ============================================================
//   Kurumi Tokisaki - Add Command
// ============================================================

const handler = async (m, { conn, args, chatId, isGroup, isAdmin, isOwner, usedPrefix }) => {
  if (!isGroup) return m.reply(`✦━【 ❌ *ERROR* 】━✦\n\nSolo en grupos.`);
  if (!isAdmin && !isOwner) return m.reply(`✦━【 ❌ *ERROR* 】━✦\n\nSolo administradores.`);

  const quoted = m.message?.extendedTextMessage?.contextInfo;
  const number = args.length > 0 ? args.join("").replace(/[^0-9]/g, "") : "";
  const targetJid = number ? (number + "@s.whatsapp.net") : quoted?.participant;

  if (!targetJid) {
    return m.reply(
      `✦━【 ➕ *ADD* 】━✦\n\n` +
      `📝 Añade un usuario al grupo.\n` +
      `💡 Sintaxis: \`${usedPrefix}add <número>\` o responde al mensaje\n` +
      `📌 Ejemplo: \`${usedPrefix}add 521234567890\``
    );
  }

  try {
    await conn.groupParticipantsUpdate(chatId, [targetJid], "add");
  } catch (err) {
    await m.reply(`✦━【 ❌ *ERROR* 】━✦\n\nNo se pudo añadir al usuario. Puede que tenga prohibido ser añadido por grupos.`);
  }
};

handler.command = /^(add|añadir|agregar)$/i;
handler.description = "Añadir un usuario al grupo";
handler.category = "grupo";
handler.group = true;
handler.admin = true;
handler.botAdmin = true;

export default handler;
