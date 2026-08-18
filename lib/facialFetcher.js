// ============================================================
//   Kurumi Tokisaki - Facial Media Selector
//   Contenido verificado para /cum (Anime)
// ============================================================

import { fileURLToPath } from "url";

const FACIAL_ASSET_DIR = fileURLToPath(new URL("../assets/facial/", import.meta.url));

/**
 * Imágenes estáticas aprobadas por el propietario del bot.
 * Se empaquetan localmente para no depender de enlaces CDN que puedan caducar.
 * Se mantienen separadas del catálogo NSFW de /cumshot.
 */
export const VERIFIED_FACIAL_IMAGES = [
  `${FACIAL_ASSET_DIR}/shiori.jpg`, // Shiori Novella
  `${FACIAL_ASSET_DIR}/raiden.jpg`, // Raiden Shogun
  `${FACIAL_ASSET_DIR}/aqua.jpg`, // Aqua
  `${FACIAL_ASSET_DIR}/rem.jpg`, // Rem
];

/**
 * Catálogo animado estable: solo se seleccionan URLs que responden como media
 * válida con las cabeceras del proveedor. Los enlaces históricos que devolvían
 * 404/HTML no se usan para evitar que WhatsApp reciba un medio vacío.
 */
export const VERIFIED_FACIAL_GIFS = [
  // URLs comprobadas con HTTP 200, MIME image/gif y Referer del proveedor.
  "https://cdn.purrbot.site/nsfw/cum/gif/cum_013.gif",
  "https://cdn.purrbot.site/nsfw/cum/gif/cum_014.gif",
  "https://img4.gelbooru.com/images/9c/dc/9cdcccc150e1c9e519e35bc8cea41c49.gif",
  "https://img4.gelbooru.com/images/5e/a4/5ea45ec21a4a2c94694e2d4595fdfa75.gif",
  "https://img4.gelbooru.com/images/a2/c5/a2c5dcb5f76fa5b879f6ae904c47fdb9.gif",
  "https://img4.gelbooru.com/images/9a/10/9a105aa1d8b73ec95e8bbccb6ad31e8a.gif",
];

const FACIAL_MEDIA = [
  ...VERIFIED_FACIAL_IMAGES.map((url) => ({ url, isGif: false })),
  ...VERIFIED_FACIAL_GIFS.map((url) => ({
    url,
    isGif: /\.gif(?:$|\?)/i.test(url),
  })),
];

// Último elemento enviado por chat, para evitar que salga dos veces seguidas.
const lastMediaByChat = new Map();
const unavailableUntilByUrl = new Map();
const FAILED_MEDIA_TTL_MS = 15 * 60 * 1000;

function isTemporarilyUnavailable(url) {
  const until = unavailableUntilByUrl.get(url) || 0;
  if (until <= Date.now()) {
    unavailableUntilByUrl.delete(url);
    return false;
  }
  return true;
}

export function markFacialMediaUnavailable(url, ttl = FAILED_MEDIA_TTL_MS) {
  if (typeof url === "string" && url) unavailableUntilByUrl.set(url, Date.now() + ttl);
}

/**
 * Devuelve un elemento del catálogo facial sin repetir inmediatamente el
 * anterior dentro del mismo chat.
 *
 * @param {string} chatId
 * @returns {{url: string, isGif: boolean}}
 */
function selectFromPool(chatId, items) {
  const key = String(chatId || "global");
  const availableItems = items.filter((item) => !isTemporarilyUnavailable(item.url));
  if (!availableItems.length) return null;
  const previousUrl = lastMediaByChat.get(key);
  const candidates = availableItems.length > 1
    ? availableItems.filter((item) => item.url !== previousUrl)
    : availableItems;
  const pool = candidates.length ? candidates : availableItems;
  const selected = pool[Math.floor(Math.random() * pool.length)];
  lastMediaByChat.set(key, selected.url);
  return { ...selected };
}

export function getFacialMedia(chatId = "global") {
  return selectFromPool(chatId, FACIAL_MEDIA);
}

export function getFacialGif(chatId = "global") {
  return selectFromPool(chatId, FACIAL_MEDIA.filter((item) => item.isGif));
}

export function getFacialImage(chatId = "global") {
  return selectFromPool(chatId, VERIFIED_FACIAL_IMAGES.map((url) => ({ url, isGif: false })));
}

export const facialGifCount = FACIAL_MEDIA.filter((item) => item.isGif).length;
export const facialMediaCount = FACIAL_MEDIA.length;
