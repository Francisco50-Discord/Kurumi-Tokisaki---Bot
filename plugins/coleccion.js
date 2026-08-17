// ============================================================
//   Kurumi Tokisaki - Colección Command
// ============================================================

import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";
import axios from "axios";
import { getWaifus } from "../lib/database.js";
import { normalizeJid, resolveTargetJid } from "../lib/utils.js";

const COLLAGE_FONT_FILE = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../assets/fonts/DejaVuSans.ttf"
);
const COLLECTION_PAGE_SIZE = 12;
const IMAGE_FETCH_TIMEOUT_MS = 5000;
const IMAGE_FETCH_CONCURRENCY = 4;
const COLLECTION_SESSION_TTL_MS = 15 * 60 * 1000;

const activeCollectionSessions = new Map();
const runningCollectionChats = new Set();

// El collage se ejecuta de forma acotada para no provocar picos de CPU en el servidor.
sharp.concurrency(1);
sharp.cache({ memory: 20, files: 0, items: 30 });

function getChatId(m) {
  return m.chat || m.chatId || m.key?.remoteJid;
}

function escapePangoText(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function truncateCardText(value, maxLength) {
  const text = String(value || "Sin nombre").trim() || "Sin nombre";
  return text.length > maxLength ? `${text.slice(0, Math.max(1, maxLength - 3))}...` : text;
}

function getCollectionColumns(count) {
  if (count <= 2) return count;
  if (count <= 4) return 2;
  if (count <= 9) return 3;
  return 4;
}

function getActiveCollectionSession(chatId) {
  const session = activeCollectionSessions.get(chatId);
  if (!session) return null;
  if (Date.now() - session.timestamp > COLLECTION_SESSION_TTL_MS) {
    activeCollectionSessions.delete(chatId);
    return null;
  }
  return session;
}

function getQuotedText(m) {
  return m.quoted?.text || m.quoted?.caption || (
    m.quoted?.message?.conversation ||
    m.quoted?.message?.extendedTextMessage?.text ||
    m.quoted?.message?.imageMessage?.caption ||
    ""
  );
}

async function renderCollectionText(text, {
  width,
  height,
  size,
  color = "#f8f8ff",
  align = "left",
}) {
  return sharp({
    text: {
      text: `<span foreground="${color}">${escapePangoText(text)}</span>`,
      font: `DejaVu Sans ${size}`,
      fontfile: COLLAGE_FONT_FILE,
      width,
      height,
      align,
      rgba: true,
    },
  }).png().toBuffer();
}

async function mapWithConcurrency(items, worker, limit = IMAGE_FETCH_CONCURRENCY) {
  const results = new Array(items.length);
  let nextIndex = 0;

  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex++;
      results[currentIndex] = await worker(items[currentIndex], currentIndex);
    }
  });

  await Promise.all(workers);
  return results;
}

function makeSolidPanel(width, height, fill, opacity = 1) {
  return Buffer.from(
    `<svg width="${width}" height="${height}"><rect width="100%" height="100%" fill="${fill}" opacity="${opacity}"/></svg>`
  );
}

/**
 * Construye una página de colección de hasta 12 tarjetas. La fuente está incluida
 * en el proyecto y la numeración recibe el desplazamiento de la página actual.
 */
