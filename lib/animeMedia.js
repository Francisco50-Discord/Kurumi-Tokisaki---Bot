// ============================================================
//   Kurumi Tokisaki - Anime SFW Media API Helper v21.0
//   ──────────────────────────────────
//   Soporte dinámico para GIFs animados (kiss, hug, pat, etc.)
//   y variaciones de waifus de múltiples fuentes (PurrBot,
//   Nekos.life y Safebooru) con consultas paralelas sin reutilizar medios.
// ============================================================

import axios from "axios";
import { execFile } from "child_process";
import util from "util";
import fs from "fs";
import path from "path";
import { getBinaryPath } from "./autoInstall.js";

const execFileAsync = util.promisify(execFile);

// ─── Fuentes y Endpoints ─────────────────────────
const ACTION_ENDPOINTS = {
  angry: [
    { type: "purrbot", endpoint: "angry" },
    { type: "nekos", endpoint: "slap" },
  ],
  kiss: [
    { type: "purrbot", endpoint: "kiss" },
    { type: "nekos", endpoint: "kiss" },
  ],
  hug: [
    { type: "purrbot", endpoint: "hug" },
    { type: "nekos", endpoint: "hug" },
  ],
  pat: [
    { type: "purrbot", endpoint: "pat" },
    { type: "nekos", endpoint: "pat" },
  ],
  cuddle: [
    { type: "purrbot", endpoint: "cuddle" },
    { type: "nekos", endpoint: "cuddle" },
  ],
  slap: [
    { type: "purrbot", endpoint: "slap" },
    { type: "nekos", endpoint: "slap" },
  ],
  tickle: [
    { type: "purrbot", endpoint: "tickle" },
    { type: "nekos", endpoint: "tickle" },
  ],
  feed: [
    { type: "purrbot", endpoint: "feed" },
    { type: "nekos", endpoint: "feed" },
  ],
  dance: [
    { type: "purrbot", endpoint: "dance" },
  ],
  smile: [
    { type: "purrbot", endpoint: "smile" },
  ],
  blush: [
    { type: "purrbot", endpoint: "blush" },
  ],
  cry: [
    { type: "purrbot", endpoint: "cry" },
  ],
  smug: [
    { type: "purrbot", endpoint: "dance" },
    { type: "nekos", endpoint: "smug" },
  ],
  meow: [
    { type: "purrbot", endpoint: "neko" },
  ],
  neko: [
    { type: "purrbot", endpoint: "neko" },
  ],
  waifu: [
    { type: "nekos", endpoint: "waifu" },
    { type: "safebooru", endpoint: "1girl" },
  ],
  wallpaper: [
    { type: "nekos", endpoint: "wallpaper" },
  ],
};

const ALIASES = {
  angry: "angry",
  enojar: "angry",
  enojo: "angry",
  beso: "kiss",
  besar: "kiss",
  kiss: "kiss",
  abrazo: "hug",
  abrazar: "hug",
  hug: "hug",
  acariciar: "pat",
  pat: "pat",
  cuddle: "cuddle",
  mimo: "cuddle",
  slap: "slap",
  cachetada: "slap",
  bofetada: "slap",
  tickle: "tickle",
  cosquillas: "tickle",
  feed: "feed",
  alimentar: "feed",
  dance: "dance",
  bailar: "dance",
  smile: "smile",
  sonreir: "smile",
  sonreír: "smile",
  blush: "blush",
  sonrojar: "blush",
  cry: "cry",
  llorar: "cry",
  smug: "smug",
  meow: "meow",
  maullar: "meow",
  neko: "neko",
  waifu: "waifu",
  wallpaper: "wallpaper",
};

const REQUEST_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  Accept: "application/json,*/*;q=0.8",
};

const PROVIDER_TIMEOUT_MS = 2_500;

function isHttpUrl(value) {
  return typeof value === "string" && /^https?:\/\//i.test(value);
}

