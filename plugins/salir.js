// ============================================================
//   Kurumi Tokisaki - Leave Group Command (Owner Exclusive)
// ============================================================

const handler = async (m, { conn, args, chatId, isGroup, isOwner }) => {
  if (!isOwner) {
    return m.reply(
      `✦━【 🚫 *ACCESO RESTRENGIDO* 】━✦\n\n` +
      `Esta función de hacer que el bot salga del grupo es exclusiva de mi creador (+529852270023).`
    );
  }

  const inputParam = (args.join(" ") || "").trim();

  // Helper to fetch all participating groups reliably
  const fetchGroupList = async () => {
    let groupsObj = {};
    try {
      if (typeof conn.groupFetchAllParticipating === "function") {
        groupsObj = await conn.groupFetchAllParticipating();
      }
    } catch (e) {
      console.error("Error en groupFetchAllParticipating:", e);
    }

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

    if (m.isGroup && m.chat && !groupsObj[m.chat]) {
      try {
        const meta = await conn.groupMetadata(m.chat);
        if (meta) groupsObj[m.chat] = meta;
      } catch (e) {}
    }

    return Object.values(groupsObj || {});
  };

  // If no parameter provided
  if (!inputParam) {
    // If inside a group, leave current group directly
    if (isGroup) {
      try {
        await m.reply(
          `✦━【 👋 *DESPEDIDA* 】━✦\n\n` +
          `Me retiro de este grupo por orden de mi creador. ¡Hasta luego!`
        );
        await new Promise((r) => setTimeout(r, 1000));
        await conn.groupLeave(chatId);
      } catch (err) {
        await m.reply(`❌ No se pudo salir del grupo: ${err.message}`);
      }
      return;
    }

    // If inside Private Chat without parameters: check if bot is in exactly 1 group
    const groupList = await fetchGroupList();
    if (groupList.length === 1) {
      const singleGroup = groupList[0];
      const targetJid = singleGroup.id;
      const targetName = singleGroup.subject || "Grupo";

      await m.reply(`⏳ *Saliendo del grupo "${targetName}"...*`);

      try {
        await conn.sendMessage(targetJid, {
          text: `✦━【 👋 *DESPEDIDA* 】━✦\n\nMe retiro de este grupo por orden de mi creador (+529852270023). ¡Hasta luego!`
        }).catch(() => {});
        await new Promise((r) => setTimeout(r, 1000));
        await conn.groupLeave(targetJid);

        return m.reply(
          `✦━【 ✅ *SALIDA EXITOSA* 】━✦\n\n` +
          `Me he salido con éxito del único grupo en el que estaba:\n` +
          `👥 *${targetName}*\n` +
          `🆔 \`${targetJid}\``
        );
      } catch (err) {
        return m.reply(`❌ No se pudo salir del grupo ${targetName}: ${err.message}`);
      }
    }

    if (groupList.length === 0) {
      return m.reply(`❌ El bot no pertenece a ningún grupo actualmente.`);
    }

    // If multiple groups exist in PV without parameter
    return m.reply(
      `✦━【 ℹ️ *SALIR DE GRUPO* 】━✦\n\n` +
      `Especifica el nombre, enlace o ID del grupo del que deseas que me salga.\n\n` +
      `💡 *Ejemplos:*\n` +
      `  \`!salir https://chat.whatsapp.com/XYZ...\` \n` +
      `  \`!salir Nombre Del Grupo\`\n\n` +
      `📌 Usa \`!grupos\` para ver los ${groupList.length} grupos activos.`
    );
  }

  // Parameter provided: Search target group
  await m.reply(`⏳ *Buscando grupo para salir...*`);

  try {
    const groupList = await fetchGroupList();

    if (!groupList || groupList.length === 0) {
      return m.reply(`❌ El bot no pertenece a ningún grupo actualmente.`);
    }

    let targetGroup = null;

    // 1. WhatsApp invite link check
    const linkMatch = inputParam.match(/chat\.whatsapp\.com\/([a-zA-Z0-9_-]+)/);
    if (linkMatch) {
      const code = linkMatch[1];
      try {
        const inviteInfo = await conn.groupGetInviteInfo(code);
        if (inviteInfo && inviteInfo.id) {
          targetGroup = groupList.find((g) => g.id === inviteInfo.id) || {
            id: inviteInfo.id,
            subject: inviteInfo.subject || "Grupo"
          };
        }
      } catch (e) {
        for (const g of groupList) {
          try {
            const gCode = await conn.groupInviteCode(g.id);
            if (gCode === code) {
              targetGroup = g;
              break;
            }
          } catch (err) {}
        }
      }
    }

    // 2. JID check
    if (!targetGroup) {
      const jidMatch = groupList.find((g) => g.id === inputParam || g.id === `${inputParam}@g.us`);
      if (jidMatch) targetGroup = jidMatch;
    }

    // 3. Group Name match (exact or partial)
    if (!targetGroup) {
      const cleanParam = inputParam.toLowerCase();
      const exactMatch = groupList.find((g) => (g.subject || "").toLowerCase() === cleanParam);
      if (exactMatch) {
        targetGroup = exactMatch;
      } else {
        const partialMatch = groupList.find((g) => (g.subject || "").toLowerCase().includes(cleanParam));
        if (partialMatch) targetGroup = partialMatch;
      }
    }

    if (!targetGroup) {
      return m.reply(
        `❌ *Grupo No Encontrado*\n\n` +
        `No se encontró ningún grupo que coincida con "${inputParam}".\n\n` +
        `💡 Usa \`!grupos\` para ver la lista completa de grupos en los que estoy.`
      );
    }

    const targetJid = targetGroup.id;
    const targetName = targetGroup.subject || "Grupo";

    // Send goodbye message in target group if different chat or if possible
    if (targetJid !== chatId) {
      try {
        await conn.sendMessage(targetJid, {
          text:
            `✦━【 👋 *DESPEDIDA* 】━✦\n\n` +
            `Me retiro de este grupo por orden de mi creador (+529852270023). ¡Hasta luego!`
        });
        await new Promise((r) => setTimeout(r, 1000));
      } catch (e) {
        // Ignore message error
      }
    } else {
      await m.reply(
        `✦━【 👋 *DESPEDIDA* 】━✦\n\n` +
        `Me retiro de este grupo por orden de mi creador. ¡Hasta luego!`
      );
      await new Promise((r) => setTimeout(r, 1000));
    }

    // Leave the group
    await conn.groupLeave(targetJid);

    // Confirm to owner if command was executed from PV or a different group
    if (targetJid !== chatId) {
      return m.reply(
        `✦━【 ✅ *SALIDA EXITOSA* 】━✦\n\n` +
        `Me he salido con éxito del grupo:\n` +
        `👥 *${targetName}*\n` +
        `🆔 \`${targetJid}\``
      );
    }
  } catch (err) {
    console.error("Error en comando salir:", err);
    return m.reply(`❌ No se pudo salir del grupo: ${err.message}`);
  }
};

handler.command = /^(salir|salte|leave|out|bye)$/i;
handler.description = "Hacer que el bot salga de un grupo especificado o del actual (Exclusivo para Owner)";
handler.category = "owner";
handler.owner = true;

export default handler;
