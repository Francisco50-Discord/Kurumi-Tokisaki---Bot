// ============================================================
//   Kurumi Tokisaki - YouTube Search Command
//   Resultados de texto ligeros con paginación interactiva
// ============================================================

import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";
import yts from "yt-search";
import ytmp3Handler from "./ytmp3.js";
import ytmp4Handler from "./ytmp4.js";

const activeSearchSessions = new Map();
const searchResultsCache = new Map();
const runningSearchChats = new Set();
const SEARCH_CACHE_TTL_MS = 180_000;
const SEARCH_REQUEST_TIMEOUT_MS = 4500;
const SEARCH_FALLBACK_TIMEOUT_MS = 2500;
const SEARCH_EXTENDED_TIMEOUT_MS = 5000;
const SEARCH_MAX_RESULTS = 40;
const COLLAGE_MAX_VIDEOS = 10;
const COLLAGE_COLUMNS = 2;
const COLLAGE_CARD_WIDTH = 480;
const COLLAGE_THUMB_WIDTH = 480;
const COLLAGE_THUMB_HEIGHT = 210;
const COLLAGE_CARD_TEXT_HEIGHT = 74;
const COLLAGE_CARD_HEIGHT = COLLAGE_THUMB_HEIGHT + COLLAGE_CARD_TEXT_HEIGHT;
const COLLAGE_HEADER_HEIGHT = 104;
const COLLAGE_FOOTER_HEIGHT = 40;
const COLLAGE_GAP = 8;
const COLLAGE_FETCH_TIMEOUT_MS = 3200;
const COLLAGE_MAX_THUMBNAIL_BYTES = 750_000;
const COLLAGE_MAX_OUTPUT_BYTES = 1_250_000;
// Límite técnico de caption para imágenes de WhatsApp.
const WHATSAPP_IMAGE_CAPTION_SAFE_LENGTH = 1024;
const COLLAGE_FONT_FILE = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../assets/fonts/DejaVuSans.ttf"
);

// Sharp usa libvips para mantener el procesamiento visual acotado.
// Los límites globales impiden picos en el servidor pequeño.
sharp.concurrency(1);
sharp.cache({ memory: 20, files: 0, items: 20 });

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function withRequestTimeout(promise, timeoutMs = SEARCH_REQUEST_TIMEOUT_MS) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error("SEARCH_TIMEOUT")), timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

function getCachedSearchResults(query) {
  const key = String(query || "").trim().toLowerCase();
  const entry = searchResultsCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.createdAt > SEARCH_CACHE_TTL_MS) {
    searchResultsCache.delete(key);
    return null;
  }
  return entry.videos.map((video) => ({ ...video, author: { ...video.author } }));
}

function cacheSearchResults(query, videos) {
  const key = String(query || "").trim().toLowerCase();
  if (!key || !videos?.length) return;
  if (searchResultsCache.size > 100) searchResultsCache.clear();
  searchResultsCache.set(key, {
    createdAt: Date.now(),
    videos: videos.map((video) => ({ ...video, author: { ...video.author } })),
  });
}

function isConnectionUnavailableError(error) {
  if (error?.code === "CONNECTION_UNAVAILABLE") return true;
  const message = String(error?.message || error || "").toLowerCase();
  return (
    message.includes("connection closed") ||
    message.includes("connection terminated") ||
    message.includes("connection lost") ||
    message.includes("precondition required") ||
    message.includes("socket closed")
  );
}

function getReadyConnection(fallbackConn) {
  // Cuando el proceso expone el socket activo, nunca se debe usar la instancia
  // recibida por el comando si todavía no ha alcanzado el estado "online".
  const hasActiveConnectionGetter = typeof globalThis.getActiveConnection === "function";
  const activeConn = hasActiveConnectionGetter
    ? globalThis.getActiveConnection()
    : fallbackConn;

  if (!activeConn) {
    const error = new Error("La conexión de WhatsApp se está restableciendo.");
    error.code = "CONNECTION_UNAVAILABLE";
    throw error;
  }
  return activeConn;
}

async function waitForReadyConnection(fallbackConn, timeoutMs = 12_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError = null;

  while (Date.now() < deadline) {
    try {
      return getReadyConnection(fallbackConn);
    } catch (error) {
      lastError = error;
      await delay(400);
    }
  }

  throw lastError || new Error("La conexión de WhatsApp no se restableció a tiempo.");
}

