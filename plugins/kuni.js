// ============================================================
//   Kurumi Tokisaki - Cunnilingus Command
//   ────────────────────────
//   Category: kuni
// ============================================================

import { sendNsfwImage } from "../lib/nsfwFetcher.js";

const handler = async (m, { conn }) => {
  await sendNsfwImage(m, conn, "kuni", "Cunnilingus");
};

handler.command = /^(kuni|cunnilingus)$/i;
handler.description = "Imagen kuni NSFW";
handler.category = "nsfw";
handler.nsfw = true;
handler.cooldown = 5;

export default handler;
