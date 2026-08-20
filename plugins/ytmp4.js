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
    const refreshRes = await axios.get(candidate.progressUrl, {
      timeout: 8000,
      headers: LOADER_TO_HEADERS
    });
    const data = refreshRes.data || {};
    const downloadUrl = getLoaderDownloadUrl(data);

    if (downloadUrl) {
      return {
        ...candidate,
        downloadUrl,
        title: typeof data.info?.title === "string" ? data.info.title : candidate.title,
        thumbnailUrl: data.thumbnail_url || data.info?.image || candidate.thumbnailUrl
      };
    }

    if (isLoaderFailure(data)) {
      console.warn(`[YTMP4][Loader.to] Actualización rechazada por la API.`);
      return null;
    }

    return null;
  } catch (error) {
    console.warn(`[YTMP4][Loader.to] Error al actualizar el candidato: ${error.message}`);
    return null;
  }
}

async function downloadThumbnailBuffer(url) {
  if (!url || typeof url !== "string") throw new Error("URL no válida");
  const res = await axios.get(url, { responseType: "arraybuffer", timeout: 8000 });
  return Buffer.from(res.data);
}

async function downloadLoaderCandidate(candidate) {
  if (!candidate?.downloadUrl) throw new Error("URL no disponible en el candidato");

  const res = await axios.get(candidate.downloadUrl, {
    responseType: "arraybuffer",
    timeout: 120000,
    onDownloadProgress: (progressEvent) => {
      const { loaded, total } = progressEvent;
      if (total) {
        const percent = Math.round((loaded / total) * 100);
        console.info(`[YTMP4][Loader.to] Descargando ${candidate.quality}p: ${percent}%`);
      }
    }
  });

  return {
    candidate,
    buffer: Buffer.from(res.data)
  };
}

function getDurationFromVideo(videoPath) {
  try {
    const output = execSync(
      `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1:noprint_wrappers=1 "${videoPath}"`,
      { encoding: "utf8", timeout: 10000 }
    ).trim();
    const duration = parseFloat(output);
    return isNaN(duration) ? 0 : Math.round(duration);
  } catch (error) {
    console.warn(`[YTMP4] ffprobe no disponible o falló: ${error.message}`);
    return 0;
  }
}

async function extractVideoThumbnailBuffer(videoBuffer) {
  let tempDir = null;

  try {
    const tempRoot = path.resolve("./temp");
    fs.mkdirSync(tempRoot, { recursive: true });
    tempDir = path.join(tempRoot, `thumb_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`);
    fs.mkdirSync(tempDir, { recursive: true });

    const inputPath = path.join(tempDir, "input.mp4");
    const outputPath = path.join(tempDir, "thumbnail.jpg");

    fs.writeFileSync(inputPath, videoBuffer);

    await new Promise((resolve, reject) => {
      const ffmpeg = spawn("ffmpeg", [
        "-i", inputPath,
        "-ss", "00:00:01",
        "-vframes", "1",
        "-q:v", "2",
        outputPath
      ], { stdio: "pipe" });

      let errorOutput = "";
      ffmpeg.stderr.on("data", (data) => {
        errorOutput += data.toString();
      });

      ffmpeg.on("close", (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`FFmpeg falló con código ${code}: ${errorOutput}`));
        }
      });

      ffmpeg.on("error", (err) => {
        reject(err);
      });
    });

    return fs.readFileSync(outputPath);
  } finally {
    if (tempDir) {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch (cleanupError) {
        console.warn(`[YTMP4] No se pudo limpiar el temporal de thumbnail: ${cleanupError.message}`);
      }
    }
  }
}

function processVideoWithFFmpeg(inputPath, outputPath, title, durationSeconds) {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn("ffmpeg", [
      "-i", inputPath,
      "-c:v", "copy",
      "-c:a", "copy",
      "-movflags", "faststart",
      "-metadata", `title=${title}`,
      "-metadata", `duration=${durationSeconds * 1000}`,
      outputPath
    ], { stdio: "pipe" });

    let errorOutput = "";
    ffmpeg.stderr.on("data", (data) => {
      errorOutput += data.toString();
    });

    ffmpeg.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`FFmpeg falló con código ${code}`));
      }
    });

    ffmpeg.on("error", (err) => {
      reject(err);
    });
  });
}

function timestampToSeconds(timestamp) {
  if (!timestamp) return 0;
  const parts = String(timestamp).split(":").map(Number);
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  } else if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  return parts[0] || 0;
}

async function sendMessageWithReconnect(conn, jid, content, options, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await conn.sendMessage(jid, content, options);
    } catch (error) {
      if (attempt < maxRetries) {
        console.warn(`[YTMP4] Intento ${attempt} falló, reintentando en 2 segundos...`);
        await delay(2000);
      } else {
        throw error;
      }
    }
  }
}

const handler = async (m, { conn, usedPrefix, command, text }) => {
  const query = text?.trim();
  if (!query) {
    return m.reply(
      `✦━【 ❌ *FALTA INFORMACIÓN* 】━✦\n\n` +
      `Uso: \`${usedPrefix}${command} [enlace de YouTube o búsqueda]\`\n\n` +
      `Ejemplo: \`${usedPrefix}${command} https://youtu.be/dQw4w9WgXcQ\`\n\n` +
      `✨ *Kurumi Tokisaki*`
    );
  }

  const targetJid = m.isGroup ? m.chat : m.sender;
  const silentStatus = m.fromMe;

  let videoUrl = query;
  let title = "Video";
  let author = "Desconocido";
  let duration = "00:00";
  let durationSeconds = 0;
  let views = "0";
  let date = "Desconocida";
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

  // Intentar descargar la portada externa
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

  // ✨ SOLUCIÓN: Garantizar que SIEMPRE hay thumbnail antes de enviar el video
  if (!coverBuffer) {
    try {
      console.info("[YTMP4] Extrayendo thumbnail del video procesado...");
      coverBuffer = await extractVideoThumbnailBuffer(processedVideoBuffer);
      console.info("[YTMP4] Thumbnail extraído exitosamente.");
    } catch (thumbnailError) {
      console.warn(`[YTMP4] No se pudo extraer thumbnail del video: ${thumbnailError.message}`);
      coverBuffer = null; // Null explícito si falla
    }
  }

  // El vídeo se envía CON jpegThumbnail garantizado
  const videoMessage = {
    video: processedVideoBuffer,
    ...(coverBuffer ? { jpegThumbnail: coverBuffer } : {}),
    mimetype: "video/mp4",
    fileName: `${String(title).replace(/[/\\?%*:|"<>]/g, "").trim() || "video"}.mp4`,
    caption: `🎬 *${title}*`,
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
    console.info(`[YTMP4] Video nativo enviado desde memoria usando Loader.to en ${loaderResult.quality}p${coverBuffer ? " con thumbnail" : " sin thumbnail"}.`);
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
