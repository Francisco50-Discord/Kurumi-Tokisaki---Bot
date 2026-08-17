// ============================================================
//   Kurumi Tokisaki - Pussy Command
//   ────────────────────────
//   Category: pussy
// ============================================================

import { sendNsfwImage } from "../lib/nsfwFetcher.js";

const handler = async (m, { conn }) => {
  await sendNsfwImage(m, conn, "pussy", "Pussy");
};

handler.command = /^(pussy|vagina|cono|coño)$/i;
handler.description = "Imagen pussy NSFW";
handler.category = "nsfw";
handler.nsfw = true;
handler.cooldown = 5;

export default handler;
