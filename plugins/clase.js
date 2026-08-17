// ============================================================
//   Kurumi Tokisaki - Clase RPG Command
// ============================================================

import { getUser, updateUser } from "../lib/database.js";

const CLASSES = {
  Novato: { emoji: "👤", bonus: {} },
  Guerrero: { emoji: "⚔️", bonus: { attack: 5, defense: 3 } },
  Mago: { emoji: "🧙", bonus: { attack: 8, speed: 3 } },
  Arquero: { emoji: "🏹", bonus: { speed: 8, attack: 3 } },
  Sanador: { emoji: "💚", bonus: { defense: 5, health: 20 } },
  Asesino: { emoji: "🗡️", bonus: { attack: 10, speed: 5 } },
  Paladín: { emoji: "🛡️", bonus: { defense: 8, health: 15 } },
  Nigromante: { emoji: "💀", bonus: { attack: 7, defense: 2 } },
};

const handler = async (m, { args, sender, usedPrefix }) => {
  const user = getUser(sender);

  if (!args[0]) {
    const classList = Object.entries(CLASSES)
      .map(([name, info]) => `» ${info.emoji} *${name}*`)
      .join("\n");
    return m.reply(
      `✦━【 🔮 *CLASES* 】━✦\n\n` +
      `${classList}\n\n` +
      `💡 Usa *${usedPrefix}clase <nombre>*\n` +
      `◈ Tu clase actual: *${user.class}*`
    );
  }

  const className = args.join(" ");
  const classKey = Object.keys(CLASSES).find(
    (k) => k.toLowerCase() === className.toLowerCase()
  );

  if (!classKey) {
    return m.reply(`❌ Clase no encontrada. Usa *${usedPrefix}clase* para ver las disponibles.`);
  }

  if (user.level < 3 && classKey !== "Novato") {
    return m.reply("❌ Necesitas al menos nivel 3 para cambiar de clase.");
  }

  updateUser(sender, { class: classKey });
  const classInfo = CLASSES[classKey];

  await m.reply(
    `✦━【 🔮 *CLASE CAMBIADA* 】━✦\n\n` +
    `✅ Ahora eres *${classKey}* ${classInfo.emoji}\n` +
    `✨ ¡Stats actualizados!`
  );
};

handler.command = /^(clase|class|cambiarclase)$/i;
handler.description = "Cambiar de clase RPG";
handler.category = "rpg";
handler.register = true;

export default handler;
