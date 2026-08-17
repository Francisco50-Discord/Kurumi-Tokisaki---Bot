// ============================================================
//   Kurumi Tokisaki - Hentai Command
//   ────────────────────────
//   Category: hentai
// ============================================================

import { sendNsfwImage } from "../lib/nsfwFetcher.js";

const handler = async (m, { conn }) => {
  await sendNsfwImage(m, conn, "hentai", "Hentai");
};

handler.command = /^(hentai|hentais|h|hen|hentail)$/i;
handler.description = "Imagen hentai aleatoria";
handler.category = "nsfw";
handler.nsfw = true;
handler.cooldown = 5;

export default handler;
