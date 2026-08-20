// ============================================================
//   Kurumi Tokisaki - Imagen Search Command
//   Búsqueda relevante sin API ni registro
// ============================================================

import crypto from "node:crypto";
import axios from "axios";
import { fileTypeFromBuffer } from "file-type";

const REQUEST_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "application/json,text/plain,*/*",
};

const IMAGE_TIMEOUT_MS = 8000;
const MAX_RESULTS_TO_SEND = 3;
const MAX_SEARCH_CANDIDATES = 36;
const MIN_IMAGE_BYTES = 2500;
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;

// Las instancias públicas pueden cambiar o limitar el formato JSON; se prueban
// varias y el flujo continúa con DuckDuckGo o las fuentes heredadas si fallan.
const SEARXNG_INSTANCES = [
  "https://searx.oloke.xyz",
  "https://searx.tiekoetter.com",
  "https://searx.linxx.net",
  "https://search.pereira.is",
  "https://paulgo.io",
  "https://searxng.eshnetwork.space",
];

// Evita repetir inmediatamente la misma imagen para la misma búsqueda y chat.
const recentImagesBySearch = new Map();

function isHttpUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function normalizeUrl(value) {
  if (!isHttpUrl(value)) return "";

  try {
    const parsed = new URL(value);
    parsed.hash = "";
    parsed.search = "";
    return parsed.toString().replace(/\/$/, "").toLowerCase();
  } catch {
    return "";
  }
}

function hostFromUrl(value) {
  try {
    return new URL(value).hostname.replace(/^www\./i, "");
  } catch {
    return "fuente desconocida";
  }
}

function cleanText(value, maxLength = 220) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function createCandidate({ imageUrl, pageUrl, title, author, source, referer, provider }) {
  const normalizedImageUrl = normalizeUrl(imageUrl);
  if (!normalizedImageUrl) return null;

  return {
    imageUrl,
    pageUrl: isHttpUrl(pageUrl) ? pageUrl : imageUrl,
    title: cleanText(title),
    author: cleanText(author, 100),
    source: cleanText(source || hostFromUrl(pageUrl || imageUrl), 100),
    referer,
    provider,
    key: normalizedImageUrl,
  };
}

function uniqueCandidates(candidates) {
  const seen = new Set();
  const unique = [];

  for (const candidate of candidates) {
    if (!candidate?.key || seen.has(candidate.key)) continue;
    seen.add(candidate.key);
    unique.push(candidate);
  }

  return unique;
}

