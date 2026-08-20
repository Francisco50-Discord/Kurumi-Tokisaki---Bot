// ============================================================
//   Kurumi Tokisaki - Delete Command
//   Borra un mensaje citado para todos cuando WhatsApp lo permite
// ============================================================

function getQuotedContext(m) {
  const messageContent = m?.messageContent || m?.message;
  return (
    messageContent?.extendedTextMessage?.contextInfo ||
    messageContent?.imageMessage?.contextInfo ||
    messageContent?.videoMessage?.contextInfo ||
    messageContent?.audioMessage?.contextInfo ||
    messageContent?.stickerMessage?.contextInfo ||
    messageContent?.documentMessage?.contextInfo ||
    messageContent?.buttonsResponseMessage?.contextInfo ||
    messageContent?.templateButtonReplyMessage?.contextInfo ||
    messageContent?.listResponseMessage?.contextInfo ||
    messageContent?.interactiveResponseMessage?.contextInfo ||
    messageContent?.contextInfo ||
    m?.message?.extendedTextMessage?.contextInfo ||
    m?.message?.contextInfo ||
    null
  );
}

function getQuotedDeleteKey(m, chatId) {
  const contextInfo = getQuotedContext(m);
  const quotedId = contextInfo?.stanzaId || m?.quoted?.id;
  if (!quotedId) return null;

  const isFromMe = Boolean(contextInfo?.fromMe || m?.quoted?.fromMe);
  const key = {
    remoteJid: contextInfo?.remoteJid || chatId,
    fromMe: isFromMe,
    id: quotedId,
  };

  // En grupos, para borrar mensajes de otros participantes, WhatsApp necesita
  // el autor original. Se prefiere el valor crudo del contexto para conservar
  // LID/PN; el valor resuelto de m.quoted.sender queda como respaldo.
  if (!isFromMe && String(chatId || "").endsWith("@g.us")) {
    const participant = contextInfo?.participant || m?.quoted?.sender;
    if (participant) key.participant = participant;
  }

  return key;
}

const handler = async (m, { conn, chatId, isGroup, isAdmin, isOwner, usedPrefix }) => {
  if (isGroup && !isAdmin && !isOwner) {
    return m.reply(
      `✦━【 🔒 *PERMISO REQUERIDO* 】━✦\n\n` +
      `En los grupos, solo un administrador puede usar \`${usedPrefix}delete\` para eliminar mensajes.`
    );
  }

  if (isGroup && !m.isBotAdmin) {
    return m.reply(
      `✦━【 ⚠️ *BOT SIN PERMISOS* 】━✦\n\n` +
      `Necesito ser administrador del grupo para eliminar mensajes para todos.`
    );
  }

  const deleteKey = getQuotedDeleteKey(m, chatId);
  if (deleteKey && !isGroup && !deleteKey.fromMe) {
    return m.reply(
      `✦━【 ℹ️ *LÍMITE DE WHATSAPP* 】━✦\n\n` +
      `En un chat privado, solo puedo borrar para todos los mensajes enviados por el propio bot. Los mensajes enviados por otra persona no se pueden eliminar de forma global mediante WhatsApp.`
    );
  }

  if (!deleteKey) {
    return m.reply(
      `✦━【 🗑️ *DELETE* 】━✦\n\n` +
      `Responde al mensaje que quieres eliminar y escribe \`${usedPrefix}delete\`.\n` +
      `También puedes usar: \`${usedPrefix}del\`, \`${usedPrefix}eliminar\`, \`${usedPrefix}delt\` o \`${usedPrefix}borrar\`.`
    );
  }

  try {
    await conn.sendMessage(chatId, { delete: deleteKey });
  } catch (error) {
    const message = String(error?.message || error || "");
    const privateLimitation = !isGroup && !deleteKey.fromMe;
    const explanation = privateLimitation
      ? `En un chat privado, WhatsApp normalmente solo permite borrar para todos los mensajes enviados por la propia cuenta del bot.`
      : `Comprueba que el mensaje todavía esté dentro del tiempo permitido y que el bot conserve permisos suficientes.`;

    console.error(`❌ Error en ${usedPrefix}delete:`, error);
    await m.reply(
      `✦━【 ❌ *NO SE PUDO ELIMINAR* 】━✦\n\n` +
      `${explanation}\n\n` +
      `Detalle: ${message || "operación rechazada por WhatsApp"}`
    );
  }
};

handler.command = /^(delete|del|eliminar|delt|borrar)$/i;
handler.description = "Eliminar para todos un mensaje citado";
handler.category = "grupo";

export default handler;

export { getQuotedContext, getQuotedDeleteKey };
