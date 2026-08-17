// ============================================================
//   Kurumi Tokisaki - Profile Picture Helper v21.0
//   ──────────────────────────────────
//   PROBLEMA PREVIO (v20.0): Se descargaba la URL del CDN de
//   WhatsApp con axios + headers personalizados. Esto fallaba
//   frecuentemente en Baileys v7 RC13 con LID/PN addressing:
//     • La URL expira rápido (token en querystring caduca)
//     • El CDN a veces rechaza requests externos
//     • El helper caía al fallback (imagen por defecto Pixabay)
//
//   SOLUCIÓN v21.0:
//     • Nueva API: getProfilePictureUrl(conn, jid) — devuelve solo la URL
//     • Nueva API: sendProfilePictureMessage(conn, ...) — pasa la URL
//       directamente a sendMessage({ image: { url } }), dejando que
//       Baileys haga la descarga con su propio stack HTTP/auth.
//     • Mantiene getProfilePictureBuffer para casos donde se necesita
//       el buffer (ej. stickers), con descarga mejorada.
//     • Mantiene getProfilePictureOrFallback para retrocompatibilidad.
// ============================================================

import axios from "axios";
import fs from "fs";
import { DEFAULT_AVATAR } from "./rpgImages.js";
import { normalizeJid } from "./utils.js";

// ─── Cache en memoria LRU (60s) ──────────────────────
const _ppCache = new Map();
const _PP_CACHE_TTL_MS = 60_000;

function _cacheGet(jid) {
  const entry = _ppCache.get(jid);
  if (!entry) return null;
  if (Date.now() - entry.t > _PP_CACHE_TTL_MS) {
    _ppCache.delete(jid);
    return null;
  }
  return entry.buf;
}

function _cacheSet(jid, buf) {
  // Limpiar cache si crece mucho (>200 entradas)
  if (_ppCache.size > 200) {
    const oldest = [..._ppCache.entries()]
      .sort((a, b) => a[1].t - b[1].t)
      .slice(0, 100);
    for (const [k] of oldest) _ppCache.delete(k);
  }
  _ppCache.set(jid, { buf, t: Date.now() });
}

// ─── Cache de URL (60s) ──────────────────────
// Separado del cache de buffer para no descargar si solo se necesita la URL
const _ppUrlCache = new Map();
// Evita repetir consultas lentas cuando un contacto no tiene foto o el CDN no responde.
const _ppUnavailableCache = new Map();
const _PP_UNAVAILABLE_TTL_MS = 120_000;

function _unavailableCacheHas(jid) {
  const timestamp = _ppUnavailableCache.get(jid);
  if (!timestamp) return false;
  if (Date.now() - timestamp > _PP_UNAVAILABLE_TTL_MS) {
    _ppUnavailableCache.delete(jid);
    return false;
  }
  return true;
}

function _unavailableCacheSet(jid) {
  if (_ppUnavailableCache.size > 200) _ppUnavailableCache.clear();
  _ppUnavailableCache.set(jid, Date.now());
}

function _urlCacheGet(jid) {
  const entry = _ppUrlCache.get(jid);
  if (!entry) return null;
  if (Date.now() - entry.t > _PP_CACHE_TTL_MS) {
    _ppUrlCache.delete(jid);
    return null;
  }
  return entry.url;
}

function _urlCacheSet(jid, url) {
  if (_ppUrlCache.size > 200) {
    const oldest = [..._ppUrlCache.entries()]
      .sort((a, b) => a[1].t - b[1].t)
      .slice(0, 100);
    for (const [k] of oldest) _ppUrlCache.delete(k);
  }
  _ppUrlCache.set(jid, { url, t: Date.now() });
}

// ─── Avatar por defecto embebido (PNG 1x1 gris) ───────────────
// Último recurso si TODO lo demás falla. Sin red.
const _FALLBACK_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAEAAAABAAQMAAACyI5kaAAAABlBMVEXMzMz////" +
  "8EwIqAAAAHXRFWHRUaXRsZQBQcm9maWxlIFBpY3R1cmWV6uM6AAAAEXRFWHRTb3" +
  "VyY2UAUGl4YWJheSAtIENvbW11bml0eTnD0yLTAAAAFklEQVQ4y2NgGAWjYBSM" +
  "GlFgwhgEA8EEA4Z2F9UAAAAASUVORK5CYII=";