export async function createCollectionCollage(waifus, {
  startIndex = 0,
  totalCount = waifus?.length || 0,
  currentPage = 1,
  totalPages = 1,
} = {}) {
  const selected = Array.isArray(waifus) ? waifus.slice(0, COLLECTION_PAGE_SIZE) : [];
  if (selected.length === 0) return null;

  const count = selected.length;
  const cols = getCollectionColumns(count);
  const rows = Math.ceil(count / cols);
  const cardWidth = 360;
  const cardHeight = 450;
  const imageHeight = 374;
  const infoHeight = cardHeight - imageHeight;
  const gap = 16;
  const headerHeight = 92;
  const footerHeight = 50;
  const canvasWidth = cols * cardWidth + (cols + 1) * gap;
  const canvasHeight = headerHeight + rows * cardHeight + (rows + 1) * gap + footerHeight;

  const fetchedImages = await mapWithConcurrency(selected, async (waifu, index) => {
    const url = waifu?.waifu_image || waifu?.image_url;
    if (!url) return null;

    try {
      const response = await axios.get(url, {
        responseType: "arraybuffer",
        timeout: IMAGE_FETCH_TIMEOUT_MS,
        maxContentLength: 3 * 1024 * 1024,
      });
      const resized = await sharp(Buffer.from(response.data))
        .resize(cardWidth, imageHeight, { fit: "cover", kernel: sharp.kernel.lanczos3 })
        .jpeg({ quality: 90, chromaSubsampling: "4:4:4" })
        .toBuffer();
      return { buffer: resized, waifu, globalIndex: startIndex + index + 1 };
    } catch {
      return null;
    }
  });

  const validFetched = fetchedImages.filter(Boolean);
  if (validFetched.length === 0) return null;

  const compositeList = [];
  compositeList.push({ input: makeSolidPanel(canvasWidth, headerHeight, "#181825"), top: 0, left: 0 });
  compositeList.push({
    input: await renderCollectionText("COLECCION DE WAIFUS HD", {
      width: canvasWidth - 40,
      height: 40,
      size: 31,
      align: "center",
    }),
    top: 13,
    left: 20,
  });
  compositeList.push({
    input: await renderCollectionText(`Pagina ${currentPage}/${totalPages}  |  Total: ${totalCount} personaje(s)`, {
      width: canvasWidth - 40,
      height: 27,
      size: 18,
      color: "#ff79c6",
      align: "center",
    }),
    top: 57,
    left: 20,
  });

  for (let i = 0; i < validFetched.length; i++) {
    const item = validFetched[i];
    const col = i % cols;
    const row = Math.floor(i / cols);
    const left = gap + col * (cardWidth + gap);
    const top = headerHeight + gap + row * (cardHeight + gap);
    const rarity = truncateCardText(item.waifu.rarity || "Comun", 14);
    const affection = Math.max(0, Number(item.waifu.affection) || 0);
    const name = truncateCardText(item.waifu.waifu_name, 29);

    compositeList.push({ input: item.buffer, top, left });
    compositeList.push({
      input: makeSolidPanel(cardWidth, infoHeight, "#11111b", 0.94),
      top: top + imageHeight,
      left,
    });
    compositeList.push({
      input: Buffer.from('<svg width="56" height="30"><rect x="8" y="5" width="48" height="25" rx="8" fill="#11111b" opacity="0.94"/></svg>'),
      top,
      left,
    });
    compositeList.push({
      input: await renderCollectionText(`#${item.globalIndex}`, {
        width: 40,
        height: 22,
        size: 16,
        align: "center",
      }),
      top: top + 7,
      left: left + 12,
    });
    compositeList.push({
      input: await renderCollectionText(name, {
        width: cardWidth - 24,
        height: 24,
        size: 17,
      }),
      top: top + imageHeight + 10,
      left: left + 12,
    });
    compositeList.push({
      input: await renderCollectionText(`Rareza: ${rarity}  |  Afecto: ${affection}`, {
        width: cardWidth - 24,
        height: 22,
        size: 15,
        color: "#ff79c6",
      }),
      top: top + imageHeight + 42,
      left: left + 12,
    });
  }

  compositeList.push({
    input: makeSolidPanel(canvasWidth, footerHeight, "#181825"),
    top: canvasHeight - footerHeight,
    left: 0,
  });
  compositeList.push({
    input: await renderCollectionText('Responde "siguiente", "anterior" o "pagina X"', {
      width: canvasWidth - 40,
      height: 28,
      size: 15,
      color: "#a6adc8",
      align: "center",
    }),
    top: canvasHeight - 36,
    left: 20,
  });

  return sharp({
    create: {
      width: canvasWidth,
      height: canvasHeight,
      channels: 4,
      background: { r: 24, g: 24, b: 37, alpha: 1 },
    },
  })
    .composite(compositeList)
    .jpeg({ quality: 92, chromaSubsampling: "4:4:4" })
    .toBuffer();
}

function formatCollectionPageText(waifus, {
  targetNum,
  startIndex,
  currentPage,
  totalPages,
  totalCount,
  totalAffection,
  usedPrefix,
}) {
  const endIndex = startIndex + waifus.length;
  let text = "✦━【 🌸 *COLECCION DE PERSONAJES* 】━✦\n\n";
  text += `👤 *Usuario:* @${targetNum}\n`;
  text += `📊 *Total acumulado:* ${totalCount} personaje(s)\n`;
  text += `❤️ *Afecto total:* ${totalAffection}\n`;
  text += `📖 *Pagina:* ${currentPage}/${totalPages} · Personajes #${startIndex + 1}-${endIndex}\n\n`;
  text += "── *Lista de la pagina actual* ──\n";

  waifus.forEach((waifu, index) => {
    const globalIndex = startIndex + index + 1;
    const star = waifu.is_main ? "⭐ " : "";
    const name = truncateCardText(waifu.waifu_name, 24);
    const rarity = truncateCardText(waifu.rarity || "Comun", 12);
    const affection = Math.max(0, Number(waifu.affection) || 0);
    text += `${globalIndex}. ${star}*${name}* [${rarity}] (❤️ ${affection})\n`;
  });

  text += `\n💡 *Usa \`${usedPrefix}coleccion <numero>\` para ver una waifu individual.*`;
  text += '\n↔️ Responde "siguiente", "anterior" o "pagina X".';
  if (currentPage < totalPages) text += `\nSiguiente: ${usedPrefix}coleccion pagina ${currentPage + 1}`;
  return text;
}

