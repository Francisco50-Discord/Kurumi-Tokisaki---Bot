// ============================================================
//   Kurumi Tokisaki - Cum Facial Command
//   Category: anime
// ============================================================

import { getFacialGif, getFacialImage, markFacialMediaUnavailable } from "../lib/facialFetcher.js";
import { sendAnimeMediaMessage } from "../lib/animeMedia.js";
import { downloadMediaBuffer, getNsfwImageCandidate } from "../lib/nsfwFetcher.js";
import { normalizeJid, resolveTargetJid } from "../lib/utils.js";

const facialMessages = [
  "se corrió en la cara de",
  "le dejó la cara llena de cariño a",
  "le estampó una sorpresa cremosa en la cara a",
  "le decoró la cara con su afecto a",
  "le dio un facial inesperado a",
  "le dejó un recuerdo pegajoso en la cara a",
  "le bañó la carita con toda su pasión a",
  "le puso la cara en modo brillo intenso a",
  "le regaló un acabado extra brillante a",
  "le dio una lluvia de amor directamente en la cara a",
  "le dejó la carita con una nueva iluminación a",
  "le aplicó el filtro facial más atrevido a",
];

const soloMessages = [
  "se corrió en su propia cara y ahora brilla más que antes.",
  "se preparó un facial sorpresa de anime. Qué manera de presumir brillo.",
  "activó el modo carita brillante. La confianza está por las nubes.",
  "recibió un facial improvisado y decidió llevarlo con orgullo.",
  "se quedó con la cara reluciente. La escena fue demasiado intensa.",
  "se dio un baño facial de pura energía y salió con aura de protagonista.",
  "dejó que el destino hiciera lo suyo y terminó con un brillo sospechoso.",
  "presumió su nuevo acabado brillante como si fuera una transformación final.",
];

function mention(jid) {
  const normalized = normalizeJid(jid);
  return `@${normalized.split("@")[0].split(":")[0]}`;
}

const handler = async (m, { conn, args, sender }) => {
  const senderJid = normalizeJid(sender || m.sender);
  const target = await resolveTargetJid(m, args, conn);
  let caption;
  let mentions;

  if (target) {
    const targetJid = normalizeJid(target);
    const action = facialMessages[Math.floor(Math.random() * facialMessages.length)];
    caption = `✦━【 💦 *FACIAL DE ANIME* 】━✦\n\n💦 ${action} ${mention(targetJid)}! ✨`;
    mentions = [targetJid];
  } else {
    const solo = soloMessages[Math.floor(Math.random() * soloMessages.length)];
    caption = `✦━【 💦 *FACIAL DE ANIME* 】━✦\n\n💦 ${mention(senderJid)} ${solo}`;
    mentions = [senderJid];
  }

  const sendFacialMedia = async (selectedMedia, extraOptions = {}) => {
    if (!selectedMedia?.url) throw new Error("medio facial sin URL");
    const remote = typeof selectedMedia.url === "string" && /^https?:\/\//i.test(selectedMedia.url);
    const preloadedBuffer = remote
      ? await downloadMediaBuffer(selectedMedia.url, {
        timeout: 16000,
        maxBytes: 28 * 1024 * 1024,
      })
      : undefined;
    if (remote && (!preloadedBuffer || preloadedBuffer.length < 1000)) {
      throw new Error("medio facial remoto vacío");
    }
    return sendAnimeMediaMessage(conn, m.chatId, selectedMedia.url, caption, {
      quoted: m,
      mentions,
      preloadedBuffer,
      // No se envía un GIF como imagen si falla la conversión: eso produce el
      // recuadro vacío que WhatsApp muestra para medios animados incompatibles.
      allowAnimatedFallback: false,
      ...extraOptions,
    });
  };

  const tryVerifiedGifs = async () => {
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const gif = getFacialGif(m.chatId);
      if (!gif) return false;
      try {
        await sendFacialMedia(gif, { forceAnimated: true });
        return true;
      } catch (error) {
        markFacialMediaUnavailable(gif.url);
        console.warn(`[cum] GIF verificado rechazado (${attempt + 1}/6):`, error.message);
      }
    }
    return false;
  };

  if (await tryVerifiedGifs()) return;
  console.warn("[cum] GIFs verificados no disponibles; probando fuentes faciales filtradas");
  try {
      // El respaldo consulta Danbooru, Xbooru, Yandere y Konachan con la
      // categoría `facial`; nsfwFetcher aplica cum_on_face y exclusiones de
      // genitales, pecho, oral, animales y presencia masculina.
      const candidate = await getNsfwImageCandidate("facial", {
        scopeKey: m.chatId,
        allowAnimated: true,
      });
      if (!candidate?.url) throw new Error("sin candidato facial filtrado");
      const buffer = candidate.preloadedBuffer || await downloadMediaBuffer(candidate.url, {
        timeout: 16000,
        maxBytes: 28 * 1024 * 1024,
      });
      if (!buffer || buffer.length < 1000) throw new Error("candidato facial vacío");
      await sendAnimeMediaMessage(conn, m.chatId, candidate.url, caption, {
        quoted: m,
        mentions,
        preloadedBuffer: buffer,
        allowAnimatedFallback: false,
      });
    } catch (filteredError) {
      console.warn("[cum] Fuentes faciales filtradas no disponibles; usando imagen aprobada local:", filteredError.message);
      try {
        const fallback = getFacialImage(m.chatId);
        await sendFacialMedia(fallback);
      } catch (fallbackError) {
        console.error("[cum] Error enviando contenido facial:", fallbackError);
        await m.reply("❌ No se pudo enviar el contenido facial. Inténtalo de nuevo en unos segundos.");
      }
    }
};

handler.command = /^(cum|correrse|cummear|semenenlacara)$/i;
handler.description = "Enviar un GIF o imagen anime de facial";
handler.category = "anime";
handler.nsfw = false;
handler.cooldown = 5;

export default handler;