async function sendYtSearchMessageWithReconnect(fallbackConn, chatId, content, options = {}) {
  let lastError = null;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const readyConn = await waitForReadyConnection(fallbackConn);
      return await readyConn.sendMessage(chatId, content, options);
    } catch (error) {
      lastError = error;
      if (!isConnectionUnavailableError(error) || attempt === 1) break;
      console.warn("La conexión cambió durante /ytsearch; se esperará el socket renovado antes de reenviar el resultado.");
    }
  }

  throw lastError;
}

async function fetchCollageThumbnail(videoId, signal) {
  // maxres conserva mucho más detalle al reducir cada tarjeta. YouTube no la
  // publica para todos los vídeos, por lo que se baja a sd y hq solo cuando
  // la variante anterior no existe o es el marcador pequeño de YouTube.
  const variants = ["maxresdefault", "sddefault", "hqdefault"];
  let lastError = null;

  for (const variant of variants) {
    try {
      const response = await fetch(`https://i.ytimg.com/vi/${videoId}/${variant}.jpg`, {
        headers: { "User-Agent": "Kurumi-Tokisaki-Bot/5.1" },
        signal,
      });
      if (!response.ok) throw new Error(`THUMBNAIL_HTTP_${response.status}`);

      const declaredLength = Number(response.headers.get("content-length") || 0);
      if (declaredLength > COLLAGE_MAX_THUMBNAIL_BYTES) {
        throw new Error("THUMBNAIL_TOO_LARGE");
      }
      const image = Buffer.from(await response.arrayBuffer());
      if (!image.length || image.length > COLLAGE_MAX_THUMBNAIL_BYTES) {
        throw new Error("THUMBNAIL_INVALID");
      }

      const source = sharp(image, { limitInputPixels: 2_000_000, failOn: "none" });
      const metadata = await source.metadata();
      // Los marcadores de ausencia devueltos por YouTube son demasiado pequeños
      // para un collage legible y deben provocar el respaldo de variante.
      if (!metadata.width || !metadata.height || metadata.width < 480 || metadata.height < 270) {
        throw new Error("THUMBNAIL_LOW_RESOLUTION");
      }

      return source
        .resize(COLLAGE_THUMB_WIDTH, COLLAGE_THUMB_HEIGHT, {
          fit: "cover",
          kernel: sharp.kernel.lanczos3,
        })
        .jpeg({ quality: 92, chromaSubsampling: "4:4:4" })
        .toBuffer();
    } catch (error) {
      lastError = error;
      if (signal?.aborted) break;
    }
  }

  throw lastError || new Error("THUMBNAIL_UNAVAILABLE");
}

function truncateCardText(value, maxLength) {
  const text = cleanDisplayText(value) || "Sin título";
  return text.length > maxLength ? `${text.slice(0, Math.max(1, maxLength - 3))}...` : text;
}

