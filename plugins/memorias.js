// ============================================================
//   Kurumi Tokisaki - Plugin de Memorias Persistentes de IA
// ============================================================

import { getUserMemories, setUserMemory, deleteUserMemory } from "../lib/database.js";

const handler = async (m, { conn, args, text, sender, usedPrefix }) => {
  const command = (m.command || "").toLowerCase();

  // Olvidar una memoria: !olvida <clave>
  if (command === "olvida" || command === "olvidar" || command === "delmemoria") {
    const key = (text || "").trim();
    if (!key) {
      return m.reply(`⚠️ Indica qué dato deseas que olvide. Ejemplo: \`${usedPrefix}olvida cumpleaños\``);
    }
    const success = deleteUserMemory(sender, key);
    if (success) {
      return m.reply(`🗑️ *Memoria borrada:* He olvidado el dato de "*${key}*".`);
    } else {
      return m.reply(`❌ No tenía guardado ninguna memoria registrada con el nombre "*${key}*".`);
    }
  }

  // Recordar un dato explícito: !recuerda <clave> : <valor>  o  !guardarmemoria <clave> : <valor>
  if (command === "recuerda" || command === "guardarmemoria" || command === "recordardato") {
    if (!text || !text.includes(":")) {
      return m.reply(
        `📌 *Uso:* \`${usedPrefix}recuerda <clave> : <valor>\`\n\n` +
        `Ejemplos:\n` +
        `• \`${usedPrefix}recuerda cumpleaños : 15 de marzo\`\n` +
        `• \`${usedPrefix}recuerda comida favorita : Ramen de cerdo\`\n` +
        `• \`${usedPrefix}recuerda anime favorito : Date A Live\`\n` +
        `• \`${usedPrefix}recuerda apodo : Pancho\``
      );
    }

    const parts = text.split(":");
    const key = parts[0].trim();
    const val = parts.slice(1).join(":").trim();

    if (!key || !val) {
      return m.reply(`❌ La clave y el valor no pueden estar vacíos.`);
    }

    const memory = setUserMemory(sender, key, val);
    return m.reply(
      `✦━【 🧠 *MEMORIA PERSISTENTE GUARDADA* 】━✦\n\n` +
      `◈ *Clave:* ${memory.key}\n` +
      `◈ *Dato:* ${memory.value}\n\n` +
      `✨ *¡Guardado!* Recordaré esto sin importar qué personalidad de IA tengas activa.`
    );
  }

  // Ver lista de memorias: !memorias / !mismemorias
  const memories = getUserMemories(sender);
  const keys = Object.keys(memories);

  if (keys.length === 0) {
    return m.reply(
      `✦━【 🧠 *MIS MEMORIAS PERSISTENTES* 】━✦\n\n` +
      `📌 *Actualmente no tengo datos guardados sobre ti.*\n\n` +
      `Puedes guardar información para que la IA la recuerde siempre (cumpleaños, gustos, apodos, etc.) usando:\n` +
      `👉 \`${usedPrefix}recuerda <clave> : <valor>\`\n` +
      `*(O simplemente dímelo por chat a la IA y se guardará automáticamente)*`
    );
  }

  let msg = `✦━【 🧠 *MIS MEMORIAS PERSISTENTES* 】━✦\n\n` +
    `La IA recordará estos datos en *todas* sus personalidades (Kurumi, Tsundere, Waifu, Asistente, Yandere):\n\n`;

  keys.forEach((k, idx) => {
    const mem = memories[k];
    msg += `*${idx + 1}.* 📌 *${mem.key}:* ${mem.value}\n`;
  });

  msg += `\n💡 *Para añadir más:* \`${usedPrefix}recuerda <clave> : <valor>\`\n` +
    `💡 *Para borrar uno:* \`${usedPrefix}olvida <clave>\``;

  return m.reply(msg);
};

handler.command = /^(memorias|mismemorias|recuerda|guardarmemoria|recordardato|olvida|olvidar|delmemoria)$/i;
handler.description = "Ver, guardar y borrar la memoria persistente que la IA recuerda de ti";
handler.category = "ia";

export default handler;
