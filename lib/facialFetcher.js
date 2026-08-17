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
 * GIFs verificados previamente. El MP4 de Rule34 se conserva porque es
 * el formato animado original devuelto por esa fuente y el helper de anime
 * sabe enviarlo como vídeo.
 */
export const VERIFIED_FACIAL_GIFS = [
  "https://purrbot.site/img/nsfw/cum/gif/cum_013.gif",
  "https://purrbot.site/img/nsfw/cum/gif/cum_014.gif",
  "https://img.xbooru.com//images/118/abd296fcd8ae79ad49c8faab3775cb45fe56a585.gif",
  "https://img4.gelbooru.com/images/9c/dc/9cdcccc150e1c9e519e35bc8cea41c49.gif",
  "https://img4.gelbooru.com/images/5e/a4/5ea45ec21a4a2c94694e2d4595fdfa75.gif",
  "https://img4.gelbooru.com/images/a2/c5/a2c5dcb5f76fa5b879f6ae904c47fdb9.gif",
  "https://img4.gelbooru.com/images/0a/8f/0a8f8d689564d689564.gif",
  "https://img4.gelbooru.com/images/13/00/1300705.gif",
  "https://img4.gelbooru.com/images/20/28/2028608.gif",
  "https://img4.gelbooru.com/images/9a/10/9a105aa1d8b73ec95e8bbccb6ad31e8a.gif",
  "https://wimg.rule34.xxx/images/3796/7e10061eb06fe1e507ffaff50492c783.mp4",
  "https://img4.gelbooru.com/images/9c/56/9c56557d13975369.gif",
  "https://img4.gelbooru.com/images/24/51/2451616.gif",
  "https://img4.gelbooru.com/images/24/51/2451627.gif",
  "https://img4.gelbooru.com/images/27/08/2708875.gif",
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

/**
 * Devuelve un elemento del catálogo facial sin repetir inmediatamente el
 * anterior dentro del mismo chat.
 *
 * @param {string} chatId
 * @returns {{url: string, isGif: boolean}}
 */
function selectFromPool(chatId, items) {
  const key = String(chatId || "global");
  const previousUrl = lastMediaByChat.get(key);
  const candidates = items.length > 1
    ? items.filter((item) => item.url !== previousUrl)
    : items;
  const pool = candidates.length ? candidates : items;
  const selected = pool[Math.floor(Math.random() * pool.length)];
  lastMediaByChat.set(key, selected.url);
  return { ...selected };
}

export function getFacialMedia(chatId = "global") {
  return selectFromPool(chatId, FACIAL_MEDIA);
}

export function getFacialImage(chatId = "global") {
  return selectFromPool(chatId, VERIFIED_FACIAL_IMAGES.map((url) => ({ url, isGif: false })));
}

export const facialMediaCount = FACIAL_MEDIA.length;
