// ============================================================
//   Kurumi Tokisaki - Yuri Command
//   ────────────────────────
//   Category: yuri
// ============================================================

import { sendNsfwImage } from "../lib/nsfwFetcher.js";

const handler = async (m, { conn }) => {
  await sendNsfwImage(m, conn, "yuri", "Yuri");
};

handler.command = /^(yuri|lesbianas|lesbians)$/i;
handler.description = "Imagen yuri NSFW";
handler.category = "nsfw";
handler.nsfw = true;
handler.cooldown = 5;

export default handler;
