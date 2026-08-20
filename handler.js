// ============================================================
//   Kurumi Tokisaki - Handler de Mensajes v3.0.0
//   Integración: reportes de error automáticos al owner
//   Soporte: Baileys v7 LID/PN addressing mode
//   Hot-Reload: módulos via getModule() (tiempo real)
// ============================================================

import chalk from "chalk";
import { getModule } from "./lib/hotReload.js";
import { getGroupMetadata, resolveGroupParticipantJid } from "./lib/utils.js";

const GROUP_UNMUTE_COMMANDS = new Set(["unban", "desbanear"]);

function isGroupMuted(groupConfig) {
  const value = groupConfig?.mute;
  return value === 1 || value === true || value === "1" || value === "on" || value === "true";
}

// ══════════════════════════════════════════════════════════
// Utilidades para Baileys v7 (LID / PN addressing)
// ══════════════════════════════════════════════════════════

function extractSenderPN(conn, m) {
  const chatId = m.key.remoteJid || "";
  const isGroup = chatId.endsWith("@g.us");

  if (isGroup) {
    const participant = m.key.participant || m.key.participantAlt || chatId;
    const participantAlt = m.key.participantAlt;
    if (participantAlt && participantAlt.includes("@s.whatsapp.net")) return participantAlt;
    if (participant && participant.includes("@s.whatsapp.net")) return participant;
    return participant;
  } else {
    const remoteJidAlt = m.key.remoteJidAlt;
    if (remoteJidAlt && remoteJidAlt.includes("@s.whatsapp.net")) return remoteJidAlt;
    if (chatId.includes("@s.whatsapp.net")) return chatId;
    if (m.key.fromMe) {
      const botId = conn.user?.id || conn.user?.phoneNumber;
      return botId || chatId;
    }
    return chatId;
  }
}

function normalizeJid(jid) {
  if (!jid) return "";
  if (typeof jid === "object" && jid !== null) {
    jid = jid.id || jid.jid || jid.user || "";
  }
  const str = jid.toString();
  const base = str.split(":")[0];
  if (base.includes("@")) return base;
  if (str.includes("@")) return base + "@" + str.split("@")[1];
  return base + "@s.whatsapp.net";
}

function extractNumber(jid) {
  if (!jid) return "";
  return jid.toString().split("@")[0].split(":")[0].replace(/\D/g, "");
}

function isOwner(sender, m = null, conn = null) {
  const { config } = getModule("config");
  if (!config || !config.owner) return false;

  // Si el mensaje viene de la propia cuenta del bot / owner (fromMe = true)
  if (m && m.key && m.key.fromMe) return true;

  const candidates = new Set();

  if (typeof sender === "string" && sender) {
    candidates.add(sender);
    candidates.add(extractNumber(sender));
  }

  if (m) {
    if (m.key) {
      if (m.key.remoteJid && !m.key.remoteJid.endsWith("@g.us")) {
        candidates.add(m.key.remoteJid);
        candidates.add(extractNumber(m.key.remoteJid));
      }
      if (m.key.remoteJidAlt && !m.key.remoteJidAlt.endsWith("@g.us")) {
        candidates.add(m.key.remoteJidAlt);
        candidates.add(extractNumber(m.key.remoteJidAlt));
      }
      if (m.key.participant) { candidates.add(m.key.participant); candidates.add(extractNumber(m.key.participant)); }
      if (m.key.participantAlt) { candidates.add(m.key.participantAlt); candidates.add(extractNumber(m.key.participantAlt)); }
    }
    if (m.participant) { candidates.add(m.participant); candidates.add(extractNumber(m.participant)); }
    if (m.sender) { candidates.add(m.sender); candidates.add(extractNumber(m.sender)); }
  }

  // Normalizar variaciones de números (especialmente formatos mexicanos 52 / 521 / 10 dígitos)
  const getVariants = (val) => {
    const clean = (val || "").toString().replace(/\D/g, "");
    if (!clean) return [];
    const set = new Set([clean]);
    if (clean.length === 10) {
      set.add("52" + clean);
      set.add("521" + clean);
    }
    if (clean.length === 12 && clean.startsWith("52")) {
      const base10 = clean.slice(2);
      set.add(base10);
      set.add("521" + base10);
    }
    if (clean.length === 13 && clean.startsWith("521")) {
      const base10 = clean.slice(3);
      set.add(base10);
      set.add("52" + base10);
    }
    return Array.from(set);
  };

  const ownerNumbers = (Array.isArray(config.owner) ? config.owner : [config.owner])
    .filter(Boolean)
    .map((o) => o.toString());

  const ownerVariants = new Set();
  for (const o of ownerNumbers) {
    for (const v of getVariants(o)) {
      ownerVariants.add(v);
    }
  }

  for (const cand of candidates) {
    if (!cand) continue;
    const candStr = cand.toString();
    if (ownerNumbers.includes(candStr)) return true;
    for (const v of getVariants(candStr)) {
      if (ownerVariants.has(v)) return true;
    }
  }

  return false;
}

