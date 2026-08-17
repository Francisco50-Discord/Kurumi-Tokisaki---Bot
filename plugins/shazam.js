// ============================================================
//   Kurumi Tokisaki - Reconocimiento de Música (Shazam Engine)
//   ✦━【 🎵 RECONOCER MÚSICA 】━✦
//   Identifica canciones a partir de un clip de audio o video.
//   Utiliza Shazam (vía @renmu/node-shazam) con muestreo multi-offset
//   dinámico, ecualización y fallback a AudD.io.
// ============================================================

import axios from "axios";
import fs from "fs";
import { execFile } from "child_process";
import { promisify } from "util";
import { Shazam } from "@renmu/node-shazam";
import { getMediaBuffer, getTempPath, downloadBuffer } from "../lib/utils.js";
import { getBinaryPath } from "../lib/autoInstall.js";

const execFileAsync = promisify(execFile);

/**
 * Obtiene la duración exacta en segundos del archivo de audio/video con ffmpeg
 */
async function parseMediaDuration(filePath) {
  const ffmpegPath = getBinaryPath("ffmpeg") || "ffmpeg";
  try {
    const { stderr } = await execFileAsync(ffmpegPath, ["-i", filePath], { timeout: 10000 }).catch(e => e);
    const match = stderr.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/i);
    if (match) {
      const hours = parseFloat(match[1]);
      const minutes = parseFloat(match[2]);
      const seconds = parseFloat(match[3]);
      return hours * 3600 + minutes * 60 + seconds;
    }
  } catch (e) {}
  return 0;
}

/**
 * Convierte un segmento del buffer de audio/video a un archivo WAV mono a 44.1kHz (PCM)
 * optimizado para huellas digitales de Shazam.
 */
async function convertToWavSegment(inputPath, startSeconds = 0, durationSeconds = 20, normalize = false) {
  const ffmpegPath = getBinaryPath("ffmpeg");
  if (!ffmpegPath) throw new Error("ffmpeg no disponible para procesar audio");

  const outputPath = getTempPath("wav");

  const args = [
    "-ss", String(startSeconds),
    "-i", inputPath,
    "-vn",                    // ignorar video
    "-ac", "1",               // mono
    "-ar", "44100",           // 44.1 kHz
  ];

  if (normalize) {
    args.push("-af", "loudnorm=I=-16:TP=-1.5:LRA=11,volume=1.8");
  }

  args.push(
    "-t", String(durationSeconds),
    "-f", "wav",
    "-y",
    outputPath
  );

  try {
    await execFileAsync(ffmpegPath, args, { timeout: 30000, maxBuffer: 10 * 1024 * 1024 });
    return outputPath;
  } catch (err) {
    try { if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath); } catch (e) {}
    throw err;
  }
}

/**
 * Helper: Consultar AudD.io como respaldo
 */
async function recognizeWithAudd(audioBuffer) {
  const apiKey = process.env.AUDD_API_KEY || "test";

  const formData = new FormData();
  formData.append("file", new Blob([audioBuffer], { type: "audio/mpeg" }), "clip.mp3");
  formData.append("return", "apple_music,spotify,deezer");
  formData.append("api_token", apiKey);

  const res = await axios.post("https://api.audd.io/", formData, {
    timeout: 30000,
    headers: { "Accept": "application/json" },
  });

  return res.data;
}

