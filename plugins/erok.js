// ============================================================
//   Kurumi Tokisaki - Ero Kitsune Command
//   ────────────────────────
//   Category: erok
// ============================================================

import { sendNsfwImage } from "../lib/nsfwFetcher.js";

const handler = async (m, { conn }) => {
  await sendNsfwImage(m, conn, "erok", "Ero Kitsune");
};

handler.command = /^(erok|ero)$/i;
handler.description = "Imagen ero NSFW";
handler.category = "nsfw";
handler.nsfw = true;
handler.cooldown = 5;

export default handler;
