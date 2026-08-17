// ============================================================
//   Kurumi Tokisaki - Keta Bondage Command
//   ────────────────────────
//   Category: keta
// ============================================================

import { sendNsfwImage } from "../lib/nsfwFetcher.js";

const handler = async (m, { conn }) => {
  await sendNsfwImage(m, conn, "keta", "Keta Bondage");
};

handler.command = /^(keta)$/i;
handler.description = "Imagen keta NSFW";
handler.category = "nsfw";
handler.nsfw = true;
handler.cooldown = 5;

export default handler;
