// ============================================================
//   Kurumi Tokisaki - YouTube MP4 Downloader Command
//   Loader.to + FFmpeg · Duración + Seek + Thumbnail Real
// ============================================================

import axios from "axios";
import yts from "yt-search";
import { execSync, spawn } from "child_process";
import fs from "fs";
import path from "path";

const LOADER_TO_VIDEO_QUALITIES = [480, 360];
const LOADER_TO_MAX_WAIT_MS = 45000;
const LOADER_TO_POLL_DELAY_MS = 700;
const LOADER_TO_STAGGER_MS = 800;
const LOADER_TO_READY_GRACE_MS = 2500;
const LOADER_TO_MIN_READY_RESULTS = 2;
const LOADER_TO_SINGLE_RESULT_MAX_WAIT_MS = 8000;
const LOADER_TO_COMPLETED_NO_URL_CHECKS = 18;
const LOADER_TO_HEADERS = {
  Accept: "application/json",
  Origin: "https://loader.to",
  Referer: "https://loader.to/",
  "User-Agent": "Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 Chrome/122.0 Safari/537.36"
};

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function normalizeLoaderUrl(value, fallbackUrl) {
  if (typeof value !== "string" || !value.trim()) return fallbackUrl;
  const normalized = value.trim().replaceAll("\\/", "/");
  return /^https?:\/\//i.test(normalized) ? normalized : fallbackUrl;
}

function isLoaderFailure(data) {
  const message = String(data?.message || data?.text || data?.status || "");
  return data?.error === true || /(?:failed|unavailable|invalid|not found|error)/i.test(message);
}

