// ============================================================
//   Kurumi Tokisaki - Succubus Command
//   ────────────────────────
//   Category: succubus
// ============================================================

import { sendNsfwImage } from "../lib/nsfwFetcher.js";

const handler = async (m, { conn }) => {
  await sendNsfwImage(m, conn, "succubus", "Succubus");
};

handler.command = /^(succubus|sucu)$/i;
handler.description = "Imagen NSFW Succubus";
handler.category = "nsfw";
handler.nsfw = true;
handler.cooldown = 5;

export default handler;