function getBotJidSet(conn) {
  const { config } = getModule("config") || {};
  const set = new Set();
  const phoneSet = new Set();

  const addPhone = (raw) => {
    if (!raw) return;
    const clean = raw.toString().split("@")[0].split(":")[0].replace(/\D/g, "");
    if (!clean) return;
    phoneSet.add(clean);
    if (clean.length === 10) {
      phoneSet.add("52" + clean);
      phoneSet.add("521" + clean);
    } else if (clean.length === 12 && clean.startsWith("52")) {
      const base10 = clean.slice(2);
      phoneSet.add(base10);
      phoneSet.add("521" + base10);
    } else if (clean.length === 13 && clean.startsWith("521")) {
      const base10 = clean.slice(3);
      phoneSet.add(base10);
      phoneSet.add("52" + base10);
    }
  };

  if (config?.botNumber) addPhone(config.botNumber);

  const sources = [
    conn?.user,
    conn?.authState?.creds?.me,
    conn?.user?.id ? { id: conn.user.id, lid: conn.user.lid } : null
  ];

  for (const connUser of sources) {
    if (!connUser) continue;
    if (connUser.id) {
      set.add(normalizeJid(connUser.id));
      addPhone(extractNumber(connUser.id));
    }
    if (connUser.jid) {
      set.add(normalizeJid(connUser.jid));
      addPhone(extractNumber(connUser.jid));
    }
    if (connUser.lid) {
      set.add(normalizeJid(connUser.lid));
      const lidNum = extractNumber(connUser.lid);
      if (lidNum) {
        set.add(lidNum);
        set.add(lidNum + "@lid");
      }
    }
    if (connUser.phoneNumber) {
      addPhone(connUser.phoneNumber);
    }
  }

  for (const phone of phoneSet) {
    set.add(phone);
    set.add(phone + "@s.whatsapp.net");
  }

  return set;
}

function getJidMatchSet(jid) {
  const set = new Set();
  if (!jid) return set;
  const norm = normalizeJid(jid);
  set.add(jid);
  set.add(norm);

  const num = extractNumber(jid);
  if (num) {
    set.add(num);
    set.add(num + "@s.whatsapp.net");
    set.add(num + ":0@s.whatsapp.net");
    if (num.length === 10) {
      set.add("52" + num);
      set.add("521" + num);
      set.add("52" + num + "@s.whatsapp.net");
      set.add("521" + num + "@s.whatsapp.net");
    } else if (num.length === 12 && num.startsWith("52")) {
      const base10 = num.slice(2);
      set.add(base10);
      set.add("521" + base10);
      set.add(base10 + "@s.whatsapp.net");
      set.add("521" + base10 + "@s.whatsapp.net");
    } else if (num.length === 13 && num.startsWith("521")) {
      const base10 = num.slice(3);
      set.add(base10);
      set.add("52" + base10);
      set.add(base10 + "@s.whatsapp.net");
      set.add("52" + base10 + "@s.whatsapp.net");
    }
  }
  return set;
}

function areJidsEqual(jid1, jid2) {
  if (!jid1 || !jid2) return false;
  if (jid1 === jid2) return true;
  if (normalizeJid(jid1) === normalizeJid(jid2)) return true;
  const set1 = getJidMatchSet(jid1);
  const set2 = getJidMatchSet(jid2);
  for (const item of set1) {
    if (set2.has(item)) return true;
  }
  return false;
}

/**
 * Comparación estricta para privilegios de grupo. Un LID es un identificador
 * opaco: nunca debe equipararse a un teléfono solo porque su parte numérica
 * coincida. Las equivalencias de prefijo telefónico se mantienen únicamente
 * entre dos Phone JID.
 */
function areGroupPrivilegeJidsEqual(jid1, jid2) {
  const first = normalizeJid(jid1);
  const second = normalizeJid(jid2);
  if (!first || !second) return false;
  if (first === second) return true;
  const firstIsLid = first.endsWith("@lid");
  const secondIsLid = second.endsWith("@lid");
  // Los LID son identificadores opacos: solo deben coincidir con el mismo LID.
  // No se comparan por sus dígitos contra un teléfono, pero sí se permite la
  // coincidencia exacta LID↔LID que Baileys entrega en mensajes de grupo.
  if (firstIsLid || secondIsLid) return firstIsLid && secondIsLid && first === second;
  return areJidsEqual(first, second);
}

