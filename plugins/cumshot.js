// ============================================================
//   Kurumi Tokisaki - Cumshot Command
//   Category: nsfw
// ============================================================

import { sendNsfwImage } from "../lib/nsfwFetcher.js";

const handler = async (m, { conn }) => {
  await sendNsfwImage(m, conn, "cum", "Cumshot / Ejaculación");
};

handler.command = /^(cumshot|corrida)$/i;
handler.description = "Imagen NSFW de cumshot";
handler.category = "nsfw";
handler.nsfw = true;
handler.cooldown = 5;

export default handler;
