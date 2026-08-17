// ============================================================
//   Kurumi Tokisaki - Demote Command
// ============================================================

import { resolveGroupParticipantJid } from "../lib/utils.js";

const handler = async (m, { conn, args, chatId, isGroup, isAdmin, isOwner, usedPrefix }) => {
  if (!isGroup) return m.reply(`✦━【 ❌ *ERROR* 】━✦\n\nSolo en grupos.`);
  if (!isAdmin && !isOwner) return m.reply(`✦━【 ❌ *ERROR* 】━✦\n\nSolo administradores.`);

  // Conserva el JID original (LID o teléfono) y admite menciones/respuestas
  // provenientes de texto, imagen o vídeo. El handler puede haber normalizado
  // m.mentionedJid, por eso se prioriza el contexto bruto del mensaje.
  const contextInfo =
    m.messageContent?.extendedTextMessage?.contextInfo ||
    m.message?.extendedTextMessage?.contextInfo ||
    m.messageContent?.imageMessage?.contextInfo ||
    m.message?.imageMessage?.contextInfo ||
    m.messageContent?.videoMessage?.contextInfo ||
    m.message?.videoMessage?.contextInfo;
  const mentioned = contextInfo?.mentionedJid?.[0] || m.mentionedJid?.[0];
  const targetNum = args.length > 0 ? args.join("").replace(/[^0-9]/g, "") : "";
  const rawTargetJid = mentioned || (targetNum ? (targetNum + "@s.whatsapp.net") : contextInfo?.participant || m.quoted?.sender);

  if (!rawTargetJid) {
    return m.reply(
      `✦━【 🔻 *DEMOTE* 】━✦\n\n` +
      `📝 Quita el rol de admin a un usuario.\n` +
      `💡 Sintaxis: \`${usedPrefix}demote @usuario\` o responde a un mensaje\n` +
      `📌 Ejemplo: \`${usedPrefix}demote @529852270023\``
    );
  }

  const mentionJid = String(rawTargetJid).replace(/:\d+(?=@)/, "");
  let targetJid = await resolveGroupParticipantJid(conn, chatId, mentionJid);

  try {
    try {
      await conn.groupParticipantsUpdate(chatId, [targetJid], "demote");
    } catch (primaryErr) {
      if (mentionJid && mentionJid !== targetJid) {
        await conn.groupParticipantsUpdate(chatId, [mentionJid], "demote");
        targetJid = mentionJid;
      } else {
        // Fallback para variantes de número mexicano 521 vs 52
        const num = targetJid.split("@")[0];
        const altNum = num.startsWith("521")
          ? num.replace(/^521/, "52")
          : (num.startsWith("52") ? num.replace(/^52/, "521") : null);

        if (altNum) {
          const altJid = altNum + "@s.whatsapp.net";
          await conn.groupParticipantsUpdate(chatId, [altJid], "demote");
          targetJid = altJid;
        } else {
          throw primaryErr;
        }
      }
    }
    // Se degrada al usuario y groupHandler se encarga de enviar la tarjeta de notificación con imagen
  } catch (err) {
    await m.reply(`✦━【 ❌ *ERROR* 】━✦\n\nNo se pudo quitar el admin al usuario. Asegúrate de que el bot sea admin y que el usuario sea administrador.`);
  }
};

handler.command = /^(demote|quitar admin|removeadmin)$/i;
handler.description = "Quitar administrador a un usuario";
handler.category = "grupo";
handler.group = true;
handler.admin = true;
handler.botAdmin = true;

export default handler;