function getDirectMessageAuthorJids(m, resolvedSender) {
  const direct = [
    m?.key?.participantAlt,
    m?.key?.participant,
    m?.participant,
  ].filter((jid) => typeof jid === "string" && jid && !jid.endsWith("@g.us"));

  // El remitente resuelto solo se usa cuando Baileys no proporcionó ninguna
  // identidad de autor en el mensaje. Esto evita reutilizar una resolución
  // LID/PN ajena como si fuera el remitente actual.
  const sources = direct.length > 0 ? direct : [resolvedSender];
  return [...new Set(sources.map(normalizeJid).filter(Boolean))];
}

function isGroupAdminFromMetadata(metadata, m, resolvedSender, ownerCheck) {
  if (ownerCheck) return true;
  const authorIds = getDirectMessageAuthorJids(m, resolvedSender);
  if (authorIds.length === 0) return false;

  const adminParticipants = (metadata?.participants || []).filter(
    (participant) => participant?.admin === "admin" || participant?.admin === "superadmin"
  );

  return adminParticipants.some((participant) => {
    const adminIds = [participant.id, participant.lid, participant.pn, participant.phoneNumber, participant.idAlt, participant.jid]
      .filter(Boolean)
      .map(normalizeJid);
    return adminIds.some((adminId) => authorIds.some((authorId) => areGroupPrivilegeJidsEqual(adminId, authorId)));
  });
}

function isBotJid(conn, jid) {
  if (!jid) return false;
  const botJids = getBotJidSet(conn);
  const jidSet = getJidMatchSet(jid);

  for (const item of jidSet) {
    if (botJids.has(item)) return true;
  }
  return false;
}

function isQuotedMessageFromBot(conn, m) {
  const msgContent = m.messageContent || m.message;
  if (!msgContent) return false;

  const contextInfo =
    msgContent?.extendedTextMessage?.contextInfo ||
    msgContent?.imageMessage?.contextInfo ||
    msgContent?.videoMessage?.contextInfo ||
    msgContent?.audioMessage?.contextInfo ||
    msgContent?.stickerMessage?.contextInfo ||
    msgContent?.documentMessage?.contextInfo ||
    msgContent?.buttonsResponseMessage?.contextInfo ||
    msgContent?.templateButtonReplyMessage?.contextInfo ||
    msgContent?.listResponseMessage?.contextInfo ||
    msgContent?.interactiveResponseMessage?.contextInfo ||
    msgContent?.contextInfo ||
    m.message?.extendedTextMessage?.contextInfo ||
    m.message?.contextInfo;

  if (!contextInfo) return false;
  if (!contextInfo.quotedMessage) return false;

  if (contextInfo.fromMe) return true;

  const quotedParticipant = contextInfo.participant || contextInfo.remoteJid;
  if (quotedParticipant && isBotJid(conn, quotedParticipant)) {
    return true;
  }

  return false;
}

// ══════════════════════════════════════════════════════════
// Cache de deduplicación de mensajes (previene envíos dobles)
// ══════════════════════════════════════════════════════════
const processedMsgIds = new Map();

// WhatsApp puede entregar un LID en el mensaje y un Phone JID tras resolver
// participantes. Conservamos la relación por grupo para que las respuestas
// posteriores usen el identificador de mención que WhatsApp espera.
const lidMentionAliases = new Map();
const LID_ALIAS_TTL_MS = 24 * 60 * 60 * 1000;

function rememberLidMentionAlias(chatId, resolvedJid, originalJid) {
  const groupJid = normalizeJid(chatId);
  const resolved = normalizeJid(resolvedJid);
  const original = normalizeJid(originalJid);
  if (!groupJid.endsWith("@g.us") || !resolved.endsWith("@s.whatsapp.net") || !original.endsWith("@lid")) return;

  lidMentionAliases.set(`${groupJid}|${resolved}`, {
    lid: original,
    expiresAt: Date.now() + LID_ALIAS_TTL_MS,
  });

  if (lidMentionAliases.size > 2000) {
    const now = Date.now();
    for (const [key, value] of lidMentionAliases) {
      if (!value || value.expiresAt <= now) lidMentionAliases.delete(key);
    }
  }
}

function getMentionAddress(chatId, jid) {
  const normalized = normalizeJid(jid);
  if (!normalized || normalized.endsWith("@lid")) return normalized;

  const aliasKey = `${normalizeJid(chatId)}|${normalized}`;
  const alias = lidMentionAliases.get(aliasKey);
  if (!alias) return normalized;
  if (alias.expiresAt <= Date.now()) {
    lidMentionAliases.delete(aliasKey);
    return normalized;
  }
  return alias.lid;
}

function isDuplicateMessage(msgId) {
  if (!msgId) return false;
  const now = Date.now();
  if (processedMsgIds.has(msgId)) {
    return true;
  }
  processedMsgIds.set(msgId, now);

  if (processedMsgIds.size > 500) {
    for (const [id, time] of processedMsgIds.entries()) {
      if (now - time > 120000) processedMsgIds.delete(id);
    }
  }
  return false;
}