async function renderCollectionPage({
  conn,
  m,
  chatId,
  targetUserJid,
  allWaifus,
  page = 1,
  usedPrefix = "!",
  command = "coleccion",
}) {
  const totalPages = Math.max(1, Math.ceil(allWaifus.length / COLLECTION_PAGE_SIZE));
  const currentPage = Math.max(1, Math.min(page, totalPages));
  const startIndex = (currentPage - 1) * COLLECTION_PAGE_SIZE;
  const pageWaifus = allWaifus.slice(startIndex, startIndex + COLLECTION_PAGE_SIZE);
  const targetNum = targetUserJid.split("@")[0].split(":")[0];
  const totalAffection = allWaifus.reduce((sum, waifu) => sum + (Number(waifu.affection) || 0), 0);
  const fallbackText = formatCollectionPageText(pageWaifus, {
    targetNum,
    startIndex,
    currentPage,
    totalPages,
    totalCount: allWaifus.length,
    totalAffection,
    usedPrefix,
  });

  const collage = await createCollectionCollage(pageWaifus, {
    startIndex,
    totalCount: allWaifus.length,
    currentPage,
    totalPages,
  });
  // El resumen completo se conserva debajo del collage: es el mismo mensaje
  // visual, no un segundo envío separado.
  const mediaCaption = fallbackText;

  const sentMessage = await conn.sendMessage(
    chatId,
    collage
      ? { image: collage, caption: mediaCaption, mentions: [targetUserJid] }
      : { text: fallbackText, mentions: [targetUserJid] },
    { quoted: m }
  );

  activeCollectionSessions.set(chatId, {
    targetUserJid,
    allWaifus,
    currentPage,
    totalPages,
    usedPrefix,
    command,
    msgId: sentMessage?.key?.id,
    timestamp: Date.now(),
  });
}

const handler = async (m, { conn, sender, args, usedPrefix, command }) => {
  const chatId = getChatId(m);
  const targetUserJid = (await resolveTargetJid(m, args, conn)) || sender;
  const targetNum = targetUserJid.split("@")[0].split(":")[0];
  const waifus = getWaifus(targetUserJid) || [];

  if (waifus.length === 0) {
    const isSelf = targetUserJid === normalizeJid(sender);
    const text = isSelf
      ? `✦━【 🌸 *TU COLECCIÓN* 】━✦\n\n📭 Tu colección está vacía.\n\n🎲 Usa *${usedPrefix}waifu* o *${usedPrefix}gacha* para conseguir personajes.`
      : `✦━【 🌸 *COLECCIÓN DE @${targetNum}* 】━✦\n\n📭 Este usuario no tiene personajes en su colección todavía.`;
    return conn.sendMessage(chatId, { text, mentions: [targetUserJid] }, { quoted: m });
  }

  let query = args.join(" ").trim().toLowerCase();
  query = query.replace(/@[0-9]+/g, "").trim();

  // Detalles individuales: !coleccion 1 o !coleccion Kurumi.
  if (query && !["ver", "fotos", "all", "imagenes", "collage"].includes(query)) {
    const numericIndex = Number.parseInt(query, 10);
    const selectedWaifu = Number.isInteger(numericIndex) && numericIndex >= 1 && numericIndex <= waifus.length
      ? waifus[numericIndex - 1]
      : waifus.find((waifu) => waifu.waifu_name.toLowerCase().includes(query));

    if (selectedWaifu) {
      const image = selectedWaifu.waifu_image || selectedWaifu.image_url;
      const caption =
        "✦━【 💖 *DETALLES DEL PERSONAJE* 】━✦\n\n" +
        `👤 *Nombre:* ${selectedWaifu.waifu_name}\n` +
        `⭐ *Rareza:* ${selectedWaifu.rarity || "Común"}\n` +
        `❤️ *Afecto:* ${selectedWaifu.affection || 0}\n` +
        `👑 *Favorita:* ${selectedWaifu.is_main ? "Sí (Mi Waifu)" : "No"}\n` +
        `📅 *Obtenida:* ${selectedWaifu.obtained_at ? new Date(selectedWaifu.obtained_at).toLocaleDateString() : "Recientemente"}\n\n` +
        `💗 Usa *${usedPrefix}afecto ${selectedWaifu.waifu_name}* para darle afecto\n` +
        `⭐ Usa *${usedPrefix}miwaifu set ${selectedWaifu.waifu_name}* para establecerla favorita`;
      if (image) await conn.sendMessage(chatId, { image: { url: image }, caption }, { quoted: m });
      else await m.reply(caption);
      return;
    }
  }

  if (runningCollectionChats.has(chatId)) {
    return conn.sendMessage(chatId, { text: "⏳ Ya hay una colección cargándose en este chat. Espera un momento." }, { quoted: m });
  }

  runningCollectionChats.add(chatId);
  try {
    await renderCollectionPage({
      conn,
      m,
      chatId,
      targetUserJid,
      allWaifus: waifus,
      usedPrefix,
      command,
    });
  } catch (error) {
    console.error("Error generando colección paginada:", error);
    await conn.sendMessage(chatId, { text: "❌ No se pudo generar la colección visual. Inténtalo de nuevo." }, { quoted: m });
  } finally {
    runningCollectionChats.delete(chatId);
  }
};

