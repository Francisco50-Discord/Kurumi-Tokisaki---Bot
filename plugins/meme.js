// ============================================================
//   Kurumi Tokisaki - Meme Command
//   v21.0: Reddit bloquea bots en 2026 (403). Solo meme-api.com.
//   3 subreddits alternativos vía meme-api.com como fallback.
// ============================================================

import axios from "axios";
import { translateToSpanish } from "../lib/translator.js";

const BROWSER_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Accept": "application/json",
};

// Lista de subreddits en español para memes
const SPANISH_SUBREDDITS = ["memesenespanol", "memexico", "yo_elr", "memes", "dankmemes"];

async function fetchMemeFromApi(subreddit = null) {
  const url = subreddit
    ? `https://meme-api.com/gimme/${subreddit}`
    : "https://meme-api.com/gimme";
  const res = await axios.get(url, { timeout: 15000, headers: BROWSER_HEADERS });
  const meme = res.data;
  if (!meme?.url) throw new Error("No meme URL");
  return meme;
}

const handler = async (m, { conn }) => {
  for (const sub of SPANISH_SUBREDDITS) {
    try {
      const meme = await fetchMemeFromApi(sub);
      let rawTitle = meme.title || "Meme aleatorio";
      const esTitle = await translateToSpanish(rawTitle);
      const title = esTitle.toUpperCase();
      const ups = meme.ups?.toLocaleString() || 0;
      const subredditLabel = meme.subreddit ? `r/${meme.subreddit}` : "meme-api";

      await conn.sendMessage(
        m.chatId,
        {
          image: { url: meme.url },
          caption:
            `✦━【 😂 *${title}* 】━✦\n\n` +
            `👍 ${ups} me gusta | 📰 ${subredditLabel}`,
        },
        { quoted: m }
      );
      return;
    } catch (e) {
      continue;
    }
  }

  await m.reply(`❌ No se pudo cargar el meme. Intenta de nuevo en unos segundos.`);
};

handler.command = /^(meme|memes)$/i;
handler.description = "Obtener un meme aleatorio";
handler.category = "daily";
handler.cooldown = 5;

export default handler;
