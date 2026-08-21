// ============================================================
//   Kurumi Tokisaki - MediaFire Downloader Command
//   Resolver directo + proveedores externos de respaldo
// ============================================================

import axios from "axios";

const MEDIAFIRE_HOST_RE = /(^|\.)mediafire\.com$/i;
const DIRECT_HOST_RE = /^download\d*\.mediafire\.com$/i;
const REQUEST_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/json,*/*;q=0.8"
};

// WhatsApp admite documentos grandes, pero el bot impone un límite explícito
// para evitar consumir memoria o almacenamiento sin control.
const MAX_FILE_SIZE_BYTES = 600 * 1024 * 1024;
const MAX_FILE_SIZE_MB = 600;
const DOWNLOAD_TIMEOUT_MS = 15 * 60 * 1000;

function decodeHtml(value = "") {
  return String(value)
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\\u002F/gi, "/")
    .replace(/\\\//g, "/");
}

function cleanFilename(value, fallback = "archivo_mediafire") {
  const cleaned = decodeHtml(value)
    .replace(/<[^>]+>/g, "")
    .replace(/[\\/:*?"<>|\x00-\x1F]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || fallback;
}

function isMediafireUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function normalizeMediafireUrl(raw) {
  const match = String(raw || "").match(/https?:\/\/[^\s<>'"]+/i);
  if (!match) return null;

  const candidate = match[0].replace(/[),.;!?]+$/g, "");
  if (!isMediafireUrl(candidate)) return null;

  const parsed = new URL(candidate);
  if (!MEDIAFIRE_HOST_RE.test(parsed.hostname)) return null;
  return parsed.toString();
}

function isDirectDownloadUrl(value) {
  try {
    const parsed = new URL(value);
    return (parsed.protocol === "http:" || parsed.protocol === "https:") && DIRECT_HOST_RE.test(parsed.hostname);
  } catch {
    return false;
  }
}

function toAbsoluteUrl(value, baseUrl) {
  try {
    const decoded = decodeHtml(String(value || "").trim());
    const absolute = new URL(decoded, baseUrl);
    return isDirectDownloadUrl(absolute.toString()) ? absolute.toString() : null;
  } catch {
    return null;
  }
}

function extractDirectUrl(html, pageUrl) {
  const normalizedHtml = decodeHtml(html);
  const candidates = [];

  for (const match of normalizedHtml.matchAll(/(?:href|data-href|data-download-url|data-s3-url)=["']([^"']+)["']/gi)) {
    candidates.push(match[1]);
  }

  for (const match of normalizedHtml.matchAll(/(?:https?:)?\/\/download\d*\.mediafire\.com\/[^\s"'<>\\]+/gi)) {
    candidates.push(match[0]);
  }

  return candidates.map((candidate) => toAbsoluteUrl(candidate, pageUrl)).find(Boolean) || null;
}

function extractFileName(html, fallback = "archivo_mediafire") {
  const patterns = [
    /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i,
    /class=["'][^"']*filename[^"']*["'][^>]*>([^<]+)/i,
    /class=["'][^"']*dl-btn-label[^"']*["'][^>]*>([^<]+)/i,
    /<title[^>]*>([^<]+)/i
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return cleanFilename(match[1], fallback);
  }
  return fallback;
}

function extractFileSize(html, fallback = "Desconocido") {
  const match = html.match(/(?:file\s*size|size)[^\d]{0,40}([\d.,]+\s*(?:B|KB|MB|GB|TB))/i);
  return match?.[1]?.trim() || fallback;
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return "Desconocido";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes;
  let unitIndex = -1;
  do {
    value /= 1024;
    unitIndex += 1;
  } while (value >= 1024 && unitIndex < units.length - 1);
  return `${value.toFixed(value >= 100 ? 0 : 2)} ${units[unitIndex]}`;
}

function createFileTooLargeError(bytes) {
  const error = new Error(
    `El archivo supera el límite de ${MAX_FILE_SIZE_MB} MB${
      Number.isFinite(bytes) ? ` (${formatBytes(bytes)})` : ""
    }.`
  );
  error.code = "MEDIAFIRE_FILE_TOO_LARGE";
  return error;
}

function getContentLength(headers) {
  const value = Number(headers?.["content-length"] || headers?.["Content-Length"]);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

async function resolveFromPage(pageUrl) {
  const response = await axios.get(pageUrl, {
    headers: REQUEST_HEADERS,
    timeout: 15000,
    maxRedirects: 5,
    validateStatus: () => true
  });

  if (response.status >= 400) {
    throw new Error(`MediaFire respondió HTTP ${response.status}.`);
  }

  const html = typeof response.data === "string" ? response.data : "";
  const downloadUrl = extractDirectUrl(html, pageUrl);
  if (!downloadUrl) throw new Error("La página no contiene un enlace directo de descarga.");

  return {
    downloadUrl,
    fileName: extractFileName(html),
    fileSize: extractFileSize(html)
  };
}

function getProviderData(payload) {
  if (!payload) return null;
  if (typeof payload === "string") {
    try {
      return getProviderData(JSON.parse(payload));
    } catch {
      return null;
    }
  }
  return payload.data || payload.result || payload;
}

function getProviderUrl(data) {
  if (!data || typeof data !== "object") return null;
  const candidate = data.link || data.url || data.download || data.downloadUrl;
  return isDirectDownloadUrl(candidate) ? candidate : null;
}

async function resolveFromAgatz(pageUrl) {
  const response = await axios.get(`https://api.agatz.xyz/api/mediafire?url=${encodeURIComponent(pageUrl)}`, {
    headers: REQUEST_HEADERS,
    timeout: 12000,
    validateStatus: () => true
  });
  if (response.status >= 400) throw new Error(`Agatz respondió HTTP ${response.status}.`);
  const data = getProviderData(response.data);
  const downloadUrl = getProviderUrl(data);
  if (!downloadUrl) throw new Error("Agatz no devolvió un enlace directo.");
  return {
    downloadUrl,
    fileName: cleanFilename(data.filename || data.name || data.nama),
    fileSize: data.filesize || data.size || "Desconocido"
  };
}

async function resolveFromSiputzx(pageUrl) {
  const response = await axios.get(`https://api.siputzx.my.id/api/d/mediafire?url=${encodeURIComponent(pageUrl)}`, {
    headers: REQUEST_HEADERS,
    timeout: 12000,
    validateStatus: () => true
  });
  if (response.status >= 400) throw new Error(`Siputzx respondió HTTP ${response.status}.`);
  const data = getProviderData(response.data);
  const downloadUrl = getProviderUrl(data);
  if (!downloadUrl) throw new Error("Siputzx no devolvió un enlace directo.");
  return {
    downloadUrl,
    fileName: cleanFilename(data.filename || data.name),
    fileSize: data.filesize || data.size || "Desconocido"
  };
}

async function resolveDownload(pageUrl) {
  const providers = [
    () => resolveFromPage(pageUrl),
    () => resolveFromAgatz(pageUrl),
    () => resolveFromSiputzx(pageUrl)
  ];

  try {
    return await Promise.any(providers.map((provider) => provider()));
  } catch {
    return null;
  }
}

function looksLikeHtml(response, buffer) {
  const contentType = String(response.headers?.["content-type"] || "").toLowerCase();
  if (contentType.includes("text/html") || contentType.includes("application/xhtml")) return true;
  const prefix = buffer.subarray(0, 300).toString("utf8").trim().toLowerCase();
  return prefix.startsWith("<!doctype html") || prefix.startsWith("<html") || prefix.startsWith("<head");
}

function filenameFromHeaders(response, fallback) {
  const header = response.headers?.["content-disposition"] || "";
  const match = header.match(/filename\*?=(?:UTF-8''|utf-8'')?['"]?([^;'"\r\n]+)['"]?/i);
  if (!match?.[1]) return fallback;
  try {
    return cleanFilename(decodeURIComponent(match[1]), fallback);
  } catch {
    return cleanFilename(match[1], fallback);
  }
}

async function downloadFile(downloadUrl, fileName) {
  let currentUrl = downloadUrl;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    // La consulta HEAD evita iniciar una descarga completa si el servidor ya
    // anuncia un tamaño por encima del límite permitido.
    try {
      const headResponse = await axios.head(currentUrl, {
        headers: { ...REQUEST_HEADERS, Accept: "*/*" },
        timeout: 20000,
        maxRedirects: 8,
        validateStatus: () => true
      });
      if (headResponse.status < 400) {
        const announcedSize = getContentLength(headResponse.headers);
        if (announcedSize !== null && announcedSize > MAX_FILE_SIZE_BYTES) {
          throw createFileTooLargeError(announcedSize);
        }
      }
    } catch (error) {
      if (error?.code === "MEDIAFIRE_FILE_TOO_LARGE") throw error;
      // Algunos CDN no soportan HEAD. En ese caso la descarga GET continúa
      // protegida por maxContentLength y por la comprobación de la respuesta.
    }

    const response = await axios.get(currentUrl, {
      responseType: "arraybuffer",
      headers: { ...REQUEST_HEADERS, Accept: "*/*" },
      timeout: DOWNLOAD_TIMEOUT_MS,
      maxRedirects: 8,
      maxContentLength: MAX_FILE_SIZE_BYTES,
      maxBodyLength: MAX_FILE_SIZE_BYTES,
      validateStatus: () => true
    });

    if (response.status >= 400) throw new Error(`MediaFire respondió HTTP ${response.status} al descargar.`);

    const announcedSize = getContentLength(response.headers);
    if (announcedSize !== null && announcedSize > MAX_FILE_SIZE_BYTES) {
      throw createFileTooLargeError(announcedSize);
    }

    const buffer = Buffer.from(response.data);
    if (buffer.length > MAX_FILE_SIZE_BYTES) {
      throw createFileTooLargeError(buffer.length);
    }

    if (looksLikeHtml(response, buffer)) {
      const html = buffer.toString("utf8");
      const nextUrl = extractDirectUrl(html, currentUrl);
      if (!nextUrl) throw new Error("MediaFire devolvió una página HTML en lugar del archivo.");
      currentUrl = nextUrl;
      continue;
    }

    const mimeType = String(response.headers?.["content-type"] || "application/octet-stream").split(";")[0];
    return {
      buffer,
      mimeType: mimeType || "application/octet-stream",
      fileName: filenameFromHeaders(response, fileName)
    };
  }

  throw new Error("No se pudo resolver la descarga directa de MediaFire.");
}