let _fallbackPngBuffer = null;
let _eventDefaultAvatarBuffer = null;
const _EVENT_DEFAULT_AVATAR_PATH = new URL("../assets/default-group-avatar-512.png", import.meta.url);

/**
 * Avatar local para eventos de grupo. No usa red, por lo que garantiza una
 * imagen inmediata cuando un perfil no tiene foto o restringe su visibilidad.
 */
export function getEventDefaultAvatarBuffer() {
  if (_eventDefaultAvatarBuffer) return _eventDefaultAvatarBuffer;
  try {
    const avatar = fs.readFileSync(_EVENT_DEFAULT_AVATAR_PATH);
    if (isValidImageBuffer(avatar)) {
      _eventDefaultAvatarBuffer = avatar;
      return avatar;
    }
  } catch {}
  return _getEmbeddedFallbackBuffer();
}

function _getEmbeddedFallbackBuffer() {
  if (_fallbackPngBuffer) return _fallbackPngBuffer;
  try {
    _fallbackPngBuffer = Buffer.from(_FALLBACK_PNG_BASE64, "base64");
  } catch {
    _fallbackPngBuffer = Buffer.alloc(0);
  }
  return _fallbackPngBuffer;
}

// ─── Avatar por defecto desde URL remota (cacheado) ───────────
let _defaultAvatarBuffer = null;
let _defaultAvatarFetching = null;
export async function getDefaultAvatarBuffer() {
  if (_defaultAvatarBuffer) return _defaultAvatarBuffer;

  // Evitar descargas simultáneas
  if (_defaultAvatarFetching) {
    try {
      return await _defaultAvatarFetching;
    } catch {
      // si falló, continuar e intentar de nuevo
    }
  }

  _defaultAvatarFetching = (async () => {
    try {
      const res = await axios.get(DEFAULT_AVATAR, {
        responseType: "arraybuffer",
        timeout: 2500,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "image/*,*/*;q=0.8",
        },
      });
      const buf = Buffer.from(res.data);
      if (isValidImageBuffer(buf)) {
        _defaultAvatarBuffer = buf;
        return buf;
      }
    } catch (e) {
      // Pixabay caído o rate-limited
    }
    return null;
  })();

  try {
    const result = await _defaultAvatarFetching;
    if (result) return result;
  } catch {}

  // Si la URL remota falla, usar PNG embebido
  return _getEmbeddedFallbackBuffer();
}

// ─── Validador de magic bytes ─────────────────
export function isValidImageBuffer(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 12) return false;
  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return true;
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 &&
    buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a
  ) return true;
  // WebP: "RIFF"...."WEBP"
  if (
    buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
    buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50
  ) return true;
  // GIF: "GIF87a" / "GIF89a"
  if (
    buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38 &&
    (buf[4] === 0x37 || buf[4] === 0x39) && buf[5] === 0x61
  ) return true;
  return false;
}

// ─── Headers de WhatsApp Web (para descargar URL del CDN) ─────
const WHATSAPP_HEADERS = {
  "User-Agent":
    "WhatsApp/2.24.12.54 A",
  Accept: "image/*,application/octet-stream;q=0.9,*/*;q=0.8",
  "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
  "Accept-Encoding": "gzip, deflate, br",
  Origin: "https://web.whatsapp.com",
  Referer: "https://web.whatsapp.com/",
  DNT: "1",
  "Sec-Fetch-Dest": "image",
  "Sec-Fetch-Mode": "no-cors",
  "Sec-Fetch-Site": "cross-site",
};

// ─── Descargar URL como buffer con headers WhatsApp ───────────
async function _downloadWithWhatsAppHeaders(url) {
  // Intento 1: headers de WhatsApp Web
  try {
    const res = await axios.get(url, {
      responseType: "arraybuffer",
      timeout: 12000,
      maxRedirects: 5,
      headers: WHATSAPP_HEADERS,
      validateStatus: (s) => s === 200,
    });
    const buf = Buffer.from(res.data || "");
    if (isValidImageBuffer(buf)) return buf;
  } catch {}

  // Intento 2: headers de navegador móvil
  try {
    const res = await axios.get(url, {
      responseType: "arraybuffer",
      timeout: 12000,
      maxRedirects: 5,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1",
        Accept: "image/*,*/*",
      },
      validateStatus: (s) => s === 200,
    });
    const buf = Buffer.from(res.data || "");
    if (isValidImageBuffer(buf)) return buf;
  } catch {}

  // Intento 3: fetch nativo (distinto stack HTTP)
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
        Accept: "image/*,*/*",
      },
    });
    clearTimeout(timer);
    if (resp.ok) {
      const ab = await resp.arrayBuffer();
      const buf = Buffer.from(ab);
      if (isValidImageBuffer(buf)) return buf;
    }
  } catch {}

  return null;
}

