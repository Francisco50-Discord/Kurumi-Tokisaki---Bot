// ============================================================
//   Kurumi Tokisaki - MediaFire Downloader Command
//   Resolver directo + proveedores externos de respaldo
// ============================================================

import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { rm, readFile, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import axios from "axios";

const execFileAsync = promisify(execFile);

const MEDIAFIRE_HOST_RE = /(^|\.)mediafire\.com$/i;
const DIRECT_HOST_RE = /^download\d*\.mediafire\.com$/i;
const REQUEST_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/json,*/*;q=0.8"
};

// WhatsApp admite documentos grandes, pero el bot impone un límite explícito
// para evitar consumir memoria o almacenamiento sin control.
const MAX_FILE_SIZE_BYTES = 200 * 1024 * 1024;
const MAX_FILE_SIZE_MB = 200;
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
  const patterns = [
    /Download\s*\(\s*([\d.,]+\s*(?:B|KB|MB|GB|TB))\s*\)/i,
    /(?:file\s*size|size)[^\d]{0,40}([\d.,]+\s*(?:B|KB|MB|GB|TB))/i
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return fallback;
}

function parseSizeToBytes(value) {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) return value;

  const match = String(value || "").match(/([\d.,]+)\s*(B|KB|MB|GB|TB)/i);
  if (!match) return null;

  const rawNumber = match[1].replace(/\s/g, "");
  const numericText = rawNumber.includes(".") && rawNumber.includes(",")
    ? rawNumber.replace(/,/g, "")
    : rawNumber.includes(",")
      ? rawNumber.replace(/,/g, ".")
      : rawNumber;
  const numericValue = Number(numericText);
  if (!Number.isFinite(numericValue)) return null;

  const unitIndex = ["B", "KB", "MB", "GB", "TB"].indexOf(match[2].toUpperCase());
  return unitIndex < 0 ? null : Math.round(numericValue * (1024 ** unitIndex));
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

async function fetchMediafirePage(pageUrl) {
  try {
    const { stdout } = await execFileAsync(
      "curl",
      [
        "--location",
        "--fail",
        "--silent",
        "--show-error",
        "--max-time",
        "30",
        "-A",
        REQUEST_HEADERS["User-Agent"],
        pageUrl
      ],
      { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 }
    );
    return stdout;
  } catch (curlError) {
    try {
      const response = await axios.get(pageUrl, {
        headers: REQUEST_HEADERS,
        timeout: 15000,
        maxRedirects: 5,
        validateStatus: () => true
      });

      if (response.status >= 400) {
        throw new Error(`MediaFire respondió HTTP ${response.status}.`);
      }

      return typeof response.data === "string" ? response.data : "";
    } catch {
      throw curlError;
    }
  }
}

async function resolveFromPage(pageUrl) {
  const html = await fetchMediafirePage(pageUrl);
  const downloadUrl = extractDirectUrl(html, pageUrl);
  if (!downloadUrl) throw new Error("La página no contiene un enlace directo de descarga.");

  const fileSize = extractFileSize(html);
  const fileSizeBytes = parseSizeToBytes(fileSize);

  return {
    downloadUrl,
    fileName: extractFileName(html),
    fileSize,
    fileSizeBytes
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
  const fileSize = data.filesize || data.size || "Desconocido";
  return {
    downloadUrl,
    fileName: cleanFilename(data.filename || data.name || data.nama),
    fileSize,
    fileSizeBytes: parseSizeToBytes(fileSize)
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
  const fileSize = data.filesize || data.size || "Desconocido";
  return {
    downloadUrl,
    fileName: cleanFilename(data.filename || data.name),
    fileSize,
    fileSizeBytes: parseSizeToBytes(fileSize)
  };
}

async function resolveDownloadCandidates(pageUrl) {
  const providers = [
    () => resolveFromPage(pageUrl),
    () => resolveFromAgatz(pageUrl),
    () => resolveFromSiputzx(pageUrl)
  ];

  const results = await Promise.allSettled(providers.map((provider) => provider()));
  return results
    .filter((result) => result.status === "fulfilled")
    .map((result) => result.value)
    .filter((result) => result?.downloadUrl);
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

function parseCurlHeaders(rawHeaders) {
  const blocks = String(rawHeaders || "")
    .split(/\r?\n\r?\n/)
    .filter((block) => /^HTTP\/\d(?:\.\d)?\s+\d+/im.test(block));
  const lastBlock = blocks.at(-1) || "";
  const headers = {};

  for (const line of lastBlock.split(/\r?\n/).slice(1)) {
    const separator = line.indexOf(":");
    if (separator <= 0) continue;
    headers[line.slice(0, separator).trim().toLowerCase()] = line.slice(separator + 1).trim();
  }
  return headers;
}

async function downloadWithCurl(downloadUrl) {
  const prefix = path.join(os.tmpdir(), `mediafire-${randomUUID()}`);
  const dataPath = `${prefix}.data`;
  const headersPath = `${prefix}.headers`;

  try {
    try {
      await execFileAsync(
        "curl",
        [
          "--location",
          "--ipv4",
          "--fail",
          "--silent",
          "--show-error",
          "--max-time",
          String(Math.ceil(DOWNLOAD_TIMEOUT_MS / 1000)),
          "--max-filesize",
          String(MAX_FILE_SIZE_BYTES),
          "-A",
          REQUEST_HEADERS["User-Agent"],
          "-D",
          headersPath,
          "--output",
          dataPath,
          downloadUrl
        ],
        { encoding: "utf8", maxBuffer: 2 * 1024 * 1024 }
      );
    } catch (error) {
      if (error?.code === 63 || /maximum file size/i.test(error?.stderr || "")) {
        throw createFileTooLargeError();
      }
      throw error;
    }

    const fileStat = await stat(dataPath);
    if (fileStat.size > MAX_FILE_SIZE_BYTES) {
      throw createFileTooLargeError(fileStat.size);
    }

    return {
      status: 200,
      headers: parseCurlHeaders(await readFile(headersPath, "utf8")),
      buffer: await readFile(dataPath)
    };
  } finally {
    await rm(dataPath, { force: true }).catch(() => {});
    await rm(headersPath, { force: true }).catch(() => {});
  }
}

async function downloadWithAxios(downloadUrl) {
  const response = await axios.get(downloadUrl, {
    responseType: "arraybuffer",
    headers: { ...REQUEST_HEADERS, Accept: "*/*" },
    timeout: DOWNLOAD_TIMEOUT_MS,
    maxRedirects: 8,
    maxContentLength: MAX_FILE_SIZE_BYTES,
    maxBodyLength: MAX_FILE_SIZE_BYTES,
    validateStatus: () => true
  });

  return {
    status: response.status,
    headers: response.headers,
    buffer: Buffer.from(response.data)
  };
}

