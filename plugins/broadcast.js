// ============================================================
//   Kurumi Tokisaki - Broadcast Command
// ============================================================

import { dbAll } from "../lib/database.js";

const handler = async (m, { conn, body, isOwner }) => {
  if (!isOwner) return m.reply(`❌ Solo el owner puede usar este comando.`);
  if (!body) {
    return m.reply(
      `✦━【 📢 *BROADCAST* 】━✦\n\n` +
      `📝 Envía un mensaje a todos los grupos.\n` +
      `💡 Sintaxis: \`!broadcast <mensaje>\`\n` +
      `📌 Ejemplo: \`!broadcast ¡Hola a todos!\``
    );
  }

  await m.reply(`⏳ *Enviando broadcast...*`);

  const groups = await dbAll("SELECT id FROM groups");
  let sent = 0;
  let failed = 0;

  for (const group of groups) {
    try {
      await conn.sendMessage(group.id, {
        text: `✦━【 📢 *MENSAJE DEL OWNER* 】━✦\n\n${body}`,
      });
      sent++;
      await new Promise((r) => setTimeout(r, 1000));
    } catch (e) {
      failed++;
    }
  }

  await m.reply(
    `✦━【 📢 *BROADCAST COMPLETADO* 】━✦\n\n` +
    `✅ Enviado: *${sent}*\n` +
    `❌ Fallido: *${failed}*`
  );
};

handler.command = /^(broadcast|anuncio|masivo)$/i;
handler.description = "Enviar mensaje a todos los grupos";
handler.category = "admin";
handler.owner = true;

export default handler;
