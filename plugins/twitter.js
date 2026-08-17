// ============================================================
//   Kurumi Tokisaki - Twitter / X Downloader Command
//   API: Multi-provider Twitter / X Downloader (FXTwitter, VxTwitter, btch, Siputzx)
// ============================================================

import axios from "axios";
import btch from "btch-downloader";

async function downloadBuffer(url, referer = "https://x.com/") {
  const response = await axios({
    method: "GET",
    url,
    responseType: "stream",
    timeout: 60000,
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      "Accept": "*/*",
      "Referer": referer
    }
  });

  const chunks = [];
  for await (const chunk of response.data) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

const handler = async (m, { body, conn, usedPrefix, command }) => {
  if (!body || !body.trim()) {
    return m.reply(
      `✦━【 🐦 *TWITTER / X* 】━✦\n\n` +
      `📝 Descarga videos e imágenes de Twitter / X.\n` +
      `💡 Sintaxis: \`${usedPrefix}${command} <url>\`\n` +
      `📌 Ejemplo: \`${usedPrefix}${command} https://x.com/i/status/2085905514555130026\``
    );
  }

  const url = body.trim();
  if (!/twitter\.com|x\.com/i.test(url)) {
    return m.reply(`❌ Proporciona un enlace válido de Twitter o X.`);
  }

  await m.reply(`⏳ *Procesando publicación de Twitter / X...*`);

  let text = "Publicación de Twitter / X";
  let mediaList = []; // Array of { type: 'image' | 'video', url: string }

  // Extract Tweet ID if available
  const idMatch = url.match(/status\/(\d+)/);
  const tweetId = idMatch ? idMatch[1] : null;

  // Las mismas fuentes se resuelven a la vez. Solo se paraleliza la consulta
  // ligera; los archivos se descargan y envían de uno en uno más abajo.
  const providerResult = await Promise.any([
    async () => {
      if (!tweetId) throw new Error("Tweet sin identificador.");
      const fxRes = await axios.get(`https://api.fxtwitter.com/i/status/${tweetId}`, {
        headers: { "User-Agent": "Mozilla/5.0" },
        timeout: 10000
      });
      const tweet = fxRes.data?.tweet;
      const result = (tweet?.media?.all || []).flatMap((item) => {
        if (!item?.url) return [];
        if (item.type === "video" || item.type === "gif") return [{ type: "video", url: item.url }];
        if (item.type === "photo") return [{ type: "image", url: item.url }];
        return [];
      });
      if (!result.length) throw new Error("FXTwitter no devolvió medios.");
      return { text: tweet.text || text, mediaList: result };
    },
    async () => {
      if (!tweetId) throw new Error("Tweet sin identificador.");
      const vxRes = await axios.get(`https://api.vxtwitter.com/i/status/${tweetId}`, {
        headers: { "User-Agent": "Mozilla/5.0" },
        timeout: 10000
      });
      const data = vxRes.data;
      const result = (data?.media_extended || []).flatMap((item) => {
        if (!item?.url) return [];
        if (item.type === "video" || item.type === "gif") return [{ type: "video", url: item.url }];
        if (item.type === "image") return [{ type: "image", url: item.url }];
        return [];
      });
      if (!result.length) throw new Error("VxTwitter no devolvió medios.");
      return { text: data.text || text, mediaList: result };
    },
    async () => {
      const btchRes = await btch.twitter(url);
      const urls = Array.isArray(btchRes?.url) ? btchRes.url : [btchRes?.url];
      const result = urls.flatMap((item) => {
        const mediaUrl = typeof item === "string" ? item : item?.hd || item?.sd || item?.url;
        if (!mediaUrl) return [];
        const isVid = mediaUrl.includes(".mp4") || mediaUrl.includes("video");
        return [{ type: isVid ? "video" : "image", url: mediaUrl }];
      });
      if (!result.length) throw new Error("BTCH no devolvió medios.");
      return { text, mediaList: result };
    },
    async () => {
      const sipRes = await axios.get(`https://api.siputzx.my.id/api/d/twitter?url=${encodeURIComponent(url)}`, {
        headers: { "User-Agent": "Mozilla/5.0" },
        timeout: 10000
      });
      const data = sipRes.data?.data || sipRes.data?.result;
      const mediaUrl = data?.video || data?.hd || data?.sd || data?.url || (Array.isArray(data?.media) ? data.media[0]?.url : null);
      if (!mediaUrl) throw new Error("Siputzx no devolvió medios.");
      const isVid = mediaUrl.includes(".mp4") || mediaUrl.includes("video");
      return { text: data.desc || data.title || text, mediaList: [{ type: isVid ? "video" : "image", url: mediaUrl }] };
    }
  ].map(async (provider) => provider())).catch(() => null);

  if (providerResult) {
    text = providerResult.text || text;
    mediaList = providerResult.mediaList || mediaList;
  }

  if (mediaList.length === 0) {
    return m.reply(`❌ No se encontró contenido multimedia descargable en este Tweet.`);
  }

  try {
    const caption =
      `✦━【 🐦 *TWITTER / X* 】━✦\n\n` +
      `📝 *Texto:* ${text.slice(0, 250)}\n\n` +
      `✨ *Kurumi Tokisaki*`;

    // Send each media
    for (let i = 0; i < mediaList.length; i++) {
      const media = mediaList[i];
      const mediaBuf = await downloadBuffer(media.url, "https://x.com/");
      const itemCaption = i === 0 ? caption : "";

      if (media.type === "video") {
        await conn.sendMessage(
          m.chatId,
          { video: mediaBuf, caption: itemCaption, mimetype: "video/mp4" },
          { quoted: m }
        );
      } else {
        await conn.sendMessage(
          m.chatId,
          { image: mediaBuf, caption: itemCaption },
          { quoted: m }
        );
      }
    }
  } catch (err) {
    console.error("Error en Twitter downloader:", err.message);
    await m.reply(`❌ Error al descargar de Twitter / X: ${err.message}`);
  }
};

handler.command = /^(twitter|x|xdl|twittern|twitterdl)$/i;
handler.description = "Descargar videos e imágenes de Twitter / X";
handler.category = "descargas";

export default handler;


