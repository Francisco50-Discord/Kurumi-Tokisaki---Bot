// ============================================================
//   Kurumi Tokisaki - YouTube MP3 Downloader Command
//   ✦━【 🎵 YOUTUBE MP3 DOWNLOADER 】━✦
//   Multi-provider YouTube MP3 Downloader (btch-downloader, Loader.to)
//   Con descarga optimizada por Buffer y envío de audio limpio para WhatsApp.
// ============================================================

import axios from "axios";
import yts from "yt-search";
import btch from "btch-downloader";

function isAbortError(error, signal) {
  if (signal?.aborted) return true;
  return error?.code === "ERR_CANCELED" || error?.code === "PROVIDER_ABORTED" || error?.name === "AbortError";
}

function throwIfAborted(signal) {
  if (!signal?.aborted) return;
  const error = new Error("Proveedor cancelado porque otro proveedor ya descargó el audio.");
  error.code = "PROVIDER_ABORTED";
  throw error;
}

function delay(ms, signal) {
  if (!signal) return new Promise((resolve) => setTimeout(resolve, ms));

  return new Promise((resolve, reject) => {
    let timer;
    const onAbort = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", onAbort);
      const error = new Error("Espera cancelada porque otro proveedor ya descargó el audio.");
      error.code = "PROVIDER_ABORTED";
      reject(error);
    };

    timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal.addEventListener("abort", onAbort, { once: true });
    if (signal.aborted) onAbort();
  });
}

// Descarga una URL concreta una sola vez.
// Si el enlace temporal falla, el proveedor debe generar otro; repetir la
// misma URL con otro Referer no renueva el enlace y solo añade latencia.
async function downloadMediaBuffer(url, signal) {
  if (!url || typeof url !== "string" || !url.startsWith("http")) {
    throw new Error("URL de descarga no válida.");
  }

  const attempts = [
    { timeout: 25000, headers: {} }
  ];
  let lastError = null;

  for (const attempt of attempts) {
    throwIfAborted(signal);
    try {
      const response = await axios({
        method: "GET",
        url,
        responseType: "arraybuffer",
        timeout: attempt.timeout,
        signal,
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
          "Accept": "audio/mpeg,audio/*;q=0.9,*/*;q=0.8",
          ...attempt.headers
        }
      });

      throwIfAborted(signal);
      if (response.data && response.data.byteLength > 1000) {
        return Buffer.from(response.data);
      }

      lastError = new Error("Respuesta de audio vacía o demasiado pequeña.");
    } catch (error) {
      if (isAbortError(error, signal)) throw error;
      lastError = error;
    }
  }

  throw lastError || new Error("No se pudo obtener el buffer del archivo de audio.");
}

const LOADER_TO_MP3_MAX_POLLS = 30;

async function resolveDownloadedProvider(provider, signal) {
  let lastError = null;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      throwIfAborted(signal);
      const result = await provider(signal);
      throwIfAborted(signal);
      if (!result?.downloadUrl) {
        throw new Error("Proveedor sin enlace disponible.");
      }

      const audioBuffer = await downloadMediaBuffer(result.downloadUrl, signal);
      throwIfAborted(signal);
      if (!audioBuffer || audioBuffer.length <= 5000) {
        throw new Error("El proveedor devolvió un audio vacío o demasiado pequeño.");
      }

      return { ...result, audioBuffer };
    } catch (error) {
      if (isAbortError(error, signal)) throw error;
      lastError = error;
      if (attempt === 0) {
        console.warn(`[YTMP3] El enlace de un proveedor falló; se solicitará una URL nueva: ${error.message}`);
      }
    }
  }

  throw lastError || new Error("No se pudo descargar el audio del proveedor.");
}

async function getFastestDownloadedResult(providerList) {
  const controller = new AbortController();
  try {
    const result = await Promise.any(
      providerList.map((provider) => resolveDownloadedProvider(provider, controller.signal))
    );
    controller.abort();
    return result;
  } catch {
    controller.abort();
    return null;
  }
}