// ============================================================
//   API PÚBLICA (NUEVA v21.0): obtener URL de foto de perfil
//   ──────────────────────────────────
//   Devuelve la URL directa del CDN de WhatsApp para la foto de
//   perfil del usuario. Esta URL se puede pasar directamente a
//   sendMessage({ image: { url } }) y Baileys la descargará con
//   su propio stack HTTP (más confiable que descargar con axios).
//
//   Estrategia:
//     1) URL cache (60s)
//     2) conn.profilePictureUrl(jid, 'image')
//     3) conn.profilePictureUrl(jid, 'preview')
//     4) conn.fetchProfilePictureUrl?.(jid, 'image')  (algunos forks)
//     5) null si todo falló
//
//   @returns {Promise<string|null>}
// ============================================================
function withTimeout(promise, ms = 1500) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error("PP_TIMEOUT")), ms))
  ]);
}

export async function getProfilePictureUrl(conn, jid, options = {}) {
  if (!conn || !jid) return null;
  const normalized = normalizeJid(jid);
  const quick = options.quick === true;
  const timeoutMs = Number.isFinite(options.timeoutMs)
    ? Math.max(100, Math.min(options.timeoutMs, 5000))
    : 2000;
  if (!normalized) return null;

  // 1) URL cache
  const cached = _urlCacheGet(normalized);
  if (cached) return cached;
  if (_unavailableCacheHas(normalized)) return null;

  // Recolectar JIDs candidatas (original + variante de México si aplica).
  // En avisos de grupo el modo rápido evita variantes y conserva una sola
  // consulta breve, para que el texto no quede retenido por una foto ausente.
  const jidsToTry = [normalized];
  if (!quick && normalized.endsWith("@s.whatsapp.net")) {
    const num = normalized.split("@")[0];
    if (num.startsWith("521") && num.length === 13) {
      jidsToTry.push(num.replace(/^521/, "52") + "@s.whatsapp.net");
    } else if (num.startsWith("52") && num.length === 12 && !num.startsWith("521")) {
      jidsToTry.push(num.replace(/^52/, "521") + "@s.whatsapp.net");
    }
  }

  const candidateUrls = [];

  for (const targetJid of jidsToTry) {
    // 2) profilePictureUrl('image')
    try {
              const url = await withTimeout(conn.profilePictureUrl(targetJid, "image"), timeoutMs);

      if (typeof url === "string" && /^https?:\/\//i.test(url)) {
        candidateUrls.push(url);
        break;
      }
    } catch {}

    // En modo rápido no se prueban variantes ni fuentes secundarias.
    if (quick) continue;

    // 3) profilePictureUrl('preview')
    try {
              const url = await withTimeout(conn.profilePictureUrl(targetJid, "preview"), timeoutMs);

      if (typeof url === "string" && /^https?:\/\//i.test(url)) {
        candidateUrls.push(url);
        break;
      }
    } catch {}

    // 4) fetchProfilePictureUrl (algunos forks de Baileys)
    if (typeof conn.fetchProfilePictureUrl === "function") {
      try {
        const url = await withTimeout(conn.fetchProfilePictureUrl(targetJid, "image"), timeoutMs);
        if (typeof url === "string" && /^https?:\/\//i.test(url)) {
          candidateUrls.push(url);
          break;
        }
      } catch {}
    }
  }

  if (candidateUrls.length > 0) {
    _ppUnavailableCache.delete(normalized);
    _urlCacheSet(normalized, candidateUrls[0]);
    return candidateUrls[0];
  }

  _unavailableCacheSet(normalized);
  return null;
}

