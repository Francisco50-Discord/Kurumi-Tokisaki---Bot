// ============================================================
//   Kurumi Tokisaki - Imagen Search Command
// ============================================================

import axios from "axios";

const handler = async (m, { body, conn, usedPrefix }) => {
  if (!body) {
    return m.reply(
      `✦━【 🖼️ *IMAGEN* 】━✦\n\n` +
      `📝 Busca imágenes en internet.\n` +
      `💡 Sintaxis: \`${usedPrefix}imagen <búsqueda>\`\n` +
      `📌 Ejemplo: \`${usedPrefix}imagen gatitos\``
    );
  }

  const sources = [];

  // 1. Pinterest (Pins de alta calidad)
  try {
    const url = `https://www.pinterest.es/search/pins/?q=${encodeURIComponent(body)}`;
    const res = await axios.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      timeout: 7000,
    });
    const matches = [...res.data.matchAll(/(https:\/\/i\.pinimg\.com\/(?:736x|originals|564x|474x)\/[a-f0-9\/]+\.(?:jpg|png|jpeg|webp))/gi)];
    const urls = [...new Set(matches.map((m) => m[1]))];
    for (const u of urls.slice(0, 10)) {
      sources.push({ url: u });
    }
  } catch (e) {}

  // 2. Pixiv (Ilustraciones y arte de alta calidad)
  try {
    const url = `https://www.pixiv.net/ajax/search/artworks/${encodeURIComponent(body)}?word=${encodeURIComponent(body)}&order=date_d&mode=all&p=1&s_mode=s_tag&type=all&lang=es`;
    const res = await axios.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        "Referer": "https://www.pixiv.net/",
      },
      timeout: 7000,
    });
    const illusts = res.data?.body?.illustManga?.data || [];
    for (const item of illusts.slice(0, 10)) {
      const imgUrl = item.url?.replace("c/240x480/custom-thumb", "c/600x1200_90/img-master") || item.url;
      if (imgUrl) {
        sources.push({
          url: imgUrl,
          title: item.title,
          author: item.userName,
          referer: "https://www.pixiv.net/",
        });
      }
    }
  } catch (e) {}

  // 3. Unsplash (Fotografía HD)
  try {
    const url = `https://unsplash.com/napi/search/photos?query=${encodeURIComponent(body)}&per_page=10`;
    const res = await axios.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
      timeout: 6000,
    });
    const results = res.data?.results || [];
    for (const item of results) {
      if (item.urls?.regular) {
        sources.push({
          url: item.urls.regular,
          title: item.alt_description || item.description,
          author: item.user?.name,
        });
      }
    }
  } catch (e) {}

  if (sources.length === 0) {
    return m.reply(`❌ No se pudieron encontrar imágenes para "${body}".`);
  }

  // Barajar fuentes y seleccionar candidato
  for (let i = sources.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [sources[i], sources[j]] = [sources[j], sources[i]];
  }

  // Intentar descargar buffer de la lista de fuentes
  for (const item of sources.slice(0, 10)) {
    try {
      const reqHeaders = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      };
      if (item.referer) reqHeaders["Referer"] = item.referer;

      const imgRes = await axios.get(item.url, {
        responseType: "arraybuffer",
        headers: reqHeaders,
        timeout: 6000,
      });

      if (imgRes.data && imgRes.data.length > 2000) {
        const imageBuffer = Buffer.from(imgRes.data);
        const caption =
          `✦━【 🖼️ *IMAGEN: ${body.toUpperCase()}* 】━✦\n\n` +
          `🖼️ Resultado de búsqueda` +
          (item.title ? `\n📝 *Título:* ${item.title}` : "") +
          (item.author ? `\n👤 *Autor:* ${item.author}` : "");

        await conn.sendMessage(m.chatId, { image: imageBuffer, caption }, { quoted: m });
        return;
      }
    } catch (e) {}
  }

  await m.reply(`❌ No se pudo descargar la imagen. Intenta con otra búsqueda.`);
};

handler.command = /^(imagen|image|img|foto|photo)$/i;
handler.description = "Buscar imágenes de alta calidad";
handler.category = "busqueda";
handler.cooldown = 5;

export default handler;

