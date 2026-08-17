// ============================================================
//   Kurumi Tokisaki - Anal Command
//   ────────────────────────
//   Category: anal
// ============================================================

import { sendNsfwImage } from "../lib/nsfwFetcher.js";

const handler = async (m, { conn }) => {
  await sendNsfwImage(m, conn, "anal", "Anal");
};

handler.command = /^(anal|culo)$/i;
handler.description = "Imagen anal NSFW";
handler.category = "nsfw";
handler.nsfw = true;
handler.cooldown = 5;

export default handler;
