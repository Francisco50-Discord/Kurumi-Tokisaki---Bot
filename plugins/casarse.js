// ============================================================
//   Kurumi Tokisaki - Casarse / Boda Command (Interactive)
// ============================================================

import { randomInt, normalizeJid, getGroupMetadata, areJidsEqual, resolveGroupParticipantJid } from "../lib/utils.js";
import { getUser, updateUser } from "../lib/database.js";

const activeWeddings = global.activeWeddings = global.activeWeddings || new Map();

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

const WEDDING_LOCATIONS = [
  "💒 Catedral de Cristal de Tokio",
  "🌸 Jardín Imperial de Cerezos en Flor",
  "🏖️ Playa Paradise en las Islas Maldivas",
  "🏰 Castillo Real de Neuschwanstein",
  "⛩️ Templo Shinto Tradicional de Kioto",
  "🌌 Observatorio de Estrellas bajo la Aurora Boreal",
  "🚢 Crucero de Lujo por las Islas Griegas",
  "🌺 Resort de Ensueño en Santorini"
];

const WEDDING_CAKES = [
  "🎂 Pastel Imperial de Fresas y Crema Chantilly (5 pisos)",
  "🍫 Pastel de Chocolate Fino Belga con Hoja de Oro",
  "🍇 Pastel de Frutos Rojos Silvestres y Vainilla Francesa",
  "🍰 Pastel de Terciopelo Red Velvet con Queso Crema",
  "🥭 Pastel Tropical de Mango, Maracuyá y Coco"
];

const HONEYMOONS = [
  "✈️ París, Francia (La ciudad del amor)",
  "✈️ Tokio y Kioto, Japón",
  "✈️ Venecia, Italia (Paseo en góndola)",
  "✈️ Bora Bora, Polinesia Francesa",
  "✈️ Cancún, México (Playa y cenotes)",
  "✈️ Santorini, Grecia",
  "✈️ Reikiavik, Islandia (Luces del norte)"
];

const VOWS = [
  "«Prometo amarte en las buenas, en las malas y cuando el Wi-Fi falle.»",
  "«Prometo compartir mis papas fritas y entregarte siempre mi corazón.»",
  "«Prometo estar a tu lado en cada aventura, anime y vida entera.»",
  "«Mi destino era encontrarte y mi felicidad es caminar juntos para siempre.»",
  "«Prometo amarte más allá de las estrellas y cuidar tu sonrisa cada día.»"
];

