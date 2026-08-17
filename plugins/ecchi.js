// ============================================================
//   Kurumi Tokisaki - Ecchi Command
//   ────────────────────────
//   Category: ecchi
// ============================================================

import { sendNsfwImage } from "../lib/nsfwFetcher.js";

const handler = async (m, { conn }) => {
  await sendNsfwImage(m, conn, "ecchi", "Ecchi");
};

handler.command = /^(ecchi)$/i;
handler.description = "Imagen Ecchi";
handler.category = "nsfw";
handler.nsfw = true;
handler.cooldown = 5;

export default handler;
