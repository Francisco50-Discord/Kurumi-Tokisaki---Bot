// ============================================================
//   Kurumi Tokisaki - Join Group Command (Owner Exclusive)
// ============================================================

const acceptInviteWithTimeout = (conn, code, ms = 20000) => {
  return Promise.race([
    conn.groupAcceptInvite(code),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Timeout: WhatsApp no respondió a tiempo al enlace de invitación.")), ms)
    )
  ]);
};

const getGroupInviteInfoWithTimeout = (conn, code, ms = 5000) => {
  return Promise.race([
    conn.groupGetInviteInfo(code),
    new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout metadata")), ms))
  ]);
};

const handler = async (m, { conn, args, isOwner, usedPrefix }) => {
  if (!isOwner) {
    return m.reply(
      `✦━【 🚫 *ACCESO RESTRENGIDO* 】━✦\n` +
      `La función de unirse a grupos mediante enlace\n` +
      `es exclusiva de mi creador (+529852270023).\n` +
      ``
    );
  }

  let input = (args.join(" ") || m.quoted?.text || m.text || "").trim();

  // Buscar enlace de WhatsApp o código directo
  let code = "";
  const match = input.match(/(?:chat|www)\.whatsapp\.com\/(?:invite\/)?([a-zA-Z0-9_-]+)/i);
  if (match) {
    code = match[1];
  } else {
    // Si pasaron directamente el código sin la URL completa
    const directCode = input.split(/\s+/).find(w => /^[a-zA-Z0-9_-]{10,35}$/.test(w));
    if (directCode) code = directCode;
  }

  code = (code || "").split("?")[0].split("#")[0].trim();

  if (!code || code.length < 5) {
    return m.reply(
      `✦━【 🔗 *UNIRSE A GRUPO* 】━✦\n` +
      `Proporciona un enlace de invitación de grupo de WhatsApp.\n` +
      `\n` +
      `💡 *Uso:* \`${usedPrefix || "!"}unirse <enlace_whatsapp>\`\n` +
      `📌 *Ejemplo:* \`${usedPrefix || "!"}unirse https://chat.whatsapp.com/ABC123XYZ...\`\n`
    );
  }

  await m.reply(`⏳ *Procesando solicitud de unión al grupo...*`);

  let groupTitle = "el grupo";
  let groupJid = "";
  let isApprovalRequired = false;

  // Intentar obtener información del grupo antes de unirse
  try {
    const inviteInfo = await getGroupInviteInfoWithTimeout(conn, code, 5000);
    if (inviteInfo) {
      if (inviteInfo.subject) groupTitle = inviteInfo.subject;
      if (inviteInfo.id) groupJid = inviteInfo.id.includes("@") ? inviteInfo.id : `${inviteInfo.id}@g.us`;
      if (inviteInfo.joinApprovalMode) isApprovalRequired = true;
    }
  } catch (e) {
    // Continuar con el intento de unirse directamente
  }

  try {
    const resJid = await acceptInviteWithTimeout(conn, code, 20000);
    const finalJid = resJid
      ? (resJid.endsWith("@g.us") ? resJid : `${resJid}@g.us`)
      : (groupJid || "WhatsApp Group");

    if (isApprovalRequired) {
      return m.reply(
        `✦━【 📌 *SOLICITUD ENVIADA* 】━✦\n` +
        `👥 *Grupo:* ${groupTitle}\n` +
        `🛡️ *Condición:* Este grupo requiere aprobación previa de un administrador.\n` +
        `⏳ La solicitud ha sido registrada correctamente. El bot ingresará cuando un administrador la apruebe.\n` +
        ``
      );
    }

    return m.reply(
      `✦━【 ✅ *UNIDO CON ÉXITO* 】━✦\n` +
      `Me he unido satisfactoriamente a:\n` +
      `👥 *${groupTitle}*\n` +
      `🆔 \`${finalJid}\`\n` +
      ``
    );
  } catch (err) {
    console.error("Error al unirse al grupo:", err);

    const errMsg = (err?.message || err?.status || err || "").toString();

    if (errMsg.includes("409") || errMsg.includes("already") || errMsg.includes("exists")) {
      return m.reply(
        `✦━【 💡 *YA ESTOY DENTRO* 】━✦\n\n` +
        `El bot ya se encuentra como miembro de *${groupTitle}*.`
      );
    }

    if (errMsg.includes("request-approval") || errMsg.includes("approval") || errMsg.includes("pending") || isApprovalRequired) {
      return m.reply(
        `✦━【 📌 *SOLICITUD ENVIADA* 】━✦\n\n` +
        `👥 *Grupo:* ${groupTitle}\n` +
        `🛡️ *Condición:* Este grupo requiere aprobación manual por parte de administradores.\n` +
        `⏳ Se ha enviado la solicitud de acceso al grupo. El bot se unirá automáticamente una vez aprobada.`
      );
    }

    if (errMsg.includes("account_reachout_restricted") || errMsg.includes("reachout")) {
      return m.reply(
        `✦━【 ⚠️ *RESTRICCIÓN* 】━✦\n\n` +
        `WhatsApp restringe a los bots unirse mediante enlaces (\`account_reachout_restricted\`).\n\n` +
        `💡 *Solución Alternativa:*\n` +
        `Un administrador del grupo debe añadir el número del bot directamente desde la aplicación de WhatsApp:\n` +
        `*Info del grupo* ➔ *Añadir participantes* ➔ Buscar el número del bot.`
      );
    }

    if (errMsg.includes("401") || errMsg.includes("not-authorized") || errMsg.includes("revoked")) {
      return m.reply(
        `✦━【 ❌ *ENLACE INVÁLIDO* 】━✦\n\n` +
        `El enlace de invitación caducó, fue restablecido o no es válido.`
      );
    }

    if (errMsg.includes("403") || errMsg.includes("forbidden")) {
      return m.reply(
        `✦━【 ❌ *ACCESO DENEGADO* 】━✦\n\n` +
        `No fue posible unirse al grupo.\n` +
        `• El bot fue expulsado previamente del grupo o los enlaces de invitación están bloqueados.`
      );
    }

    return m.reply(
      `✦━【 ❌ *ERROR AL UNIRSE* 】━✦\n\n` +
      `No fue posible unirse al grupo *${groupTitle}*.\n` +
      `📝 Motivo: ${err.message || "Enlace revocado, restringido o requiere aprobación de admin"}`
    );
  }
};

handler.command = /^(unirse|unete|join|joingroup|entrar)$/i;
handler.description = "Unirse a un grupo mediante enlace de invitación (Exclusivo para Owner)";
handler.category = "owner";
handler.owner = true;

export default handler;
