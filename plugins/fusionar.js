// ============================================================
//   Kurumi Tokisaki - Fusionar Waifus Command
// ============================================================

import { fuseWaifus } from "../lib/database.js";

const handler = async (m, { conn, sender, args, usedPrefix }) => {
  if (args.length < 2) {
    return m.reply(
      `✦━【 🔮 *SISTEMA DE FUSIÓN* 】━✦\n\n` +
      `🧬 *Sintaxis:* \`${usedPrefix}fusionar <#1> <#2>\`\n` +
      `\n` +
      `💡 *Ejemplos:*\n` +
      `• \`${usedPrefix}fusionar 1 2\`\n` +
      `• \`${usedPrefix}fusionar "Kurumi" "Kurumi #2"\`\n` +
      `\n` +
      `🌟 *Beneficios:*\n` +
      `• Fused 2 personajes para elevar su rareza:\n` +
      `  Común ➔ Rara ➔ Épica ➔ Legendaria ➔ Mítica ➔ Divina\n` +
      `• ¡Obtén +200 de Afecto/Poder y conserva tu personaje más fuerte!\n` +
      ``
    );
  }

  const input1 = args[0];
  const input2 = args.slice(1).join(" ");

  const res = fuseWaifus(sender, input1, input2);

  if (!res.success) {
    return m.reply(`✦━【 🔮 *ERROR DE FUSIÓN* 】━✦\n\n${res.error}\n\n✨ *Kurumi Tokisaki*`);
  }

  const w = res.fusedWaifu;
  const img = w.waifu_image || w.image_url;

  const caption = 
    `✦━【 🔮 *FUSIÓN EXITOSA* 】━✦\n\n` +
    `🧬 *Personaje resultado:* ${w.waifu_name}\n` +
    `💥 *Personaje consumido:* ${res.consumed}\n` +
    `\n` +
    `⭐ *Rareza anterior:* ${res.previousRarity}\n` +
    `👑 *NUEVA RAREZA:* *${res.newRarity}*\n` +
    `❤️ *NUEVO AFECTO/PODER:* ${res.newAffection} (✨ +200 Bonus)\n` +
    `\n` +
    `🎉 ¡Tu personaje ha evolucionado y alcanzado un nuevo nivel de poder!\n` +
    ``;

  if (img) {
    try {
      return await conn.sendMessage(m.chatId, { image: { url: img }, caption }, { quoted: m });
    } catch (e) {
      // Fallback si falla la carga de la imagen
    }
  }

  return m.reply(caption);
};

handler.command = /^(fusionar|fusi[oó]n|fusion|fusewaifu)$/i;
handler.description = "Fusionar 2 personajes para aumentar su rareza y poder";
handler.category = "rpg";
handler.register = true;

export default handler;
