// ============================================================
//   Kurumi Tokisaki - Plugin de Recordatorios y Tareas Programadas
// ============================================================

import { addReminder, getPendingReminders, deleteReminder } from "../lib/database.js";

/**
 * Convierte expresiones de tiempo a milisegundos
 * Soporta: 30s, 10m, 2h, 1d o formato de hora '22:30' / '08:00'
 */
function parseTimeToMs(timeStr) {
  if (!timeStr) return null;
  const str = timeStr.trim().toLowerCase();

  // Formato hora 'HH:MM' o 'HH:MM pm' / 'HH:MM am'
  const timeMatch = str.match(/^([0-1]?[0-9]|2[0-3]):([0-5][0-9])\s*(am|pm|a\.m\.|p\.m\.)?$/i);
  if (timeMatch) {
    let hours = parseInt(timeMatch[1], 10);
    const minutes = parseInt(timeMatch[2], 10);
    const ampm = timeMatch[3] ? timeMatch[3].toLowerCase().replace(/\./g, '') : null;

    if (ampm === "pm" && hours < 12) hours += 12;
    if (ampm === "am" && hours === 12) hours = 0;

    // Obtener la fecha y hora actual en México (America/Mexico_City)
    const now = new Date();
    const mxParts = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Mexico_City",
      year: "numeric", month: "numeric", day: "numeric",
      hour: "numeric", minute: "numeric", second: "numeric", hour12: false
    }).formatToParts(now);

    const partMap = {};
    mxParts.forEach(p => { partMap[p.type] = parseInt(p.value, 10); });

    const currentMxHour = partMap.hour;
    const currentMxMinute = partMap.minute;

    // Si no se especificó AM/PM explícito y hours < 12, pero en México ya pasó del mediodía (>= 12):
    // Ejemplo: hora actual 13:28 (1:28 PM), y piden "1:29":
    // hours=1, pero 1 < 12 y currentMxHour >= 12 -> probar con 1 + 12 = 13 (1:29 PM).
    if (!ampm && hours < 12 && currentMxHour >= 12) {
      const pmHours = hours + 12;
      if (pmHours > currentMxHour || (pmHours === currentMxHour && minutes >= currentMxMinute)) {
        hours = pmHours;
      }
    }

    // Timestamp base en México
    const currentMxTimeMs = Date.UTC(partMap.year, partMap.month - 1, partMap.day, currentMxHour, currentMxMinute, partMap.second);
    let targetMxTimeMs = Date.UTC(partMap.year, partMap.month - 1, partMap.day, hours, minutes, 0);

    if (targetMxTimeMs <= currentMxTimeMs) {
      // Si la hora ya transcurrió hoy en México, se programa para mañana a la misma hora
      targetMxTimeMs += 24 * 60 * 60 * 1000;
    }

    return targetMxTimeMs - currentMxTimeMs;
  }

  // Formato relativo '30s', '10m', '2h', '1d'
  const match = str.match(/^(\d+)\s*(s|sec|seg|m|min|h|hr|d|dias|días)$/);
  if (!match) return null;

  const num = parseInt(match[1], 10);
  const unit = match[2];

  if (unit.startsWith("s")) return num * 1000;
  if (unit.startsWith("m")) return num * 60 * 1000;
  if (unit.startsWith("h")) return num * 3600 * 1000;
  if (unit.startsWith("d")) return num * 86400 * 1000;

  return null;
}

