// ============================================================
//   Kurumi Tokisaki - Ship Command
// ============================================================

import { randomInt, normalizeJid, getGroupMetadata, areJidsEqual, resolveGroupParticipantJid } from "../lib/utils.js";
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

  // 1. Si el JID es el propio bot
  if (jid) {
    const normJid = normalizeJid(jid);
    const botJid = conn?.user?.id ? normalizeJid(conn.user.id) : null;
    if (botJid && areJidsEqual(normJid, botJid)) {
      return "Kurumi Tokisaki";
    }

    // 2. Si es el sender y tenemos pushName real
    if (isSender && isRealName(senderPushName)) {
      return senderPushName.trim();
    }

    // 3. Buscar en la base de datos local
    const user = getUser(normJid);
    if (user?.name && isRealName(user.name)) {
      return user.name.trim();
    }

    // 4. Buscar en los participantes del grupo
    if (participants && participants.length > 0) {
      const p = participants.find((item) => areJidsEqual(item.id, normJid) || normalizeJid(item.id) === normJid);
      const groupName = p?.notify || p?.name || p?.pushName;
      if (isRealName(groupName)) {
        updateUser(normJid, { name: groupName.trim() });
        return groupName.trim();
      }
    }

    // 5. Buscar en contactos / store / conn.getName
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

    // 6. Usar el texto de la etiqueta si es un nombre legible (ej: "@Abuela" -> "Abuela")
    if (isRealName(cleanArg)) {
      updateUser(normJid, { name: cleanArg });
      return cleanArg;
    }

    if (cleanArg && cleanArg.length >= 2 && !/^\d+$/.test(cleanArg)) {
      return cleanArg;
    }
  }

  // Si no hay JID pero tenemos texto explícito
  if (isRealName(cleanArg)) {
    return cleanArg;
  }
  if (cleanArg && cleanArg.length >= 2 && !/^\d+$/.test(cleanArg)) {
    return cleanArg;
  }

  // Fallback con apodos bonitos
  const fallbackNames = [
    "Corazón", "Encanto", "Solcito", "Estrella", "Bombón", "Cielo",
    "Amores", "Piruleta", "Dulzura", "Mariposa", "Destino", "Caramelo"
  ];
  return fallbackNames[randomInt(0, fallbackNames.length - 1)];
}

function createShipName(n1, n2) {
  const clean1 = (n1 || "").toString().replace(/^[@+]/g, "").trim();
  const clean2 = (n2 || "").toString().replace(/^[@+]/g, "").trim();

  const valid1 = isRealName(clean1);
  const valid2 = isRealName(clean2);

  const romanticPrefixes = ["Astro", "Romi", "Amor", "Destino", "Nova", "Lumi", "Sora", "Star", "Kawai", "Luna", "Sweet", "Heart", "Velvet", "Shimi"];
  const romanticSuffixes = ["love", "heart", "spark", "soul", "bloom", "glow", "kiss", "charm", "wish", "fluff", "verse", "shine"];

  let w1 = valid1 ? (clean1.split(/\s+/)[0] || clean1) : clean1;
  let w2 = valid2 ? (clean2.split(/\s+/)[0] || clean2) : clean2;

  // Si no son nombres válidos pero tienen algún texto
  if (!valid1 && w1.length < 2) {
    w1 = romanticPrefixes[randomInt(0, romanticPrefixes.length - 1)];
  }
  if (!valid2 && w2.length < 2) {
    w2 = romanticSuffixes[randomInt(0, romanticSuffixes.length - 1)];
  }

  // Limpiar "User", "Persona", "Usuario" o sufijos numéricos de los fragmentos
  w1 = w1.replace(/^(user|persona|usuario)\d*$/i, "Amor").replace(/\d+$/g, "");
  w2 = w2.replace(/^(user|persona|usuario)\d*$/i, "Lover").replace(/\d+$/g, "");

  if (w1.length < 2) w1 = romanticPrefixes[randomInt(0, romanticPrefixes.length - 1)];
  if (w2.length < 2) w2 = romanticSuffixes[randomInt(0, romanticSuffixes.length - 1)];

  const len1 = w1.length;
  const len2 = w2.length;

  const cut1 = Math.max(2, Math.ceil(len1 / 2));
  const cut2 = Math.floor(len2 / 2);

  let part1 = w1.slice(0, cut1);
  let part2 = w2.slice(cut2);

  let ship = part1 + part2;
  ship = ship.charAt(0).toUpperCase() + ship.slice(1).toLowerCase();

  if (
    ship.length < 3 ||
    ship.toLowerCase() === w1.toLowerCase() ||
    ship.toLowerCase() === w2.toLowerCase()
  ) {
    const altCut1 = Math.floor(len1 / 2);
    const altCut2 = Math.max(2, Math.ceil(len2 / 2));
    const altPart1 = w2.slice(0, altCut2);
    const altPart2 = w1.slice(altCut1);
    ship = altPart1 + altPart2;
    ship = ship.charAt(0).toUpperCase() + ship.slice(1).toLowerCase();
  }

  if (
    !ship ||
    ship.length < 3 ||
    /^(user|persona|usuario|\d+)$/i.test(ship) ||
    /^\d+$/.test(ship)
  ) {
    const p = romanticPrefixes[randomInt(0, romanticPrefixes.length - 1)];
    const s = romanticSuffixes[randomInt(0, romanticSuffixes.length - 1)];
    ship = `${p}${s}`;
    ship = ship.charAt(0).toUpperCase() + ship.slice(1).toLowerCase();
  }

  return ship;
}