async function searchDuckDuckGo(query) {
  try {
    const landing = await axios.get("https://duckduckgo.com/", {
      params: { q: query },
      headers: {
        ...REQUEST_HEADERS,
        Accept: "text/html,application/xhtml+xml",
      },
      timeout: IMAGE_TIMEOUT_MS,
    });

    const landingHtml = String(landing.data || "");
    const tokenMatch = landingHtml.match(/vqd(?:=|['\"]\s*:\s*['\"]?)([0-9-]+)/i);
    const token = tokenMatch?.[1];
    if (!token) return [];

    const response = await axios.get("https://duckduckgo.com/i.js", {
      params: {
        l: "us-en",
        o: "json",
        q: query,
        vqd: token,
        f: ",,,,,,,,",
        p: 1,
      },
      headers: {
        ...REQUEST_HEADERS,
        Referer: `https://duckduckgo.com/?q=${encodeURIComponent(query)}`,
        Accept: "application/json",
      },
      timeout: IMAGE_TIMEOUT_MS,
    });

    const results = Array.isArray(response.data?.results) ? response.data.results : [];
    return results
      .map((item) =>
        createCandidate({
          imageUrl: item.image,
          pageUrl: item.url,
          title: item.title,
          source: hostFromUrl(item.url || item.image),
          provider: "DuckDuckGo",
        }),
      )
      .filter(Boolean)
      .slice(0, MAX_SEARCH_CANDIDATES);
  } catch {
    return [];
  }
}

async function searchSearxInstance(instance, query) {
  try {
    const response = await axios.get(`${instance}/search`, {
      params: {
        q: query,
        categories: "images",
        format: "json",
        language: "es",
        safesearch: 1,
        pageno: 1,
      },
      headers: REQUEST_HEADERS,
      timeout: 6000,
      validateStatus: () => true,
    });

    if (response.status !== 200 || !Array.isArray(response.data?.results)) return [];

    return response.data.results
      .map((item) =>
        createCandidate({
          imageUrl: item.img_src || item.image || item.thumbnail_src,
          pageUrl: item.url || item.source,
          title: item.title,
          source: item.source || hostFromUrl(item.url || item.img_src),
          provider: "SearXNG",
        }),
      )
      .filter(Boolean)
      .slice(0, MAX_SEARCH_CANDIDATES);
  } catch {
    return [];
  }
}

async function searchSearx(query) {
  const responses = await Promise.all(
    SEARXNG_INSTANCES.map((instance) => searchSearxInstance(instance, query)),
  );

  return uniqueCandidates(responses.flat()).slice(0, MAX_SEARCH_CANDIDATES);
}

async function searchLegacySources(query) {
  const sources = [];

  // Pinterest: solo se usa como respaldo porque su HTML puede cambiar.
  try {
    const url = `https://www.pinterest.es/search/pins/?q=${encodeURIComponent(query)}`;
    const response = await axios.get(url, {
      headers: { ...REQUEST_HEADERS, Accept: "text/html,application/xhtml+xml" },
      timeout: IMAGE_TIMEOUT_MS,
    });
    const matches = [
      ...String(response.data || "").matchAll(
        /(https:\/\/i\.pinimg\.com\/(?:736x|originals|564x|474x)\/[a-f0-9\/]+\.(?:jpg|png|jpeg|webp))/gi,
      ),
    ];

    for (const match of matches.slice(0, 12)) {
      const candidate = createCandidate({
        imageUrl: match[1],
        pageUrl: url,
        source: "pinterest.es",
        provider: "Pinterest",
      });
      if (candidate) sources.push(candidate);
    }
  } catch {}

  // Pixiv: aporta ilustraciones y metadatos cuando su endpoint es accesible.
  try {
    const url = `https://www.pixiv.net/ajax/search/artworks/${encodeURIComponent(query)}?word=${encodeURIComponent(query)}&order=date_d&mode=all&p=1&s_mode=s_tag&type=all&lang=es`;
    const response = await axios.get(url, {
      headers: {
        ...REQUEST_HEADERS,
        Referer: "https://www.pixiv.net/",
      },
      timeout: IMAGE_TIMEOUT_MS,
    });
    const illusts = response.data?.body?.illustManga?.data || [];

    for (const item of illusts.slice(0, 12)) {
      const imageUrl =
        item.url?.replace("c/240x480/custom-thumb", "c/600x1200_90/img-master") || item.url;
      const candidate = createCandidate({
        imageUrl,
        pageUrl: item.id ? `https://www.pixiv.net/artworks/${item.id}` : "https://www.pixiv.net/",
        title: item.title,
        author: item.userName,
        source: "pixiv.net",
        referer: "https://www.pixiv.net/",
        provider: "Pixiv",
      });
      if (candidate) sources.push(candidate);
    }
  } catch {}

  // Unsplash queda como respaldo para búsquedas fotográficas generales.
  try {
    const url = `https://unsplash.com/napi/search/photos?query=${encodeURIComponent(query)}&per_page=12`;
    const response = await axios.get(url, {
      headers: REQUEST_HEADERS,
      timeout: IMAGE_TIMEOUT_MS,
    });
    const results = response.data?.results || [];

    for (const item of results) {
      const candidate = createCandidate({
        imageUrl: item.urls?.regular,
        pageUrl: item.links?.html,
        title: item.alt_description || item.description,
        author: item.user?.name,
        source: "unsplash.com",
        provider: "Unsplash",
      });
      if (candidate) sources.push(candidate);
    }
  } catch {}

  return uniqueCandidates(sources).slice(0, MAX_SEARCH_CANDIDATES);
}

async function searchImages(query) {
  // DuckDuckGo fue el proveedor público que devolvió resultados utilizables en
  // las pruebas; SearXNG y las fuentes actuales quedan como respaldo.
  const duckCandidates = await searchDuckDuckGo(query);
  if (duckCandidates.length >= MAX_RESULTS_TO_SEND) return duckCandidates;

  const searxCandidates = await searchSearx(query);
  const combined = uniqueCandidates([...duckCandidates, ...searxCandidates]);
  if (combined.length >= MAX_RESULTS_TO_SEND) return combined;

  const legacyCandidates = await searchLegacySources(query);
  return uniqueCandidates([...combined, ...legacyCandidates]);
}

async function downloadImage(candidate) {
  const headers = { ...REQUEST_HEADERS };
  if (candidate.referer) headers.Referer = candidate.referer;

  const response = await axios.get(candidate.imageUrl, {
    responseType: "arraybuffer",
    headers,
    timeout: IMAGE_TIMEOUT_MS,
    maxContentLength: MAX_IMAGE_BYTES,
    maxBodyLength: MAX_IMAGE_BYTES,
    validateStatus: (status) => status >= 200 && status < 300,
  });

  const buffer = Buffer.from(response.data || []);
  if (buffer.length < MIN_IMAGE_BYTES || buffer.length > MAX_IMAGE_BYTES) return null;

  const detected = await fileTypeFromBuffer(buffer);
  const responseMime = String(response.headers["content-type"] || "").split(";")[0].toLowerCase();
  const mime = detected?.mime || responseMime;
  if (!mime.startsWith("image/")) return null;

  const supportedMime = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
  if (!supportedMime.has(mime)) return null;

  const hash = crypto.createHash("sha256").update(buffer).digest("hex");
  return { buffer, mime, hash };
}

function getHistoryKey(message, query) {
  return `${message.chatId || message.chat || "unknown"}:${query.toLowerCase()}`;
}

function getRecentSet(historyKey) {
  const now = Date.now();
  const existing = recentImagesBySearch.get(historyKey);
  if (existing && now - existing.updatedAt < 6 * 60 * 60 * 1000) return existing.urls;

  const urls = new Set();
  recentImagesBySearch.set(historyKey, { urls, updatedAt: now });
  if (recentImagesBySearch.size > 200) {
    const oldestKey = recentImagesBySearch.keys().next().value;
    recentImagesBySearch.delete(oldestKey);
  }
  return urls;
}

function captionFor(query, candidate, index, total) {
  const lines = [
    `✦━【 🖼️ *IMAGEN: ${query.toUpperCase()}* 】━✦`,
    "",
    `🖼️ Resultado ${index} de ${total}`,
  ];

  if (candidate.title) lines.push(`📝 *Título:* ${candidate.title}`);
  if (candidate.author) lines.push(`👤 *Autor:* ${candidate.author}`);
  lines.push(`🔎 *Fuente:* ${candidate.source}`);
  if (candidate.pageUrl) lines.push(`🔗 ${candidate.pageUrl}`);

  return lines.join("\n");
}

const handler = async (m, { body, conn, usedPrefix }) => {
  const query = String(body || "").trim();
  if (!query) {
    return m.reply(
      `✦━【 🖼️ *IMAGEN* 】━✦\n\n` +
        `📝 Busca imágenes relevantes en internet.\n` +
        `💡 Sintaxis: \`${usedPrefix}imagen <búsqueda>\`\n` +
        `📌 Ejemplo: \`${usedPrefix}imagen Rem wallpapers\``,
    );
  }

  const candidates = await searchImages(query);
  if (candidates.length === 0) {
    return m.reply(`❌ No se encontraron imágenes relevantes para "${query}".`);
  }

  const historyKey = getHistoryKey(m, query);
  const recentSet = getRecentSet(historyKey);
  const freshCandidates = candidates.filter((candidate) => !recentSet.has(candidate.key));
  const candidatesToTry = (freshCandidates.length >= MAX_RESULTS_TO_SEND ? freshCandidates : candidates).slice(
    0,
    MAX_SEARCH_CANDIDATES,
  );

  const downloaded = [];
  for (const candidate of candidatesToTry) {
    try {
      const image = await downloadImage(candidate);
      if (!image) continue;
      if (recentSet.has(image.hash) || downloaded.some((item) => item.hash === image.hash)) continue;
      downloaded.push({ candidate, ...image });
      if (downloaded.length >= MAX_RESULTS_TO_SEND) break;
    } catch {}
  }

  if (downloaded.length === 0) {
    return m.reply(`❌ Se encontraron resultados, pero ninguna imagen pudo descargarse correctamente.`);
  }

  const total = downloaded.length;
  for (let index = 0; index < downloaded.length; index += 1) {
    const item = downloaded[index];
    await conn.sendMessage(
      m.chatId,
      {
        image: item.buffer,
        mimetype: item.mime,
        caption: captionFor(query, item.candidate, index + 1, total),
      },
      { quoted: m },
    );
    recentSet.add(item.candidate.key);
    recentSet.add(item.hash);
  }

  const history = recentImagesBySearch.get(historyKey);
  if (history) history.updatedAt = Date.now();
};

handler.command = /^(imagen|image|img|foto|photo)$/i;
handler.description = "Buscar imágenes relevantes sin API";
handler.category = "busqueda";
handler.cooldown = 5;

export default handler;
