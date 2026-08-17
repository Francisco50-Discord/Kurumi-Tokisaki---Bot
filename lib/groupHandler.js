import { getGroup, getUser } from "./database.js";
import { normalizeJid, extractNumber, getGroupMetadata, invalidateGroupMetadata, resolveGroupParticipantJid } from "./utils.js";
import { getEventDefaultAvatarBuffer, getProfilePictureUrl } from "./profilePicture.js";
import { config } from "../config/settings.js";
import { generateTextWithAI } from "./aiGenerator.js";
import { PERSONALITIES } from "../plugins/ia.js";

// Mapa de acciones recientes del bot para evitar duplicar mensajes cuando un comando ejecuta groupParticipantsUpdate
const recentBotActions = new Map();

/**
 * Registra una acción ejecutada por un comando del bot para evitar notificaciones duplicadas en groupParticipantsUpdate.
 */
export function recordBotGroupAction(chatId, targetJid, action) {
  if (!chatId || !targetJid || !action) return;
  const normChat = normalizeJid(chatId);
  const normUser = normalizeJid(targetJid);
  const key = `${normChat}:${normUser}:${action}`;
  recentBotActions.set(key, Date.now());

  // Limpiar automáticamente después de 15 segundos
  setTimeout(() => {
    recentBotActions.delete(key);
  }, 15000);
}

/**
 * Construye un mensaje de evento local; la generación externa solo se usa si se solicita explícitamente.
 */
export async function generateKurumiEventText({ type, userMention, userName, groupName, reason, pKey = "asistente", allowAI = false }) {
  const nameStr = userName && userName !== "Usuario" ? userName : userMention;

  const pInfo = PERSONALITIES[pKey] || PERSONALITIES.asistente;
  const personaName = pInfo?.name || config.botName || "Kurumi Tokisaki";
  const personaPrompt = pInfo?.prompt || "";

  const systemPrompt = `Eres ${personaName}, la asistente virtual de WhatsApp para este grupo.
${personaPrompt}
Responde siempre en español claro, fluido y acorde a tu personalidad.
Tu tarea es generar un mensaje personalizado y conciso (2 a 4 líneas) para un evento en un grupo de WhatsApp ("${groupName}").
REGLA OBLIGATORIA: Debes incluir exactamente la mención "${userMention}" en el texto para referirte al usuario.
Puedes incluir 1 o 2 emojis acorde al evento.`;

  let userPrompt = "";

  if (type === "welcome") {
    userPrompt = `Crea un mensaje de BIENVENIDA alegre e integrador para ${userMention} (llamado/a ${nameStr}) que acaba de unirse al grupo "${groupName}". Recomiéndale revisar las reglas y disfrutar.`;
  } else if (type === "goodbye") {
    userPrompt = `Crea un mensaje de DESPEDIDA respetuoso y cordial para ${userMention} que ha salido o fue retirado del grupo "${groupName}". Despídete deseándole lo mejor.`;
  } else if (type === "promote") {
    userPrompt = `Crea un mensaje de FELICITACIONES y ANUNCIO alegre para ${userMention} porque ahora es ADMINISTRADOR/A del grupo "${groupName}". Felicítalo/a y recomiéndale usar sus poderes con responsabilidad.`;
  } else if (type === "demote") {
    userPrompt = `Redacta únicamente un aviso breve, informativo y respetuoso para ${userMention} porque ya se le retiró el cargo de administrador/a en el grupo "${groupName}". No ejecutes ninguna acción, no hagas preguntas y no rechaces la solicitud: solo escribe el texto final del anuncio en 2 o 4 líneas, manteniendo exactamente la mención ${userMention}.`;
  } else if (type === "antilink") {
    userPrompt = `Redacta únicamente el texto final de una advertencia breve, educada y clara para ${userMention}, porque ya envió un enlace de invitación no permitido en el grupo "${groupName}". Indica que el mensaje fue eliminado por seguridad. No ejecutes acciones, no expliques cómo expulsar a nadie, no hagas preguntas ni rechaces la solicitud; solo escribe 2 o 4 líneas en español y conserva exactamente la mención ${userMention}.`;
  } else if (type === "antilinkAdmin") {
    userPrompt = `Redacta únicamente el texto final de un aviso informativo breve para ${userMention}, quien envió un enlace de invitación en el grupo "${groupName}" y tiene permisos de administración. Indica que el enlace fue permitido y que el mensaje no fue eliminado porque es administrador. Aclara que Antilink continúa activo para usuarios normales. No amenaces, no sanciones, no expliques cómo expulsar a nadie y no ejecutes acciones; solo escribe 2 o 4 líneas en español y conserva exactamente la mención ${userMention}.`;
  }

  // Los eventos de grupo deben ser inmediatos. La IA externa se deja como opción
  // explícita para no bloquear bienvenidas, promociones o expulsiones durante
  // varios segundos cuando un proveedor no responde.
  if (allowAI) {
    let aiTimeout;
    try {
      const fullPrompt = `${systemPrompt}\n\nInstrucción:\n${userPrompt}`;
      const aiPromise = generateTextWithAI(fullPrompt, "");
      const timeoutPromise = new Promise((resolve) => {
        aiTimeout = setTimeout(() => resolve(""), 8000);
      });
      const text = await Promise.race([aiPromise, timeoutPromise]);
      if (text && text.trim()) {
        let result = text.trim();
        if (result.includes("@usuario")) {
          result = result.replace(/@usuario/g, userMention);
        }
        if (!result.includes(userMention)) {
          result = `${userMention}\n\n${result}`;
        }
        return result;
      }
    } catch (e) {
      // Se conserva el mensaje local si ningún proveedor puede generar el texto.
    } finally {
      if (aiTimeout) clearTimeout(aiTimeout);
    }
  }

  // Textos locales inmediatos según el tipo de evento.
  if (type === "welcome") {
    return `¡Bienvenid@ a *${groupName}*, ${userMention}! ✨\n\nNos alegra tenerte en el grupo. Por favor recuerda revisar y respetar las reglas de la comunidad. ¡Que disfrutes tu estadía! 📌`;
  } else if (type === "goodbye") {
    return `*${userMention}* ha dejado el grupo *${groupName}*. 👋\n\n¡Le deseamos lo mejor en sus próximos pasos!`;
  } else if (type === "promote") {
    return `🎉 ¡Felicidades ${userMention}!\n\n👑 Has sido ascendido a *Administrador* del grupo *${groupName}*. ¡Usa tus poderes con sabiduría y responsabilidad!`;
  } else if (type === "demote") {
    return `📢 Aviso de administración en *${groupName}*:\n\n🔻 A ${userMention} se le ha retirado el rango de *Administrador*.`;
  } else if (type === "antilink") {
    return `⚠️ *Atención* ${userMention}:\n\nEn el grupo *${groupName}* no están permitidos los enlaces de invitación a WhatsApp. Tu mensaje ha sido eliminado por seguridad. Por favor respeta las reglas. 🚫`;
  } else if (type === "antilinkAdmin") {
    return `ℹ️ *Enlace permitido*, ${userMention}:\n\nTu mensaje no fue eliminado porque tienes permisos de administrador en *${groupName}*. Antilink continúa activo para los usuarios normales.`;
  }
}

