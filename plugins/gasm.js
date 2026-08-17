// ============================================================
//   Kurumi Tokisaki - Orogasm Command
//   ────────────────────────
//   Category: gasm
// ============================================================

import { sendNsfwImage } from "../lib/nsfwFetcher.js";

const handler = async (m, { conn }) => {
  await sendNsfwImage(m, conn, "gasm", "Orogasm");
};

handler.command = /^(gasm|gasmd)$/i;
handler.description = "Imagen gasm NSFW";
handler.category = "nsfw";
handler.nsfw = true;
handler.cooldown = 5;

export default handler;
