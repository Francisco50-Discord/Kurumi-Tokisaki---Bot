// ============================================================
//   Kurumi Tokisaki - Mi Waifu Favorita Command
// ============================================================

import { getWaifus, getMainWaifu, setMainWaifu } from "../lib/database.js";
import { getAnimeMediaUrl } from "../lib/animeMedia.js";

async function getFallbackImage() {
  // v20.0: nekos.life vía helper centralizado (waifu.pics y nekos.best caídos)
  const url = await getAnimeMediaUrl("waifu");
  if (url) return url;
  return "https://i.imgur.com/8N4a37R.jpeg";
}

const handler = async (m, { sender, conn, args, usedPrefix }) => {
  const waifus = getWaifus(sender) || [];

  if (waifus.length === 0) {
    return m.reply(
      `✦━【 💗 *MI WAIFU FAVORITA* 】━✦\n\n\n` +
      `📭 Aún no tienes waifus en tu colección.\n\n` +
      `🌸 Usa *${usedPrefix}waifu* o *${usedPrefix}gacha*\n` +
      `   para conseguir tu primera waifu!\n` +
      ``
    );
  }

  // Permitir establecer waifu favorita directamente o con 'set':
  // ej: !miwaifu set 2 | !miwaifu Kurumi | !miwaifu 1
  let selectionQuery = null;
  if (args[0]) {
    if (["set", "fav", "seleccionar", "elegir"].includes(args[0].toLowerCase())) {
      selectionQuery = args.slice(1).join(" ").trim();
    } else {
      selectionQuery = args.join(" ").trim();
    }
  }

  if (selectionQuery) {
    let targetInput = selectionQuery;
    let index = parseInt(selectionQuery);
    if (!isNaN(index) && index >= 1 && index <= waifus.length) {
      targetInput = waifus[index - 1].waifu_name;
    }

    const updated = setMainWaifu(sender, targetInput);
    if (!updated) {
      return m.reply(`❌ No se encontró el personaje "${selectionQuery}" en tu colección. Usa \`${usedPrefix}coleccion\` para ver tus waifus.`);
    }

    const img = updated.waifu_image || updated.image_url || await getFallbackImage();

    return conn.sendMessage(m.chatId, {
      image: { url: img },
      caption: 
        `✦━【 💖 *WAIFU FAVORITA* 】━✦\n\n` +
        `🌸 *${updated.waifu_name}* es ahora tu waifu favorita!\n` +
        `💎 *Rareza:* ${updated.rarity || "Común"}\n` +
        `❤️ *Afecto:* ${updated.affection || 0}\n` +
        `📅 *Obtenida:* ${updated.obtained_at ? new Date(updated.obtained_at).toLocaleDateString() : "Recientemente"}\n\n` +
        `💗 Usa *${usedPrefix}afecto* para interactuar con ella.\n` +
        ``
    }, { quoted: m });
  }

  // Obtener la waifu principal o favorita del usuario
  let mainWaifu = getMainWaifu(sender) || waifus[0];
  let imageUrl = mainWaifu.waifu_image || mainWaifu.image_url;

  if (!imageUrl) {
    imageUrl = await getFallbackImage();
  }

  const caption = 
    `✦━【 💗 *MI WAIFU FAVORITA* 】━✦\n` +
    `\n` +
    `👤 *Nombre:* ${mainWaifu.waifu_name}\n` +
    `💎 *Rareza:* ${mainWaifu.rarity || "Común"}\n` +
    `❤️ *Afecto:* ${mainWaifu.affection || 0}\n` +
    `👑 *Estado:* Favorita Principal\n` +
    `📅 *Obtenida:* ${mainWaifu.obtained_at ? new Date(mainWaifu.obtained_at).toLocaleDateString() : "Recientemente"}\n\n` +
    `🌸 ¡Es el personaje favorito de tu colección!\n` +
    `💗 Usa *${usedPrefix}afecto* para darle cariño (+afecto)\n` +
    `⚙️ Usa *${usedPrefix}miwaifu <nombre o número>* para cambiar de favorita\n` +
    ``;

  // Siempre adjuntar la imagen de la waifu favorita del usuario
  await conn.sendMessage(m.chatId, {
    image: { url: imageUrl },
    caption: caption
  }, { quoted: m });
};

handler.command = /^(miwaifu|waifumain|favwaifu|miwaifufav)$/i;
handler.description = "Ver o establecer la imagen de tu waifu favorita";
handler.category = "rpg";
handler.register = true;

export default handler;
