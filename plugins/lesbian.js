// ============================================================
//   Kurumi Tokisaki - Lesbian Command
//   ────────────────────────
//   Category: lesbian
// ============================================================

import { sendNsfwImage } from "../lib/nsfwFetcher.js";

const handler = async (m, { conn }) => {
  await sendNsfwImage(m, conn, "lesbian", "Lesbian");
};

handler.command = /^(lesbian|lesbiana)$/i;
handler.description = "Imagen lesbian NSFW";
handler.category = "nsfw";
handler.nsfw = true;
handler.cooldown = 5;

export default handler;