function escapePangoText(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

async function renderCollageText(text, { width, height, size, align = "left" }) {
  return sharp({
    text: {
      text: `<span foreground="#f2f5fa">${escapePangoText(text)}</span>`,
      font: `DejaVu Sans ${size}`,
      fontfile: COLLAGE_FONT_FILE,
      width,
      height,
      align,
      rgba: true,
    },
  }).png().toBuffer();
}

async function renderCollageBadge(text, width) {
  const label = await renderCollageText(text, {
    width: width - 12,
    height: 30,
    size: 19,
  });
  return sharp({
    create: {
      width,
      height: 32,
      channels: 4,
      background: { r: 10, g: 11, b: 18, alpha: 0.9 },
    },
  })
    .composite([{ input: label, left: 6, top: 2 }])
    .png()
    .toBuffer();
}

async function createDetailedYtSearchCard(video, index, thumbnail) {
  const title = truncateCardText(video?.title, 48);
  const channel = truncateCardText(video?.author?.name || video?.author || "YouTube", 42);
  const duration = truncateCardText(video?.timestamp || video?.duration?.timestamp || "0:00", 12);
  const detailText = await renderCollageText(`${title}\nCanal: ${channel}`, {
    width: COLLAGE_CARD_WIDTH - 24,
    height: COLLAGE_CARD_TEXT_HEIGHT - 12,
    size: 18,
  });
  const numberBadge = await renderCollageBadge(`#${index + 1}`, 74);
  const durationBadge = await renderCollageBadge(duration, 78);

  return sharp({
    create: {
      width: COLLAGE_CARD_WIDTH,
      height: COLLAGE_CARD_HEIGHT,
      channels: 3,
      background: { r: 18, g: 19, b: 29 },
    },
  })
    .composite([
      { input: thumbnail, left: 0, top: 0 },
      { input: numberBadge, left: 8, top: 8 },
      { input: durationBadge, left: COLLAGE_CARD_WIDTH - 86, top: 8 },
      { input: detailText, left: 12, top: COLLAGE_THUMB_HEIGHT + 8 },
    ])
    .jpeg({ quality: 88, chromaSubsampling: "4:2:0" })
    .toBuffer();
}

async function createCompactYtSearchCollage(videos, query, startIndex = 0) {
  const selectedVideos = videos
    .filter((video) => /^[a-zA-Z0-9_-]{11}$/.test(String(video?.videoId || "")))
    .slice(0, COLLAGE_MAX_VIDEOS);
  // La última página puede tener menos de diez resultados. Mientras haya al
  // menos uno válido, debe conservar su collage en vez de caer a texto.
  if (selectedVideos.length === 0) return null;

  const rows = Math.ceil(selectedVideos.length / COLLAGE_COLUMNS);
  const canvasWidth = COLLAGE_COLUMNS * COLLAGE_CARD_WIDTH + (COLLAGE_COLUMNS + 1) * COLLAGE_GAP;
  const canvasHeight = COLLAGE_HEADER_HEIGHT + COLLAGE_FOOTER_HEIGHT
    + rows * COLLAGE_CARD_HEIGHT + (rows + 2) * COLLAGE_GAP;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), COLLAGE_FETCH_TIMEOUT_MS);

  try {
    const thumbnails = await Promise.all(selectedVideos.map(async (video) => {
      try {
        return await fetchCollageThumbnail(video.videoId, controller.signal);
      } catch {
        return null;
      }
    }));
    // Solo se recurre al listado de texto cuando no se obtuvo ninguna miniatura.
    // Si falla una miniatura aislada, se conserva su tarjeta con fondo neutro y
    // sus datos, evitando que una página completa pierda el collage.
    if (!thumbnails.some(Boolean)) return null;
    const missingThumbnail = await sharp({
      create: {
        width: COLLAGE_THUMB_WIDTH,
        height: COLLAGE_THUMB_HEIGHT,
        channels: 3,
        background: { r: 31, g: 32, b: 46 },
      },
    }).jpeg({ quality: 88 }).toBuffer();

    const cards = await Promise.all(selectedVideos.map((video, index) => (
      createDetailedYtSearchCard(video, startIndex + index, thumbnails[index] || missingThumbnail)
    )));
    const header = await renderCollageText(
      `YOUTUBE SEARCH\nBúsqueda: ${truncateCardText(query, 68)} (${selectedVideos.length} resultados)`,
      { width: canvasWidth - 40, height: 82, size: 28, align: "center" }
    );
    const footer = await renderCollageText(
      "Kurumi Tokisaki Bot - YouTube Search",
      { width: canvasWidth - 40, height: 30, size: 16, align: "center" }
    );
    const composition = [
      { input: header, left: 20, top: 14 },
      { input: footer, left: 20, top: canvasHeight - COLLAGE_FOOTER_HEIGHT + 8 },
    ];

    cards.forEach((card, index) => {
      composition.push({
        input: card,
        left: COLLAGE_GAP + (index % COLLAGE_COLUMNS) * (COLLAGE_CARD_WIDTH + COLLAGE_GAP),
        top: COLLAGE_HEADER_HEIGHT + COLLAGE_GAP
          + Math.floor(index / COLLAGE_COLUMNS) * (COLLAGE_CARD_HEIGHT + COLLAGE_GAP),
      });
    });

    const collage = await sharp({
      create: {
        width: canvasWidth,
        height: canvasHeight,
        channels: 3,
        background: { r: 22, g: 22, b: 34 },
      },
    })
      .composite(composition)
      .jpeg({ quality: 89, chromaSubsampling: "4:4:4" })
      .toBuffer();

    return collage.length <= COLLAGE_MAX_OUTPUT_BYTES ? collage : null;
  } finally {
    clearTimeout(timeout);
  }
}

