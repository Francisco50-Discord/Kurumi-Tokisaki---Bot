// ============================================================
//   Kurumi Tokisaki - Lewd Command
//   ────────────────────────
//   Category: lewd
// ============================================================

import { sendNsfwImage } from "../lib/nsfwFetcher.js";

const handler = async (m, { conn }) => {
  await sendNsfwImage(m, conn, "lewd", "Lewd");
};

handler.command = /^(lewd|lwd)$/i;
handler.description = "Imagen lewd NSFW";
handler.category = "nsfw";
handler.nsfw = true;
handler.cooldown = 5;

export default handler;