handler.before = async (m, { conn }) => {
  if (!m.quoted) return false;

  const chatId = getChatId(m);
  const quotedText = getQuotedText(m);
  const isCollectionResult = /COLECCION DE (WAIFUS|PERSONAJES)|COLECCIÓN DE (WAIFUS|PERSONAJES)/i.test(quotedText) && /Pagina:\*?\s*\d+\/\d+/i.test(quotedText);
  if (!isCollectionResult) return false;

  const text = (m.text || m.body || "").trim().toLowerCase();
  if (!text) return false;

  let targetPage = null;
  if (/^(siguiente|sig|next|>|mas|más|paso)$/i.test(text)) {
    targetPage = "next";
  } else if (/^(anterior|ant|prev|<|atras|atrás)$/i.test(text)) {
    targetPage = "previous";
  } else if (/^(pagina|página|pag|p|page)\s*(\d+)$/i.test(text)) {
    const match = text.match(/^(pagina|página|pag|p|page)\s*(\d+)$/i);
    targetPage = Number.parseInt(match?.[2], 10);
  }

  if (targetPage === null) return false;

  const session = getActiveCollectionSession(chatId);
  if (!session) {
    await conn.sendMessage(chatId, {
      text: "⚠️ La sesión de colección expiró. Usa !coleccion nuevamente para cargarla.",
    }, { quoted: m });
    return true;
  }

  const page = targetPage === "next"
    ? session.currentPage + 1
    : targetPage === "previous"
      ? session.currentPage - 1
      : targetPage;

  if (page < 1) {
    await conn.sendMessage(chatId, { text: "⚠️ Ya estás en la primera página de la colección." }, { quoted: m });
    return true;
  }
  if (page > session.totalPages) {
    await conn.sendMessage(chatId, {
      text: `⚠️ No hay más páginas. La última página de la colección es la ${session.totalPages}.`,
    }, { quoted: m });
    return true;
  }
  if (runningCollectionChats.has(chatId)) {
    await conn.sendMessage(chatId, { text: "⏳ La página solicitada se está cargando. Espera un momento." }, { quoted: m });
    return true;
  }

  runningCollectionChats.add(chatId);
  try {
    await conn.sendMessage(chatId, { text: `⏳ *Cargando página ${page} de la colección...*` }, { quoted: m });
    await renderCollectionPage({
      conn,
      m,
      chatId,
      targetUserJid: session.targetUserJid,
      allWaifus: session.allWaifus,
      page,
      usedPrefix: session.usedPrefix,
      command: session.command,
    });
  } catch (error) {
    console.error("Error en paginación de colección:", error);
    await conn.sendMessage(chatId, { text: `❌ No se pudo cargar la página ${page} de la colección.` }, { quoted: m });
  } finally {
    runningCollectionChats.delete(chatId);
  }

  return true;
};

handler.command = /^(coleccion|colección|collection|coll|miswaifus)$/i;
handler.description = "Ver tu colección de personajes en un collage paginado";
handler.category = "rpg";
handler.register = true;

export default handler;
