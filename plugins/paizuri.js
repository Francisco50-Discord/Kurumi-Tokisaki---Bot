// ============================================================
//   Kurumi Tokisaki - Paizuri Command
//   ────────────────────────
//   Category: paizuri
// ============================================================

import { sendNsfwImage } from "../lib/nsfwFetcher.js";

const handler = async (m, { conn }) => {
  await sendNsfwImage(m, conn, "paizuri", "Paizuri");
};

handler.command = /^(paizuri|tittyfuck)$/i;
handler.description = "Imagen NSFW Paizuri";
handler.category = "nsfw";
handler.nsfw = true;
handler.cooldown = 5;

export default handler;
