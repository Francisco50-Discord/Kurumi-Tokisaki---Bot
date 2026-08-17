// ============================================================
//   Kurumi Tokisaki - Reacciones y GIFs de Anime
//   v22.0: Soporte directo para comandos individuales (/besar,
//   /abrazar, /pat, /slap, /cuddle, /dance, /smile, /cry, etc.)
// ============================================================

import { getAnimeMediaUrl, sendAnimeMediaMessage } from "../lib/animeMedia.js";
import { normalizeJid, resolveTargetJid } from "../lib/utils.js";

// Mapa de comandos a categorías y mensajes dinámicos
const ACTION_MAP = {
  // Beso
  kiss: { endpoint: "kiss", emoji: "💋", title: "¡BESO!", actionText: "le da un tierno beso a", soloText: "manda un tierno beso con mucho amor! 💖" },
  beso: { endpoint: "kiss", emoji: "💋", title: "¡BESO!", actionText: "le da un tierno beso a", soloText: "manda un tierno beso con mucho amor! 💖" },
  besar: { endpoint: "kiss", emoji: "💋", title: "¡BESO!", actionText: "le da un tierno beso a", soloText: "manda un tierno beso con mucho amor! 💖" },

  // Abrazo
  hug: { endpoint: "hug", emoji: "🤗", title: "¡ABRAZO!", actionText: "le da un cálido abrazo a", soloText: "le manda un cálido abrazo a todos! 💕" },
  abrazo: { endpoint: "hug", emoji: "🤗", title: "¡ABRAZO!", actionText: "le da un cálido abrazo a", soloText: "le manda un cálido abrazo a todos! 💕" },
  abrazar: { endpoint: "hug", emoji: "🤗", title: "¡ABRAZO!", actionText: "le da un cálido abrazo a", soloText: "le manda un cálido abrazo a todos! 💕" },

  // Caricias en la cabeza
  pat: { endpoint: "pat", emoji: "🫳", title: "¡CARICIAS!", actionText: "le acaricia suavemente la cabeza a", soloText: "pide caricias en la cabeza! ✨" },
  acariciar: { endpoint: "pat", emoji: "🫳", title: "¡CARICIAS!", actionText: "le acaricia suavemente la cabeza a", soloText: "pide caricias en la cabeza! ✨" },

  // Bofetada / Cachetada
  slap: { endpoint: "slap", emoji: "🖐️", title: "¡BOFETADA!", actionText: "le da una tremenda bofetada a", soloText: "da una bofetada al aire! 💥" },
  bofetada: { endpoint: "slap", emoji: "🖐️", title: "¡BOFETADA!", actionText: "le da una tremenda bofetada a", soloText: "da una bofetada al aire! 💥" },
  cachetada: { endpoint: "slap", emoji: "🖐️", title: "¡CACHETADA!", actionText: "le da una cachetada a", soloText: "da una bofetada al aire! 💥" },

  // Acurrucarse / Mimos
  cuddle: { endpoint: "cuddle", emoji: "🫂", title: "¡MIMOS!", actionText: "se acurruca dulcemente con", soloText: "quiere mimos y acurrucarse! 🥰" },
  mimo: { endpoint: "cuddle", emoji: "🫂", title: "¡MIMOS!", actionText: "le da mimos a", soloText: "quiere mimos y acurrucarse! 🥰" },
  acurrucar: { endpoint: "cuddle", emoji: "🫂", title: "¡ACURRUCAR!", actionText: "se acurruca dulcemente con", soloText: "quiere mimos y acurrucarse! 🥰" },

  // Cosquillas
  tickle: { endpoint: "tickle", emoji: "👉", title: "¡COSQUILLAS!", actionText: "le hace cosquillas sin piedad a", soloText: "empieza a hacer cosquillas! 🤭" },
  cosquillas: { endpoint: "tickle", emoji: "👉", title: "¡COSQUILLAS!", actionText: "le hace cosquillas sin piedad a", soloText: "empieza a hacer cosquillas! 🤭" },

  // Alimentar
  feed: { endpoint: "feed", emoji: "🍱", title: "¡COMIDA!", actionText: "le da de comer en la boca a", soloText: "está disfrutando de una rica comida! 😋" },
  alimentar: { endpoint: "feed", emoji: "🍱", title: "¡ALIMENTAR!", actionText: "le da de comer en la boca a", soloText: "está disfrutando de una rica comida! 😋" },

  // Bailar
  dance: { endpoint: "dance", emoji: "💃", title: "¡A BAILAR!", actionText: "se pone a bailar alegremente con", soloText: "se pone a bailar con mucho ritmo! 🎶" },
  bailar: { endpoint: "dance", emoji: "💃", title: "¡A BAILAR!", actionText: "se pone a bailar alegremente con", soloText: "se pone a bailar con mucho ritmo! 🎶" },

  // Sonreír
  smile: { endpoint: "smile", emoji: "😊", title: "¡SONRISA!", actionText: "le dedica una linda sonrisa a", soloText: "sonríe alegremente! ✨" },
  sonreir: { endpoint: "smile", emoji: "😊", title: "¡SONRISA!", actionText: "le dedica una linda sonrisa a", soloText: "sonríe alegremente! ✨" },
  sonreír: { endpoint: "smile", emoji: "😊", title: "¡SONRISA!", actionText: "le dedica una linda sonrisa a", soloText: "sonríe alegremente! ✨" },

  // Sonrojarse
  blush: { endpoint: "blush", emoji: "😳", title: "¡SONROJO!", actionText: "se sonroja apenado/a al ver a", soloText: "se sonroja apenado/a! 💖" },
  sonrojar: { endpoint: "blush", emoji: "😳", title: "¡SONROJO!", actionText: "se sonroja apenado/a al ver a", soloText: "se sonroja apenado/a! 💖" },
  sonrojarse: { endpoint: "blush", emoji: "😳", title: "¡SONROJO!", actionText: "se sonroja apenado/a al ver a", soloText: "se sonroja apenado/a! 💖" },

  // Llorar
  cry: { endpoint: "cry", emoji: "😭", title: "¡LLANTO!", actionText: "rompe en llanto desconsoladamente ante", soloText: "está llorando desconsoladamente... 💔" },
  llorar: { endpoint: "cry", emoji: "😭", title: "¡LLANTO!", actionText: "rompe en llanto desconsoladamente ante", soloText: "está llorando desconsoladamente... 💔" },

  // Presumir / Smug
  smug: { endpoint: "smug", emoji: "😏", title: "¡PRESUNTUOSO!", actionText: "mira con cara presuntuosa a", soloText: "mira a todos con una sonrisa presuntuosa! 😼" },
  presumir: { endpoint: "smug", emoji: "😏", title: "¡PRESUNTUOSO!", actionText: "mira con cara presuntuosa a", soloText: "mira a todos con una sonrisa presuntuosa! 😼" },

  // Maullar / Meow
  meow: { endpoint: "meow", emoji: "🐱", title: "¡MAULLIDO NEKO!", actionText: "le maúlla lindamente como una chica neko a", soloText: "maúlla como una adorable chica neko! nya~ 🐾 🐱" },
  maullar: { endpoint: "meow", emoji: "🐱", title: "¡MAULLIDO NEKO!", actionText: "le maúlla lindamente como una chica neko a", soloText: "maúlla como una adorable chica neko! nya~ 🐾 🐱" },

  // Enojo / Angry
  angry: { endpoint: "angry", emoji: "💢", title: "¡ENOJO!", actionText: "se enoja duramente con", soloText: "está muy enojado/a! 💢" },
  enojar: { endpoint: "angry", emoji: "💢", title: "¡ENOJO!", actionText: "se enoja duramente con", soloText: "está muy enojado/a! 💢" },
  enojo: { endpoint: "angry", emoji: "💢", title: "¡ENOJO!", actionText: "se enoja duramente con", soloText: "está muy enojado/a! 💢" },
};

