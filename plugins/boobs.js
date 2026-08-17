// ============================================================
//   Kurumi Tokisaki - Boobs Command
//   ────────────────────────
//   Category: boobs
// ============================================================

import { sendNsfwImage } from "../lib/nsfwFetcher.js";

const handler = async (m, { conn }) => {
  await sendNsfwImage(m, conn, "boobs", "Boobs");
};

handler.command = /^(boobs|tetas|tits)$/i;
handler.description = "Imagen boobs NSFW";
handler.category = "nsfw";
handler.nsfw = true;
handler.cooldown = 5;

export default handler;
