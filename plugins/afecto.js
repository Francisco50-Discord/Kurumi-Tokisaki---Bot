// ============================================================
//   Kurumi Tokisaki - Afecto Command
//   v20.0: Usa lib/animeMedia.js (waifu.pics muerto en 2026)
// ============================================================

import { getAnimeMediaUrl, sendAnimeMediaMessage } from "../lib/animeMedia.js";
import { getMainWaifu, getWaifus, updateWaifuAffection } from "../lib/database.js";
import { randomInt } from "../lib/utils.js";

const ACTIONS = ["pat", "hug", "cuddle", "kiss", "smile"];
const ACTION_TEXT = {
  pat: "acariciado la cabeza de",
  hug: "dado un cálido abrazo a",
  cuddle: "dado mimos a",
  kiss: "dado un tierno beso a",
  smile: "sonreído a",
};

async function fetchAffectionMedia() {
  const action = ACTIONS[Math.floor(Math.random() * ACTIONS.length)];
  const url = await getAnimeMediaUrl(action);
  return url ? { url, action } : null;
}

const handler = async (m, { conn, sender, args, usedPrefix }) => {
  const waifus = getWaifus(sender) || [];

  if (waifus.length === 0) {
    return m.reply(
      `✦━【 💕 *AFECTO* 】━✦\n\n\n` +
      `📭 No tienes waifus en tu colección para darle afecto.\n\n` +
      `🌸 Usa *${usedPrefix}waifu* para conseguir una!\n` +
      ``
    );
  }

  let targetWaifu = null;
  const input = args.join(" ").trim();

  if (input) {
    let index = parseInt(input);
    if (!isNaN(index) && index >= 1 && index <= waifus.length) {
      targetWaifu = waifus[index - 1];
    } else {
      targetWaifu = waifus.find(w => w.waifu_name.toLowerCase().includes(input.toLowerCase()));
    }
  }

  if (!targetWaifu) {
    targetWaifu = getMainWaifu(sender) || waifus[0];
  }

  const bonus = randomInt(15, 35);
  const updatedWaifu = updateWaifuAffection(sender, targetWaifu.waifu_name, bonus);

  const media = await fetchAffectionMedia();
  const imageUrl = media?.url || targetWaifu.waifu_image || targetWaifu.image_url;

  const actionText = media ? (ACTION_TEXT[media.action] || "demostrado amor a") : "demostrado amor a";

  const caption =
    `✦━【 💞 *AFECTO A TU WAIFU* 】━✦\n` +
    `\n\n` +
    `🌸 Le has ${actionText} *${targetWaifu.waifu_name}*!\n\n` +
    `📈 *Afecto ganado:* +${bonus}\n` +
    `❤️ *Afecto total:* ${updatedWaifu ? updatedWaifu.affection : (targetWaifu.affection + bonus)}\n\n` +
    `✨ ¡Tu personaje está feliz y te quiere aún más!\n` +
    ``;

  if (imageUrl) {
    await sendAnimeMediaMessage(conn, m.chatId, imageUrl, caption, { quoted: m });
  } else {
    await m.reply(caption);
  }
};

handler.command = /^(afecto|mimar|caricia|affection|darafecto)$/i;
handler.description = "Dar afecto a tu waifu con una imagen o GIF";
handler.category = "rpg";
handler.register = true;

export default handler;
