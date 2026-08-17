// ============================================================
//   Kurumi Tokisaki - Restablecer Ajustes de Grupo
// ============================================================

import { resetGroupSettings } from "../lib/database.js";

const handler = async (m, { args, chatId, isGroup, isAdmin, isOwner, usedPrefix }) => {
  const p = usedPrefix || "!";
  if (!isGroup) {
    return m.reply("✦━【 ❌ *ERROR* 】━✦\n\nEste comando solo funciona en grupos.");
  }
  if (!isAdmin && !isOwner) {
    return m.reply(
      `✦━【 ❌ *PERMISO REQUERIDO* 】━✦\n\nSolo los administradores pueden restablecer los ajustes del grupo.`
    );
  }

  const confirmation = (args[0] || "").toLowerCase();
  if (!['confirmar', 'confirm', 'si', 'sí'].includes(confirmation)) {
    return m.reply(
      `✦━【 ⚠️ *RESTABLECER AJUSTES* 】━✦\n\n` +
      `Esta acción restablecerá de una sola vez:\n` +
      `• NSFW: desactivado\n` +
      `• Antilink: desactivado\n` +
      `• Bienvenida y despedida: desactivadas\n` +
      `• IA: desactivada (solo por comando al activarla)\n` +
      `• Personalidad: Asistente\n` +
      `• Antispam y silencio: desactivados\n` +
      `• Idioma y prefijo: español / \`!\`\n\n` +
      `No modifica participantes, administradores, foto, descripción ni el estado abierto/cerrado de WhatsApp.\n\n` +
      `🔐 Para confirmar, escribe: \`${p}restablecerajustes confirmar\``
    );
  }

  resetGroupSettings(chatId);
  return m.reply(
    `✦━【 ✅ *AJUSTES RESTABLECIDOS* 】━✦\n\n` +
    `Los ajustes configurables del grupo volvieron a sus valores predeterminados seguros.\n\n` +
    `Usa \`${p}ajustes\` para consultar el nuevo estado.`
  );
};

handler.command = /^(restablecerajustes|restaurarajustes|resetajustes|resetgrupo|restablecergrupo)$/i;
handler.description = "Restablecer todos los ajustes del grupo";
handler.category = "grupo";
handler.group = true;
handler.admin = true;

export default handler;