// ─── API PÚBLICA: obtener Buffer de foto de perfil ────────────
//
// Estrategia:
//   1) Buffer cache (60s)
//   2) Obtener URL via getProfilePictureUrl()
//   3) Descargar URL con headers WhatsApp
//   4) null si todo falló → el caller decide fallback
//
// @returns {Promise<Buffer|null>}
// ──────────────────────────────────────
export async function getProfilePictureBuffer(conn, jid) {
  if (!conn || !jid) return null;
  const normalized = normalizeJid(jid);
  if (!normalized) return null;

  // 1) Buffer cache
  const cached = _cacheGet(normalized);
  if (cached) return cached;

  // 2) Obtener URL (esto usa su propio cache de URL)
  const url = await getProfilePictureUrl(conn, normalized);
  if (!url) return null;

  // 3) Descargar
  const buf = await _downloadWithWhatsAppHeaders(url);
  if (buf) {
    _cacheSet(normalized, buf);
    return buf;
  }

  return null;
}

// ─── API PÚBLICA: obtener Buffer garantizado (con fallback) ────
//
// Igual que getProfilePictureBuffer pero SIEMPRE devuelve un buffer
// válido (real foto o avatar por defecto). Nunca retorna null.
//
// @returns {Promise<Buffer>}
// ──────────────────────────────────────
export async function getProfilePictureOrFallback(conn, jid) {
  const real = await getProfilePictureBuffer(conn, jid);
  if (real) return real;
  return await getDefaultAvatarBuffer();
}

// ============================================================
//   API PÚBLICA (NUEVA v21.0): enviar mensaje con foto de perfil
//   ──────────────────────────────────
//   Estrategia en cascada (cada paso se prueba y si falla pasa
//   al siguiente):
//
//   PASO 1: URL o Buffer de la foto de perfil del usuario
//   PASO 2: URL o Buffer del JID secundario (ej. grupo chatId)
//   PASO 3: Banner/Avatar por defecto (garantiza mensaje con imagen)
//   PASO 4: Solo texto (último recurso)
//
//   @returns {Promise<boolean>} true si se envió con imagen, false si fue solo texto
// ============================================================
export async function sendProfilePictureMessage(
  conn,
  chatId,
  userJid,
  caption,
  options = {}
) {
  if (!conn || !chatId) {
    return false;
  }

  const mentions = options.mentions || [];
  const quoted = options.quoted;
  const sendOpts = quoted ? { quoted } : {};
  const targetUser = userJid || chatId;
  const fallbackJid = options.fallbackJid || (chatId !== targetUser ? chatId : null);

  // ─── PASO 1: Foto del usuario ───────────────────────
  if (targetUser) {
    // La URL directa evita descargar el mismo archivo antes de que Baileys lo envíe.
    const url = await getProfilePictureUrl(conn, targetUser);
    if (url) {
      try {
        await conn.sendMessage(chatId, {
          image: { url },
          caption,
          mentions,
        }, sendOpts);
        return true;
      } catch (e) {
        // Solo si el envío directo falla se descarga el buffer como respaldo.
      }
    }

    const buf = await getProfilePictureBuffer(conn, targetUser);
    if (buf && buf.length > 0) {
      try {
        await conn.sendMessage(chatId, {
          image: buf,
          caption,
          mentions,
        }, sendOpts);
        return true;
      } catch (e) {}
    }
  }

  // ─── PASO 2: Foto del grupo/Fallback JID ────────────
  if (fallbackJid) {
    const fbUrl = await getProfilePictureUrl(conn, fallbackJid);
    if (fbUrl) {
      try {
        await conn.sendMessage(chatId, {
          image: { url: fbUrl },
          caption,
          mentions,
        }, sendOpts);
        return true;
      } catch (e) {}
    }

    const fbBuf = await getProfilePictureBuffer(conn, fallbackJid);
    if (fbBuf && fbBuf.length > 0) {
      try {
        await conn.sendMessage(chatId, {
          image: fbBuf,
          caption,
          mentions,
        }, sendOpts);
        return true;
      } catch (e) {}
    }
  }

  // ─── PASO 3: Avatar / Banner por defecto ───
  if (options.useDefaultAvatarOnError !== false) {
    const defaultBuf = await getDefaultAvatarBuffer();
    if (defaultBuf && defaultBuf.length > 0) {
      try {
        await conn.sendMessage(chatId, {
          image: defaultBuf,
          caption,
          mentions,
        }, sendOpts);
        return true;
      } catch (e) {}
    }
  }

  // ─── PASO 4: Solo texto ───
  try {
    await conn.sendMessage(chatId, {
      text: caption,
      mentions,
    }, sendOpts);
  } catch (e) {
    try {
      if (quoted?.reply) await quoted.reply(caption);
    } catch {}
  }
  return false;
}
