// ============================================================
//   Kurumi Tokisaki - Utilidades Generales v3.0
//   ──────────────────────────────────
//   Funciones compartidas reutilizadas por el motor central
//   y los comandos. Sin lógica de descarga.
// ============================================================

import axios from "axios";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createWriteStream } from "fs";
import { pipeline } from "stream/promises";
import crypto from "crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const tempDir = path.join(__dirname, "../temp");

// Asegurar que el directorio temporal existe
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

// ============================================================
// Funciones de descarga — OPTIMIZADAS para velocidad
// ============================================================

/**
 * Descargar archivo a disco (streaming directo).
 */
export async function downloadFile(url, filename = null) {
  const ext = url.split(".").pop()?.split("?")[0] || "tmp";
  const name = filename || `${crypto.randomUUID()}.${ext}`;
  const filePath = path.join(tempDir, name);

  const response = await axios({
    method: "GET",
    url,
    responseType: "stream",
    timeout: 30000,
    maxRedirects: 5,
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "Accept": "*/*",
      "Accept-Encoding": "gzip, deflate",
    },
  });

  await pipeline(response.data, createWriteStream(filePath));
  return filePath;
}

/**
 * Descargar URL como Buffer — OPTIMIZADO.
 * Método principal: axios arraybuffer → Buffer directo (1 sola operación en memoria).
 * Fallback con streaming solo si arraybuffer falla.
 */
export async function downloadBuffer(url) {
  try {
    const response = await axios({
      method: "GET",
      url,
      responseType: "arraybuffer",
      timeout: 30000,
      maxRedirects: 5,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "*/*",
        "Accept-Encoding": "gzip, deflate",
      },
    });
    return Buffer.from(response.data);
  } catch (primaryError) {
    try {
      const ext = url.split(".").pop()?.split("?")[0]?.split("/").pop() || "tmp";
      const filePath = getTempPath(ext.replace(/[^a-z0-9]/gi, "").slice(0, 5) || "tmp");

      const response = await axios({
        method: "GET",
        url,
        responseType: "stream",
        timeout: 45000,
        maxRedirects: 5,
        headers: {
          "User-Agent": "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36",
          "Accept": "*/*",
        },
      });

      await pipeline(response.data, createWriteStream(filePath));
      const buffer = fs.readFileSync(filePath);
      try { fs.unlinkSync(filePath); } catch (e) {}
      return buffer;
    } catch (fallbackError) {
      throw primaryError;
    }
  }
}

// ============================================================
// Funciones de formato
// ============================================================
export function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}

