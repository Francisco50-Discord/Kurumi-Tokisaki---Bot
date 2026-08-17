// ============================================================
//   Kurumi Tokisaki - Blowjob Command
//   ────────────────────────
//   Category: blowjob
// ============================================================

import { sendNsfwImage } from "../lib/nsfwFetcher.js";

const handler = async (m, { conn }) => {
  await sendNsfwImage(m, conn, "blowjob", "Blowjob");
};

handler.command = /^(blowjob|bj18|mamada)$/i;
handler.description = "Imagen blowjob NSFW";
handler.category = "nsfw";
handler.nsfw = true;
handler.cooldown = 5;

export default handler;
