// ============================================================
//   Kurumi Tokisaki - Ranking Command (Nivel RPG)
// ============================================================

import { getLeaderboard, getUser } from "../lib/database.js";
import { areJidsEqual, getGroupMetadata, normalizeJid } from "../lib/utils.js";

const handler = async (m, { conn, usedPrefix, sender }) => {
  const chatId = normalizeJid(m.chatId || m.chat || m.key?.remoteJid || "");
  let groupParticipants = [];
  if (conn && chatId && chatId.endsWith("@g.us")) {
    try {
      const metadata = await getGroupMetadata(conn, chatId);
      groupParticipants = metadata?.participants || [];
    } catch (e) {}
  }

  // Obtener top usuarios ordenados por Nivel
  const top = getLeaderboard("level", 10, groupParticipants);

  if (!top || top.length === 0) {
    return m.reply(`✦━【 ❌ *RANKING VACÍO* 】━✦\n\nNo hay usuarios registrados todavía.`);
  }

  const medals = ["🥇", "🥈", "🥉", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟"];
  const mentions = [];

  const maxDisplay = Math.min(top.length, 10);
  let rankText = `✦━【 🏆 *TOP ${maxDisplay} RPG* 】━✦\n\n`;

  top.forEach((user, i) => {
    const levelVal = user.level || 1;
    const expVal = user.exp || 0;

    const jid = user.id || "";
    if (jid && !mentions.includes(jid)) mentions.push(jid);

    const numTag = jid.split("@")[0].split(":")[0] || "Usuario";
    const displayName = `@${numTag}`;

    rankText += `» ${medals[i]} *${displayName}*\n`;
    rankText += `   └ ⚔️ *Nivel:* ${levelVal} *(EXP: ${expVal})*\n\n`;
  });

  // Mostrar la posición/nivel actual del usuario que ejecuta el comando
  const currentUser = getUser(sender, groupParticipants);
  if (currentUser) {
    const levelVal = currentUser.level || 1;
    const expVal = currentUser.exp || 0;
    const myTag = sender.split("@")[0].split(":")[0];

    rankText += `\n👤 *Tu perfil:* @${myTag} — ⚔️ *Nivel ${levelVal}* *(EXP: ${expVal})*\n\n✨ *Kurumi Tokisaki*`;
    if (!mentions.includes(sender)) mentions.push(sender);
  }

  await conn.sendMessage(m.chatId, { text: rankText, mentions }, { quoted: m });
};

handler.command = /^(ranking|rank|top|leaderboard|clasificacion|clasificación|nivel|level|lvl)$/i;
handler.description = "Ver el ranking de Nivel RPG de los usuarios";
handler.category = "rpg";

export default handler;