// ============================================================
// Handler principal
// ============================================================
const handler = async (m, { conn, usedPrefix }) => {
  let mediaBuffer = await getMediaBuffer(m);

  if (!mediaBuffer) {
    return m.reply(
      `✦━【 🎵 *RECONOCER MÚSICA* 】━✦\n\n` +
      `🎵 Identifica cualquier canción enviando o\n` +
      `   respondiendo a una nota de voz, audio\n` +
      `   o video de cualquier duración.\n\n` +
      `💡 *Cómo usar:*\n` +
      `   1. Envía o responde a un audio/video\n` +
      `   2. Escribe \`${usedPrefix}shazam\`\n\n` +
      `📌 *Compatible con:*\n` +
      `   • Notas de voz (audio)\n` +
      `   • Videos (MP4, AVI, WebM, PTV)\n` +
      `   • Archivos MP3/OGG/AAC/WAV\n\n` +
      `✨ *Kurumi Tokisaki*`
    );
  }

  await m.reply(`⏳ *Analizando audio con Shazam...*`);

  const tempInputPath = getTempPath("media");
  fs.writeFileSync(tempInputPath, mediaBuffer);

  try {
    const totalDuration = await parseMediaDuration(tempInputPath);
    const shazam = new Shazam();
    let track = null;

    // Calcular offsets dinámicos basados en la duración total
    let offsets = [0, 8, 20, 35, 55, 80, 110, 150];
    if (totalDuration > 0) {
      if (totalDuration <= 25) {
        offsets = [0, 5];
      } else if (totalDuration <= 60) {
        offsets = [0, 10, 25, 40];
      } else if (totalDuration <= 180) {
        offsets = [0, 12, 30, 55, 85, 120, 150];
      } else {
        // Muestrear a lo largo del clip completo
        const step = Math.floor(totalDuration / 8);
        offsets = Array.from({ length: 8 }, (_, i) => i * step).filter(s => s < totalDuration - 5);
      }
    }

    // 1. Pasada estándar con offsets calculados
    for (const startSec of offsets) {
      let segmentWav = null;
      try {
        segmentWav = await convertToWavSegment(tempInputPath, startSec, 20, false);
        const shazamResult = await shazam.recognise(segmentWav);
        if (shazamResult && shazamResult.track) {
          track = shazamResult.track;
          break; // ¡Encontrado!
        }
      } catch (shazamErr) {
        console.warn(`[shazam] Offset ${startSec}s falló:`, shazamErr.message || shazamErr);
      } finally {
        if (segmentWav) {
          try { fs.unlinkSync(segmentWav); } catch (e) {}
        }
      }
    }

    // 2. Si la pasada estándar no funcionó, probar con audio normalizado/amplificado
    if (!track && offsets.length > 0) {
      const selectedOffsets = offsets.filter((_, idx) => idx % 2 === 0);
      for (const startSec of selectedOffsets) {
        let segmentWav = null;
        try {
          segmentWav = await convertToWavSegment(tempInputPath, startSec, 20, true);
          const shazamResult = await shazam.recognise(segmentWav);
          if (shazamResult && shazamResult.track) {
            track = shazamResult.track;
            break;
          }
        } catch (err) {
        } finally {
          if (segmentWav) {
            try { fs.unlinkSync(segmentWav); } catch (e) {}
          }
        }
      }
    }

    // 3. Si Shazam tuvo éxito, formatear respuesta
    if (track) {
      const title = track.title || "Desconocido";
      const artist = track.subtitle || "Desconocido";

      const songSection = track.sections?.find(s => s.type === "SONG");
      const album = songSection?.metadata?.find(m => m.title === "Album")?.text || "N/A";
      const releaseDate = songSection?.metadata?.find(m => m.title === "Released")?.text || "N/A";
      const genre = track.genres?.primary || "N/A";

      const shazamUrl = track.share?.href || track.url || "";
      const spotifyUrl = `https://open.spotify.com/search/${encodeURIComponent(`${title} ${artist}`)}`;
      const youtubeUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(`${title} ${artist}`)}`;

      const caption =
        `✦━【 🎵 *CANCIÓN IDENTIFICADA* 】━✦\n\n` +
        `🎵 *Título:* ${title}\n` +
        `🎤 *Artista:* ${artist}\n` +
        `💿 *Álbum:* ${album}\n` +
        `🏷️ *Género:* ${genre}\n` +
        `📅 *Lanzamiento:* ${releaseDate}\n\n` +
        (shazamUrl ? `🔗 *Shazam:* ${shazamUrl}\n` : "") +
        `🟢 *Spotify:* ${spotifyUrl}\n` +
        `🔴 *YouTube:* ${youtubeUrl}\n\n` +
        `✨ *Kurumi Tokisaki*`;

      const coverUrl = track.images?.coverarthdq || track.images?.coverart || track.share?.image;

      if (coverUrl) {
        try {
          const imgBuf = await downloadBuffer(coverUrl);
          await conn.sendMessage(m.chatId, { image: imgBuf, caption }, { quoted: m });
          return;
        } catch (e) {
          console.warn("[shazam] No se pudo descargar la portada HD:", e.message);
        }
      }

      await m.reply(caption);
      return;
    }

    // 4. Fallback: Probar con AudD
    try {
      const auddResult = await recognizeWithAudd(mediaBuffer);
      if (auddResult.status === "success" && auddResult.result) {
        const tr = auddResult.result;
        const title = tr.title || "Desconocido";
        const artist = tr.artist || "Desconocido";
        const album = tr.album || "N/A";
        const releaseDate = tr.release_date || "N/A";

        const caption =
          `✦━【 🎵 *CANCIÓN IDENTIFICADA* 】━✦\n\n` +
          `🎵 *Título:* ${title}\n` +
          `🎤 *Artista:* ${artist}\n` +
          `💿 *Álbum:* ${album}\n` +
          `📅 *Lanzamiento:* ${releaseDate}\n\n` +
          `✨ *Kurumi Tokisaki*`;

        await m.reply(caption);
        return;
      }
    } catch (auddErr) {
      console.warn("[shazam] Fallback AudD falló:", auddErr.message);
    }

    // Si ambos fallaron
    await m.reply(
      `✦━【 ❌ *CANCIÓN NO IDENTIFICADA* 】━✦\n\n` +
      `No se pudo reconocer la canción en este fragmento.\n\n` +
      `💡 *Consejos:*\n` +
      `• Asegúrate de que la música sea claramente audible\n` +
      `• Usa un fragmento con el estribillo o la parte con música principal\n` +
      `• Evita clips con mucho ruido de fondo o voz distorsionada\n\n` +
      `✨ *Kurumi Tokisaki*`
    );

  } catch (err) {
    console.error("[shazam] Error general:", err.message);
    let hint = "";
    if (err.message?.includes("ffmpeg")) {
      hint = "\n\n💡 ffmpeg no está disponible en el servidor.";
    }
    await m.reply(
      `✦━【 ❌ *ERROR DE ANÁLISIS* 】━✦\n\n` +
      `Ocurrió un problema al analizar la huella de sonido.${hint}\n\n` +
      `✨ *Kurumi Tokisaki*`
    );
  } finally {
    try { if (fs.existsSync(tempInputPath)) fs.unlinkSync(tempInputPath); } catch (e) {}
  }
};

handler.command = /^(shazam|recognize|reconocer|whatmusic|quemusica|quécanción|wacamúsica|detectmusic)$/i;
handler.description = "Identificar canción por audio/video (tipo Shazam)";
handler.category = "utiles";
handler.usage = "[responde a un audio/video]";
handler.cooldown = 5;

export default handler;
