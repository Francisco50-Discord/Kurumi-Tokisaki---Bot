// ============================================================
//   Kurumi Tokisaki - Blowjob Command
//   ────────────────────────
//   Category: bj
// ============================================================

import { sendNsfwImage } from "../lib/nsfwFetcher.js";

const handler = async (m, { conn }) => {
  await sendNsfwImage(m, conn, "bj", "Blowjob");
};

handler.command = /^(bj)$/i;
handler.description = "Imagen BJ NSFW";
handler.category = "nsfw";
handler.nsfw = true;
handler.cooldown = 5;

export default handler;