function getLoaderDownloadUrl(data) {
  const candidates = [
    data?.download_url,
    data?.downloadUrl,
    data?.url,
    data?.link,
    data?.result?.download_url,
    data?.result?.downloadUrl,
    data?.result?.url
  ];

  return candidates.find((value) => typeof value === "string" && /^https?:\/\//i.test(value)) || null;
}

async function startLoaderJob(videoUrl, quality) {
  const initRes = await axios.get("https://loader.to/ajax/download.php", {
    params: { url: videoUrl, format: quality },
    timeout: 15000,
    headers: LOADER_TO_HEADERS
  });

  const init = initRes.data || {};
  if (!init.id || isLoaderFailure(init)) return null;

  return {
    quality,
    progressUrl: normalizeLoaderUrl(
      init.progress_url,
      `https://loader.to/ajax/progress.php?id=${encodeURIComponent(init.id)}`
    ),
    title: typeof init.info?.title === "string" ? init.info.title : null,
    thumbnailUrl: init.thumbnail_url || init.info?.image || null,
    lastProgress: null,
    completedWithoutUrlChecks: 0
  };
}

async function getLoaderToVideoResults(videoUrl) {
  const startedAt = Date.now();
  const jobs = new Map();
  const startingJobs = new Map();
  const readyResults = new Map();
  const failedQualities = new Set();
  let nextQualityIndex = 0;
  let nextLaunchAt = startedAt;
  let firstReadyAt = null;

  const launchNextQuality = () => {
    const quality = LOADER_TO_VIDEO_QUALITIES[nextQualityIndex];
    nextQualityIndex += 1;
    console.info(`[YTMP4][Loader.to] Solicitando ${quality}p.`);

    const startPromise = startLoaderJob(videoUrl, quality)
      .then((job) => {
        startingJobs.delete(quality);
        if (job) {
          jobs.set(quality, job);
        } else {
          failedQualities.add(quality);
          console.warn(`[YTMP4][Loader.to] ${quality}p no inició una conversión válida.`);
        }
      })
      .catch((error) => {
        startingJobs.delete(quality);
        failedQualities.add(quality);
        console.warn(`[YTMP4][Loader.to] ${quality}p falló al iniciar: ${error.message}`);
      });

    startingJobs.set(quality, startPromise);
  };

  while (Date.now() - startedAt < LOADER_TO_MAX_WAIT_MS) {
    while (
      nextQualityIndex < LOADER_TO_VIDEO_QUALITIES.length &&
      Date.now() >= nextLaunchAt
    ) {
      launchNextQuality();
      nextLaunchAt = Date.now() + LOADER_TO_STAGGER_MS;
    }

    const readyElapsed = firstReadyAt ? Date.now() - firstReadyAt : 0;
    const enoughReadyResults = readyResults.size >= LOADER_TO_MIN_READY_RESULTS;
    const highestQuality = LOADER_TO_VIDEO_QUALITIES[0];
    const highestQualityPending =
      jobs.has(highestQuality) || startingJobs.has(highestQuality);
    const allQualitiesSettled =
      jobs.size === 0 &&
      startingJobs.size === 0 &&
      nextQualityIndex >= LOADER_TO_VIDEO_QUALITIES.length;

    if (
      firstReadyAt &&
      (
        (!highestQualityPending && enoughReadyResults && readyElapsed >= LOADER_TO_READY_GRACE_MS) ||
        (!highestQualityPending && readyElapsed >= LOADER_TO_SINGLE_RESULT_MAX_WAIT_MS) ||
        allQualitiesSettled
      )
    ) {
      break;
    }

    if (
      jobs.size === 0 &&
      startingJobs.size === 0 &&
      nextQualityIndex >= LOADER_TO_VIDEO_QUALITIES.length
    ) {
      break;
    }

    await delay(LOADER_TO_POLL_DELAY_MS);

    await Promise.all(
      [...jobs.values()].map(async (job) => {
        try {
          const progressRes = await axios.get(job.progressUrl, {
            timeout: 8000,
            headers: LOADER_TO_HEADERS
          });
          const data = progressRes.data || {};
          const downloadUrl = getLoaderDownloadUrl(data);

          if (downloadUrl) {
            jobs.delete(job.quality);
            const result = {
              quality: job.quality,
              downloadUrl,
              progressUrl: job.progressUrl,
              title: typeof data.info?.title === "string" ? data.info.title : job.title,
              thumbnailUrl: data.thumbnail_url || data.info?.image || job.thumbnailUrl,
              provider: "Loader.to"
            };
            readyResults.set(job.quality, result);
            if (!firstReadyAt) firstReadyAt = Date.now();
            console.info(`[YTMP4][Loader.to] ${job.quality}p listo para descargar.`);
            return;
          }

          if (isLoaderFailure(data)) {
            jobs.delete(job.quality);
            failedQualities.add(job.quality);
            console.warn(`[YTMP4][Loader.to] ${job.quality}p fue rechazado por la API.`);
            return;
          }

          const progress = Number(data.progress || 0);
          if (progress !== job.lastProgress) {
            job.lastProgress = progress;
            console.info(`[YTMP4][Loader.to] ${job.quality}p en preparación (${progress || 0}/1000).`);
          }

          if (progress >= 1000) {
            job.completedWithoutUrlChecks += 1;
            if (job.completedWithoutUrlChecks >= LOADER_TO_COMPLETED_NO_URL_CHECKS) {
              jobs.delete(job.quality);
              failedQualities.add(job.quality);
              console.warn(`[YTMP4][Loader.to] ${job.quality}p terminó sin un enlace MP4 válido.`);
            }
          }
        } catch (error) {
          jobs.delete(job.quality);
          failedQualities.add(job.quality);
          console.warn(`[YTMP4][Loader.to] ${job.quality}p falló durante el sondeo: ${error.message}`);
        }
      })
    );
  }

  const results = [...readyResults.values()].sort((a, b) => b.quality - a.quality);
  console.info(
    `[YTMP4][Loader.to] Resultados listos: ${results.map((result) => `${result.quality}p`).join(", ") || "ninguno"}.`
  );
  if (!results.length) {
    console.warn(`[YTMP4][Loader.to] No se obtuvo un MP4 tras ${LOADER_TO_MAX_WAIT_MS / 1000}s. Fallaron: ${[...failedQualities].join(", ") || "sin detalle"}.`);
  }
  return results;
}

async function refreshLoaderCandidate(candidate) {
  if (!candidate?.progressUrl) return null;

  try {
    const progressRes = await axios.get(candidate.progressUrl, {
      timeout: 8000,
      headers: LOADER_TO_HEADERS
    });
    const data = progressRes.data || {};
    const downloadUrl = getLoaderDownloadUrl(data);
    if (!downloadUrl || downloadUrl === candidate.downloadUrl) return null;

    return {
      ...candidate,
      downloadUrl,
      title: typeof data.info?.title === "string" ? data.info.title : candidate.title,
      thumbnailUrl: data.thumbnail_url || data.info?.image || candidate.thumbnailUrl
    };
  } catch (error) {
    console.warn(`[YTMP4][Loader.to] No se pudo renovar el enlace de ${candidate.quality}p: ${error.message}`);
    return null;
  }
}

async function downloadLoaderCandidate(candidate) {
  try {
    return {
      candidate,
      buffer: await downloadMediaBuffer(candidate.downloadUrl)
    };
  } catch (firstError) {
    const refreshedCandidate = await refreshLoaderCandidate(candidate);
    if (!refreshedCandidate) throw firstError;

    console.info(`[YTMP4][Loader.to] Enlace de ${candidate.quality}p renovado; reintentando una sola vez.`);
    return {
      candidate: refreshedCandidate,
      buffer: await downloadMediaBuffer(refreshedCandidate.downloadUrl)
    };
  }
}

async function downloadThumbnailBuffer(url) {
  if (!url || typeof url !== "string" || !url.startsWith("http")) {
    throw new Error("URL de portada no válida.");
  }

  const response = await axios.get(url, {
    responseType: "arraybuffer",
    timeout: 8000,
    maxContentLength: 5 * 1024 * 1024,
    maxBodyLength: 5 * 1024 * 1024,
    headers: {
      Accept: "image/jpeg,image/*;q=0.9,*/*;q=0.8",
      "User-Agent": "Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 Chrome/122.0 Safari/537.36"
    }
  });

  const buffer = Buffer.from(response.data || []);
  if (buffer.length < 1000) throw new Error("Portada vacía o demasiado pequeña.");
  return buffer;
}

function extractVideoThumbnailBuffer(videoBuffer) {
  if (!Buffer.isBuffer(videoBuffer) || videoBuffer.length < 50000) {
    return Promise.reject(new Error("Video insuficiente para extraer una portada."));
  }

  return new Promise((resolve, reject) => {
    const ffmpeg = spawn("ffmpeg", [
      "-hide_banner",
      "-loglevel", "error",
      "-i", "pipe:0",
      "-frames:v", "1",
      "-vf", "scale=640:-2",
      "-f", "image2pipe",
      "-vcodec", "mjpeg",
      "-q:v", "3",
      "pipe:1"
    ], { stdio: ["pipe", "pipe", "pipe"] });
    const chunks = [];
    let stderr = "";
    let settled = false;
    const timeoutId = setTimeout(() => {
      ffmpeg.kill("SIGKILL");
      finish(new Error("Tiempo agotado al extraer la portada del MP4."));
    }, 10000);

    const finish = (error, buffer) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      if (error) reject(error);
      else resolve(buffer);
    };

    ffmpeg.stdout.on("data", (chunk) => chunks.push(chunk));
    ffmpeg.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
    ffmpeg.on("error", finish);
    ffmpeg.on("close", (code) => {
      if (code !== 0) {
        finish(new Error(`FFmpeg no pudo extraer la portada (${code}): ${stderr.trim() || "sin detalle"}`));
        return;
      }
      const buffer = Buffer.concat(chunks);
      if (buffer.length < 1000) {
        finish(new Error("FFmpeg generó una portada vacía."));
        return;
      }
      finish(null, buffer);
    });
    ffmpeg.stdin.on("error", (error) => {
      if (error.code !== "EPIPE") finish(error);
    });
    ffmpeg.stdin.end(videoBuffer);
  });
}