async function fetchPurrbot(endpoint) {
  const urls = [
    `https://api.purrbot.site/v2/img/sfw/${endpoint}/gif`,
    `https://purrbot.site/api/img/sfw/${endpoint}/gif`,
  ];
  return Promise.any(urls.map(async (url) => {
    const res = await axios.get(url, {
      timeout: PROVIDER_TIMEOUT_MS,
      headers: REQUEST_HEADERS,
    });
    const link = res.data?.link;
    if (!isHttpUrl(link)) throw new Error("PurrBot no devolvió un enlace válido");
    return link;
  }));
}

async function fetchMediaSource(source) {
  if (source.type === "purrbot") {
    return fetchPurrbot(source.endpoint);
  }

  if (source.type === "nekos") {
    const res = await axios.get(`https://nekos.life/api/v2/img/${source.endpoint}`, {
      timeout: PROVIDER_TIMEOUT_MS,
      headers: REQUEST_HEADERS,
    });
    const url = res.data?.url;
    if (!isHttpUrl(url)) throw new Error("Nekos no devolvió un enlace válido");
    return url;
  }

  if (source.type === "safebooru") {
    const pid = Math.floor(Math.random() * 80) + 1;
    const res = await axios.get(`https://safebooru.org/index.php?page=dapi&s=post&q=index&json=1&tags=1girl+solo&pid=${pid}&limit=20`, {
      timeout: PROVIDER_TIMEOUT_MS,
      headers: REQUEST_HEADERS,
    });
    if (!Array.isArray(res.data) || res.data.length === 0) {
      throw new Error("Safebooru no devolvió resultados");
    }
    const item = res.data[Math.floor(Math.random() * res.data.length)];
    if (!item?.directory || !item?.image) throw new Error("Safebooru no devolvió una imagen válida");
    return `https://safebooru.org/images/${item.directory}/${item.image}`;
  }

  throw new Error(`Proveedor desconocido: ${source.type}`);
}

/**
 * Obtiene la URL de un GIF/imagen de anime SFW para una acción dada.
 * Las fuentes se consultan en paralelo y cada llamada solicita contenido nuevo.
 *
 * @param {string} action - kiss, hug, pat, cuddle, slap, tickle, feed, dance, smile, etc.
 * @returns {Promise<string|null>} URL del GIF/imagen
 */
export async function getAnimeMediaUrl(action) {
  if (!action) return null;
  const rawKey = String(action).toLowerCase().trim();
  const normalizedKey = ALIASES[rawKey] || rawKey;

  const sources = ACTION_ENDPOINTS[normalizedKey] || [
    { type: "purrbot", endpoint: normalizedKey },
    { type: "nekos", endpoint: normalizedKey },
  ];

  // Las fuentes y los dos endpoints de PurrBot se consultan en paralelo.
  try {
    const mediaUrl = await Promise.any(sources.map((source) => fetchMediaSource(source)));
    if (isHttpUrl(mediaUrl)) {
      return mediaUrl;
    }
  } catch (e) {
    // Se usa el fallback final solo si todas las fuentes principales fallan.
  }

  // Fallback final: nekos.life waifu o kiss si la acción era de interacción
  try {
    const fallbackEndpoint = ["kiss", "hug", "pat"].includes(normalizedKey) ? "kiss" : "waifu";
    const mediaUrl = await fetchMediaSource({ type: "nekos", endpoint: fallbackEndpoint });
    if (isHttpUrl(mediaUrl)) {
      return mediaUrl;
    }
  } catch (e) {
    return null;
  }

  return null;
}

/**
 * Obtiene múltiples URLs para variedad.
 */
export async function getAnimeMediaUrls(action, count = 1) {
  const results = await Promise.all(
    Array.from({ length: Math.max(1, count) }, () => getAnimeMediaUrl(action))
  );
  return [...new Set(results.filter(isHttpUrl))];
}

