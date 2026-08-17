// ============================================================
//   Kurumi Tokisaki - Change AI Personality Shortcut Command
// ============================================================

import { PERSONALITIES } from "./ia.js";
import { getUser, updateUser, getGroup, updateGroup } from "../lib/database.js";

const handler = async (m, { conn, args, body, sender, chatId, usedPrefix, isGroup, isAdmin, isOwner }) => {
  const targetKey = (args[0] || "").toLowerCase().trim();

  let currentKey = "asistente";
  if (isGroup) {
    const g = getGroup(chatId);
    currentKey = g?.ai_personality || "asistente";
  } else {
    const u = getUser(sender);
    currentKey = u?.ai_personality || "asistente";
  }

  if (!targetKey || targetKey === "lista" || targetKey === "menu" || targetKey === "help") {
    let menuText = `✦━【 🎭 *PERSONALIDADES DE LA IA* 】━✦\n\n` +
      `◈ *Personalidad Activa:* ${PERSONALITIES[currentKey]?.name || "Kurumi Tokisaki"} ${PERSONALITIES[currentKey]?.icon || "🌸"}\n\n` +
      `Elige una de las 5 personalidades disponibles para la IA:\n\n`;

    for (const [key, p] of Object.entries(PERSONALITIES)) {
      const isActive = key === currentKey;
      menuText += `${p.icon} *${p.name}* (${key})\n` +
        `   • *Estilo:* ${p.badge}\n` +
        `   • *Detalle:* ${p.description}\n` +
        `   • *Comando:* \`${usedPrefix}personalidad ${key}\` ${isActive ? "⬅️ *(ACTIVA)*" : ""}\n\n`;
    }

    menuText += `📌 *Uso:* Escribe \`${usedPrefix}personalidad <nombre>\` para cambiar la voz de la IA.` +
      (isGroup ? "\n🔐 En grupos, solo un administrador puede aplicar el cambio." : "");
    return m.reply(menuText);
  }

  if (!PERSONALITIES[targetKey]) {
    const keysList = Object.keys(PERSONALITIES).join(", ");
    return m.reply(
      `❌ *Personalidad no encontrada*\n────────\nLas opciones válidas son: *${keysList}*\n\n` +
      `Usa \`${usedPrefix}personalidad\` para ver la lista completa.`
    );
  }

  const p = PERSONALITIES[targetKey];
  if (isGroup && !isAdmin && !isOwner) {
    return m.reply(
      `✦━【 ❌ *PERMISO REQUERIDO* 】━✦\n\nCambiar la personalidad afecta a todo el grupo. Pide a un administrador que use \`${usedPrefix}personalidad ${targetKey}\`.`
    );
  }
  if (isGroup) {
    updateGroup(chatId, { ai_personality: targetKey });
  } else {
    updateUser(sender, { ai_personality: targetKey });
  }

  return m.reply(
    `✦━【 ✨ *PERSONALIDAD CAMBIADA* 】━✦\n\n` +
    `◈ *Nueva Voz:* ${p.name} ${p.icon}\n` +
    `◈ *Estilo:* ${p.badge}\n` +
    `◈ *Modo:* ${isGroup ? "Afecta a todo el grupo" : "Configuración personal"}\n\n` +
    `💬 *¡Hola!* Ahora la IA responderá con la actitud de *${p.name}*.`
  );
};

handler.command = /^(personalidad|personalidades|iapersonalidad|iagrupo|iagrupopersonalidad|iasim|simi)$/i;
handler.description = "Ver y cambiar las 5 personalidades de la IA (Kurumi, Tsundere, Waifu, Asistente, Yandere)";
handler.category = "ia";

export default handler;
