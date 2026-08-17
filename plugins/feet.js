// ============================================================
//   Kurumi Tokisaki - Feet Command
//   ────────────────────────
//   Category: feet
// ============================================================

import { sendNsfwImage } from "../lib/nsfwFetcher.js";

const handler = async (m, { conn }) => {
  await sendNsfwImage(m, conn, "feet", "Feet");
};

handler.command = /^(feet|pies|fetishpies)$/i;
handler.description = "Imagen feet NSFW";
handler.category = "nsfw";
handler.nsfw = true;
handler.cooldown = 5;

export default handler;