// ══════════════════════════════════════════════════════════
// Handler principal
// ══════════════════════════════════════════════════════════

export async function handleMessage(conn, m, store) {
  try {
    const msgId = m?.key?.id;
    if (msgId && isDuplicateMessage(msgId)) {
      return;
    }
    // ──── Obtener módulos del registry (hot-reloadable) ────
    // Cada vez que se procesa un mensaje, se obtiene la versión
    // más reciente de cada módulo. Si un archivo fue editado,
    // getModule() devuelve la versión actualizada.
    const { config } = getModule("config");
    const db = getModule("db");
    const { getUser, updateUser, getCooldown, setCooldown, getGroup } = db;
    const { plugins } = getModule("pluginLoader");
    const { reportError } = getModule("error");
    const msg = getModule("msg");

    const chatIdRaw = m.key.remoteJid || "";
    const chatId = normalizeJid(chatIdRaw);
    const isGroup = chatId.endsWith("@g.us");
    const isPrivate = !isGroup;

    let senderRaw = extractSenderPN(conn, m);
    let sender = normalizeJid(senderRaw);

    if (isGroup && chatId) {
      try {
        const resolvedSender = await resolveGroupParticipantJid(conn, chatId, sender);
        if (resolvedSender) sender = resolvedSender;
      } catch (e) {}
    }

    if (m.key.fromMe && isPrivate) {
      const botPhone = conn.user?.phoneNumber;
      const remoteJidAlt = m.key.remoteJidAlt;
      if (botPhone) {
        sender = normalizeJid(botPhone) + "@s.whatsapp.net";
      } else if (remoteJidAlt) {
        sender = normalizeJid(remoteJidAlt);
      }
    }

    const messageContent =
      m.message?.ephemeralMessage?.message ||
      m.message?.viewOnceMessage?.message ||
      m.message?.viewOnceMessageV2?.message ||
      m.message?.viewOnceMessageV2Extension?.message ||
      m.message?.documentWithCaptionMessage?.message ||
      m.message?.editedMessage?.message?.protocolMessage?.editedMessage ||
      m.message?.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson ||
      m.message;

    const text =
      messageContent?.conversation ||
      messageContent?.extendedTextMessage?.text ||
      messageContent?.imageMessage?.caption ||
      messageContent?.videoMessage?.caption ||
      messageContent?.documentMessage?.caption ||
      messageContent?.buttonsResponseMessage?.selectedButtonId ||
      messageContent?.listResponseMessage?.singleSelectReply?.selectedRowId ||
      messageContent?.templateButtonReplyMessage?.selectedId ||
      "";

    m.isGroup = isGroup;
    m.isPrivate = isPrivate;
    m.sender = sender;
    m.chatId = chatId;
    m.text = text;
    m.messageContent = messageContent;
    m.statusMsg = null;
    m.lastStatusTime = 0;

    const contextInfo =
      messageContent?.extendedTextMessage?.contextInfo ||
      messageContent?.imageMessage?.contextInfo ||
      messageContent?.videoMessage?.contextInfo ||
      messageContent?.audioMessage?.contextInfo ||
      messageContent?.stickerMessage?.contextInfo ||
      messageContent?.documentMessage?.contextInfo ||
      messageContent?.buttonsResponseMessage?.contextInfo ||
      messageContent?.templateButtonReplyMessage?.contextInfo ||
      messageContent?.listResponseMessage?.contextInfo ||
      messageContent?.interactiveResponseMessage?.contextInfo ||
      messageContent?.contextInfo ||
      m.message?.extendedTextMessage?.contextInfo ||
      m.message?.contextInfo;

    const mentionedJidList = contextInfo?.mentionedJid || [];
    const originalMentionJids = mentionedJidList.map((j) => normalizeJid(j)).filter(Boolean);
    const originalSenderJid = normalizeJid(m.key?.participant || m.key?.participantAlt || senderRaw);
    const originalQuotedJid = contextInfo?.quotedMessage
      ? normalizeJid(contextInfo.participant || contextInfo.remoteJid)
      : "";
    m.rawSenderJid = originalSenderJid;
    m.mentionedJid = [...originalMentionJids];

    if (isGroup && chatId) {
      rememberLidMentionAlias(chatId, sender, originalSenderJid);
    }

    if (contextInfo?.quotedMessage) {
      const qMsg = contextInfo.quotedMessage;
      const qText =
        qMsg?.conversation ||
        qMsg?.extendedTextMessage?.text ||
        qMsg?.imageMessage?.caption ||
        qMsg?.videoMessage?.caption ||
        "";

      m.quoted = {
        message: qMsg,
        sender: normalizeJid(contextInfo.participant || contextInfo.remoteJid),
        id: contextInfo.stanzaId,
        text: qText,
      };
    } else {
      m.quoted = null;
    }

    // Resolución automática de LIDs en m.mentionedJid y m.quoted.sender si es grupo
    if (isGroup && chatId) {
      try {
        if (m.mentionedJid && m.mentionedJid.length > 0) {
          m.mentionedJid = await Promise.all(m.mentionedJid.map(async (j) => {
            return await resolveGroupParticipantJid(conn, chatId, j);
          }));
          for (let index = 0; index < m.mentionedJid.length; index += 1) {
            rememberLidMentionAlias(chatId, m.mentionedJid[index], originalMentionJids[index]);
          }
        }
        if (m.quoted?.sender) {
          m.quoted.sender = await resolveGroupParticipantJid(conn, chatId, m.quoted.sender);
          rememberLidMentionAlias(chatId, m.quoted.sender, originalQuotedJid);
        }
      } catch (e) {}
    }

    // Si el mensaje viene de la IA (inyectado), ya trae el prefijo !
    // Si es un mensaje normal del usuario, buscamos el prefijo configurado.
    const isAiInjection = Boolean(m.key?.id?.startsWith("IA_TOOL_") || m.isAi || m.fromAi);

    if (text && text.trim()) {
      const msgLog = `[MSG IN] ${extractNumber(sender)} (${isPrivate ? 'PV' : 'GRP'}): ${text.slice(0, 70)}`;
      console.log(chalk.gray(msgLog));
      if (globalThis.addLog) globalThis.addLog(msgLog);

      // Guardar nombre y LID del usuario si están disponibles
      if (sender) {
        try {
          const participantLid = m.key?.participant?.endsWith("@lid") ? normalizeJid(m.key.participant) : null;
          const existingUser = getUser(sender);
          const updates = {};
          if (m.pushName && m.pushName.trim() && m.pushName.trim() !== "Usuario") {
            if (!existingUser?.name || existingUser.name === "Usuario" || /^\d+$/.test(existingUser.name)) {
              updates.name = m.pushName.trim();
            }
          }
          if (participantLid && existingUser?.lid !== participantLid) {
            updates.lid = participantLid;
          }
          if (Object.keys(updates).length > 0) {
            updateUser(sender, updates);
          }
        } catch (e) {}
      }
    }

    // Garantiza que los @números escritos por el bot estén acompañados de un JID.
    // No se añaden las menciones del mensaje entrante: una respuesta puede
    // mencionar a otro usuario y heredar esos JID mezclaría ambos contextos.
    const enrichMentions = (textVal, existingMentions = []) => {
      const sourceMentions = (existingMentions || []).map(normalizeJid).filter(Boolean);
      const mentionsSet = new Set(sourceMentions.map((jid) => getMentionAddress(chatId, jid)).filter(Boolean));
      if (textVal) {
        const matches = String(textVal).match(/@\+?[\d\s-]{5,20}/g);
        if (matches) {
          for (const mStr of matches) {
            const num = mStr.replace(/[^0-9]/g, "");
            if (num.length >= 5) {
              // Si el comando ya proporcionó un LID/JID cuyo identificador
              // coincide con esta etiqueta, se conserva exactamente ese valor.
              // Añadir un JID telefónico adicional alteraría la asociación.
              const isAlreadyAddressed = sourceMentions.some((jid) => {
                return extractNumber(jid) === num;
              }) || Array.from(mentionsSet).some((jid) => extractNumber(jid) === num);
              if (isAlreadyAddressed) continue;

              mentionsSet.add(getMentionAddress(chatId, num + "@s.whatsapp.net"));
              if (num.startsWith("521") && num.length === 13) {
                mentionsSet.add(getMentionAddress(chatId, num.replace(/^521/, "52") + "@s.whatsapp.net"));
              } else if (num.startsWith("52") && num.length === 12) {
                mentionsSet.add(getMentionAddress(chatId, num.replace(/^52/, "521") + "@s.whatsapp.net"));
              }
            }
          }
        }
      }
      return Array.from(mentionsSet);
    };

    // El texto `@número` debe referirse al mismo JID que el arreglo `mentions`.
    // Si hay un LID conocido para ese teléfono dentro del grupo, se sustituye la
    // etiqueta técnica antes de enviar el mensaje.
    const alignMentionLabels = (textVal) => {
      if (!textVal) return textVal;
      return String(textVal).replace(/@\+?[\d\s-]{5,20}/g, (label) => {
        const phoneNum = label.replace(/[^0-9]/g, "");
        const mentionJid = getMentionAddress(chatId, phoneNum + "@s.whatsapp.net");
        const mentionNum = extractNumber(mentionJid);
        return mentionNum && mentionNum !== phoneNum ? `@${mentionNum}` : label;
      });
    };

    // Proxy de conn para capturar/actualizar mensajes de estado sin duplicar
    const connProxy = Object.create(conn);

    connProxy.sendMessage = async (jid, content, options = {}) => {
      let finalContent = content;
      if (typeof content === "string") {
        const alignedText = alignMentionLabels(content);
        finalContent = { text: alignedText, mentions: enrichMentions(alignedText) };
      } else if (typeof content === "object" && content !== null) {
        const textVal = content.text || content.caption || "";
        const alignedText = alignMentionLabels(textVal);
        finalContent = {
          ...content,
          ...(typeof content.text === "string" ? { text: alignedText } : {}),
          ...(typeof content.caption === "string" ? { caption: alignedText } : {}),
          mentions: enrichMentions(alignedText, content.mentions)
        };
      }

      return conn.sendMessage(jid, finalContent, options);
    };

    m.reply = async (content, opt1 = {}, opt2 = {}) => {
      let targetChatId = chatId;
      let options = {};

      if (typeof opt1 === "string" && opt1.includes("@")) {
        targetChatId = opt1;
        if (opt2 && typeof opt2 === "object" && opt2 !== null) options = opt2;
      } else if (opt1 === null || opt1 === undefined || typeof opt1 !== "object" || Array.isArray(opt1)) {
        if (opt2 && typeof opt2 === "object" && opt2 !== null) options = opt2;
      } else if (typeof opt1 === "object" && opt1 !== null) {
        options = opt1;
        if (opt2 && typeof opt2 === "object" && opt2 !== null) options = { ...options, ...opt2 };
      }

      const outText = typeof content === "string" ? content : (content?.text || content?.caption || "[Media/Attachment]");

      const botLog = `[BOT OUT] -> ${extractNumber(sender)}: ${String(outText).replace(/\n+/g, " ").slice(0, 80)}`;
      console.log(chalk.hex("#06ffa5")(botLog));
      if (globalThis.addLog) globalThis.addLog(botLog);


      if (typeof content === "string") {
        return connProxy.sendMessage(targetChatId, { text: content, ...options }, { quoted: m });
      }
      return connProxy.sendMessage(targetChatId, { ...content, ...options }, { quoted: m });
    };

    m.react = async (emoji) => {};

    let groupConfig = isGroup ? getGroup(chatId) : null;
    const ownerCheck = isOwner(sender, m, conn);
    const usedPrefix = isAiInjection ? "!" : config.prefix.find((p) => text.startsWith(p));

    // Un grupo silenciado no procesa mensajes ni comandos normales. Se deja pasar
    // únicamente /unban para que cualquier participante pueda reactivar al bot.
    if (isGroup && isGroupMuted(groupConfig)) {
      const mutedCommand = usedPrefix
        ? (text.slice(usedPrefix.length).trim().split(/\s+/)[0] || "").toLowerCase()
        : "";
      if (!GROUP_UNMUTE_COMMANDS.has(mutedCommand)) return;
    }

    // ──── Antilink Check Early (para todos los mensajes en grupos) ────
    if (isGroup && groupConfig && (groupConfig.antilink === 1 || groupConfig.antilink === true)) {
      let isAdmin = ownerCheck;
      try {
        const metadata = await getGroupMetadata(conn, chatId);
        isAdmin = isGroupAdminFromMetadata(metadata, m, sender, ownerCheck);
        m.isAdmin = isAdmin;
      } catch (e) {}

      const { checkAntilink } = getModule("groupHandler");
      if (await checkAntilink(conn, m, groupConfig, isAdmin, ownerCheck)) return;
    }

    // ──── 1. Ejecutar hooks 'before' de plugins (juegos interactivos, capturadores de respuestas) ────
    for (const plugin of plugins) {
      if (typeof plugin.before === "function") {
        try {
          const handled = await plugin.before(m, {
            conn: connProxy,
            chatId,
            sender,
            text,
            isGroup,
            isPrivate,
            isOwner: ownerCheck,
            store,
            usedPrefix,
          });
          if (handled) return;
        } catch (e) {
          console.error("Error en plugin.before:", e);
        }
      }
    }

    if (!usedPrefix) {
      await handleNonCommand(connProxy, m, sender, text, chatId, isGroup, groupConfig, store, ownerCheck);
      return;
    }

    const withoutPrefix = isAiInjection ? text.slice(1).trim() : text.slice(usedPrefix.length).trim();
    const [commandName, ...argsArr] = withoutPrefix.split(/\s+/);
    const command = (commandName || "").toLowerCase();
    const args = argsArr;
    const body = argsArr.join(" ");

    if (!command) return;

    const logText = `[CMD] ${extractNumber(sender)} → ${usedPrefix}${command} (${isPrivate ? 'PV' : 'GRP'})`;
    console.log(chalk.hex("#3a86ff")(logText));
    if (globalThis.addLog) globalThis.addLog(logText);

    for (const handler of plugins) {
      let match = false;
      if (handler.command instanceof RegExp) match = handler.command.test(command);
      else if (typeof handler.command === "string") match = handler.command.toLowerCase() === command;
      else if (Array.isArray(handler.command)) match = handler.command.map((c) => c.toLowerCase()).includes(command);

      if (!match) continue;

      const user = getUser(sender);
      if (user.name === "Usuario" || !user.name) {
        try {
          let realName = "";
          if (m.pushName && m.pushName.trim()) {
            realName = m.pushName.trim();
          } else if (isGroup) {
            const metadata = await getGroupMetadata(conn, chatId);
            const participant = metadata?.participants?.find(p => normalizeJid(p.id) === sender);
            realName = participant?.notify || participant?.name || "";
          }
          if (realName && realName !== "Usuario") {
            updateUser(sender, { name: realName });
          }
        } catch (e) {}
      }
      if (user.banned && !isOwner(sender, m, conn)) return m.reply(msg.error("Has sido baneado del bot."));

      const ownerCheck = isOwner(sender, m, conn);
      let isAdmin = false;
      let isBotAdmin = false;

      if (isGroup) {
        try {
          const metadata = await getGroupMetadata(conn, chatId);
          const adminParticipants = (metadata?.participants || []).filter(
            (participant) => participant?.admin === "admin" || participant?.admin === "superadmin"
          );

          isAdmin = isGroupAdminFromMetadata(metadata, m, sender, ownerCheck);
          isBotAdmin = adminParticipants.some((participant) =>
            [participant.id, participant.lid, participant.pn, participant.phoneNumber, participant.idAlt, participant.jid]
              .filter(Boolean)
              .some((jid) => isBotJid(conn, jid))
          );
          m.isAdmin = isAdmin;
          m.isBotAdmin = isBotAdmin;
        } catch (e) {
          console.error("Admin check error:", e.message);
          isAdmin = ownerCheck;
        }
      }

      if (handler.owner && !ownerCheck) return m.reply(msg.error("Solo el owner puede usar este comando."));
      if (handler.group && !isGroup) return m.reply(msg.error("Este comando solo funciona en grupos."));
      if (handler.private && isGroup) return m.reply(msg.error("Este comando solo funciona en privado."));
      if (handler.admin && !isAdmin && !ownerCheck) {
        return m.reply(msg.error(`El comando \`${usedPrefix}${command}\` requiere permisos de administrador del grupo.`));
      }
      if (handler.botAdmin && !isBotAdmin) {
        return m.reply(msg.error(`Para usar \`${usedPrefix}${command}\`, necesito ser administrador del grupo.`));
      }

      if (handler.register && !user.registered) {
        return m.reply(msg.warning(`⚠️ *¡REGISTRO REQUERIDO!* ⚠️\n\nDebes registrarte para usar este comando.\nUsa: *!registro*`));
      }

      // Los comandos de contenido NSFW deben respetar la configuración del
      // grupo incluso si un plugin olvida declarar la marca `handler.nsfw`.
      // El propio comando `nsfw` se excluye para que un administrador pueda
      // activarlo o desactivarlo cuando corresponda.
      const isNsfwContentCommand = handler.nsfw === true || (
        String(handler.category || "").toLowerCase() === "nsfw" &&
        String(command || "").toLowerCase() !== "nsfw"
      );
      if (isNsfwContentCommand) {
        if (config.nsfwEnabled === false) {
          return m.reply(msg.warning("Los comandos NSFW están deshabilitados globalmente en este bot."));
        }
        if (isGroup) {
          const freshGroup = getGroup(chatId);
          const isNsfwOn = Boolean(freshGroup?.nsfw === 1 || freshGroup?.nsfw === true);
          if (!isNsfwOn) {
            return m.reply(msg.warning(`Los comandos NSFW están deshabilitados en este grupo.\n\nUn administrador debe activarlos con \`${usedPrefix}nsfw on\`.`));
          }
        } else {
          const freshUser = getUser(sender);
          const isPrivateNsfwOn = freshUser?.nsfw === true && config.nsfwPrivateEnabled !== false;
          if (!isPrivateNsfwOn) {
            return m.reply(msg.warning(`Los comandos NSFW están deshabilitados en tu chat privado.\n\nPuedes activarlos tú mismo con \`${usedPrefix}nsfw on\`.`));
          }
        }
      }

      // Cooldown desactivado a petición del usuario para evitar tiempos de espera
      // if (handler.cooldown && !ownerCheck) { ... }

      updateUser(sender, { total_commands: (user.total_commands || 0) + 1 });

      const isInternalAiCommand = Boolean(isAiInjection || m.isAi || m.fromAi);

      try {
        // La presencia mejora la experiencia visual, pero no debe retrasar el comando.
        void conn.sendPresenceUpdate('composing', chatId).catch(() => {});
        const ctx = {
          conn: connProxy, args, body, text: body, usedPrefix, command, isGroup, isPrivate,
          isAdmin, isBotAdmin, isOwner: ownerCheck, sender, chatId, store, groupConfig,
          silentStatus: isInternalAiCommand,
        };
        const fn = typeof handler === "function" ? handler : (handler.run || handler.exec || handler.handler);
        if (typeof fn === "function") {
          const commandStartedAt = performance.now();
          await fn(m, ctx);
          const elapsedMs = Math.round(performance.now() - commandStartedAt);
          const perfLog = `⏱️ [PERF] ${usedPrefix}${command}: ${elapsedMs} ms`;
          console.log(chalk.gray(perfLog));
          if (globalThis.addLog) globalThis.addLog(perfLog);
        } else {
          throw new Error(`El comando "${command}" no tiene una función ejecutable válida.`);
        }
      } catch (err) {
        const errMessage = String(err?.message || err || "");
        const isConnClosed = /connection closed|connection unavailable|websocket|socket closed/i.test(errMessage);
        const errLog = `❌ [ERROR CMD] ${extractNumber(sender)} @ ${usedPrefix}${command}: ${errMessage}`;
        console.error(chalk.red(errLog), err);
        if (globalThis.addLog) globalThis.addLog(errLog);

        // La conexión principal gestiona su propio ciclo de reconexión mediante
        // connection.update. Reprogramarla aquí duplica temporizadores y usar
        // m.reply sobre un socket cerrado prolonga la recuperación.
        if (isConnClosed) {
          const socketLog = `ℹ️ [CMD] ${usedPrefix}${command} finalizó mientras WhatsApp reconectaba; se omite el reintento de envío.`;
          console.warn(chalk.yellow(socketLog));
          if (globalThis.addLog) globalThis.addLog(socketLog);
          return;
        }

        // Enviar mensaje corto al usuario para errores ajenos a la conexión.
        try {
          await m.reply(
            `✦━━【 ❌ *ERROR* 】━━✦\n\n` +
            `Ocurrió un error al ejecutar \`${usedPrefix}${command}\`.\n` +
            `El reporte fue enviado automáticamente al creador. 📨\n\n` +
            `💬 ${errMessage || "Error desconocido"}`
          );
        } catch (e) {}

        // Enviar reporte completo al owner para errores ajenos a la conexión.
        if (!isConnClosed) {
          try {
            await reportError(err, m, {
              conn, args, body, usedPrefix, command, isGroup, isPrivate,
              isAdmin, isBotAdmin, isOwner: ownerCheck, sender, chatId,
            });
          } catch (e) {}
        }
      }
      return;
    }
  } catch (err) {
    console.error(err);
  }
}