const handler = async (m, { conn, args, sender, isGroup, store, chatId }) => {
  const quoted = m.message?.extendedTextMessage?.contextInfo;
  const mentions = m.mentionedJid || [];

  let proposerJid = normalizeJid(sender);
  let targetJid = null;
  let rawArg2 = args[0] || null;

  let participants = [];
  if (isGroup) {
    try {
      const meta = await getGroupMetadata(conn, chatId);
      participants = meta?.participants || [];
    } catch (e) {}
  }

  if (mentions.length >= 2) {
    proposerJid = normalizeJid(mentions[0]);
    targetJid = normalizeJid(mentions[1]);
  } else if (mentions.length === 1 && quoted?.participant) {
    proposerJid = normalizeJid(quoted.participant);
    targetJid = normalizeJid(mentions[0]);
  } else if (mentions.length === 1) {
    targetJid = normalizeJid(mentions[0]);
  } else if (quoted?.participant) {
    targetJid = normalizeJid(quoted.participant);
  } else if (args.length >= 1 && isNaN(args[0]) && !args[0].includes("@")) {
    rawArg2 = args.join(" ");
  } else if (args.length >= 1) {
    const num = args[0].replace(/[^0-9]/g, "");
    if (num.length >= 7) targetJid = num + "@s.whatsapp.net";
  }

  if (proposerJid) proposerJid = await resolveGroupParticipantJid(conn, chatId, proposerJid);
  if (targetJid) targetJid = await resolveGroupParticipantJid(conn, chatId, targetJid);

  // Si no hay objetivo y es grupo, elegir uno al azar
  if (!targetJid && !rawArg2 && isGroup) {
    if (participants.length >= 2) {
      const filtered = participants.filter(p => !conn?.user?.id || !areJidsEqual(p.id, conn.user.id));
      const candidates = filtered.filter(p => !areJidsEqual(p.id, proposerJid));
      if (candidates.length > 0) {
        const chosen = candidates[randomInt(0, candidates.length - 1)];
        targetJid = normalizeJid(chosen.id);
        rawArg2 = chosen.notify || chosen.name || chosen.pushName || null;
      }
    }
  }

  if (!targetJid && !rawArg2 && !isGroup) {
    targetJid = conn.user?.id ? normalizeJid(conn.user.id) : "bot@s.whatsapp.net";
    rawArg2 = "Kurumi Tokisaki";
  }

  if (targetJid && areJidsEqual(proposerJid, targetJid)) {
    return m.reply("❌ No puedes casarte contigo mismo/a. ¡Etiqueta o responde al mensaje de la persona con la que deseas casarte!");
  }

  if (activeWeddings.has(chatId)) {
    return m.reply("⚠️ Ya hay una propuesta de matrimonio pendiente en este chat. Espera a que sea respondida o que expire.");
  }

  const proposerName = await getTargetName(proposerJid, m.pushName, conn, chatId, participants, store, true, m.pushName);
  const targetName = await getTargetName(targetJid, rawArg2, conn, chatId, participants, store, false, null);

  const botJid = conn?.user?.id ? normalizeJid(conn.user.id) : null;
  const isTargetBot = (botJid && targetJid && areJidsEqual(targetJid, botJid)) || targetName === "Kurumi Tokisaki";

  const weddingData = {
    proposerJid,
    targetJid,
    proposerName,
    targetName,
    happiness: randomInt(80, 100),
    location: WEDDING_LOCATIONS[randomInt(0, WEDDING_LOCATIONS.length - 1)],
    cake: WEDDING_CAKES[randomInt(0, WEDDING_CAKES.length - 1)],
    honeymoon: HONEYMOONS[randomInt(0, HONEYMOONS.length - 1)],
    vow: VOWS[randomInt(0, VOWS.length - 1)],
    status: "pending"
  };

  // Si se propone casarse con Kurumi (Bot), Kurumi acepta automáticamente
  if (isTargetBot) {
    await m.reply(`🌸 *¡Ara ara~! Kurumi Tokisaki ha aceptado encantada tu propuesta de matrimonio!* 💖✨`);
    return sendWeddingCertificate(conn, chatId, weddingData, m);
  }

  if (!targetJid) {
    return sendWeddingCertificate(conn, chatId, weddingData, m);
  }

  // Establecer propuesta interactiva con tiempo límite (1 minuto)
  const targetNum = targetJid.split("@")[0].split(":")[0];
  const proposerNum = proposerJid.split("@")[0].split(":")[0];

  const proposalTimeout = setTimeout(async () => {
    if (activeWeddings.has(chatId)) {
      activeWeddings.delete(chatId);
      await conn.sendMessage(chatId, {
        text: `⏳ *Tiempo Agotado*\n\nLa propuesta de matrimonio de @${proposerNum} para @${targetNum} ha expirado sin recibir respuesta. 🥀`,
        mentions: [proposerJid, targetJid]
      });
    }
  }, 60000);

  weddingData.timeout = proposalTimeout;
  activeWeddings.set(chatId, weddingData);

  const proposalText =
    `💍 ━━━━ *PROPUESTA DE MATRIMONIO* ━━━━ 💍\n\n` +
    `@${targetNum} ¿te casarías con @${proposerNum}?\n\n` +
    `👉 *Responde con:* "aceptar" o "rechazar" (o "sí" / "no")\n` +
    `⏰ *Tiempo límite:* 1 minuto`;

  await conn.sendMessage(chatId, {
    text: proposalText,
    mentions: [targetJid, proposerJid]
  }, { quoted: m });
};

