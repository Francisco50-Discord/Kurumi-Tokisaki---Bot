// ============================================================
//   Kurumi Tokisaki - Cum Image Command
//   ──────────────────────────────────
//   Category: nsfw
// ============================================================

import { sendNsfwImage } from "../lib/nsfwFetcher.js";

const handler = async (m, { conn }) => {
  await sendNsfwImage(m, conn, "cum", "Cum / Ejaculation");
};

handler.command = /^(cum|corrida|cumshot)$/i;
handler.description = "Imagen NSFW de cum";
handler.category = "nsfw";
handler.nsfw = true;
handler.cooldown = 5;

export default handler;