/**
 * Envía un mensaje a un grupo intentando adjuntar la foto de perfil del usuario.
 * Si la foto no está disponible, cae a texto plano.
 *
 * @param {object} conn          Conexión Baileys
 * @param {string} chatId        JID del grupo
 * @param {string} userJid       JID del usuario destino
 * @param {string} captionText   Texto del mensaje (ya con menciones embebidas)
 * @param {string[]} mentions    Lista de menciones JID (solo el usuario en cuestión)
 */
async function sendEventMessageWithPicture(conn, chatId, userJid, captionText, mentions) {
  const safeMentions = mentions || [userJid];

  // Una tarjeta de evento no debe esperar la cascada completa de fotos de
  // perfil, banners y descargas remotas. Se intenta una sola consulta breve
  // de la foto del participante y, si no está lista, se envía texto al instante.
  try {
    const pictureUrl = await getProfilePictureUrl(conn, userJid, {
      quick: true,
      timeoutMs: 750,
    });
    if (pictureUrl) {
      try {
        await conn.sendMessage(chatId, {
          image: { url: pictureUrl },
          caption: captionText,
          mentions: safeMentions,
        });
        return true;
      } catch (error) {
        // La disponibilidad de la foto nunca debe impedir el aviso de grupo.
      }
    }
  } catch (error) {
    // Se usa el mensaje de texto inmediato como respaldo.
  }

  // Respaldo visual local: siempre está disponible y no requiere red.
  // Con ello todos los eventos conservan una imagen, incluso si el perfil
  // del participante es privado o no tiene foto configurada.
  const defaultAvatar = getEventDefaultAvatarBuffer();
  if (defaultAvatar?.length > 0) {
    await conn.sendMessage(chatId, {
      image: defaultAvatar,
      caption: captionText,
      mentions: safeMentions,
    });
    return true;
  }

  // Salvaguarda únicamente para una instalación incompleta sin el recurso.
  await conn.sendMessage(chatId, {
    text: captionText,
    mentions: safeMentions,
  });
  return false;
}

