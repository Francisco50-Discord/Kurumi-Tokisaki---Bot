// ============================================================
//   Kurumi Tokisaki - Holo Ero Command
//   ────────────────────────
//   Category: holoero
// ============================================================

import { sendNsfwImage } from "../lib/nsfwFetcher.js";

const handler = async (m, { conn }) => {
  await sendNsfwImage(m, conn, "holoero", "Holo Ero");
};

handler.command = /^(holoero|holo)$/i;
handler.description = "Imagen holoero NSFW";
handler.category = "nsfw";
handler.nsfw = true;
handler.cooldown = 5;

export default handler;
