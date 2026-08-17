// ============================================================
//   Kurumi Tokisaki - Kick Command
// ============================================================

import { areJidsEqual, getGroupMetadata, resolveGroupParticipantJid } from "../lib/utils.js";
import { addRecentlyKicked } from "../lib/groupHandler.js";
import { sendProfilePictureMessage } from "../lib/profilePicture.js";

const handler = async (m, { conn, args, chatId, isGroup, isAdmin, isOwner, usedPrefix }) => {
  if (!isGroup) return m.reply(`❌ Solo en grupos.`);
  if (!isAdmin && !isOwner) return m.reply(`❌ Solo administradores.`);

  // Se toma primero el JID original del contexto. El handler resuelve `m.mentionedJid`
  // a un Phone JID para otras operaciones, pero WhatsApp puede requerir el LID original
  // al crear la mención dentro de un grupo.
  const contextInfo =
    m.messageContent?.extendedTextMessage?.contextInfo ||
    m.message?.extendedTextMessage?.contextInfo ||
    m.messageContent?.imageMessage?.contextInfo ||
    m.message?.imageMessage?.contextInfo ||
    m.messageContent?.videoMessage?.contextInfo ||
    m.message?.videoMessage?.contextInfo;
  const mentioned = contextInfo?.mentionedJid?.[0];
  const targetNum = args.length > 0 ? args.join("").replace(/[^0-9]/g, "") : "";
  const rawTargetJid = mentioned || (targetNum ? (targetNum + "@s.whatsapp.net") : contextInfo?.participant);

  if (!rawTargetJid) {
    return m.reply(
      `✦━【 🚫 *KICK* 】━✦\n\n` +
      `📝 Expulsa a un usuario del grupo.\n` +
      `💡 Sintaxis: \`${usedPrefix}kick @usuario\` o responde a un mensaje\n` +
      `📌 Ejemplo: \`${usedPrefix}kick @529852270023\``
    );
  }

  // `mentionJid` permanece ligado al mensaje original (LID o Phone JID).
  // `targetJid` se resuelve únicamente para la operación de expulsión.
  const mentionJid = String(rawTargetJid).replace(/:\d+(?=@)/, "");

  // Verificar el rol real antes de enviar el aviso o ejecutar la expulsión.
  // En Baileys v7 el objetivo puede llegar como LID, mientras que el perfil
  // también expone `phoneNumber`; se comparan ambas identidades del participante.
  const metadata = await getGroupMetadata(conn, chatId);
  const participants = metadata?.participants || [];
  if (participants.length === 0) {
    return m.reply(`✦━【 ❌ *ERROR* 】━✦\n\nNo pude verificar los participantes del grupo. No se realizará la expulsión por seguridad.`);
  }

  const targetParticipant = participants.find((participant) =>
    [participant.id, participant.lid, participant.pn, participant.phoneNumber, participant.idAlt, participant.jid]
      .filter(Boolean)
      .some((candidate) => areJidsEqual(mentionJid, candidate, participants))
  );

  if (!targetParticipant) {
    return m.reply(`✦━【 ❌ *ERROR* 】━✦\n\nEl usuario objetivo no pertenece actualmente a este grupo.`);
  }

  if (targetParticipant.admin === "superadmin") {
    return m.reply(`✦━【 🛡️ *USUARIO PROTEGIDO* 】━✦\n\nNo puedo expulsar al creador del grupo.`);
  }

  if (targetParticipant.admin === "admin") {
    return m.reply(`✦━【 🛡️ *USUARIO PROTEGIDO* 】━✦\n\nNo puedo expulsar a un administrador del grupo.`);
  }

  let targetJid = await resolveGroupParticipantJid(conn, chatId, mentionJid);

  try {
    // Mismo patrón que bienvenida y /casarse: @identificador en texto y el
    // JID correspondiente en `mentions`. Nunca se sustituye por un nombre guardado.
    const targetNumForMention = mentionJid.split("@")[0].replace(/[^0-9]/g, "");
    const mentionsList = [mentionJid];
    await sendProfilePictureMessage(
      conn,
      chatId,
      mentionJid,
      `🚫 @${targetNumForMention} será expulsado del grupo.`,
      {
        mentions: mentionsList,
        quoted: m,
        fallbackJid: chatId,
        useDefaultAvatarOnError: true,
      }
    );
    // El acuse de envío de WhatsApp garantiza que el aviso se encola antes de expulsar.
    await new Promise(resolve => setTimeout(resolve, 450));

    if (targetJid) addRecentlyKicked(targetJid);
    if (mentionJid && mentionJid !== targetJid) addRecentlyKicked(mentionJid);

    try {
      await conn.groupParticipantsUpdate(chatId, [targetJid], "remove");
    } catch (primaryErr) {
      if (mentionJid && mentionJid !== targetJid) {
        await conn.groupParticipantsUpdate(chatId, [mentionJid], "remove");
      } else {
        const num = targetJid.split("@")[0];
        const altNum = num.startsWith("521")
          ? num.replace(/^521/, "52")
          : (num.startsWith("52") ? num.replace(/^52/, "521") : null);

        if (altNum) {
          const altJid = altNum + "@s.whatsapp.net";
          if (altJid) addRecentlyKicked(altJid);
          await conn.groupParticipantsUpdate(chatId, [altJid], "remove");
          targetJid = altJid;
        } else {
          throw primaryErr;
        }
      }
    }
  } catch (err) {
    await m.reply(`✦━【 ❌ *ERROR* 】━✦\n\nNo se pudo expulsar al usuario. ¿El bot es admin en este grupo?`);
  }
};

handler.command = /^(kick|expulsar|remover|remove)$/i;
handler.description = "Expulsar a un usuario del grupo";
handler.category = "grupo";
handler.group = true;
handler.admin = true;
handler.botAdmin = true;

export default handler;