async function getEventGroupMetadata(conn, chatId) {
  let timeout;
  try {
    return await Promise.race([
      getGroupMetadata(conn, chatId),
      new Promise((resolve) => {
        timeout = setTimeout(() => resolve(null), 900);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export const recentlyKicked = new Set();

export function addRecentlyKicked(jid) {
    if (!jid) return;
    const norm = normalizeJid(jid);
    recentlyKicked.add(norm);
    const num = extractNumber(norm);
    if (num) recentlyKicked.add(num);
    setTimeout(() => {
        recentlyKicked.delete(norm);
        if (num) recentlyKicked.delete(num);
    }, 30000);
}

export async function handleGroupParticipantsUpdate(conn, { id, participants, action, author }) {
    const normId = normalizeJid(id);
    invalidateGroupMetadata(normId);
    const groupConfig = getGroup(normId);

    let groupName = groupConfig?.name || "este grupo";
    const eventMetadata = await getEventGroupMetadata(conn, normId);
    if (eventMetadata?.subject) groupName = eventMetadata.subject;

    const pKey = groupConfig?.ai_personality || "asistente";
    const pInfo = PERSONALITIES[pKey] || PERSONALITIES.asistente;
    const personaName = pInfo?.name || config.botName || "Kurumi Tokisaki";

    const normAuthor = author ? normalizeJid(author) : "";

    for (const user of participants) {
        const userJidRaw = typeof user === "string" ? user : (user?.id || user?.jid || user?.user || "");
        const normUser = normalizeJid(userJidRaw);

        const userNum = normUser.split("@")[0].split(":")[0].replace(/[^0-9]/g, "");
        const userMention = userNum ? `@${userNum}` : "@usuario";
        const userObj = getUser ? getUser(normUser) : null;
        const userName = userObj?.name || "Usuario";

        const isWelcomeOn = Boolean(groupConfig?.welcome === 1 || groupConfig?.welcome === true);
        const isGoodbyeOn = Boolean(groupConfig?.goodbye === 1 || groupConfig?.goodbye === true);

        if (action === "add" && isWelcomeOn) {
            const groupDesc = eventMetadata?.desc
                ? eventMetadata.desc.toString().trim()
                : "";

            const aiMsg = await generateKurumiEventText({
                type: "welcome",
                userMention,
                userName,
                groupName,
                pKey,
                allowAI: true
            });

            let text = `✦━【 🌸 *BIENVENIDA* 】━✦\n\n${aiMsg}`;
            if (groupDesc) {
                text += `\n\n📜 *REGLAS / DESCRIPCIÓN DEL GRUPO:*\n${groupDesc}`;
            }
            text += `\n\n✦ *${personaName}*`;

            await sendEventMessageWithPicture(conn, normId, normUser, text, [normUser]);
        } else if (action === "remove" && isGoodbyeOn) {
            // Verificar si fue una expulsión (por bot o admin) en lugar de salida voluntaria
            const isKicked = 
                recentlyKicked.has(normUser) ||
                (userNum && recentlyKicked.has(userNum)) ||
                (normAuthor && normAuthor !== normUser);

            if (isKicked) {
                // Si fue expulsado/eliminado por el bot o admin, NO enviamos el mensaje de despedida
                recentlyKicked.delete(normUser);
                if (userNum) recentlyKicked.delete(userNum);
                continue;
            }

            const aiMsg = await generateKurumiEventText({
                type: "goodbye",
                userMention,
                userName,
                groupName,
                pKey,
                allowAI: true
            });

            const text = `✦━【 🥀 *DESPEDIDA* 】━✦\n\n${aiMsg}\n\n✦ *${personaName}*`;
            await sendEventMessageWithPicture(conn, normId, normUser, text, [normUser]);
        } else if (action === "promote") {
            const aiMsg = await generateKurumiEventText({
                type: "promote",
                userMention,
                userName,
                groupName,
                pKey,
                allowAI: true
            });

            const text = `✦━【 👑 *NUEVO ADMINISTRADOR* 】━✦\n\n${aiMsg}\n\n✦ *${personaName}*`;
            await sendEventMessageWithPicture(conn, normId, normUser, text, [normUser]);
        } else if (action === "demote") {
            const aiMsg = await generateKurumiEventText({
                type: "demote",
                userMention,
                userName,
                groupName,
                pKey,
                allowAI: true
            });

            const text = `✦━【 🔻 *ADMINISTRADOR REMOVIDO* 】━✦\n\n${aiMsg}\n\n✦ *${personaName}*`;
            await sendEventMessageWithPicture(conn, normId, normUser, text, [normUser]);
        }
    }
}

export async function checkAntilink(conn, m, groupConfig, isAdmin = false, isOwner = false) {
    const isAntilinkEnabled = Boolean(groupConfig?.antilink === 1 || groupConfig?.antilink === true);
    if (!isAntilinkEnabled) return false;

    const text = m.text || m.body || m.caption || "";
    const isLink = /(?:chat\.whatsapp\.com\/|whatsapp\.com\/channel\/)/i.test(text);

    const userIsAdmin = isAdmin || m.isAdmin;
    const userIsOwner = isOwner || m.isOwner;

    if (isLink && (userIsAdmin || userIsOwner)) {
        let groupName = groupConfig?.name || "este grupo";
        try {
            const metadata = await getGroupMetadata(conn, m.chatId);
            if (metadata?.subject) groupName = metadata.subject;
        } catch (e) {}

        const originalSenderJid = normalizeJid(m.key?.participant || m.key?.participantAlt || m.rawSenderJid || m.sender);
        const targetJid = await resolveGroupParticipantJid(conn, m.chatId, originalSenderJid);
        const mentionJid = originalSenderJid.endsWith("@lid") ? originalSenderJid : targetJid;
        const userNum = extractNumber(mentionJid) || mentionJid.split("@")[0].split(":")[0];
        const userMention = `@${userNum || "usuario"}`;
        const userName = m.pushName || "Administrador";
        const pKey = groupConfig?.ai_personality || "asistente";
        const pInfo = PERSONALITIES[pKey] || PERSONALITIES.asistente;
        const personaName = pInfo?.name || config.botName || "Kurumi Tokisaki";

        const aiMsg = await generateKurumiEventText({
            type: "antilinkAdmin",
            userMention,
            userName,
            groupName,
            pKey,
            allowAI: true
        });

        const infoText = `✦━【 ℹ️ *ENLACE PERMITIDO* 】━✦\n\n${aiMsg}\n\n✦ *${personaName}*`;
        await sendEventMessageWithPicture(conn, m.chatId, mentionJid, infoText, [mentionJid]);
        return true;
    }

    if (isLink && !userIsAdmin && !userIsOwner) {
        try {
            await conn.sendMessage(m.chatId, { delete: m.key });
        } catch (e) {
            console.error("Antilink delete error:", e?.message);
        }

        let groupName = groupConfig?.name || "este grupo";
        try {
            const metadata = await getGroupMetadata(conn, m.chatId);
            if (metadata?.subject) groupName = metadata.subject;
        } catch (e) {}

        // El manejador principal puede resolver `m.sender` a un Phone JID. Para
        // mencionarlo, conservamos el LID original de la clave si WhatsApp lo entregó.
        const originalSenderJid = normalizeJid(m.key?.participant || m.key?.participantAlt || m.rawSenderJid || m.sender);
        const targetJid = await resolveGroupParticipantJid(conn, m.chatId, originalSenderJid);
        const mentionJid = originalSenderJid.endsWith("@lid") ? originalSenderJid : targetJid;
        const userNum = extractNumber(mentionJid) || mentionJid.split("@")[0].split(":")[0];
        const userMention = `@${userNum}`;
        const userName = m.pushName || "Usuario";

        const pKey = groupConfig?.ai_personality || "asistente";
        const pInfo = PERSONALITIES[pKey] || PERSONALITIES.asistente;
        const personaName = pInfo?.name || config.botName || "Kurumi Tokisaki";

        const aiMsg = await generateKurumiEventText({
            type: "antilink",
            userMention,
            userName,
            groupName,
            pKey,
            allowAI: true
        });

        const warningText = `✦━【 ❌ *ANTILINK* 】━✦\n\n${aiMsg}\n\n🗑️ *Mensaje eliminado y usuario expulsado.*\n✦ *${personaName}*`;

        // Enviar y confirmar la advertencia antes de expulsar. Esta vía usa
        // foto real o avatar local, por lo que no depende de un helper externo
        // inexistente ni deja al usuario sin aviso.
        await sendEventMessageWithPicture(conn, m.chatId, mentionJid, warningText, [mentionJid]);
        // Registrar para evitar despedida y expulsar después de enviar la advertencia.
        addRecentlyKicked(targetJid);
        try {
            await conn.groupParticipantsUpdate(m.chatId, [targetJid], "remove");
        } catch (removeErr) {
            console.error("Antilink remove participant error:", removeErr?.message);
        }

        return true;
    }
    return false;
}