async function withTimeout(promise, timeoutMs, message, signal) {
  let timeoutId;
  let abortHandler;
  try {
    const racers = [
      promise,
      new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
      })
    ];

    if (signal) {
      racers.push(new Promise((_, reject) => {
        abortHandler = () => {
          const error = new Error("Solicitud cancelada porque otro proveedor ya descargó el audio.");
          error.code = "PROVIDER_ABORTED";
          reject(error);
        };
        signal.addEventListener("abort", abortHandler, { once: true });
        if (signal.aborted) abortHandler();
      }));
    }

    return await Promise.race(racers);
  } finally {
    clearTimeout(timeoutId);
    if (signal && abortHandler) signal.removeEventListener("abort", abortHandler);
  }
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

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const activeConn = getReadyConnection(fallbackConn);
      return await activeConn.sendMessage(targetJid, content, options);
    } catch (error) {
      lastError = error;
      if (!isConnectionUnavailableError(error) || attempt === 2) break;
      const waitMs = 1000 * (attempt + 1);
      console.warn(`Conexión no disponible al enviar MP3; reintentando en ${waitMs / 1000}s (${attempt + 1}/3).`);
      await delay(waitMs);
    }
  }

  throw lastError;
}

const handler = async (m, { body, conn, usedPrefix, command, silentStatus = false }) => {
  if (!body || !body.trim()) {
    return m.reply(
      `✦━【 🎵 *YOUTUBE MP3* 】━✦\n\n` +
      `📝 Descarga el audio de cualquier video de YouTube.\n` +
      `💡 Sintaxis: \`${usedPrefix}${command} <url | búsqueda>\`\n` +
      `📌 Ejemplo: \`${usedPrefix}${command} https://www.youtube.com/watch?v=dQw4w9WgXcQ\`\n\n` +
      `✨ *Kurumi Tokisaki*`
    );
  }

  const targetJid = m.chat || m.chatId || m.key?.remoteJid;
  let query = body.trim();
  let videoUrl = query;
  let title = "Audio de YouTube";
  let author = "YouTube";
  let duration = "Desconocida";
  let views = "No disponible";
  let date = "No disponible";
  let description = "Sin descripción";
  let coverUrl = null;

  // Direct check for playlist URL
  if (query.includes("list=") || query.includes("/playlist")) {
    return m.reply(
      `✦━【 ❌ *ENLACE NO COMPATIBLE* 】━✦\n\n` +
      `El enlace proporcionado es una lista de reproducción. Proporciona el enlace de un video individual o selecciona un número en \`${usedPrefix}ytsearch\`.\n\n` +
      `✨ *Kurumi Tokisaki*`
    );
  }

  // Extract video ID if present in query
  const vidMatch = query.match(/(?:v=|\/embed\/|\/watch\?v=|\/v\/|youtu\.be\/|^)([a-zA-Z0-9_-]{11})(?:[&?].*)?$/);
  const explicitVid = vidMatch ? vidMatch[1] : null;

  // 1. Obtener metadatos completos de YouTube (soporta URL directa o búsqueda)
  try {
    let videoData = null;
    if (explicitVid) {
      videoData = await yts({ videoId: explicitVid });
    }
    if (!videoData) {
      const searchRes = await yts(query);
      videoData = searchRes.videos?.[0];
    }

    if (videoData) {
      if (videoData.url) videoUrl = videoData.url;
      else if (videoData.videoId) videoUrl = `https://www.youtube.com/watch?v=${videoData.videoId}`;
      
      if (videoData.title) title = typeof videoData.title === "string" ? videoData.title : (videoData.title?.name || "Audio de YouTube");
      if (videoData.author?.name) author = videoData.author.name;
      coverUrl = videoData.image || videoData.thumbnail || (videoData.videoId ? `https://i.ytimg.com/vi/${videoData.videoId}/hqdefault.jpg` : null);
      if (videoData.timestamp || videoData.duration?.timestamp) {
        duration = videoData.timestamp || videoData.duration?.timestamp;
      }
      if (videoData.views) {
        views = Number(videoData.views).toLocaleString("es-ES");
      }
      if (videoData.ago || videoData.uploadDate) {
        date = videoData.ago || videoData.uploadDate;
      }
      if (videoData.description) {
        const rawDesc = String(videoData.description).trim();
        description = rawDesc.length > 150 ? rawDesc.slice(0, 147) + "..." : rawDesc;
      }
    }
  } catch (e) {}

  if (!/youtube\.com|youtu\.be/i.test(videoUrl)) {
    return m.reply(
      `✦━【 ❌ *ERROR DE ENLACE* 】━✦\n\n` +
      `Proporciona un enlace válido de YouTube o un término de búsqueda claro.\n\n` +
      `✨ *Kurumi Tokisaki*`
    );
  }

  if (!silentStatus) {
    await m.reply(`⏳ *Descargando audio de YouTube en MP3...*`);
  }

  // Mostrar la portada y los datos conocidos antes de iniciar la descarga.
  // Así el usuario recibe confirmación inmediata aunque el MP3 tarde en estar listo.
  const cardCaption =
    `✦━【 🎵 *YOUTUBE MP3* 】━✦\n\n` +
    `📌 *Título:* ${title}\n` +
    `👤 *Canal:* ${author}\n` +
    `⏱️ *Duración:* ${duration}\n` +
    `👁️ *Visualizaciones:* ${views}\n` +
    `📅 *Fecha:* ${date}\n` +
    `📝 *Descripción:* ${description}\n\n` +
    `✨ *Kurumi Tokisaki*`;

  try {
    if (coverUrl) {
      await sendMessageWithReconnect(
        conn,
        targetJid,
        { image: { url: coverUrl }, caption: cardCaption },
        { quoted: m }
      );
    } else {
      await sendMessageWithReconnect(conn, targetJid, { text: cardCaption }, { quoted: m });
    }
  } catch (cardError) {
    console.warn("No se pudo enviar la tarjeta previa de ytmp3:", cardError.message);
  }

  // Cada proveedor resuelve y descarga su propio resultado dentro de la carrera.
  // Así una URL temporal inválida no puede ganar y provocar una segunda ronda
  // completa de llamadas duplicadas.
  const providerList = [
    // Provider 1: btch-downloader
    async (signal) => {
      try {
        throwIfAborted(signal);
        const btchRes = await withTimeout(btch.youtube(videoUrl), 25000, "Timeout BTCH", signal);
        throwIfAborted(signal);
        const url = btchRes?.mp3 || btchRes?.url;
        if (typeof url === "string" && url.startsWith("http")) {
          return {
            downloadUrl: url,
            title: typeof btchRes?.title === "string" ? btchRes.title : null,
            author: typeof btchRes?.author === "string" ? btchRes.author : null,
            thumbnail: typeof btchRes?.thumbnail === "string" ? btchRes.thumbnail : null,
            provider: "BTCH"
          };
        }
      } catch (error) {
        if (isAbortError(error, signal)) throw error;
        console.warn(`[YTMP3][BTCH] Falló: ${error.message}`);
      }
      console.warn("[YTMP3][BTCH] No devolvió un enlace MP3 válido.");
      return null;
    },
    // Provider 2: Loader.to API
    async (signal) => {
      try {
        throwIfAborted(signal);
        const initRes = await axios.get("https://loader.to/ajax/download.php", {
          params: { format: "mp3", url: videoUrl },
          timeout: 20000,
          signal,
          headers: { Accept: "application/json", Referer: "https://loader.to/" }
        });
        throwIfAborted(signal);
        const init = initRes.data || {};
        if (!init.id) return null;

        const progressUrl = init.progress_url || `https://loader.to/ajax/progress.php?id=${encodeURIComponent(init.id)}`;
        for (let attempt = 0; attempt < LOADER_TO_MP3_MAX_POLLS; attempt += 1) {
          await delay(1000, signal);
          const progressRes = await axios.get(progressUrl, {
            timeout: 5000,
            signal,
            headers: { Accept: "application/json", Referer: "https://loader.to/" }
          });
          throwIfAborted(signal);
          const data = progressRes.data || {};
          const downloadUrl = [
            data.download_url,
            data.downloadUrl,
            data.url,
            data.link,
            data.result?.download_url,
            data.result?.downloadUrl,
            data.result?.url
          ].find((value) => typeof value === "string" && /^https?:\/\//i.test(value));

          if (downloadUrl) {
            return {
              downloadUrl,
              title: typeof data.info?.title === "string" ? data.info.title : null,
              provider: "Loader.to"
            };
          }

          const status = String(data.message || data.text || data.status || "");
          if (data.error === true || /(?:failed|unavailable|invalid|not found|error)/i.test(status)) break;
        }
      } catch (error) {
        if (isAbortError(error, signal)) throw error;
        console.warn(`[YTMP3][Loader.to] Falló: ${error.message}`);
      }
      console.warn("[YTMP3][Loader.to] No terminó con un enlace MP3 válido.");
      return null;
    }
  ];

  let audioBuffer = null;
  let activeProvider = null;
  const fastestResult = await getFastestDownloadedResult(providerList);

  if (fastestResult?.audioBuffer) {
    if (fastestResult.title) title = fastestResult.title;
    if (fastestResult.author) author = fastestResult.author;
    activeProvider = fastestResult.provider || "Proveedor desconocido";
    audioBuffer = fastestResult.audioBuffer;
    console.info(`[YTMP3] Audio descargado correctamente con ${activeProvider}.`);
  }

  if (!audioBuffer) {
    return m.reply(
      `✦━【 ❌ *DESCARGA FALLIDA* 】━✦\n\n` +
      `No se pudo procesar la descarga MP3 en este momento. Inténtalo de nuevo en unos segundos.\n\n` +
      `✨ *Kurumi Tokisaki*`
    );
  }

  try {
    // Entregar el archivo de audio en un mensaje separado cuando termine la descarga.
    const safeTitle = String(title).replace(/[/\\?%*:|"<>]/g, "").trim() || "audio";

    try {
      // Intento 1: Enviar como audio ejecutable/reproducible en WhatsApp (audio/mpeg)
      await sendMessageWithReconnect(conn,
        targetJid,
        {
          audio: audioBuffer,
          mimetype: "audio/mpeg",
          ptt: false
        },
        { quoted: m }
      );
      console.info(`[YTMP3] Audio enviado por WhatsApp usando ${activeProvider || "el proveedor disponible"}.`);
    } catch (errAudio) {
      console.error("Fallo al enviar mensaje audio/mpeg, reintentando como documento:", errAudio.message);
      // Intento 2: Fallback como Documento adjunto MP3 (imposible de rechazar por el cliente)
      await sendMessageWithReconnect(conn,
        targetJid,
        {
          document: audioBuffer,
          mimetype: "audio/mpeg",
          fileName: `${safeTitle}.mp3`,
          caption: `🎵 *${title}*`
        },
        { quoted: m }
      );
      console.info(`[YTMP3] Audio enviado como documento usando ${activeProvider || "el proveedor disponible"}.`);
    }
  } catch (err) {
    console.error("Error en ytmp3 downloader:", err.message);
    try {
      await sendMessageWithReconnect(
        conn,
        targetJid,
        {
          text:
            `✦━【 ❌ *ERROR AL ENVIAR AUDIO* 】━✦\n\n` +
            `Error al procesar o enviar el archivo MP3: ${err.message}\n\n` +
            `✨ *Kurumi Tokisaki*`,
        },
        { quoted: m }
      );
    } catch (notifyError) {
      console.error("No se pudo notificar el error de audio porque WhatsApp sigue desconectado:", notifyError.message);
    }
  }
};

handler.command = /^(ytmp3|ytaudio|playmp3|ytmp3dl|audioyt)$/i;
handler.description = "Descargar directamente el audio MP3 de una canción o video de YouTube, aceptando un enlace o una búsqueda por título; no es una herramienta de búsqueda o listado";
handler.category = "descargas";

export default handler;