const handler = async (m, { conn, args, sender, isGroup, store }) => {
  const quoted = m.message?.extendedTextMessage?.contextInfo;
  const mentions = m.mentionedJid || [];

  let target1 = null;
  let target2 = null;
  let rawArg1 = args[0] || null;
  let rawArg2 = args[1] || null;

  let participants = [];
  if (isGroup) {
    try {
      const meta = await getGroupMetadata(conn, m.chatId);
      participants = meta?.participants || [];
    } catch (e) {}
  }

  // Detectar objetivos según menciones, cita, argumentos o aleatorio
  if (mentions.length >= 2) {
    target1 = normalizeJid(mentions[0]);
    target2 = normalizeJid(mentions[1]);
    rawArg1 = args[0] || null;
    rawArg2 = args[1] || null;
  } else if (mentions.length === 1 && quoted?.participant) {
    target1 = normalizeJid(quoted.participant);
    target2 = normalizeJid(mentions[0]);
    rawArg1 = null;
    rawArg2 = args[0] || null;
  } else if (mentions.length === 1) {
    target1 = normalizeJid(sender);
    target2 = normalizeJid(mentions[0]);
    rawArg1 = m.pushName || null;
    rawArg2 = args[0] || null;
  } else if (quoted?.participant) {
    target1 = normalizeJid(sender);
    target2 = normalizeJid(quoted.participant);
    rawArg1 = m.pushName || null;
    rawArg2 = null;
  } else if (args.length >= 2 && !args[0].includes("@") && !args[1].includes("@") && isNaN(args[0]) && isNaN(args[1])) {
    // Caso de nombres libres ej: !ship Goku Vegeta
    rawArg1 = args[0];
    rawArg2 = args[1];
  } else if (args.length >= 2) {
    const num1 = args[0].replace(/[^0-9]/g, "");
    const num2 = args[1].replace(/[^0-9]/g, "");
    if (num1.length >= 7) target1 = num1 + "@s.whatsapp.net";
    if (num2.length >= 7) target2 = num2 + "@s.whatsapp.net";
    rawArg1 = args[0];
    rawArg2 = args[1];
  }

  // Si no hay objetivos y es grupo, elegir 2 miembros al azar
  if (!target1 && !target2 && !rawArg1 && !rawArg2 && isGroup) {
    if (participants.length >= 2) {
      const filtered = participants.length > 2
        ? participants.filter(p => !conn?.user?.id || !areJidsEqual(p.id, conn.user.id))
        : participants;

      const p1 = filtered[randomInt(0, filtered.length - 1)];
      let p2 = filtered[randomInt(0, filtered.length - 1)];
      while (p2.id === p1.id && filtered.length > 1) {
        p2 = filtered[randomInt(0, filtered.length - 1)];
      }
      target1 = normalizeJid(p1.id);
      target2 = normalizeJid(p2.id);
      rawArg1 = p1.notify || p1.name || p1.pushName || null;
      rawArg2 = p2.notify || p2.name || p2.pushName || null;
    }
  }

  // Resolver JIDs con resolveGroupParticipantJid para asegurar PN JIDs
  if (target1) target1 = await resolveGroupParticipantJid(conn, chatId, target1);
  if (target2) target2 = await resolveGroupParticipantJid(conn, chatId, target2);

  // Si no hay objetivos en privado
  if (!target1 && !target2 && !rawArg1 && !rawArg2 && !isGroup) {
    target1 = normalizeJid(sender);
    target2 = conn.user?.id ? normalizeJid(conn.user.id) : "bot@s.whatsapp.net";
    rawArg1 = m.pushName || null;
    rawArg2 = "Kurumi Tokisaki";
  }

  const isSender1 = target1 && sender && areJidsEqual(target1, sender);
  const isSender2 = target2 && sender && areJidsEqual(target2, sender);

  const name1 = await getTargetName(target1, rawArg1, conn, m.chatId, participants, store, isSender1, isSender1 ? m.pushName : null);
  const name2 = await getTargetName(target2, rawArg2, conn, m.chatId, participants, store, isSender2, isSender2 ? m.pushName : null);

  const shipName = createShipName(name1, name2);
  const compatibility = randomInt(1, 100);

  let status = "";
  if (compatibility === 100) status = "💍 *¡BODA EN CAMINO!* Son la pareja perfecta. ✨";
  else if (compatibility >= 85) status = "💖 *¡AMOR PURO!* Hay un sentimiento mutuo gigante. 😍";
  else if (compatibility >= 70) status = "💘 *¡MUCHA QUÍMICA!* Deberían salir a una cita ya. 😉";
  else if (compatibility >= 50) status = "💙 *¡INTERESANTE!* Hay chispa, solo falta dar el primer paso. 🙈";
  else if (compatibility >= 30) status = "🟡 *¡FRIENDZONE!* Hay cariño, pero como mejores amigos. 🤝";
  else if (compatibility >= 15) status = "🔴 *¡TENSIÓN!* Salen chispas, pero no de las buenas... 😅";
  else status = "💥 *¡DESASTRE TOTAL!* Es mejor mantener la distancia... 💔";

  const num1 = target1 ? target1.split("@")[0].split(":")[0] : name1;
  const num2 = target2 ? target2.split("@")[0].split(":")[0] : name2;

  const mentionsList = [target1, target2].filter(Boolean);

  let coupleLabel = "";
  if (target1 && target2) {
    coupleLabel = `@${num1} + @${num2}`;
  } else if (target1) {
    coupleLabel = `@${num1} + *${name2}*`;
  } else if (target2) {
    coupleLabel = `*${name1}* + @${num2}`;
  } else {
    coupleLabel = `*${name1}* + *${name2}*`;
  }

  await m.reply(
    `✦━【 *SHIP DE PAREJA* 】━✦\n\n` +
    `👥 *Pareja:* ${coupleLabel}\n` +
    `💖 *Nombre del Ship:* *${shipName}*\n` +
    `📊 *Compatibilidad:* *${compatibility}%*\n\n` +
    `✨ *Pronóstico:* ${status}`,
    { mentions: mentionsList }
  );
};

handler.command = /^(ship|pareja|shipear)$/i;
handler.description = "Shipear a dos personas";
handler.category = "misc";

export default handler;