/**
 * Convierte un GIF animado (URL o buffer) a Buffer MP4 (H.264 yuv420p)
 * para que WhatsApp lo reproduzca en bucle sin bucles de descarga ni errores.
 */
export async function convertGifToMp4Buffer(gifUrlOrBuffer) {
  const ffmpegPath = getBinaryPath("ffmpeg");
  if (!ffmpegPath) throw new Error("ffmpeg no disponible");

  const tempId = Date.now() + "_" + Math.floor(Math.random() * 10000);
  const inputPath = path.join("/tmp", `gif_in_${tempId}.gif`);
  const outputPath = path.join("/tmp", `gif_out_${tempId}.mp4`);

  try {
    if (Buffer.isBuffer(gifUrlOrBuffer)) {
      fs.writeFileSync(inputPath, gifUrlOrBuffer);
    } else {
      const res = await axios.get(gifUrlOrBuffer, {
        responseType: "arraybuffer",
        timeout: 10000,
        headers: REQUEST_HEADERS,
      });
      fs.writeFileSync(inputPath, Buffer.from(res.data));
    }

    await execFileAsync(ffmpegPath, [
      "-i", inputPath,
      "-movflags", "faststart",
      "-pix_fmt", "yuv420p",
      "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2",
      "-y", outputPath
    ]);

    return fs.readFileSync(outputPath);
  } finally {
    if (fs.existsSync(inputPath)) try { fs.unlinkSync(inputPath); } catch (e) {}
    if (fs.existsSync(outputPath)) try { fs.unlinkSync(outputPath); } catch (e) {}
  }
}

/**
 * Envía un mensaje con media (GIF animado como video MP4 o imagen) a WhatsApp.
 * Si la URL es un GIF, lo convierte a MP4 con ffmpeg para que WhatsApp lo
 * reproduzca automáticamente en bucle sin loops de descarga ni congelamientos.
 */
export async function sendAnimeMediaMessage(conn, chatId, mediaUrl, caption, options = {}) {
  if (!mediaUrl) throw new Error("No media URL provided");

  const isGif = typeof mediaUrl === "string" && (
    mediaUrl.toLowerCase().endsWith(".gif") ||
    mediaUrl.includes("/gif") ||
    mediaUrl.includes("purrbot")
  ) && !/\.(jpe?g|png|webp)$/i.test(mediaUrl);
  const isDirectVideo = typeof mediaUrl === "string" && /\.(mp4|webm|mov)(?:[?#].*)?$/i.test(mediaUrl);
  const isLocalFile = typeof mediaUrl === "string" && (mediaUrl.startsWith("/") || mediaUrl.startsWith("file://"));

  const mentions = options.mentions || [];
  const sendOpts = options.quoted ? { quoted: options.quoted } : {};

  if (isGif) {
    try {
      const mp4Buffer = await convertGifToMp4Buffer(mediaUrl);
      return await conn.sendMessage(
        chatId,
        { video: mp4Buffer, gifPlayback: true, caption, mimetype: "video/mp4", mentions },
        sendOpts
      );
    } catch (e) {
      console.warn("[sendAnimeMediaMessage] Conversión GIF a MP4 falló, enviando imagen fallback:", e.message);
    }
  }

  if (isDirectVideo) {
    return await conn.sendMessage(
      chatId,
      { video: { url: mediaUrl }, gifPlayback: true, caption, mimetype: "video/mp4", mentions },
      sendOpts
    );
  }

  if (isLocalFile) {
    const localPath = mediaUrl.startsWith("file://") ? new URL(mediaUrl) : mediaUrl;
    return await conn.sendMessage(
      chatId,
      { image: fs.readFileSync(localPath), caption, mentions },
      sendOpts
    );
  }

  // Fallback o imagen estática remota
  return await conn.sendMessage(
    chatId,
    { image: { url: mediaUrl }, caption, mentions },
    sendOpts
  );
}

/**
 * Lista de acciones soportadas.
 */
export function getSupportedActions() {
  return Object.keys(ALIASES);
}