const handler = async (m, { body, conn, usedPrefix, command }) => {
  if (!body || !body.trim()) {
    return m.reply(
      `✦━【 📂 *MEDIAFIRE DOWNLOADER* 】━✦\n\n` +
      `📝 Descarga archivos directos de MediaFire de hasta ${MAX_FILE_SIZE_MB} MB.\n` +
      `💡 Sintaxis: \`${usedPrefix}${command} <url>\`\n` +
      `📌 Ejemplo: \`${usedPrefix}${command} https://www.mediafire.com/file/ID/nombre-del-archivo.zip/file\``
    );
  }

  const url = normalizeMediafireUrl(body.trim());
  if (!url) {
    return m.reply(
      `❌ Proporciona un enlace completo de MediaFire.\n\n` +
      `Ejemplo: \`${usedPrefix}${command} https://www.mediafire.com/file/ID/nombre-del-archivo.zip/file\``
    );
  }

  await m.reply(`⏳ *Procesando archivo de MediaFire...*`);

  const providerResult = await resolveDownload(url);
  if (!providerResult?.downloadUrl) {
    return m.reply(
      `❌ No se pudo obtener el archivo de MediaFire.\n` +
      `Verifica que el enlace sea público, esté completo y todavía exista.`
    );
  }

  try {
    const downloaded = await downloadFile(
      providerResult.downloadUrl,
      cleanFilename(providerResult.fileName)
    );
    const fileName = downloaded.fileName || cleanFilename(providerResult.fileName);
    const fileSize = formatBytes(downloaded.buffer.length) || providerResult.fileSize || "Desconocido";
    const caption =
      `✦━【 📂 *MEDIAFIRE DOWNLOADER* 】━✦\n\n` +
      `📝 *Nombre:* ${fileName}\n` +
      `📊 *Tamaño:* ${fileSize}\n\n` +
      `✨ *Kurumi Tokisaki*`;

    await conn.sendMessage(
      m.chatId,
      {
        document: downloaded.buffer,
        fileName,
        mimetype: downloaded.mimeType,
        caption
      },
      { quoted: m }
    );
  } catch (err) {
    console.error("Error en MediaFire downloader:", err.message);
    if (err?.code === "MEDIAFIRE_FILE_TOO_LARGE") {
      return m.reply(`❌ El archivo supera el límite permitido de ${MAX_FILE_SIZE_MB} MB.`);
    }
    await m.reply(`❌ Error al descargar el archivo de MediaFire: ${err.message}`);
  }
};

handler.command = /^(mediafire|mf|mfdl|mediafiredl)$/i;
handler.description = "Descargar archivos de MediaFire";
handler.category = "descargas";

export default handler;
