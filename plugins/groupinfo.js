// ============================================================
//   Kurumi Tokisaki - GroupInfo Command
// ============================================================

import { getGroup } from "../lib/database.js";
import { sendProfilePictureMessage } from "../lib/profilePicture.js";

const handler = async (m, { conn, chatId, isGroup }) => {
  if (!isGroup) return m.reply(`✦━【 ❌ *ERROR* 】━✦\n\nSolo en grupos.`);

  try {
    const metadata = await conn.groupMetadata(chatId);
    // En grupos con privacidad LID, el LID es la dirección que debe usarse
    // para mencionar al participante; el Phone JID queda como respaldo.
    const adminIds = metadata.participants
      .filter((p) => p.admin)
      .map((p) => p.lid || p.id)
      .filter(Boolean);
    const admins = adminIds.map((id) => `@${id.split("@")[0].split(":")[0]}`);

    const groupConfig = getGroup(chatId);

    const infoText = 
      `✦━【 👥 *INFORMACIÓN DEL GRUPO* 】━✦\n\n` +
      `📌 *Nombre:* ${metadata.subject}\n` +
      `📝 *Descripción:* ${metadata.desc || "Sin descripción"}\n` +
      `👥 *Miembros:* ${metadata.participants.length}\n` +
      `👑 *Admins:* ${admins.join(", ") || "N/A"}\n` +
      `📅 *Creado:* ${new Date(metadata.creation * 1000).toLocaleDateString("es-MX")}\n\n` +
      `✦━【 ⚙️ *CONFIGURACIÓN* 】━✦\n` +
      `👋 *Bienvenida:* ${(groupConfig?.welcome === 1 || groupConfig?.welcome === true) ? "✅" : "❌"}\n` +
      `🔗 *Antilink:* ${(groupConfig?.antilink === 1 || groupConfig?.antilink === true) ? "✅" : "❌"}\n` +
      `🔞 *NSFW:* ${(groupConfig?.nsfw === 1 || groupConfig?.nsfw === true) ? "✅" : "❌"}\n` +
      `✨ *IA:* ${(groupConfig?.ai_enabled !== false && groupConfig?.ai_enabled !== 0) ? "✅" : "❌"}\n`;

    await sendProfilePictureMessage(conn, chatId, chatId, infoText, {
      mentions: adminIds,
      quoted: m,
    });
  } catch (err) {
    await m.reply(`✦━【 ❌ *ERROR* 】━✦\n\nError al obtener información del grupo.`);
    throw err;
  }
};

handler.command = /^(grupoinfo|groupinfo|infogrupo)$/i;
handler.description = "Ver información del grupo";
handler.category = "grupo";
handler.group = true;

export default handler;
