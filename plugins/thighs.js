// ============================================================
//   Kurumi Tokisaki - Thighs Command
//   ────────────────────────
//   Category: thighs
// ============================================================

import { sendNsfwImage } from "../lib/nsfwFetcher.js";

const handler = async (m, { conn }) => {
  await sendNsfwImage(m, conn, "thighs", "Thighs");
};

handler.command = /^(thighs|muslos)$/i;
handler.description = "Imagen NSFW Muslos / Thighs";
handler.category = "nsfw";
handler.nsfw = true;
handler.cooldown = 5;

export default handler;
