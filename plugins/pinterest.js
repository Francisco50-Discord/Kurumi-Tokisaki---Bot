// ============================================================
//   Kurumi Tokisaki - Pinterest Downloader Command
//   Multi-provider Pinterest Downloader & Search (Direct Scraper & Siputzx)
// ============================================================

import axios from "axios";
import * as cheerio from "cheerio";

async function downloadPinterestMedia(mediaUrl) {
  const fallbackUrl = mediaUrl?.includes("i.pinimg.com/originals/")
    ? mediaUrl.replace("/originals/", "/736x/")
    : null;
  const candidates = [...new Set([mediaUrl, fallbackUrl].filter(Boolean))];
  let lastError = null;

  for (const url of candidates) {
    try {
      const response = await axios.get(url, {
        responseType: "arraybuffer",
        timeout: 25000,
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        headers: {
          "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36",
          "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
          "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
          "Referer": "https://www.pinterest.com/"
        }
      });
      if (response.data?.byteLength > 1000) {
        return Buffer.from(response.data);
      }
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error("Pinterest no devolvió un archivo válido.");
}

const handler = async (m, { body, conn, usedPrefix, command }) => {
  if (!body || !body.trim()) {
    return m.reply(
      `✦━【 📌 *PINTEREST DOWNLOADER* 】━✦\n\n` +
      `📝 Descarga imágenes o videos de Pinterest o busca pines.\n` +
      `💡 Sintaxis: \`${usedPrefix}${command} <url | búsqueda>\`\n` +
      `📌 Ejemplo: \`${usedPrefix}${command} https://pin.it/1234567\`\n` +
      `📌 Ejemplo: \`${usedPrefix}${command} anime aesthetic\``
    );
  }

  const query = body.trim();
  await m.reply(`⏳ *Procesando contenido de Pinterest...*`);

  let mediaUrl = null;
  let title = "Pin de Pinterest";
  let isVideo = false;

  const isUrl = /pinterest\.com|pin\.it/i.test(query);

  // Strategy A: Direct HTML Scraper for Pinterest Pin URLs
  if (isUrl) {
    try {
      let targetUrl = query.match(/https?:\/\/[^\s]+/)?.[0] || query;

      // Expand short link pin.it if needed
      if (targetUrl.includes("pin.it")) {
        const exp = await axios.get(targetUrl, {
          maxRedirects: 5,
          headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36" },
          timeout: 8000
        });
        targetUrl = exp.request?.res?.responseUrl || exp.config?.url || targetUrl;
      }

      const res = await axios.get(targetUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8"
        },
        timeout: 10000
      });

      const html = res.data;
      const $ = cheerio.load(html);

      const ogTitle = $('meta[property="og:title"]').attr("content") || $("title").text();
      const ogImage = $('meta[property="og:image"]').attr("content");
      const ogVideo = $('meta[property="og:video"]').attr("content") || $('meta[property="og:video:secure_url"]').attr("content");

      const isStaticAsset = (link) => !link || (
        link.includes("d53b014d86a6b6761bf649a0ed813c2b") ||
        link.includes("75x75_RS") ||
        link.includes("30x30_RS") ||
        link.includes("avatar")
      );

      const highResOgImage = (ogImage && !isStaticAsset(ogImage))
        ? ogImage.replace(/\/(?:236x|474x|564x|736x)\//, "/originals/")
        : null;

      const origImages = [...html.matchAll(/(https:\/\/i\.pinimg\.com\/originals\/[^\s"<]+\.(?:jpg|jpeg|png|webp))/g)]
        .map(m => m[1])
        .filter(img => !isStaticAsset(img));

      // Los Pins modernos pueden almacenar el MP4 en v1.pinimg.com (o con
      // barras escapadas dentro de JSON), mientras que la imagen OG solo es
      // una vista previa. Normalizamos esas rutas antes de elegir la imagen.
      const decodedHtml = html
        .replace(/\\u002F/gi, "/")
        .replace(/\\\//g, "/")
        .replace(/&amp;/gi, "&");
      const mp4Videos = [...decodedHtml.matchAll(/(https?:\/\/(?:v\d*|i)\.pinimg\.com\/[^\s"'<\\]+?\.mp4(?:\?[^\s"'<\\]*)?)/gi)]
        .map(m => m[1])
        .filter(vid => !isStaticAsset(vid));

      if (mp4Videos[0] || (ogVideo && !isStaticAsset(ogVideo))) {
        mediaUrl = mp4Videos[0] || ogVideo;
        isVideo = true;
      } else if (highResOgImage || origImages[0] || ogImage) {
        mediaUrl = highResOgImage || origImages[0] || ogImage;
        isVideo = false;
      }

      if (ogTitle) {
        title = ogTitle.replace(/\| Pinterest/i, "").trim();
      }
    } catch (e) {
      // Scraper error
    }
  }

  // Strategy B: Siputzx Pinterest API (Search queries or fallback for URLs)
  if (!mediaUrl) {
    try {
      const sipRes = await axios.get(`https://api.siputzx.my.id/api/s/pinterest?query=${encodeURIComponent(query)}`, {
        headers: { "User-Agent": "Mozilla/5.0" },
        timeout: 10000
      });
      const data = sipRes.data?.data;
      if (Array.isArray(data) && data.length > 0) {
        const item = data[Math.floor(Math.random() * Math.min(data.length, 5))];
        mediaUrl = item.video_url || item.image_url || item.pin;
        if (item.grid_title || item.description) {
          title = item.grid_title || item.description;
        }
        isVideo = !!item.video_url || (typeof mediaUrl === "string" && (mediaUrl.includes(".mp4") || mediaUrl.includes("v.pinimg.com")));
      }
    } catch (e) {
      // Siputzx search failed
    }
  }

  if (!mediaUrl) {
    return m.reply(
      `✦━【 ❌ *DESCARGA FALLIDA* 】━✦\n\n` +
      `No se pudo obtener el contenido de Pinterest. Verifica la URL o término de búsqueda.\n\n` +
      `✨ *Kurumi Tokisaki*`
    );
  }

  try {
    const caption =
      `✦━【 📌 *PINTEREST DOWNLOADER* 】━✦\n\n` +
      `📝 *Título:* ${title}\n\n` +
      `✨ *Kurumi Tokisaki*`;

    const mediaBuffer = await downloadPinterestMedia(mediaUrl);

    const isMp4 = isVideo || (typeof mediaUrl === "string" && (mediaUrl.includes(".mp4") || mediaUrl.includes("v.pinimg.com")));

    if (isMp4) {
      await conn.sendMessage(
        m.chatId,
        { video: mediaBuffer, caption, mimetype: "video/mp4" },
        { quoted: m }
      );
    } else {
      await conn.sendMessage(
        m.chatId,
        { image: mediaBuffer, caption },
        { quoted: m }
      );
    }
  } catch (err) {
    console.error("Error en Pinterest downloader:", err.message);
    await m.reply(`❌ Error al enviar el contenido de Pinterest: ${err.message}`);
  }
};

handler.command = /^(pinterestdl|pindl|pinterest|pindownload)$/i;
handler.description = "Descargar imágenes o videos de Pinterest";
handler.category = "descargas";

export default handler;