async function downloadMediaBuffer(url) {
  if (!url || typeof url !== "string" || !url.startsWith("http")) {
    throw new Error("URL de descarga no válida.");
  }

  const attempts = [
    {
      timeout: 15000,
      headers: { Referer: "https://loader.to/" }
    },
    {
      timeout: 10000,
      headers: { Referer: "https://www.youtube.com/" }
    }
  ];
  let lastError = null;

  for (const [index, attempt] of attempts.entries()) {
    try {
      const response = await axios({
        method: "GET",
        url,
        responseType: "arraybuffer",
        timeout: attempt.timeout,
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
          "Accept": "video/mp4,video/*;q=0.9,*/*;q=0.8",
          "Accept-Encoding": "gzip, deflate, br",
          "Accept-Language": "es-ES,es;q=0.9",
          "Sec-Fetch-Dest": "video",
          "Sec-Fetch-Mode": "cors",
          "Sec-Fetch-Site": "cross-site",
          ...attempt.headers
        }
      });

      if (response.data && response.data.byteLength > 50000) {
        console.info(`[YTMP4] Buffer descargado exitosamente (${(response.data.byteLength / 1024 / 1024).toFixed(2)} MB).`);
        return Buffer.from(response.data);
      }

      lastError = new Error("Buffer MP4 vacío o muy pequeño.");
    } catch (error) {
      lastError = error;
      console.warn(`[YTMP4] Descarga del enlace falló en intento ${index + 1}/${attempts.length}: ${error.message}`);
      if ([403, 404, 502, 503, 504].includes(error?.response?.status)) break;
    }
  }

  throw lastError || new Error("Loader.to no entregó un MP4 descargable.");
}

