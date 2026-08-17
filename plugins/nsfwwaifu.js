// ============================================================
//   Kurumi Tokisaki - NSFW Waifu Command
//   ────────────────────────
//   Category: nsfwwaifu
// ============================================================

import { sendNsfwImage } from "../lib/nsfwFetcher.js";

const handler = async (m, { conn }) => {
  await sendNsfwImage(m, conn, "nsfwwaifu", "NSFW Waifu");
};

handler.command = /^(nsfwwaifu|waifunsfw|lewdwaifu|nsfw_waifu)$/i;
handler.description = "Waifu NSFW aleatoria";
handler.category = "nsfw";
handler.nsfw = true;
handler.cooldown = 5;

export default handler;
