// ============================================================
//   Kurumi Tokisaki - Spotify Downloader Command
//   Multi-provider Spotify Downloader (Embed JSON, OEmbed, Siputzx, btch-downloader, yts)
// ============================================================

import axios from "axios";
import * as cheerio from "cheerio";
import yts from "yt-search";
import btch from "btch-downloader";

// Helper for downloading audio media buffer safely with referer fallback
async function downloadMediaBuffer(url) {
  if (!url || typeof url !== "string" || !url.startsWith("http")) {
    throw new Error("URL de descarga no válida.");
  }

  const referers = [
    "https://ytmp3.nu/",
    "https://c.ymcdn.org/",
    "https://y2mate.nu/",
    "https://youtube.com/",
    "https://open.spotify.com/"
  ];

  let lastError = null;

  for (const referer of referers) {
    try {
      const response = await axios({
        method: "GET",
        url,
        responseType: "arraybuffer",
        timeout: 45000,
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
          "Accept": "*/*",
          "Referer": referer
        }
      });

      if (response.data && response.data.byteLength > 1000) {
        return Buffer.from(response.data);
      }
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error("No se pudo descargar el buffer del archivo de audio.");
}

const handler = async (m, { body, conn, usedPrefix, command }) => {
  if (!body || !body.trim()) {
    return m.reply(
      `✦━【 🎧 *SPOTIFY DOWNLOADER* 】━✦\n\n` +
      `📝 Descarga canciones directamente de Spotify por enlace o búsqueda.\n` +
      `💡 Sintaxis: \`${usedPrefix}${command} <url | nombre>\`\n` +
      `📌 Ejemplo: \`${usedPrefix}${command} https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT\`\n` +
      `📌 Ejemplo: \`${usedPrefix}${command} Never Gonna Give You Up\``
    );
  }

  const query = body.trim();
  await m.reply(`⏳ *Procesando audio de Spotify...*`);

  let downloadUrl = null;
  let title = "Canción de Spotify";
  let artist = "Artista de Spotify";
  let coverUrl = null;
  let duration = null;
  let activeProvider = null;

  const isSpotifyUrl = /spotify\.com/i.test(query);
  const cleanSpotifyUrl = isSpotifyUrl ? (query.match(/https?:\/\/[^\s]+/)?.[0] || query) : null;
  let cardSent = false;

  const sendSpotifyCard = async () => {
    if (cardSent) return;
    cardSent = true;

    const cardCaption =
      `✦━【 🎧 *SPOTIFY DOWNLOADER* 】━✦\n\n` +
      `🎶 *Canción:* ${title}\n` +
      `👤 *Artista:* ${artist}\n` +
      (duration ? `⏱️ *Duración:* ${duration}\n` : "") +
      (cleanSpotifyUrl ? `🔗 *Enlace:* ${cleanSpotifyUrl}\n` : "") +
      `\n✨ *Kurumi Tokisaki*`;

    try {
      if (coverUrl) {
        await conn.sendMessage(m.chatId, { image: { url: coverUrl }, caption: cardCaption }, { quoted: m });
      } else {
        await m.reply(cardCaption);
      }
    } catch (cardError) {
      console.warn("No se pudo enviar la tarjeta previa de Spotify:", cardError.message);
    }
  };

  // Estas consultas ya existían; se inician juntas para no encadenar sus
  // tiempos de respuesta. Los datos siguen aplicándose con la misma prioridad.
  const spotifyOembedPromise = isSpotifyUrl && cleanSpotifyUrl
    ? axios.get(`https://open.spotify.com/oembed?url=${encodeURIComponent(cleanSpotifyUrl)}`, {
      headers: { "User-Agent": "Mozilla/5.0" },
      timeout: 4000
    }).then((response) => response.data).catch(() => null)
    : null;
  const spotifyDirectPromise = isSpotifyUrl
    ? axios.get(`https://api.siputzx.my.id/api/d/spotify?url=${encodeURIComponent(cleanSpotifyUrl || query)}`, {
      headers: { "User-Agent": "Mozilla/5.0" },
      timeout: 4000
    }).then((response) => response.data?.data || response.data?.result || response.data).catch((error) => {
      console.warn(`[SPOTIFY][Siputzx Spotify API] Falló: ${error.message}`);
      return null;
    })
    : null;

  // 1. Obtain official Spotify metadata via Embed HTML & OEmbed
  if (isSpotifyUrl && cleanSpotifyUrl) {
    const trackId = cleanSpotifyUrl.match(/track\/([a-zA-Z0-9]+)/)?.[1];
    if (trackId) {
      try {
        const embedRes = await axios.get(`https://open.spotify.com/embed/track/${trackId}`, {
          headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
          timeout: 4000
        });
        const $ = cheerio.load(embedRes.data);
        const nextDataRaw = $("#__NEXT_DATA__").html();
        if (nextDataRaw) {
          const nextData = JSON.parse(nextDataRaw);
          const entity = nextData?.props?.pageProps?.state?.data?.entity;
          if (entity) {
            if (entity.title || entity.name) title = entity.title || entity.name;
            if (entity.artists?.length) artist = entity.artists.map(a => a.name).join(", ");
            coverUrl = entity.coverArt?.sources?.[0]?.url || entity.visualIdentity?.image?.[0]?.url;
            if (entity.duration) {
              const secs = Math.floor(entity.duration / 1000);
              const mins = Math.floor(secs / 60);
              const remSecs = secs % 60;
              duration = `${mins}:${remSecs < 10 ? "0" : ""}${remSecs}`;
            }
          }
        }
      } catch (e) {
        // ignore
      }
    }

    // Fallback OEmbed if needed. La consulta ya se inició junto con Embed.
    if (title === "Canción de Spotify" || !coverUrl) {
      const oembedData = await spotifyOembedPromise;
      if (oembedData) {
        if (oembedData.title && title === "Canción de Spotify") title = oembedData.title;
        if (oembedData.author_name && artist === "Artista de Spotify") artist = oembedData.author_name;
        if (oembedData.thumbnail_url && !coverUrl) coverUrl = oembedData.thumbnail_url;
      }
    }

    // La tarjeta oficial se entrega antes de resolver y descargar el audio.
    await sendSpotifyCard();
  }

  // 2. Try direct Spotify Downloader API (Siputzx). La misma llamada se inició
  // antes de leer los metadatos para aprovechar el tiempo de espera.
  if (isSpotifyUrl) {
    const data = await spotifyDirectPromise;
    if (data) {
      const directUrl = data.music || data.download_url || data.url || data.link;
      if (directUrl && typeof directUrl === "string" && directUrl.startsWith("http")) {
        downloadUrl = directUrl;
        activeProvider = "Siputzx Spotify API";
        console.info(`[SPOTIFY] Proveedor seleccionado: ${activeProvider}`);
        if (data.title || data.name) title = data.title || data.name;
        if (data.artist || data.artists) artist = data.artist || data.artists;
        if (data.cover || data.image || data.thumbnail) coverUrl = data.cover || data.image || data.thumbnail;
      }
    }
  }

  // 3. Fallback: Search YouTube & extract audio with btch-downloader / Siputzx YT Search
  if (!downloadUrl) {
    try {
      const searchQuery = isSpotifyUrl ? `${title} ${artist}` : query;
      const searchRes = await yts(searchQuery);
      const firstVid = searchRes.videos?.[0];

      if (firstVid) {
        if (!isSpotifyUrl) {
          title = firstVid.title;
          artist = firstVid.author?.name || artist;
          coverUrl = firstVid.image || firstVid.thumbnail;
          duration = firstVid.timestamp;
        } else if (!coverUrl) {
          coverUrl = firstVid.image || firstVid.thumbnail;
        }

        if (!duration && firstVid.timestamp) {
          duration = firstVid.timestamp;
        }

        // Para búsquedas, ya existe título, artista y portada antes de pedir el audio.
        await sendSpotifyCard();

        // Se conservan ambos respaldos de YouTube, ahora en paralelo.
        const fallbackResult = await Promise.any([
          async () => {
            try {
              const btchRes = await btch.youtube(firstVid.url);
              const resultUrl = btchRes?.mp3 || btchRes?.url;
              if (!resultUrl || typeof resultUrl !== "string" || !resultUrl.startsWith("http")) {
                throw new Error("BTCH no devolvió audio.");
              }
              return { downloadUrl: resultUrl, provider: "BTCH YouTube" };
            } catch (error) {
              console.warn(`[SPOTIFY][BTCH YouTube] Falló: ${error.message}`);
              throw error;
            }
          },
          async () => {
            try {
              const sipYt = await axios.get(`https://api.siputzx.my.id/api/s/youtube?query=${encodeURIComponent(firstVid.url)}`, {
                headers: { "User-Agent": "Mozilla/5.0" },
                timeout: 4000
              });
              const sipData = sipYt.data?.data?.[0] || sipYt.data?.[0];
              const resultUrl = sipData?.mp3 || sipData?.audio || sipData?.download;
              if (!resultUrl || typeof resultUrl !== "string" || !resultUrl.startsWith("http")) {
                throw new Error("Siputzx no devolvió audio.");
              }
              return { downloadUrl: resultUrl, provider: "Siputzx YouTube" };
            } catch (error) {
              console.warn(`[SPOTIFY][Siputzx YouTube] Falló: ${error.message}`);
              throw error;
            }
          }
        ].map(async (provider) => provider())).catch(() => null);

        if (fallbackResult?.downloadUrl) {
          downloadUrl = fallbackResult.downloadUrl;
          activeProvider = fallbackResult.provider;
          console.info(`[SPOTIFY] Proveedor seleccionado: ${activeProvider}`);
        }
      }
    } catch (e) {
      console.warn(`[SPOTIFY] La búsqueda de respaldo en YouTube falló: ${e.message}`);
    }
  }

  if (!downloadUrl) {
    return m.reply(
      `✦━【 ❌ *DESCARGA FALLIDA* 】━✦\n\n` +
      `No se pudo obtener el audio de Spotify. Verifica el enlace o nombre e inténtalo de nuevo.\n\n` +
      `✨ *Kurumi Tokisaki*`
    );
  }

  // Attempt to download the audio buffer to avoid Baileys stream fetch header blocks
  let audioBuffer = null;
  try {
    audioBuffer = await downloadMediaBuffer(downloadUrl);
    console.info(`[SPOTIFY] Audio descargado correctamente con ${activeProvider || "el proveedor disponible"}.`);
  } catch (e) {
    console.warn(`[SPOTIFY][${activeProvider || "Proveedor disponible"}] Falló la descarga de buffer; se enviará el enlace directo: ${e.message}`);
  }

  try {
    // El audio se entrega en un mensaje independiente cuando termina la descarga.
    const audioPayload = audioBuffer ? audioBuffer : { url: downloadUrl };

    await conn.sendMessage(
      m.chatId,
      {
        audio: audioPayload,
        mimetype: "audio/mp4",
        ptt: false
      },
      { quoted: m }
    );
    console.info(`[SPOTIFY] Audio enviado por WhatsApp usando ${activeProvider || "el proveedor disponible"}.`);

  } catch (err) {
    console.error("Error en Spotify downloader:", err.message);
    await m.reply(`❌ Error al enviar el audio de Spotify: ${err.message}`);
  }
};

handler.command = /^(spotify|sp|spotdl|spotilink)$/i;
handler.description = "Descargar canciones de Spotify";
handler.category = "descargas";

export default handler;
