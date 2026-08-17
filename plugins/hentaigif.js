// ============================================================
//   Kurumi Tokisaki - Hentai GIF / Animated Media Command
// ============================================================

import { sendNsfwVideo } from "../lib/nsfwFetcher.js";

const handler = async (m, { conn }) => {
  await sendNsfwVideo(m, conn, "Hentai GIF");
};

handler.command = /^(hentaigif|hgif|hentai_gif)$/i;
handler.description = "Clip hentai animado";
handler.category = "nsfw";
handler.nsfw = true;
handler.cooldown = 12;

export default handler;