handler.before = async (m, { conn, chatId, sender }) => {
  const wedding = activeWeddings.get(chatId);
  if (!wedding || wedding.status !== "pending") return false;

  const rawText = (m.text || "").trim().toLowerCase();
  if (!rawText) return false;

  const isAccept = /(^|\s)(aceptar|acepto|sí|si|sii+|acepto!|si quiero|sí quiero|acepto el matrimonio|acepto casarme|aceptar propuesta|claro|claro que si|claro que sí|yes|yep|obvio)(\s|!|\.|$)/i.test(rawText);
  const isReject = /(^|\s)(rechazar|rechazo|no|cancelar|desechar|declinar|rechazar propuesta|no quiero)(\s|!|\.|$)/i.test(rawText);

  if (!isAccept && !isReject) return false;

  // Pre-fetch group metadata for LID/PN matching
  let participants = [];
  if (chatId.endsWith("@g.us")) {
    try {
      const meta = await getGroupMetadata(conn, chatId);
      participants = meta?.participants || [];
    } catch (e) {}
  }

  // Si quien propone intenta responder su propia propuesta, ignorar
  if (wedding.proposerJid && areJidsEqual(sender, wedding.proposerJid, participants)) {
    return false;
  }

  // Verificar validez de la respuesta
  let isValidResponse = false;

  if (wedding.targetJid && areJidsEqual(sender, wedding.targetJid, participants)) {
    isValidResponse = true;
  }

  const quotedText = m.quoted?.text || (
    m.quoted?.message?.conversation ||
    m.quoted?.message?.extendedTextMessage?.text ||
    ""
  );

  if (!isValidResponse && m.quoted) {
    const isQuotedBot = Boolean(conn?.user?.id && areJidsEqual(m.quoted.sender, conn.user.id, participants));
    const isQuotedProposal = /PROPUESTA DE MATRIMONIO|casarías/i.test(quotedText);
    if (isQuotedBot || isQuotedProposal) {
      isValidResponse = true;
    }
  }

  // Si no había targetJid especificado o si sender es un miembro del grupo respondiendo al matrimonio activo
  if (!isValidResponse && !areJidsEqual(sender, wedding.proposerJid, participants)) {
    isValidResponse = true;
  }

  if (!isValidResponse) return false;

  if (isAccept) {
    clearTimeout(wedding.timeout);
    activeWeddings.delete(chatId);

    wedding.targetJid = sender;

    await sendWeddingCertificate(conn, chatId, wedding, m);
    return true;
  } else if (isReject) {
    clearTimeout(wedding.timeout);
    activeWeddings.delete(chatId);

    const targetNum = wedding.targetJid ? wedding.targetJid.split("@")[0].split(":")[0] : "alguien";
    const proposerNum = wedding.proposerJid ? wedding.proposerJid.split("@")[0].split(":")[0] : "alguien";

    const rejectText =
      `💔 ━━━━ *PROPUESTA RECHAZADA* ━━━━ 💔\n\n` +
      `@${targetNum} ha rechazado la propuesta de matrimonio de @${proposerNum}.\n\n` +
      `_"El amor a veces es un camino complicado... ¡Un minuto de silencio por el corazón roto!"_ 💔🌧️`;

    await conn.sendMessage(chatId, {
      text: rejectText,
      mentions: [wedding.targetJid, wedding.proposerJid].filter(Boolean)
    }, { quoted: m });
    return true;
  }

  return false;
};

async function sendWeddingCertificate(conn, chatId, wedding, m) {
  const targetNum = wedding.targetJid ? wedding.targetJid.split("@")[0].split(":")[0] : wedding.targetName;
  const proposerNum = wedding.proposerJid ? wedding.proposerJid.split("@")[0].split(":")[0] : wedding.proposerName;

  let coupleLabel = "";
  if (wedding.proposerJid && wedding.targetJid) {
    coupleLabel = `@${proposerNum} 💍 @${targetNum}`;
  } else if (wedding.proposerJid) {
    coupleLabel = `@${proposerNum} 💍 *${wedding.targetName}*`;
  } else {
    coupleLabel = `*${wedding.proposerName}* 💍 *${wedding.targetName}*`;
  }

  const mentionsList = [wedding.proposerJid, wedding.targetJid].filter(Boolean);

  const certMessage =
    `💒 ━━━━ *CERTIFICADO DE MATRIMONIO* ━━━━ 💒\n\n` +
    `✨ *Se declara oficialmente casados a:*\n` +
    `👩‍❤️‍👨 ${coupleLabel}\n\n` +
    `📍 *Lugar de la Ceremonia:*\n${wedding.location}\n\n` +
    `🎂 *Pastel Matrimonial:*\n${wedding.cake}\n\n` +
    `🏝️ *Luna de Miel:*\n${wedding.honeymoon}\n\n` +
    `💬 *Votos Matrimoniales:*\n_${wedding.vow}_\n\n` +
    `💖 *Felicidad Matrimonial:* *${wedding.happiness}%* (¡Amor Eterno!)\n` +
    `🥂 *¡Felicidades a los recién casados! Que sean muy felices.* ✨🎉`;

  await conn.sendMessage(chatId, {
    text: certMessage,
    mentions: mentionsList
  }, { quoted: m });
}

handler.command = /^(casarse|matrimonio|boda|marry)$/i;
handler.description = "Celebrar un matrimonio simbólico entre dos usuarios";
handler.category = "misc";

export default handler;
