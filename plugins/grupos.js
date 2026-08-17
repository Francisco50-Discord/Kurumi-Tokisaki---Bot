// ============================================================
//   Kurumi Tokisaki - Group List Command (Owner Exclusive)
// ============================================================

const getInviteCodeWithTimeout = (conn, jid, ms = 1500) => {
  return Promise.race([
    conn.groupInviteCode(jid),
    new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), ms))
  ]);
};

const handler = async (m, { conn, isOwner }) => {
  if (!isOwner) {
    return m.reply(
      `✦━【 🚫 *ACCESO RESTRENGIDO* 】━✦\n` +
      `Esta función es exclusiva de mi creador (+529852270023).\n` +
      ``
    );
  }

  await m.reply(`⏳ *Cargando lista de grupos...*`);

  try {
    let groupsObj = {};
    try {
      if (typeof conn.groupFetchAllParticipating === "function") {
        groupsObj = await conn.groupFetchAllParticipating();
      }
    } catch (e) {
      console.error("Error en groupFetchAllParticipating:", e);
    }

    // Fallback: si groupFetchAllParticipating no devolvió nada, buscar en chats activos y store
    if (!groupsObj || Object.keys(groupsObj).length === 0) {
      groupsObj = {};
      const chats = conn.chats || (global.store ? global.store.chats : null) || {};
      for (const [jid, chat] of Object.entries(chats)) {
        if (jid.endsWith("@g.us")) {
          groupsObj[jid] = {
            id: jid,
            subject: chat.subject || chat.name || chat.title || "Grupo de WhatsApp",
            participants: chat.participants || []
          };
        }
      }
    }

    // Incluir el grupo actual si m.isGroup y no estuviese en la lista
    if (m.isGroup && m.chat && !groupsObj[m.chat]) {
      try {
        const meta = await conn.groupMetadata(m.chat);
        if (meta) groupsObj[m.chat] = meta;
      } catch (e) {}
    }

    const groupList = Object.values(groupsObj || {});

    if (!groupList || groupList.length === 0) {
      return m.reply(
        `✦━【 📜 *LISTA DE GRUPOS* 】━✦\n` +
        `\n` +
        `❌ El bot no se encuentra en ningún grupo actualmente.\n` +
        ``
      );
    }

    const botNumber = conn.user?.id ? conn.user.id.split("@")[0].split(":")[0] : "";

    let text = `✦━【 📜 *GRUPOS* (${groupList.length}) 】━✦\n\n`;

    let index = 1;
    for (const group of groupList) {
      const name = group.subject || "Sin Nombre";
      const members = group.participants ? group.participants.length : 0;
      const jid = group.id;

      let inviteLink = "Sin enlace (Requiere admin)";

      // Intentar obtener código de invitación directamente.
      try {
        const code = await getInviteCodeWithTimeout(conn, jid, 4000);
        if (code) {
          inviteLink = `https://chat.whatsapp.com/${code}`;
        }
      } catch (e) {
        // Fallback: solicitar metadatos frescos del grupo por si el estado de admin acaba de actualizarse
        try {
          const freshMeta = await conn.groupMetadata(jid);
          if (freshMeta) {
            const code = await getInviteCodeWithTimeout(conn, jid, 4000);
            if (code) inviteLink = `https://chat.whatsapp.com/${code}`;
          }
        } catch (err) {
          inviteLink = "Sin enlace (Requiere admin)";
        }
      }

      text += `*${index}. ${name}*\n`;
      text += `   👥 Miembros: ${members}\n`;
      text += `   🆔 ID: \`${jid}\`\n`;
      text += `   🔗 Enlace: ${inviteLink}\n`;
      text += `\n`;
      index++;
    }

    text += `\n\n💡 *Tip para el Owner:* Puedes pedirme salir de cualquier grupo usando:\n\`!salir <nombre_o_enlace>\``;

    return m.reply(text);
  } catch (err) {
    console.error("Error al obtener lista de grupos:", err);
    return m.reply(`✦━【 ❌ ERROR 】━✦\n\nNo se pudo obtener la lista de grupos:\n${err.message}`);
  }
};

handler.command = /^(listagrupos|listagrupo|grouplist|listgroups|grupos)$/i;
handler.description = "Listar los grupos donde está el bot con enlace y miembros (Exclusivo para Owner)";
handler.category = "owner";
handler.owner = true;

export default handler;
