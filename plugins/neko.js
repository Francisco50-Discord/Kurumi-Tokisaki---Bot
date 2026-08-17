// ============================================================
//   Kurumi Tokisaki - Neko Girl Command (SFW)
//   v20.0: Usa lib/animeMedia.js (nekos.best, waifu.im, waifu.pics caídos en 2026)
// ============================================================

import { getAnimeMediaUrl } from "../lib/animeMedia.js";

const handler = async (m, { conn }) => {
  try {
    // nekos.life vía helper centralizado
    const nekoUrl = await getAnimeMediaUrl("neko");

    if (!nekoUrl) {
      return m.reply(`✦━【 ❌ *ERROR* 】━✦\n\nNo se pudo obtener la chica neko. Intenta de nuevo en unos segundos.`);
    }

    const caption =
      `✦━【 🐱 *CHICA GATO* 】━✦\n` +
      `🐾 ¡Una tierna neko aleatoria para ti! ¡Nya~! ✨\n` +
      ``;

    await conn.sendMessage(m.chatId, {
      image: { url: nekoUrl },
      caption: caption
    }, { quoted: m });

  } catch (err) {
    console.error("Error en neko command:", err);
    await m.reply(`✦━【 ❌ *ERROR* 】━✦\n\nError al procesar la imagen neko.`);
  }
};

handler.command = /^(neko|nekogirl|chicagato)$/i;
handler.description = "Imagen de chica gato (neko) aleatoria de API externa";
handler.category = "anime";
handler.cooldown = 3;

export default handler;