// ✅ NUEVA FUNCIÓN: Obtener duración real del MP4 con ffprobe
function getDurationFromVideo(videoPath) {
  try {
    const output = execSync(
      `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1:noprint_wrappers=1 "${videoPath}"`,
      { encoding: "utf8", timeout: 15000 }
    ).trim();

    const duration = parseFloat(output);
    console.info(`[YTMP4] Duración obtenida de ffprobe: ${duration}s`);
    return Math.round(duration);
  } catch (error) {
    console.warn(`[YTMP4] No se pudo obtener duración con ffprobe: ${error.message}`);
    return 0;
  }
}

// ✅ NUEVA FUNCIÓN: Procesar MP4 con FFmpeg (moov al inicio + metadata)
function processVideoWithFFmpeg(inputPath, outputPath, title, durationSeconds) {
  return new Promise((resolve, reject) => {
    try {
      const ffmpegArgs = [
        "-i", inputPath,
        "-c:v", "copy", // Copiar video sin recodificar
        "-c:a", "copy", // Copiar audio sin recodificar
        "-movflags", "faststart", // ✅ Mueve moov atom al inicio (permite seek)
        "-metadata", `title=${title}`, // Agregar título
        "-metadata", `duration=${durationSeconds}`, // Agregar duración
        "-y", // Sobrescribir sin preguntar
        outputPath
      ];

      console.info(`[YTMP4] Procesando video con FFmpeg (faststart + metadata)...`);

      const ffmpeg = spawn("ffmpeg", ffmpegArgs, {
        stdio: ["ignore", "pipe", "pipe"]
      });

      let errorOutput = "";

      ffmpeg.stderr.on("data", (data) => {
        errorOutput += data.toString();
      });

      ffmpeg.on("close", (code) => {
        if (code === 0) {
          console.info(`[YTMP4] Video procesado correctamente con FFmpeg`);
          const stats = fs.statSync(outputPath);
          console.info(`[YTMP4] Tamaño final: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
          resolve(true);
        } else {
          console.error(`[YTMP4] FFmpeg error (code ${code}): ${errorOutput}`);
          reject(new Error(`FFmpeg process exited with code ${code}`));
        }
      });

      ffmpeg.on("error", (error) => {
        console.error(`[YTMP4] FFmpeg spawn error: ${error.message}`);
        reject(error);
      });

    } catch (error) {
      console.error(`[YTMP4] Error al procesar video: ${error.message}`);
      reject(error);
    }
  });
}

// ✅ NUEVA FUNCIÓN: Convertir timestamp a segundos
function timestampToSeconds(timestamp) {
  if (!timestamp || typeof timestamp !== "string") return 0;

  const parts = timestamp.split(":").map(Number);
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2]; // hh:mm:ss
  } else if (parts.length === 2) {
    return parts[0] * 60 + parts[1]; // mm:ss
  }
  return 0;
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
  const hasConnectionGetter = typeof globalThis.getActiveConnection === "function";
  const activeConn = hasConnectionGetter ? globalThis.getActiveConnection() : fallbackConn;

  if (!activeConn) {
    const error = new Error("La conexión de WhatsApp se está restableciendo. Espera unos segundos e inténtalo de nuevo.");
    error.code = "CONNECTION_UNAVAILABLE";
    throw error;
  }

  return activeConn;
}

async function sendMessageWithReconnect(fallbackConn, targetJid, content, options = {}) {
  let lastError = null;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await getReadyConnection(fallbackConn).sendMessage(targetJid, content, options);
    } catch (error) {
      lastError = error;
      if (!isConnectionUnavailableError(error) || attempt === 2) break;

      const waitMs = 1000 * (attempt + 1);
      console.warn(`Conexión no disponible al enviar MP4; reintentando en ${waitMs / 1000}s (${attempt + 1}/3).`);
      await delay(waitMs);
    }
  }

  throw lastError;
}

const handler = async (m, { body, conn, usedPrefix, command, silentStatus = false }) => {
  if (!body || !body.trim()) {
    return m.reply(
      `✦━【 🎬 *YOUTUBE MP4* 】━✦\n\n` +
      `📝 Descarga videos de YouTube en formato MP4.\n` +
      `💡 Sintaxis: \`${usedPrefix}${command} <url | búsqueda>\`\n` +
      `📌 Calidad automática: 480p → 360p\n` +
      `📌 Ejemplo: \`${usedPrefix}${command} https://www.youtube.com/watch?v=dQw4w9WgXcQ\`\n\n` +
      `✨ *Kurumi Tokisaki*`
    );
  }

  const targetJid = m.chat || m.chatId || m.key?.remoteJid;
  const query = body.trim();
  let videoUrl = query;
  let title = "Video de YouTube";
  let author = "YouTube";
  let duration = "Desconocida";
  let durationSeconds = 0;
  let views = "No disponible";
  let date = "No disponible";
  let description = "Sin descripción";
  let coverUrl = null;
  let coverBuffer = null;

  if (query.includes("list=") || query.includes("/playlist")) {
    return m.reply(
      `✦━【 ❌ *ENLACE NO COMPATIBLE* 】━✦\n\n` +
      `El enlace proporcionado es una lista de reproducción. Proporciona el enlace de un video individual o selecciona un número en \`${usedPrefix}ytsearch\`.\n\n` +
      `✨ *Kurumi Tokisaki*`
    );
  }

  const vidMatch = query.match(/(?:v=|\/embed\/|\/watch\?v=|\/v\/|youtu\.be\/|^)([a-zA-Z0-9_-]{11})(?:[&?].*)?$/);
  const explicitVid = vidMatch ? vidMatch[1] : null;

  try {
    let videoData = explicitVid ? await yts({ videoId: explicitVid }) : null;
    if (!videoData) {
      const searchRes = await yts(query);
      videoData = searchRes.videos?.[0];
    }

    if (videoData) {
      if (videoData.url) videoUrl = videoData.url;
      else if (videoData.videoId) videoUrl = `https://www.youtube.com/watch?v=${videoData.videoId}`;

      if (videoData.title) title = typeof videoData.title === "string" ? videoData.title : (videoData.title?.name || title);
      if (videoData.author?.name) author = videoData.author.name;
      coverUrl = videoData.image || videoData.thumbnail || (videoData.videoId ? `https://i.ytimg.com/vi/${videoData.videoId}/hqdefault.jpg` : null);
      if (videoData.timestamp || videoData.duration?.timestamp) {
        duration = videoData.timestamp || videoData.duration?.timestamp;
        durationSeconds = timestampToSeconds(duration);
      }
      if (videoData.views) views = Number(videoData.views).toLocaleString("es-ES");
      if (videoData.ago || videoData.uploadDate) date = videoData.ago || videoData.uploadDate;
      if (videoData.description) {
        const rawDescription = String(videoData.description).trim();
        description = rawDescription.length > 150 ? `${rawDescription.slice(0, 147)}...` : rawDescription;
      }
    }
  } catch (error) {
    console.warn(`[YTMP4] No se pudieron obtener todos los metadatos: ${error.message}`);
  }

  if (!coverUrl) {
    const fallbackVideoId = videoUrl.match(/(?:v=|youtu\.be\/|\/shorts\/|\/embed\/)([a-zA-Z0-9_-]{11})/i)?.[1];
    if (fallbackVideoId) coverUrl = `https://i.ytimg.com/vi/${fallbackVideoId}/hqdefault.jpg`;
  }

  if (!/youtube\.com|youtu\.be/i.test(videoUrl)) {
    return m.reply(
      `✦━【 ❌ *ERROR DE ENLACE* 】━✦\n\n` +
      `Proporciona un enlace válido de YouTube o un término de búsqueda claro.\n\n` +
      `✨ *Kurumi Tokisaki*`
    );
  }

  if (!silentStatus) {
    await m.reply("⏳ *Preparando el video en MP4...*");
  }

  const cardCaption =
    `✦━【 🎬 *YOUTUBE MP4* 】━✦\n\n` +
    `📌 *Título:* ${title}\n` +
    `👤 *Canal:* ${author}\n` +
    `⏱️ *Duración:* ${duration}\n` +
    `👁️ *Visualizaciones:* ${views}\n` +
    `📅 *Fecha:* ${date}\n` +
    `📝 *Descripción:* ${description}\n\n` +
    `✨ *Kurumi Tokisaki*`;

  // La tarjeta previa nunca se envía como texto plano. La portada externa se
  // intenta antes de descargar el vídeo, pero si falla se extraerá un fotograma
  // del MP4 y se enviará la tarjeta después del procesamiento.
  if (coverUrl) {
    try {
      coverBuffer = await downloadThumbnailBuffer(coverUrl);
      await sendMessageWithReconnect(
        conn,
        targetJid,
        { image: coverBuffer, caption: cardCaption },
        { quoted: m }
      );
    } catch (cardError) {
      coverBuffer = null;
      console.warn(`[YTMP4] La portada externa falló; se extraerá una imagen del MP4: ${cardError.message}`);
    }
  } else {
    console.warn("[YTMP4] No hay portada externa; se extraerá una imagen del MP4.");
  }

  let loaderResults = [];
  try {
    loaderResults = await getLoaderToVideoResults(videoUrl);
  } catch (error) {
    console.warn(`[YTMP4][Loader.to] No se pudo preparar el MP4: ${error.message}`);
  }

  if (!loaderResults.length) {
    return m.reply(
      `✦━【 ❌ *DESCARGA FALLIDA* 】━✦\n\n` +
      `Loader.to no pudo entregar un MP4 en 480p ni 360p para este video. Inténtalo más tarde o prueba otro enlace.\n\n` +
      `✨ *Kurumi Tokisaki*`
    );
  }

  let loaderResult = null;
  let videoBuffer = null;
  let lastDownloadError = null;

  for (const candidate of loaderResults) {
    try {
      console.info(`[YTMP4][Loader.to] Intentando descargar ${candidate.quality}p en memoria para el envío nativo.`);
      const downloaded = await downloadLoaderCandidate(candidate);
      loaderResult = downloaded.candidate;
      videoBuffer = downloaded.buffer;
      break;
    } catch (error) {
      lastDownloadError = error;
      console.warn(`[YTMP4][Loader.to] ${candidate.quality}p no se pudo descargar; probando la siguiente calidad: ${error.message}`);
    }
  }

  if (!loaderResult || !videoBuffer) {
    console.error(`[YTMP4][Loader.to] Ninguna calidad lista pudo descargarse: ${lastDownloadError?.message || "sin detalle"}`);
    return m.reply(
      `✦━【 ❌ *DESCARGA FALLIDA* 】━✦\n\n` +
      `Loader.to preparó el video, pero sus enlaces MP4 no pudieron descargarse. Inténtalo nuevamente.\n\n` +
      `✨ *Kurumi Tokisaki*`
    );
  }

  if (loaderResult.title) title = loaderResult.title;

  // Procesar con FFmpeg sin recodificar para reconstruir el contenedor MP4.
  let processedVideoBuffer = videoBuffer;
  let realDurationSeconds = durationSeconds;
  let tempDir = null;

  try {
    const tempRoot = path.resolve("./temp");
    fs.mkdirSync(tempRoot, { recursive: true });
    tempDir = path.join(tempRoot, `ytmp4_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`);
    fs.mkdirSync(tempDir, { recursive: true });

    const inputVideoPath = path.join(tempDir, "input.mp4");
    const outputVideoPath = path.join(tempDir, "output.mp4");

    fs.writeFileSync(inputVideoPath, videoBuffer);
    console.info(`[YTMP4] Video temporal guardado: ${(videoBuffer.byteLength / 1024 / 1024).toFixed(2)} MB`);

    realDurationSeconds = getDurationFromVideo(inputVideoPath);
    if (realDurationSeconds === 0) realDurationSeconds = durationSeconds;

    await processVideoWithFFmpeg(inputVideoPath, outputVideoPath, title, realDurationSeconds);

    processedVideoBuffer = fs.readFileSync(outputVideoPath);
    console.info(`[YTMP4] Video procesado: ${(processedVideoBuffer.byteLength / 1024 / 1024).toFixed(2)} MB`);
  } catch (ffmpegError) {
    console.warn(`[YTMP4] FFmpeg no disponible o falló, usando video original: ${ffmpegError.message}`);
  } finally {
    if (tempDir) {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
        console.info("[YTMP4] Archivos temporales eliminados.");
      } catch (cleanupError) {
        console.warn(`[YTMP4] No se pudo limpiar el temporal: ${cleanupError.message}`);
      }
    }
  }

  if (!coverBuffer) {
    try {
      coverBuffer = await extractVideoThumbnailBuffer(processedVideoBuffer);
      await sendMessageWithReconnect(
        conn,
        targetJid,
        { image: coverBuffer, caption: cardCaption },
        { quoted: m }
      );
      console.info("[YTMP4] Portada extraída del MP4 y enviada junto con la información.");
    } catch (thumbnailError) {
      console.warn(`[YTMP4] No se pudo extraer una portada del MP4: ${thumbnailError.message}`);
    }
  }

  // El vídeo conserva la portada validada como thumbnail cuando WhatsApp la acepta.
  // Nunca se envía la tarjeta como texto plano independiente.
  const videoMessage = {
    video: processedVideoBuffer,
    ...(coverBuffer ? { jpegThumbnail: coverBuffer } : {}),
    mimetype: "video/mp4",
    fileName: `${String(title).replace(/[/\\?%*:|"<>]/g, "").trim() || "video"}.mp4`,
    caption: `🎬 *${title}*\n📺 Calidad: ${loaderResult.quality}p`,
    duration: realDurationSeconds,
    gifPlayback: false
  };

  try {
    await sendMessageWithReconnect(
      conn,
      targetJid,
      videoMessage,
      { quoted: m }
    );
    console.info(`[YTMP4] Video nativo enviado desde memoria usando Loader.to en ${loaderResult.quality}p.`);
  } catch (error) {
    console.error(`[YTMP4] Error al enviar el video nativo: ${error.message}`);
    return m.reply(
      `✦━【 ❌ *ERROR AL ENVIAR VIDEO* 】━✦\n\n` +
      `El MP4 se obtuvo correctamente, pero WhatsApp no pudo enviarlo como video nativo: ${error.message}\n\n` +
      `✨ *Kurumi Tokisaki*`
    );
  }
};

handler.command = /^(ytmp4|ytvideo|playvideo|ytmp4dl|videoyt)$/i;
handler.description = "Descargar directamente el video MP4 reproducible de YouTube mediante Loader.to, aceptando un enlace o una búsqueda; no usar para solicitudes de audio";
handler.category = "descargas";

export default handler;