// ══════════════════════════════════════════════════════════
// Handler para mensajes sin comando (IA)
// ══════════════════════════════════════════════════════════

async function handleNonCommand(conn, m, sender, text, chatId, isGroup, groupConfig, store, ownerCheck) {
  if (!text || text.length < 2) return;

  const isOwnerUser = ownerCheck !== undefined ? ownerCheck : isOwner(sender, m, conn);
  const { getUser, getGroup } = getModule("db");
  const { reportError } = getModule("error");

  const currentGroupConfig = isGroup ? (getGroup(chatId) || groupConfig) : null;

  let isAdmin = false;
  if (isGroup) {
    try {
      const metadata = await getGroupMetadata(conn, chatId);
      isAdmin = isGroupAdminFromMetadata(metadata, m, sender, isOwnerUser);
    } catch (e) {
      isAdmin = isOwnerUser;
    }
  }

  // Modo temporal: en grupos la IA solo responde mediante /ia, /bot o aliases.
  // Las menciones, replies y mensajes normales no activan la conversación automática.
  if (isGroup) return;

  if (!isGroup) {
    const user = getUser(sender);
    const aiVal = user?.ai_command_enabled;
    const isAiEnabled = aiVal === 1 || aiVal === true || aiVal === "1" || aiVal === "on" || aiVal === "true";
    if (!isAiEnabled) return;
  }

  try {
    // IA: obtener handleAI del registry (hot-reloadable)
    const iaModule = getModule("ia");
    await iaModule.handleAI(conn, m, sender, text, chatId, isOwnerUser, isAdmin);
  } catch (e) {
    console.error(chalk.red("❌ Error IA:"), e?.message || e);
    await reportError(e, m, { sender, chatId, isGroup, command: "IA" });
  }
}
