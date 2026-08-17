// ============================================================
//   Kurumi Tokisaki - Ahegao Command
//   ────────────────────────
//   Category: ahegao
// ============================================================

import { sendNsfwImage } from "../lib/nsfwFetcher.js";

const handler = async (m, { conn }) => {
  await sendNsfwImage(m, conn, "ahegao", "Ahegao");
};

handler.command = /^(ahegao)$/i;
handler.description = "Imagen NSFW Ahegao";
handler.category = "nsfw";
handler.nsfw = true;
handler.cooldown = 5;

export default handler;
