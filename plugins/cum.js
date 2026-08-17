// ============================================================
//   Kurumi Tokisaki - Cum Facial Command
//   Category: anime
// ============================================================

import { getFacialMedia } from "../lib/facialFetcher.js";
import { sendAnimeMediaMessage } from "../lib/animeMedia.js";
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
  const { url } = getFacialMedia(m.chatId);

  let caption;
  let mentions;

  if (target) {
    const targetJid = normalizeJid(target);
    const action = facialMessages[Math.floor(Math.random() * facialMessages.length)];
    caption = `✦━【 💦 *FACIAL DE ANIME* 】━✦\n\n💦 ${mention(senderJid)} ${action} ${mention(targetJid)}! ✨`;
    mentions = [senderJid, targetJid];
  } else {
    const solo = soloMessages[Math.floor(Math.random() * soloMessages.length)];
    caption = `✦━【 💦 *FACIAL DE ANIME* 】━✦\n\n💦 ${mention(senderJid)} ${solo}`;
    mentions = [senderJid];
  }

  try {
    await sendAnimeMediaMessage(conn, m.chatId, url, caption, {
      quoted: m,
      mentions,
    });
  } catch (error) {
    console.error("[cum] Error enviando contenido facial:", error);
    await m.reply("❌ No se pudo enviar el contenido facial. Inténtalo de nuevo en unos segundos.");
  }
};

handler.command = /^(cum|correrse|cummear|semenenlacara)$/i;
handler.description = "Enviar un GIF o imagen anime de facial";
handler.category = "anime";
handler.nsfw = false;
handler.cooldown = 5;

export default handler;
