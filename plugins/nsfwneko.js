// ============================================================
//   Kurumi Tokisaki - NSFW Neko Command
//   ────────────────────────
//   Category: nsfwneko
// ============================================================

import { sendNsfwImage } from "../lib/nsfwFetcher.js";

const handler = async (m, { conn }) => {
  await sendNsfwImage(m, conn, "nsfwneko", "NSFW Neko");
};

handler.command = /^(neko18|nsfwneko|nekoplus|nsfw_neko|neko_lewd|nekoNSFW)$/i;
handler.description = "Neko NSFW aleatoria";
handler.category = "nsfw";
handler.nsfw = true;
handler.cooldown = 5;

export default handler;