const handler = async (m, { conn, args, command, sender }) => {
  const cmd = (command || "").toLowerCase();
  
  // Si usó el comando genérico /gif o /reaction, comprobar si se le pasó un subcomando en args[0]
  let actionKey = cmd;
  if (["gif", "animegif", "reaction"].includes(cmd)) {
    const sub = args[0] ? args[0].toLowerCase() : null;
    if (sub && ACTION_MAP[sub]) {
      actionKey = sub;
    } else {
      // Elegir una acción aleatoria de las disponibles
      const keys = Object.keys(ACTION_MAP);
      actionKey = keys[Math.floor(Math.random() * keys.length)];
    }
  }

  const config = ACTION_MAP[actionKey] || {
    endpoint: actionKey,
    emoji: "🎬",
    title: "REACCIÓN",
    actionText: "reacciona hacia",
    soloText: "está reaccionando! ✨"
  };

  // Determinar el objetivo (target JID)
  let target = await resolveTargetJid(m, args, conn);

  try {
    const mediaUrl = await getAnimeMediaUrl(config.endpoint);
    if (!mediaUrl) {
      return m.reply(`✦━【 ❌ *ERROR* 】━✦\n\nNo se pudo obtener la reacción. Intenta de nuevo.`);
    }

    const senderJid = normalizeJid(sender);
    const senderNum = senderJid.split("@")[0].split(":")[0];
    const senderName = `@${senderNum}`;
    let caption = "";
    let mentionsList = [senderJid];

    if (target) {
      const targetJid = normalizeJid(target);
      const targetNum = targetJid.split("@")[0].split(":")[0];
      const targetName = `@${targetNum}`;
      caption = `✦━【 ${config.emoji} *${config.title}* 】━✦\n\n${config.emoji} ${senderName} ${config.actionText} ${targetName}! ✨`;
      mentionsList = [senderJid, targetJid];
    } else {
      caption = `✦━【 ${config.emoji} *${config.title}* 】━✦\n\n${config.emoji} ${senderName} ${config.soloText}`;
    }

    await sendAnimeMediaMessage(
      conn,
      m.chatId,
      mediaUrl,
      caption,
      { quoted: m, mentions: mentionsList }
    );

  } catch (err) {
    console.error("Error en comandos de reacción:", err);
    await m.reply(`❌ *Error al procesar la reacción de anime.*`);
  }
};

handler.command = /^(gif|animegif|reaction|kiss|beso|besar|hug|abrazo|abrazar|pat|acariciar|slap|bofetada|cachetada|cuddle|mimo|acurrucar|tickle|cosquillas|feed|alimentar|dance|bailar|smile|sonreir|sonreír|blush|sonrojar|sonrojarse|cry|llorar|smug|presumir|meow|maullar|angry|enojar|enojo)$/i;
handler.description = "Reacciones e interacciones de anime (beso, abrazo, caricias, bailar, etc.)";
handler.category = "anime";
handler.cooldown = 3;

export default handler;