async function downloadFile(downloadUrl, fileName) {
  let currentUrl = downloadUrl;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    let response;
    try {
      response = await downloadWithCurl(currentUrl);
    } catch (curlError) {
      if (curlError?.code === "MEDIAFIRE_FILE_TOO_LARGE") throw curlError;
      response = await downloadWithAxios(currentUrl);
    }

    if (response.status >= 400) {
      throw new Error(`MediaFire respondió HTTP ${response.status} al descargar.`);
    }

    if (response.buffer.length > MAX_FILE_SIZE_BYTES) {
      throw createFileTooLargeError(response.buffer.length);
    }

    if (looksLikeHtml(response, response.buffer)) {
      const html = response.buffer.toString("utf8");
      const nextUrl = extractDirectUrl(html, currentUrl);
      if (!nextUrl) throw new Error("MediaFire devolvió una página HTML en lugar del archivo.");
      currentUrl = nextUrl;
      continue;
    }

    const mimeType = String(response.headers?.["content-type"] || "application/octet-stream").split(";")[0];
    return {
      buffer: response.buffer,
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

  const providerResults = await resolveDownloadCandidates(url);
  if (!providerResults.length) {
    return m.reply(
      `❌ No se pudo obtener el archivo de MediaFire.\n` +
      `Verifica que el enlace sea público, esté completo y todavía exista.`
    );
  }

  const announcedTooLarge = providerResults.find(
    (candidate) => Number.isFinite(candidate.fileSizeBytes) && candidate.fileSizeBytes > MAX_FILE_SIZE_BYTES
  );
  if (announcedTooLarge) {
    return m.reply(`❌ El archivo supera el límite permitido de ${MAX_FILE_SIZE_MB} MB.`);
  }

  try {
    let downloaded = null;
    let providerResult = null;
    let lastError = null;

    for (const candidate of providerResults) {
      try {
        downloaded = await downloadFile(
          candidate.downloadUrl,
          cleanFilename(candidate.fileName)
        );
        providerResult = candidate;
        break;
      } catch (error) {
        lastError = error;
        if (error?.code === "MEDIAFIRE_FILE_TOO_LARGE") throw error;
      }
    }

    if (!downloaded || !providerResult) {
      throw lastError || new Error("No se pudo completar la descarga directa de MediaFire.");
    }

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
