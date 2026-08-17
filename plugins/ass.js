// ============================================================
//   Kurumi Tokisaki - Ass Command
//   ────────────────────────
//   Category: ass
// ============================================================

import { sendNsfwImage } from "../lib/nsfwFetcher.js";

const handler = async (m, { conn }) => {
  await sendNsfwImage(m, conn, "ass", "Ass");
};

handler.command = /^(ass|trasero|trasera)$/i;
handler.description = "Imagen ass NSFW";
handler.category = "nsfw";
handler.nsfw = true;
handler.cooldown = 5;

export default handler;