const handler = async (m, { conn, args, text, body, sender, chatId, usedPrefix, isGroup, isAdmin, isOwner }) => {
  const command = (m.command || "").toLowerCase();
  const effectiveAdmin = Boolean(isAdmin || isOwner);

  // Subcomando: Eliminar recordatorio por ID
  if (command === "eliminarrecordatorio" || command === "borrarrecordatorio" || command === "delrecordatorio") {
    const remId = (args[0] || "").trim();
    if (!remId) {
      return m.reply(`⚠️ Debe especificar el ID del recordatorio. Ejemplo: \`${usedPrefix}eliminarrecordatorio rem_123456\``);
    }
    const success = deleteReminder(remId);
    if (success) {
      return m.reply(`✅ *Recordatorio eliminado correctamente.*`);
    } else {
      return m.reply(`❌ No se encontró ningún recordatorio activo con el ID \`${remId}\`.`);
    }
  }

  // Subcomando: Ver mis recordatorios
  if (command === "misrecordatorios" || command === "recordatorios" || command === "lista-recordatorios") {
    const list = getPendingReminders(isGroup ? chatId : sender);
    if (!list || list.length === 0) {
      return m.reply(`📌 *No hay recordatorios pendientes* programados en este chat.`);
    }

    let msg = `✦━【 ⏰ *RECORDATORIOS PENDIENTES* 】━✦\n\n`;
    list.forEach((r, idx) => {
      const dateStr = new Date(r.remind_at).toLocaleString("es-ES");
      const actionTag = r.action === "group_close" ? " [🔒 Cerrar Grupo]" : r.action === "group_open" ? " [🔓 Abrir Grupo]" : "";
      msg += `*${idx + 1}.* ID: \`${r.id}\`${actionTag}\n` +
        `   • *Programado para:* ${dateStr}\n` +
        `   • *Mensaje:* ${r.message}\n\n`;
    });
    msg += `📌 Para cancelar uno usa: \`${usedPrefix}eliminarrecordatorio <ID>\``;
    return m.reply(msg);
  }

  // Crear nuevo recordatorio: !recordar <tiempo> | <mensaje>
  const rawText = (text || body || m.text || "").trim();
  if (!rawText || !rawText.includes("|")) {
    // Si no incluye '|', intentamos separar el primer argumento del resto
    if (rawText) {
      const parts = rawText.split(/\s+/);
      if (parts.length >= 2) {
        const maybeTime = parts[0];
        const maybeMsg = parts.slice(1).join(" ");
        const ms = parseTimeToMs(maybeTime);
        if (ms && ms > 0) {
          return processCreateReminder(m, conn, chatId, sender, maybeTime, maybeMsg, ms, isGroup, effectiveAdmin, usedPrefix);
        }
      }
    }

    return m.reply(
      `✦━【 ⏰ *SISTEMA DE RECORDATORIOS* 】━✦\n\n` +
      `📌 *Uso general:* \`${usedPrefix}recordar <tiempo> | <mensaje>\`\n` +
      `📌 *Ejemplos:*\n` +
      `• \`${usedPrefix}recordar 30m | Hacer el !daily y minar\`\n` +
      `• \`${usedPrefix}recordar 2h | Revisar el horno\`\n` +
      `• \`${usedPrefix}recordar 22:30 | Ir a dormir\`\n\n` +
      `🔒 *Programación para Grupos (Solo Admins/Owner):*\n` +
      `• \`${usedPrefix}recordar 1h | cerrar grupo\`\n` +
      `• \`${usedPrefix}recordar 08:00 | abrir grupo\`\n\n` +
      `📋 *Ver lista:* \`${usedPrefix}misrecordatorios\``
    );
  }

  const split = rawText.split("|");
  const timePart = split[0].trim();
  const msgPart = split.slice(1).join("|").trim();

  const ms = parseTimeToMs(timePart);
  if (!ms || ms <= 0) {
    return m.reply(
      `❌ *Formato de tiempo inválido*\n────────\n` +
      `Usa formatos como: *10s*, *15m*, *2h*, *1d* o una hora exacta como *22:00*.\n` +
      `Ejemplo: \`${usedPrefix}recordar 30m | Hacer mi daily\``
    );
  }

  return processCreateReminder(m, conn, chatId, sender, timePart, msgPart, ms, isGroup, effectiveAdmin, usedPrefix);
};

function processCreateReminder(m, conn, chatId, sender, timePart, msgPart, ms, isGroup, isAdmin, usedPrefix) {
  const targetDate = new Date(Date.now() + ms);
  const targetStr = targetDate.toLocaleString("es-ES");

  let action = "reminder";
  const lowerMsg = msgPart.toLowerCase();

  if (lowerMsg.includes("cerrar grupo") || lowerMsg.includes("cerrar el grupo") || lowerMsg.includes("grupo cerrar")) {
    if (!isGroup) return m.reply("❌ La acción de cerrar grupo solo está disponible dentro de un grupo.");
    if (!isAdmin) return m.reply("❌ Solo los administradores pueden programar el cierre automático del grupo.");
    action = "group_close";
  } else if (lowerMsg.includes("abrir grupo") || lowerMsg.includes("abrir el grupo") || lowerMsg.includes("grupo abrir")) {
    if (!isGroup) return m.reply("❌ La acción de abrir grupo solo está disponible dentro de un grupo.");
    if (!isAdmin) return m.reply("❌ Solo los administradores pueden programar la apertura automática del grupo.");
    action = "group_open";
  }

  const reminder = addReminder({
    chat_id: chatId,
    user_id: sender,
    message: msgPart,
    remind_at: targetDate,
    action,
    message_id: m.key?.id
  });

  // Si fue provocado por la IA de forma conversacional, no enviar el recuadro formal redundante
  if (m.isAi || m.fromAi) {
    return reminder;
  }

  const actionTagStr = action === "group_close" ? "🔒 Cierre automático del grupo" : action === "group_open" ? "🔓 Apertura automática del grupo" : "⏰ Recordatorio personal";

  return m.reply(
    `✦━【 ✨ *TAREA PROGRAMADA* 】━✦\n\n` +
    `◈ *Tipo:* ${actionTagStr}\n` +
    `◈ *Programado para:* ${targetStr}\n` +
    `◈ *Mensaje:* ${msgPart}\n` +
    `◈ *ID:* \`${reminder.id}\`\n\n` +
    `✅ *¡Entendido!* Kurumi ejecutará esta acción exactamente a la hora indicada.`
  );
}

handler.command = /^(recordar|recordatorio|programar|remind|misrecordatorios|recordatorios|eliminarrecordatorio|borrarrecordatorio|delrecordatorio)$/i;
handler.description = "Programar recordatorios personales o cierre/apertura automática del grupo";
handler.category = "ia";

export default handler;