export function formatDuration(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function formatNumber(num) {
  return new Intl.NumberFormat("es-MX").format(num);
}

export function truncate(str, maxLength = 100) {
  if (!str) return "";
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + "...";
}

// ============================================================
// Funciones de limpieza
// ============================================================
export function cleanTemp(maxAgeMs = 3600000) {
  const files = fs.readdirSync(tempDir);
  const now = Date.now();
  let cleaned = 0;

  for (const file of files) {
    const filePath = path.join(tempDir, file);
    const stat = fs.statSync(filePath);
    if (now - stat.mtimeMs > maxAgeMs) {
      fs.unlinkSync(filePath);
      cleaned++;
    }
  }

  return cleaned;
}

import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

/**
 * Obtener resolución de video con ffprobe y verificar que sea un video válido.
 * Retorna { width, height } o null si no es un video válido.
 */
export async function getVideoResolution(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return null;
  try {
    const stat = fs.statSync(filePath);
    if (stat.size < 10000) return null;

    const { stdout } = await execFileAsync("ffprobe", [
      "-v", "error",
      "-select_streams", "v:0",
      "-show_entries", "stream=width,height",
      "-of", "csv=p=0",
      filePath,
    ], { timeout: 10000 });

    const firstLine = (stdout || "").trim().split("\n")[0] || "";
    const parts = firstLine.split(",");
    if (parts.length >= 2) {
      const width = parseInt(parts[0], 10);
      const height = parseInt(parts[1], 10);
      if (!isNaN(width) && !isNaN(height) && width > 0 && height > 0) {
        return { width, height };
      }
    }
  } catch (e) {}
  return null;
}

export function getTempPath(ext = "tmp") {
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
  return path.join(tempDir, `${crypto.randomUUID()}.${ext}`);
}

// ============================================================
// Funciones de validación de URLs
// ============================================================
export function isValidUrl(url) {
  try { new URL(url); return true; } catch { return false; }
}

export function isYouTubeUrl(url) {
  return /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/.test(url);
}

export function isTikTokUrl(url) {
  return /^(https?:\/\/)?(www\.|vm\.|vt\.)?tiktok\.com\/.+/.test(url);
}

export function isTwitterUrl(url) {
  return /^(https?:\/\/)?(www\.)?(twitter\.com|x\.com)\/.+/.test(url);
}

export function isFacebookUrl(url) {
  return /^(https?:\/\/)?(www\.)?(facebook\.com|fb\.watch|fb\.com)\/.+/.test(url);
}

export function isInstagramUrl(url) {
  return /^(https?:\/\/)?(www\.)?instagram\.com\/.+/.test(url);
}

export function isMediaFireUrl(url) {
  return /^(https?:\/\/)?(www\.)?mediafire\.com\/.+/.test(url);
}

// ============================================================
// Funciones de WhatsApp
// ============================================================

// Cache de metadata de grupos para eliminar la latencia de red en cada comando
export const groupMetadataCache = new Map();
const GROUP_METADATA_TTL_MS = 120000; // 2 minutos

export async function getGroupMetadata(conn, chatId) {
  if (!chatId || !conn || !chatId.endsWith("@g.us")) return null;
  const now = Date.now();
  const cached = groupMetadataCache.get(chatId);
  if (cached && (now - cached.timestamp < GROUP_METADATA_TTL_MS)) {
    return cached.metadata;
  }
  try {
    const metadata = await conn.groupMetadata(chatId);
    if (metadata) {
      groupMetadataCache.set(chatId, { metadata, timestamp: now });
    }
    return metadata;
  } catch (err) {
    if (cached?.metadata) return cached.metadata;
    return null;
  }
}

export function invalidateGroupMetadata(chatId) {
  if (chatId) groupMetadataCache.delete(chatId);
}

export function normalizeJid(jid = "") {
  if (!jid) return "";
  if (typeof jid === "object" && jid !== null) {
    jid = jid.id || jid.jid || jid.user || "";
  }
  if (typeof jid !== "string") return "";
  let clean = jid.split(":")[0];
  if (clean.includes("@")) {
    const [user, domain] = clean.split("@");
    return `${user}@${domain}`;
  }
  return clean;
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

export function areJidsEqual(jid1, jid2, participants = null) {
  if (!jid1 || !jid2) return false;
  if (jid1 === jid2) return true;
  const n1 = normalizeJid(jid1);
  const n2 = normalizeJid(jid2);
  if (n1 === n2) return true;

  const set1 = getJidMatchSet(jid1);
  const set2 = getJidMatchSet(jid2);
  for (const item of set1) {
    if (set2.has(item)) return true;
  }

  const checkList = (parts) => {
    if (!Array.isArray(parts)) return false;
    for (const p of parts) {
      if (!p) continue;
      const pId = p.id ? normalizeJid(p.id) : "";
      const pLid = p.lid ? normalizeJid(p.lid) : "";
      const pPn = p.pn ? normalizeJid(p.pn) : (p.idAlt ? normalizeJid(p.idAlt) : "");
      const pPhone = p.phoneNumber ? normalizeJid(p.phoneNumber) : "";
      const matches1 = (pId && (pId === n1 || set1.has(pId))) || (pLid && (pLid === n1 || set1.has(pLid))) || (pPn && (pPn === n1 || set1.has(pPn))) || (pPhone && (pPhone === n1 || set1.has(pPhone)));
      const matches2 = (pId && (pId === n2 || set2.has(pId))) || (pLid && (pLid === n2 || set2.has(pLid))) || (pPn && (pPn === n2 || set2.has(pPn))) || (pPhone && (pPhone === n2 || set2.has(pPhone)));
      if (matches1 && matches2) return true;
    }
    return false;
  };

  if (participants && checkList(participants)) return true;

  if (typeof groupMetadataCache !== "undefined" && groupMetadataCache.size > 0) {
    for (const entry of groupMetadataCache.values()) {
      if (checkList(entry?.metadata?.participants)) return true;
    }
  }

  return false;
}

export function getJid(number) {
  const clean = number.replace(/[^0-9]/g, "");
  return clean + "@s.whatsapp.net";
}

/**
 * Resuelve el JID exacto de un participante dentro de un grupo,
 * solucionando desajustes de prefijos de país (ej. México 521 vs 52).
 */
export async function resolveGroupParticipantJid(conn, chatId, inputJid) {
  if (!inputJid) return inputJid;
  const cleanJid = normalizeJid(inputJid);
  const inputNum = cleanJid.split("@")[0].replace(/[^0-9]/g, "");

  let participants = [];
  if (conn && chatId && chatId.endsWith("@g.us")) {
    try {
      const metadata = await getGroupMetadata(conn, chatId);
      participants = metadata?.participants || [];
    } catch (e) {}
  }

  // Extrae el JID de teléfono real (Phone JID) de un objeto de participante.
  // Baileys v7 expone el teléfono como `phoneNumber`; `id` puede ser únicamente un LID.
  const extractPhoneJid = (p) => {
    if (!p) return null;
    const candidates = [
      { value: p.phoneNumber, allowBareNumber: true },
      { value: p.pn, allowBareNumber: true },
      { value: p.idAlt, allowBareNumber: false },
      { value: p.id, allowBareNumber: false },
      { value: p.jid, allowBareNumber: false },
    ].filter((entry) => entry.value);
    const lidNum = p.lid ? normalizeJid(p.lid).split("@")[0].replace(/[^0-9]/g, "") : null;

    for (const { value, allowBareNumber } of candidates) {
      const norm = normalizeJid(value);
      let phoneJid = norm;
      if (allowBareNumber && !norm.includes("@")) {
        const bareNumber = norm.replace(/[^0-9]/g, "");
        phoneJid = bareNumber ? `${bareNumber}@s.whatsapp.net` : "";
      }
      if (!phoneJid.endsWith("@lid") && phoneJid.endsWith("@s.whatsapp.net")) {
        const candNum = phoneJid.split("@")[0].replace(/[^0-9]/g, "");
        if (lidNum && candNum === lidNum) continue; // Si es el número del LID, no es el número de teléfono
        return phoneJid;
      }
    }
    return null;
  };

  // Verifica si un participante coincide por LID, ID o PN con el input
  const matchesParticipantLidOrId = (p) => {
    if (!p) return false;
    const pLid = p.lid ? normalizeJid(p.lid) : "";
    const pLidNum = pLid.split("@")[0].replace(/[^0-9]/g, "");
    const pId = p.id ? normalizeJid(p.id) : "";
    const pIdNum = pId.split("@")[0].replace(/[^0-9]/g, "");
    const pPn = p.pn ? normalizeJid(p.pn) : "";
    const pPnNum = pPn.split("@")[0].replace(/[^0-9]/g, "");
    const pPhone = p.phoneNumber ? normalizeJid(p.phoneNumber) : "";
    const pPhoneNum = pPhone.split("@")[0].replace(/[^0-9]/g, "");

    return (pLid && (pLid === cleanJid || pLidNum === inputNum)) ||
           (pId && (pId === cleanJid || pIdNum === inputNum)) ||
           (pPn && (pPn === cleanJid || pPnNum === inputNum)) ||
           (pPhone && (pPhone === cleanJid || pPhoneNum === inputNum));
  };

  // 1. Coincidencia por LID o ID en los participantes del grupo -> devolver su teléfono real
  if (participants.length > 0) {
    for (const p of participants) {
      if (matchesParticipantLidOrId(p)) {
        const phoneJid = extractPhoneJid(p);
        if (phoneJid) return phoneJid;
      }
    }
  }

  // 2. Normalización de país para México (521 vs 52)
  if (participants.length > 0) {
    const normInputNum = inputNum.replace(/^521/, "52");
    for (const p of participants) {
      const phoneJid = extractPhoneJid(p);
      if (!phoneJid) continue;
      const pNum = phoneJid.split("@")[0].replace(/[^0-9]/g, "");
      const normPNum = pNum.replace(/^521/, "52");
      if (normPNum === normInputNum) return phoneJid;
    }
  }

  // 3. Coincidencia por últimos 10 dígitos
  if (participants.length > 0 && inputNum.length >= 10) {
    const last10 = inputNum.slice(-10);
    for (const p of participants) {
      const phoneJid = extractPhoneJid(p);
      if (!phoneJid) continue;
      const pNum = phoneJid.split("@")[0].replace(/[^0-9]/g, "");
      if (pNum.length >= 10 && pNum.endsWith(last10)) return phoneJid;
    }
  }

  // 4. Buscar en caché de metadata de otros grupos
  if (typeof groupMetadataCache !== "undefined" && groupMetadataCache.size > 0) {
    for (const entry of groupMetadataCache.values()) {
      const parts = entry?.metadata?.participants || [];
      for (const p of parts) {
        if (matchesParticipantLidOrId(p)) {
          const phoneJid = extractPhoneJid(p);
          if (phoneJid) return phoneJid;
        }
      }
    }
  }

  // 5. Buscar en contacts si conn los mantiene
  if (conn?.contacts) {
    const c = conn.contacts[cleanJid] || conn.contacts[inputJid] || conn.contacts[inputNum + "@s.whatsapp.net"] || conn.contacts[inputNum + "@lid"];
    if (c) {
      const phoneJid = extractPhoneJid(c);
      if (phoneJid) return phoneJid;
    }
  }

  // 6. Buscar en db.users por coincidencia
  try {
    const dbModule = await import("./database.js");
    if (dbModule?.db?.users) {
      for (const [k, u] of Object.entries(dbModule.db.users)) {
        const normK = normalizeJid(k);
        if (normK.endsWith("@s.whatsapp.net")) {
          const kNum = normK.split("@")[0].replace(/[^0-9]/g, "");
          if (kNum === inputNum || (kNum.length >= 10 && inputNum.length >= 10 && kNum.endsWith(inputNum.slice(-10)))) {
            return normK;
          }
        }
      }
    }
  } catch (e) {}

  return cleanJid;
}

/**
 * Extrae y resuelve el JID del usuario objetivo de un mensaje (mencionados, citados o args).
 */
export async function resolveTargetJid(m, args = [], conn = null) {
  let rawJid = null;

  if (m?.mentionedJid && m.mentionedJid.length > 0) {
    rawJid = m.mentionedJid[0];
  } else if (m?.quoted) {
    rawJid = m.quoted.sender || m.quoted.participant;
  } else if (args && args.length > 0) {
    const firstArg = args[0] || "";
    const cleanNum = firstArg.replace(/[^0-9]/g, "");
    if (cleanNum && cleanNum.length >= 7) {
      rawJid = cleanNum + "@s.whatsapp.net";
    }
  }

  if (!rawJid) return null;

  const chatId = m?.chatId || m?.key?.remoteJid;
  if (conn && chatId) {
    return await resolveGroupParticipantJid(conn, chatId, rawJid);
  }
  return normalizeJid(rawJid);
}

// ============================================================
// Funciones de imagen/media
// ============================================================
function unwrapWhatsAppMsg(msg) {
  if (!msg) return null;
  if (msg.message) msg = msg.message;
  if (msg.ephemeralMessage?.message) msg = msg.ephemeralMessage.message;
  if (msg.viewOnceMessage?.message) msg = msg.viewOnceMessage.message;
  if (msg.viewOnceMessageV2?.message) msg = msg.viewOnceMessageV2.message;
  if (msg.viewOnceMessageV2Extension?.message) msg = msg.viewOnceMessageV2Extension.message;
  if (msg.documentWithCaptionMessage?.message) msg = msg.documentWithCaptionMessage.message;
  return msg;
}

function getQuotedMessageObj(m) {
  if (!m) return null;
  if (m.quoted?.message) return unwrapWhatsAppMsg(m.quoted.message);
  
  const direct = unwrapWhatsAppMsg(m.message);
  if (!direct) return null;

  for (const key of Object.keys(direct)) {
    if (direct[key]?.contextInfo?.quotedMessage) {
      return unwrapWhatsAppMsg(direct[key].contextInfo.quotedMessage);
    }
  }
  return null;
}

export async function getMediaBuffer(m) {
  if (!m) return null;

  const directMsg = unwrapWhatsAppMsg(m.message);
  const quotedMsg = getQuotedMessageObj(m);

  const mediaMap = [
    { key: "audioMessage", type: "audio" },
    { key: "videoMessage", type: "video" },
    { key: "ptvMessage", type: "video" },
    { key: "imageMessage", type: "image" },
    { key: "documentMessage", type: "document" },
    { key: "stickerMessage", type: "sticker" },
  ];

  for (const targetObj of [directMsg, quotedMsg]) {
    if (!targetObj) continue;
    for (const { key, type } of mediaMap) {
      if (targetObj[key]) {
        try {
          const { downloadContentFromMessage } = await import("@whiskeysockets/baileys");
          const stream = await downloadContentFromMessage(targetObj[key], type);
          const chunks = [];
          for await (const chunk of stream) { chunks.push(chunk); }
          const buffer = Buffer.concat(chunks);
          if (buffer && buffer.length > 0) return buffer;
        } catch (err) {
          console.error(`[getMediaBuffer] Error descargando ${key}:`, err.message);
        }
      }
    }
  }
  return null;
}

// ============================================================
// Funciones de utilidad adicionales
// ============================================================

/**
 * Retorna un entero aleatorio entre min y max (incluyentes).
 */
export function randomInt(min, max) {
  if (max === undefined) {
    max = min;
    min = 0;
  }
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Retorna un elemento aleatorio de un arreglo o cadena.
 */
export function randomElement(arr) {
  if (!arr || arr.length === 0) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Formatear fecha en formato legible.
 */
export function formatDate(date = new Date(), options = {}) {
  const d = new Date(date);
  if (isNaN(d.getTime())) return "Fecha inválida";
  return d.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    ...options,
  });
}

/**
 * Genera una barra de progreso visual.
 */
export function progressBar(current, max, length = 10, filledChar = "█", emptyChar = "░") {
  if (max <= 0) max = 1;
  const progress = Math.min(Math.max(current / max, 0), 1);
  const filled = Math.round(progress * length);
  const empty = length - filled;
  return filledChar.repeat(filled) + emptyChar.repeat(empty);
}

/**
 * Detectar tipo de media desde mensaje WhatsApp.
 */
export function getMediaType(m) {
  if (!m) return null;
  const directMsg = unwrapWhatsAppMsg(m.message);
  const quotedMsg = getQuotedMessageObj(m);

  for (const target of [directMsg, quotedMsg]) {
    if (!target) continue;
    if (target.imageMessage) return "image";
    if (target.videoMessage || target.ptvMessage) return "video";
    if (target.audioMessage) return "audio";
    if (target.documentMessage) return "document";
    if (target.stickerMessage) return "sticker";
  }
  return null;
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function extractNumber(jid) {
  if (!jid) return "";
  return jid.toString().split("@")[0].split(":")[0].replace(/\D/g, "");
}
