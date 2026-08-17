// ============================================================
//   Kurumi Tokisaki - Harem Command
// ============================================================

import { randomInt, normalizeJid, getGroupMetadata, areJidsEqual } from "../lib/utils.js";
import { getUser, updateUser } from "../lib/database.js";

function isRealName(str) {
  if (!str || typeof str !== "string") return false;
  const clean = str.trim().replace(/^[@+]/g, "");
  if (!clean || clean.length < 2) return false;
  if (/^(usuario|user|persona|anonimo|anónimo|undefined|null)$/i.test(clean)) return false;
  if (/^(usuario|user|persona)\s*\d+$/i.test(clean)) return false;
  if (/^\d+$/.test(clean)) return false;
  return true;
}

async function getTargetName(jid, rawArg, conn, chatId, participants = [], store = null, isSender = false, senderPushName = null) {
  const cleanArg = rawArg ? rawArg.replace(/^[@+]/g, "").trim() : "";

  if (jid) {
    const normJid = normalizeJid(jid);
    const botJid = conn?.user?.id ? normalizeJid(conn.user.id) : null;
    if (botJid && areJidsEqual(normJid, botJid)) {
      return "Kurumi Tokisaki";
    }

    if (isSender && isRealName(senderPushName)) {
      return senderPushName.trim();
    }

    const user = getUser(normJid);
    if (user?.name && isRealName(user.name)) {
      return user.name.trim();
    }

    if (participants && participants.length > 0) {
      const p = participants.find((item) => areJidsEqual(item.id, normJid) || normalizeJid(item.id) === normJid);
      const groupName = p?.notify || p?.name || p?.pushName;
      if (isRealName(groupName)) {
        updateUser(normJid, { name: groupName.trim() });
        return groupName.trim();
      }
    }

    const storeContact = conn?.contacts?.[normJid] || global?.store?.contacts?.[normJid] || store?.contacts?.[normJid];
    const contactName = storeContact?.notify || storeContact?.name || storeContact?.verifiedName;
    if (isRealName(contactName)) {
      updateUser(normJid, { name: contactName.trim() });
      return contactName.trim();
    }

    if (typeof conn?.getName === "function") {
      try {
        const cName = await conn.getName(normJid);
        if (isRealName(cName)) {
          updateUser(normJid, { name: cName.trim() });
          return cName.trim();
        }
      } catch (e) {}
    }

    if (isRealName(cleanArg)) {
      updateUser(normJid, { name: cleanArg });
      return cleanArg;
    }

    if (cleanArg && cleanArg.length >= 2 && !/^\d+$/.test(cleanArg)) {
      return cleanArg;
    }
  }

  if (isRealName(cleanArg)) {
    return cleanArg;
  }
  if (cleanArg && cleanArg.length >= 2 && !/^\d+$/.test(cleanArg)) {
    return cleanArg;
  }

  const fallbackNames = [
    "Corazón", "Encanto", "Solcito", "Estrella", "Bombón", "Cielo",
    "Amores", "Piruleta", "Dulzura", "Mariposa", "Destino", "Caramelo"
  ];
  return fallbackNames[randomInt(0, fallbackNames.length - 1)];
}

const HAREM_ROLES = [
  { title: "👑 Waifu / Husbando Principal", quote: "«Eres la única persona en mi corazón.»" },
  { title: "⚡ Tsundere del Grupo", quote: "«¡N-No es como si me gustaras o algo parecido, tonto/a!»" },
  { title: "🖤 Yandere Posesivo/a", quote: "«Si miras a alguien más, te encerraré para siempre...»" },
  { title: "🧹 Maid / Mayordomo Leal", quote: "«Tus deseos son órdenes para mí, mi señor/a.»" },
  { title: "📚 Senpai / Kouhai Adorable", quote: "«Siempre quise pasar más tiempo a tu lado...»" },
  { title: "🌸 Amigo/a de la Infancia", quote: "«Prometimos estar juntos desde niños, ¿te acuerdas?»" },
  { title: "🦊 Necomimi / Chibi Tierno/a", quote: "«Nyaa~ ¡Abrazos gratis solo para ti!»" }
];