function cleanDisplayText(str) {
  if (!str) return "";
  return String(str)
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{200B}-\u{200D}\u{FE0F}]/gu, "")
    .replace(/[^\x20-\x7E\u00A0-\u024F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getSafeString(val, fallback = "") {
  if (val === null || val === undefined) return fallback;
  if (typeof val === "string") return val.trim();
  if (typeof val === "number") return String(val).trim();
  if (typeof val === "object") {
    if (typeof val.name === "string") return val.name.trim();
    if (typeof val.text === "string") return val.text.trim();
    if (typeof val.title === "string") return val.title.trim();
    if (typeof val.label === "string") return val.label.trim();
    try {
      const str = String(val);
      if (typeof str === "string" && str !== "[object Object]") return str.trim();
    } catch (e) {}
  }
  return fallback;
}


function extractEmbeddedJson(source, marker, markerIndex = source.indexOf(marker)) {
  if (markerIndex < 0) throw new Error(`YOUTUBE_MARKER_NOT_FOUND:${marker}`);
  const start = source.indexOf("{", markerIndex + marker.length);
  if (start < 0) throw new Error(`YOUTUBE_JSON_NOT_FOUND:${marker}`);

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < source.length; index += 1) {
    const character = source[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') inString = true;
    else if (character === "{") depth += 1;
    else if (character === "}") {
      depth -= 1;
      if (depth === 0) return JSON.parse(source.slice(start, index + 1));
    }
  }
  throw new Error(`YOUTUBE_JSON_INCOMPLETE:${marker}`);
}

function collectYoutubeValues(value, key, output = []) {
  if (!value || typeof value !== "object") return output;
  if (Object.prototype.hasOwnProperty.call(value, key)) output.push(value[key]);
  Object.values(value).forEach((child) => collectYoutubeValues(child, key, output));
  return output;
}

function getYoutubeRunsText(value) {
  if (typeof value?.simpleText === "string") return value.simpleText;
  if (Array.isArray(value?.runs)) return value.runs.map((run) => run?.text || "").join("");
  return "";
}

function normalizeYoutubeRenderer(video) {
  if (!video?.videoId) return null;
  const overlay = Array.isArray(video.thumbnailOverlays)
    ? video.thumbnailOverlays.find((item) => item?.thumbnailOverlayTimeStatusRenderer)?.thumbnailOverlayTimeStatusRenderer
    : null;
  const timestamp = getYoutubeRunsText(video.lengthText)
    || getYoutubeRunsText(overlay?.text)
    || "0:00";
  const channel = getYoutubeRunsText(video.longBylineText)
    || getYoutubeRunsText(video.shortBylineText)
    || getYoutubeRunsText(video.ownerText)
    || "YouTube";
  const description = Array.isArray(video.detailedMetadataSnippets)
    ? video.detailedMetadataSnippets.map((item) => getYoutubeRunsText(item?.snippetText)).filter(Boolean).join(" ")
    : "";

  return {
    videoId: video.videoId,
    url: `https://www.youtube.com/watch?v=${video.videoId}`,
    title: getYoutubeRunsText(video.title) || "Sin título",
    author: { name: channel },
    timestamp,
    description,
  };
}

async function fetchExtendedYouTubeResults(query) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SEARCH_EXTENDED_TIMEOUT_MS);
  const headers = {
    "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/125 Safari/537.36",
    "Accept-Language": "es-ES,es;q=0.9",
  };

  try {
    const pageResponse = await fetch(
      `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`,
      { headers, signal: controller.signal }
    );
    if (!pageResponse.ok) throw new Error(`YOUTUBE_HTML_HTTP_${pageResponse.status}`);

    const html = await pageResponse.text();
    const initialData = extractEmbeddedJson(html, "var ytInitialData =");
    const apiKeyIndex = html.indexOf("INNERTUBE_API_KEY");
    const configMarker = apiKeyIndex >= 0 ? html.lastIndexOf("ytcfg.set(", apiKeyIndex) : -1;
    const config = configMarker >= 0
      ? extractEmbeddedJson(html, "ytcfg.set(", configMarker)
      : null;
    const initialVideos = collectYoutubeValues(initialData, "videoRenderer")
      .map(normalizeYoutubeRenderer)
      .filter(Boolean);

    const continuationToken = collectYoutubeValues(initialData, "continuationCommand")
      .map((command) => command?.token)
      .find(Boolean);
    if (!continuationToken || !config?.INNERTUBE_API_KEY || !config?.INNERTUBE_CONTEXT) {
      return initialVideos.slice(0, SEARCH_MAX_RESULTS);
    }

    const continuationResponse = await fetch(
      `https://www.youtube.com/youtubei/v1/search?key=${encodeURIComponent(config.INNERTUBE_API_KEY)}`,
      {
        method: "POST",
        headers: {
          ...headers,
          "Content-Type": "application/json",
          "X-YouTube-Client-Name": String(config.INNERTUBE_CONTEXT_CLIENT_NAME || 1),
          "X-YouTube-Client-Version": config.INNERTUBE_CONTEXT_CLIENT_VERSION || "2.20250101.00.00",
        },
        signal: controller.signal,
        body: JSON.stringify({ context: config.INNERTUBE_CONTEXT, continuation: continuationToken }),
      }
    );
    if (!continuationResponse.ok) throw new Error(`YOUTUBE_CONTINUATION_HTTP_${continuationResponse.status}`);

    const continuationData = await continuationResponse.json();
    const continuationVideos = collectYoutubeValues(continuationData, "videoRenderer")
      .map(normalizeYoutubeRenderer)
      .filter(Boolean);
    return [...initialVideos, ...continuationVideos].slice(0, SEARCH_MAX_RESULTS);
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchYouTubeFallbackResults(query) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SEARCH_FALLBACK_TIMEOUT_MS);

  try {
    const response = await fetch(
      `https://api.siputzx.my.id/api/s/youtube?query=${encodeURIComponent(query)}`,
      {
        headers: { "User-Agent": "Kurumi-Tokisaki-Bot/5.1" },
        signal: controller.signal,
      }
    );

    if (!response.ok) {
      throw new Error(`YOUTUBE_FALLBACK_HTTP_${response.status}`);
    }

    const data = await response.json();
    return Array.isArray(data?.data) ? data.data : [];
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchYouTubeSearchResults(query) {
  const cached = getCachedSearchResults(query);
  if (cached) return cached;

  const allVideos = [];
  const existingIds = new Set();

  const addVideo = (v) => {
    if (!v) return;
    const rawUrl = String(v.url || v.link || "").trim();
    
    // Strict rejection of playlists, channels, or user profiles
    if (
      rawUrl.includes("list=") ||
      rawUrl.includes("/playlist") ||
      rawUrl.includes("/channel/") ||
      rawUrl.includes("/user/") ||
      rawUrl.includes("/c/") ||
      (v.type && v.type !== "video")
    ) {
      return;
    }

    let vid = v.videoId;
    if (!vid && rawUrl) {
      const match = rawUrl.match(/(?:v=|\/embed\/|\/watch\?v=|\/v\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
      if (match) vid = match[1];
    }

    if (!vid || typeof vid !== "string" || vid.length !== 11) return;
    if (existingIds.has(vid)) return;

    existingIds.add(vid);

    const title = getSafeString(v.title || v.name, "Sin título");
    const author = getSafeString(v.author?.name || v.author || v.channel, "YouTube");
    let timestamp = getSafeString(v.timestamp || v.duration?.timestamp || v.duration, "0:00");
    if (timestamp === "0" || timestamp === "00:00" || timestamp === "0:0") timestamp = "0:00";
    const description = getSafeString(v.description || v.desc, "");

    allVideos.push({
      title,
      url: `https://www.youtube.com/watch?v=${vid}`,
      videoId: vid,
      author: { name: author },
      timestamp,
      description,
    });
  };

  // Se consulta primero la fuente que entrega los metadatos completos de forma
  // directa. No hay peticiones paralelas, miniaturas ni detalles por vídeo.
  let primaryError = null;
  try {
    const fallbackVideos = await fetchYouTubeFallbackResults(query);
    fallbackVideos.forEach(addVideo);
  } catch (error) {
    primaryError = error;
  }

  // Si la fuente rápida entrega menos de cuatro páginas, se usa una sola
  // continuación secuencial de YouTube para alcanzar hasta 40 vídeos distintos.
  // Nunca se consulta en paralelo: así se conserva el límite global de carga.
  let extendedError = null;
  if (allVideos.length < SEARCH_MAX_RESULTS) {
    try {
      const extendedVideos = await fetchExtendedYouTubeResults(query);
      extendedVideos.forEach(addVideo);
    } catch (error) {
      extendedError = error;
    }
  }

  // yt-search queda reservado como último respaldo cuando ninguna fuente devolvió vídeos.
  let backupError = null;
  if (allVideos.length === 0) {
    try {
      const res1 = await withRequestTimeout(yts(query));
      if (res1?.videos && Array.isArray(res1.videos)) res1.videos.forEach(addVideo);
    } catch (error) {
      backupError = error;
    }
  }

  if (allVideos.length === 0 && (primaryError || extendedError || backupError)) {
    console.warn(
      "No hay proveedores disponibles para /ytsearch:",
      primaryError?.message || "sin respuesta principal",
      extendedError?.message || backupError?.message || "sin respuesta de respaldo"
    );
  }

  cacheSearchResults(query, allVideos);
  return allVideos;
}

async function renderYtSearchPage({ conn, m, chatId, query, page = 1, usedPrefix = "/", command = "ytsearch", cachedVideos = null }) {
  let allVideos = Array.isArray(cachedVideos) && cachedVideos.length > 0 ? [...cachedVideos] : null;

  if (!allVideos || !Array.isArray(allVideos) || allVideos.length === 0) {
    allVideos = await fetchYouTubeSearchResults(query);
  }

  if (!allVideos || allVideos.length === 0) {
    return sendYtSearchMessageWithReconnect(conn, chatId, { text: `❌ No se encontraron resultados para "${query}".` }, { quoted: m });
  }

  const shorten = (value, maxLength, fallback = "") => {
    const text = cleanDisplayText(getSafeString(value, "")) || fallback;
    return text.length > maxLength ? `${text.slice(0, maxLength - 3)}...` : text;
  };

  const buildCaption = (videos, pageNumber, pageCount, pageStartIndex) => {
    // Formato de lista de la versión anterior, sin mostrar la duración.
    // El collage moderno se genera y envía por separado más abajo.
    let value = "✦━【 🔍 *RESULTADOS DE YOUTUBE* 】━✦\n\n";
    value += `📌 *Búsqueda:* ${cleanDisplayText(query) || "YouTube"}\n`;
    value += `📖 *Página:* ${pageNumber}/${pageCount} | 📊 *Total resultados:* ${allVideos.length}\n\n`;

    videos.forEach((video, idx) => {
      const globalIndex = pageStartIndex + idx + 1;
      const title = cleanDisplayText(getSafeString(video?.title, "")) || "Sin título";
      const channel = cleanDisplayText(getSafeString(video?.author?.name || video?.author, "")) || "YouTube";
      const rawDescription = cleanDisplayText(getSafeString(video?.description, ""));
      const description = rawDescription
        ? shorten(rawDescription, 80)
        : "Sin descripción";
      const videoId = String(video?.videoId || "").trim();
      const url = typeof video?.url === "string" && video.url.startsWith("http")
        ? video.url
        : (videoId ? `https://youtube.com/watch?v=${videoId}` : "Sin enlace disponible");

      value += `*#${globalIndex}. ${title}*\n`;
      value += `👤 *Canal:* ${channel}\n`;
      value += `📝 *Desc:* ${description}\n`;
      value += `🔗 *Link:* ${url}\n\n`;
    });

    value += "💡 *Responde con un número para descargar.*\n";
    value += "💬 *Navega con:* siguiente, anterior o página X.";
    return value;
  };

  // Mantener exactamente el modelo de la versión anterior: hasta diez
  // resultados por página y solo los restantes en la última. El collage y el
  // caption actuales no se modifican.
  const totalPages = Math.max(1, Math.ceil(allVideos.length / COLLAGE_MAX_VIDEOS));
  const currentPage = Math.max(1, Math.min(page, totalPages));
  const startIndex = (currentPage - 1) * COLLAGE_MAX_VIDEOS;
  const pageVideos = allVideos.slice(startIndex, startIndex + COLLAGE_MAX_VIDEOS);

  if (pageVideos.length === 0) {
    return sendYtSearchMessageWithReconnect(conn, chatId, { text: `❌ No hay resultados en la página ${currentPage}. Total páginas disponibles: ${totalPages}` }, { quoted: m });
  }

  // Cada resultado conserva su enlace directo dentro del mismo caption adjunto.
  const caption = buildCaption(pageVideos, currentPage, totalPages, startIndex);

  // El caption permanece por debajo del límite seguro y viaja adjunto a la
  // misma imagen. Si no hay collage, se mantiene el resultado como texto.
  const collage = await createCompactYtSearchCollage(pageVideos, query, startIndex);

  const sentMsg = await sendYtSearchMessageWithReconnect(
    conn,
    chatId,
    collage ? { image: collage, caption } : { text: caption },
    { quoted: m }
  );

  // Guardar datos completos de la sesión para navegación continua e interacción
  activeSearchSessions.set(chatId, {
    query,
    allVideos,
    currentPage,
    totalPages,
    usedPrefix,
    command,
    msgId: sentMsg?.key?.id,
    timestamp: Date.now()
  });
}

const handler = async (m, { body, conn, usedPrefix, command, args, silentStatus = false }) => {
  if (!body || !body.trim()) {
    return m.reply(
      `✦━【 🔍 *YOUTUBE SEARCH* 】━✦\n\n` +
      `📝 Busca videos en YouTube y muestra los resultados.\n` +
      `💡 Sintaxis: \`${usedPrefix}${command} <búsqueda> [página]\`\n` +
      `📌 Ejemplo: \`${usedPrefix}${command} Nightcore Falling Inside The Black\`\n` +
      `📌 Para ver más resultados: responde "siguiente" al mensaje de búsqueda`
    );
  }

  const chatId = m.chat || m.chatId || m.key?.remoteJid;
  let page = 1;
  let query = body.trim();

  // Verificar si se solicitó un número de página al final de los argumentos
  if (args && args.length > 1) {
    const lastArg = args[args.length - 1];
    if (/^\d+$/.test(lastArg)) {
      const parsedPage = parseInt(lastArg, 10);
      const possibleQuery = args.slice(0, -1).join(" ").trim();
      if (parsedPage >= 1 && possibleQuery.length > 0) {
        page = parsedPage;
        query = possibleQuery;
      }
    }
  }

  if (!query) {
    return m.reply(`❌ Debes especificar un término de búsqueda.`);
  }

  // Revisar si hay una sesión activa con los mismos resultados cargados
  const session = activeSearchSessions.get(chatId);
  let cachedVideos = null;
  if (session && session.query.toLowerCase() === query.toLowerCase() && Array.isArray(session.allVideos) && session.allVideos.length > 0) {
    cachedVideos = session.allVideos;
  }

  if (runningSearchChats.has(chatId)) {
    return sendYtSearchMessageWithReconnect(
      conn,
      chatId,
      { text: "⏳ Ya hay una búsqueda de YouTube en curso en este chat. Espera el resultado antes de iniciar otra." },
      { quoted: m }
    );
  }

  runningSearchChats.add(chatId);
  try {
    if (!silentStatus) {
      await sendYtSearchMessageWithReconnect(conn, chatId, { text: `⏳ *Buscando en YouTube...*` }, { quoted: m });
    }
    await renderYtSearchPage({
      conn,
      m,
      chatId,
      query,
      page,
      usedPrefix,
      command,
      cachedVideos
    });
  } catch (err) {
    console.error("Error en ytsearch:", err.message);
    await sendYtSearchMessageWithReconnect(conn, chatId, { text: `❌ Error al realizar la búsqueda en YouTube: ${err.message}` }, { quoted: m }).catch((notifyError) => console.error("No se pudo notificar el error de /ytsearch:", notifyError.message));
  } finally {
    runningSearchChats.delete(chatId);
  }
};

handler.before = async (m, { conn }) => {
  if (!m.quoted) return false;

  const chatId = m.chat || m.chatId || m.key?.remoteJid;
  const quotedText = m.quoted.text || m.quoted.caption || (
    m.quoted.message?.conversation ||
    m.quoted.message?.extendedTextMessage?.text ||
    m.quoted.message?.imageMessage?.caption ||
    ""
  );

  const isYtSearchResult = /RESULTADOS DE YOUTUBE|YOUTUBE SEARCH/i.test(quotedText);
  if (!isYtSearchResult) return false;

  const rawText = (m.text || "").trim();
  if (!rawText) return false;

  const session = activeSearchSessions.get(chatId);
  let query = session?.query;
  let cachedVideos = session?.allVideos || null;
  let currentPage = session?.currentPage || 1;
  let totalPages = session?.totalPages || 1;
  let usedPrefix = session?.usedPrefix || "/";
  let command = session?.command || "ytsearch";

  if (!query) {
    const queryMatch = quotedText.match(/📌 \*Búsqueda:\* (.*)/i);
    if (queryMatch) {
      query = queryMatch[1].trim();
    }
  }

  if (!query) return false;

  const pageMatch = quotedText.match(/📖 \*Página:\* (\d+)\/(\d+)/i);
  if (pageMatch) {
    currentPage = parseInt(pageMatch[1], 10) || 1;
    totalPages = parseInt(pageMatch[2], 10) || totalPages;
  }

  const textLower = rawText.toLowerCase();

  // 1. Detección de navegación de páginas
  let targetPage = null;

  if (/^(siguiente|sig|next|>|mas|más|paso)$/i.test(textLower)) {
    targetPage = currentPage + 1;
  } else if (/^(anterior|ant|prev|<|atras|atrás)$/i.test(textLower)) {
    targetPage = currentPage - 1;
  } else if (/^(página|pagina|pag|p|page)\s*(\d+)$/i.test(textLower)) {
    const match = textLower.match(/^(página|pagina|pag|p|page)\s*(\d+)$/i);
    if (match) targetPage = parseInt(match[2], 10);
  }

  if (targetPage !== null) {
    if (targetPage < 1) {
      await sendYtSearchMessageWithReconnect(conn, chatId, { text: `⚠️ Ya estás en la primera página.` }, { quoted: m });
      return true;
    }

    if (targetPage > totalPages) {
      await sendYtSearchMessageWithReconnect(conn, chatId, { text: `⚠️ No hay más páginas disponibles. La última página es la ${totalPages}.` }, { quoted: m });
      return true;
    }

    await sendYtSearchMessageWithReconnect(conn, chatId, { text: `⏳ *Cargando página ${targetPage}...*` }, { quoted: m });

    try {
      await renderYtSearchPage({
        conn,
        m,
        chatId,
        query,
        page: targetPage,
        usedPrefix,
        command,
        cachedVideos
      });
    } catch (err) {
      console.error("Error en paginación interactiva de ytsearch:", err.message);
      await sendYtSearchMessageWithReconnect(conn, chatId, { text: `❌ Error al cargar la página ${targetPage}: ${err.message}` }, { quoted: m }).catch((notifyError) => console.error("No se pudo notificar el error de paginación de /ytsearch:", notifyError.message));
    }

    return true;
  }

  // 2. Detección de selección de número / descarga de elemento (ej: "#15", "15", "mp3 15", "mp4 15", "video 15")
  const selectionMatch = textLower.match(/^(?:#|mp3\s*|ytmp3\s*|audio\s*|mp4\s*|ytmp4\s*|video\s*|descargar\s*)?(\d+)(?:\s*(mp3|mp4|audio|video))?$/i);
  if (selectionMatch && cachedVideos && cachedVideos.length > 0) {
    const selectedNum = parseInt(selectionMatch[1], 10);
    if (selectedNum >= 1 && selectedNum <= cachedVideos.length) {
      const selectedVideo = cachedVideos[selectedNum - 1];
      const videoUrl = typeof selectedVideo.url === "string" && selectedVideo.url.startsWith("http")
        ? selectedVideo.url
        : `https://youtube.com/watch?v=${selectedVideo.videoId || ''}`;

      const isVideoFormat = /mp4|video/i.test(textLower) || selectionMatch[2] === "mp4" || selectionMatch[2] === "video";

      if (isVideoFormat) {
        await sendYtSearchMessageWithReconnect(conn, chatId, { text: `⏳ *Descargando video #${selectedNum}:* ${selectedVideo.title}...` }, { quoted: m });
        try {
          await ytmp4Handler(m, { body: videoUrl, conn, usedPrefix, command: "ytmp4", silentStatus: true });
        } catch (e) {
          await sendYtSearchMessageWithReconnect(conn, chatId, { text: `❌ Error al descargar video: ${e.message}` }, { quoted: m }).catch((notifyError) => console.error("No se pudo notificar el error de video:", notifyError.message));
        }
      } else {
        await sendYtSearchMessageWithReconnect(conn, chatId, { text: `⏳ *Descargando audio #${selectedNum}:* ${selectedVideo.title}...` }, { quoted: m });
        try {
          await ytmp3Handler(m, { body: videoUrl, conn, usedPrefix, command: "ytmp3", silentStatus: true });
        } catch (e) {
          await sendYtSearchMessageWithReconnect(conn, chatId, { text: `❌ Error al descargar audio: ${e.message}` }, { quoted: m }).catch((notifyError) => console.error("No se pudo notificar el error de audio:", notifyError.message));
        }
      }
      return true;
    }
  }

  return false;
};

handler.command = /^(ytsearch|yts|ytsr|searchyt|ytbusqueda|ytb)$/i;
handler.description = "Buscar y listar videos de YouTube para explorar, consultar resultados o elegir uno después; no descarga ni entrega audio o video directamente";
handler.category = "descargas";

export default handler;
