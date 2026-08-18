// ============================================================
//   Kurumi Tokisaki - Fuck Anime Command
//   Category: anime
// ============================================================

import { sendNsfwMixedMedia } from "../lib/nsfwFetcher.js";
import { normalizeJid, resolveTargetJid } from "../lib/utils.js";

const targetMessages = [
  "se fue directo a la acción con",
  "se dejó llevar por la pasión junto a",
  "se puso en modo travieso con",
  "se entregó a una sesión intensa con",
  "terminó en una noche de pasión con",
  "se olvidó del mundo y empezó a follar con",
  "convirtió el chat en una escena subida de tono con",
  "se dejó llevar por el deseo junto a",
  "se metió en problemas deliciosos con",
  "decidió que hoy tocaba una sesión privada con",
  "se fue al catre sin perder tiempo con",
  "acabó compartiendo una escena intensa con"
];

const soloMessages = [
  "se puso en modo pasión y acabó en una escena subida de tono.",
  "activó el modo travieso; hoy no piensa comportarse.",
  "se dejó llevar por el deseo y la noche se volvió intensa.",
  "encontró una escena privada y decidió no desperdiciarla.",
  "se metió en problemas de adultos y parece bastante feliz.",
  "declaró oficialmente inaugurada su sesión de pasión.",
  "se fue directo al modo +18 con una confianza peligrosa.",
  "convirtió la noche en una aventura demasiado intensa."
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
    const action = targetMessages[Math.floor(Math.random() * targetMessages.length)];
    caption = `✦━【 🔥 *SESIÓN INTENSA* 】━✦\n\n🔥 ${mention(senderJid)} ${action} ${mention(targetJid)}! 🔞`;
    mentions = [senderJid, targetJid];
  } else {
    const solo = soloMessages[Math.floor(Math.random() * soloMessages.length)];
    caption = `✦━【 🔥 *SESIÓN INTENSA* 】━✦\n\n🔥 ${mention(senderJid)} ${solo}`;
    mentions = [senderJid];
  }

  try {
    await sendNsfwMixedMedia(m, conn, "fuck", caption, { mentions });
  } catch (error) {
    console.error("[fuck] Error enviando medio anime:", error);
    await m.reply("❌ No se pudo enviar la escena. Inténtalo de nuevo en unos segundos.");
  }
};

handler.command = /^(fuck)$/i;
handler.description = "Enviar un GIF o imagen anime de sexo adulto";
handler.category = "anime";
handler.nsfw = false;
handler.cooldown = 5;

export default handler;