const handler = async (m, { conn, args, sender, isGroup, store }) => {
  const quoted = m.message?.extendedTextMessage?.contextInfo;
  const mentions = m.mentionedJid || [];

  let ownerJid = normalizeJid(sender);
  let ownerRawArg = m.pushName || null;

  // Si mencionan a alguien, generar el harem para esa persona
  if (mentions.length > 0) {
    ownerJid = normalizeJid(mentions[0]);
    ownerRawArg = args[0] || null;
  } else if (quoted?.participant) {
    ownerJid = normalizeJid(quoted.participant);
    ownerRawArg = null;
  }

  let participants = [];
  if (isGroup) {
    try {
      const meta = await getGroupMetadata(conn, m.chatId);
      participants = meta?.participants || [];
    } catch (e) {}
  }

  const isOwnerSender = areJidsEqual(ownerJid, sender);
  const ownerName = await getTargetName(ownerJid, ownerRawArg, conn, m.chatId, participants, store, isOwnerSender, isOwnerSender ? m.pushName : null);
  const ownerNum = ownerJid ? ownerJid.split("@")[0].split(":")[0] : ownerName;

  // Filtrar candidatos para el harem (excluir al dueño del harem)
  let candidates = participants.filter((p) => !areJidsEqual(p.id, ownerJid));

  // Si hay pocos participantes o en chat privado, añadir bot o respaldos
  const botJid = conn?.user?.id ? normalizeJid(conn.user.id) : null;

  // Determinar tamaño del harem (3 a 5 miembros)
  const haremSize = Math.min(Math.max(3, randomInt(3, 5)), Math.max(3, candidates.length));

  // Seleccionar miembros aleatorios sin repetición
  const shuffledCandidates = [...candidates].sort(() => 0.5 - Math.random());
  const selectedCandidates = shuffledCandidates.slice(0, haremSize);

  // Mezclar roles
  const shuffledRoles = [...HAREM_ROLES].sort(() => 0.5 - Math.random());

  const haremList = [];
  const mentionsList = [ownerJid];

  for (let i = 0; i < haremSize; i++) {
    const candidate = selectedCandidates[i];
    const role = shuffledRoles[i % shuffledRoles.length];
    const affection = randomInt(75, 100);

    let memberJid = candidate ? normalizeJid(candidate.id) : null;
    let memberRawArg = candidate ? (candidate.notify || candidate.name || candidate.pushName) : null;

    if (memberJid) {
      mentionsList.push(memberJid);
    }

    const memberName = await getTargetName(
      memberJid,
      memberRawArg,
      conn,
      m.chatId,
      participants,
      store,
      memberJid && sender && areJidsEqual(memberJid, sender),
      (memberJid && sender && areJidsEqual(memberJid, sender)) ? m.pushName : null
    );

    const num = memberJid ? memberJid.split("@")[0].split(":")[0] : memberName;
    const label = memberJid ? `@${num}` : `*${memberName}*`;

    haremList.push({
      label,
      role: role.title,
      quote: role.quote,
      affection
    });
  }

  const powerLevel = randomInt(8500, 9999);

  let haremText =
    `✦━【 🏰 *HAREM DE @${ownerNum}* 】━✦\n\n` +
    `👤 *Líder:* @${ownerNum}\n` +
    `⚡ *Poder de Atracción:* *${powerLevel} / 10,000 pts*\n` +
    `👥 *Integrantes:* *${haremList.length} Miembros*\n\n`;

  haremList.forEach((item, index) => {
    haremText +=
      `*${index + 1}.* ${item.label}\n` +
      `   └ 🎭 *Rol:* ${item.role}\n` +
      `   └ 💖 *Afecto:* *${item.affection}%*\n` +
      `   └ 💬 _${item.quote}_\n\n`;
  });

  haremText += `🔮 *Comentario de Kurumi:* _«Un harem envidiable... Asegúrate de tratarlos a todos con mucho amor para mantener la paz.»_\n\n✨ *Kurumi Tokisaki*`;

  await m.reply(haremText, { mentions: mentionsList });
};

handler.command = /^(harem|miharem| harem)$/i;
handler.description = "Revelar o formar el harem de un usuario";
handler.category = "misc";

export default handler;
