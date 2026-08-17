// ============================================================
//   Kurumi Tokisaki - Waifu Command
// ============================================================

import axios from "axios";
import { addWaifu, getWaifus } from "../lib/database.js";
import { randomInt } from "../lib/utils.js";
import { getAnimeMediaUrl } from "../lib/animeMedia.js";

const WAIFU_RARITIES = [
  { name: "Común", emoji: "⚪", chance: 40, bonus: 0 },
  { name: "Poco común", emoji: "🟢", chance: 25, bonus: 5 },
  { name: "Raro", emoji: "🔵", chance: 15, bonus: 15 },
  { name: "Épico", emoji: "🟣", chance: 10, bonus: 30 },
  { name: "Legendario", emoji: "🟡", chance: 8, bonus: 50 },
  { name: "Mítico", emoji: "🔴", chance: 2, bonus: 100 },
];

async function fetchWaifuImage(query = "") {
  if (query && query.trim()) {
    const cleanQuery = query.trim();

    // 1. AniList Character Search (Preciso para nombres de anime/personajes)
    try {
      const graphqlQuery = `
        query ($search: String) {
          Character(search: $search) {
            id
            name {
              full
              native
            }
            image {
              large
            }
            media(perPage: 1) {
              nodes {
                title {
                  romaji
                  english
                }
              }
            }
          }
        }
      `;
      const res = await axios.post("https://graphql.anilist.co", {
        query: graphqlQuery,
        variables: { search: cleanQuery }
      }, {
        timeout: 8000,
        headers: { "Content-Type": "application/json", "Accept": "application/json" }
      });

      const char = res.data?.data?.Character;
      if (char && char.image?.large) {
        const anime = char.media?.nodes?.[0]?.title?.romaji || char.media?.nodes?.[0]?.title?.english || "";
        const fullName = anime ? `${char.name.full} (${anime})` : char.name.full;
        return { url: char.image.large, name: fullName };
      }
    } catch (e) {}

    // 2. Safebooru tag search
    try {
      const tag = cleanQuery.toLowerCase().replace(/\s+/g, "_");
      const res = await axios.get(`https://safebooru.org/index.php?page=dapi&s=post&q=index&json=1&tags=${encodeURIComponent(tag)}&limit=25`, {
        timeout: 6000,
        headers: { "User-Agent": "Mozilla/5.0" }
      });
      if (Array.isArray(res.data) && res.data.length > 0) {
        const item = res.data[Math.floor(Math.random() * res.data.length)];
        if (item?.directory && item?.image) {
          const url = `https://safebooru.org/images/${item.directory}/${item.image}`;
          const formattedName = cleanQuery.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
          return { url, name: formattedName };
        }
      }
    } catch (e) {}

    // 3. Yande.re search fallback
    try {
      const tag = cleanQuery.toLowerCase().replace(/\s+/g, "_");
      const res = await axios.get(`https://yande.re/post.json?limit=25&tags=${encodeURIComponent(tag)}`, {
        timeout: 6000,
        headers: { "User-Agent": "Mozilla/5.0" }
      });
      if (Array.isArray(res.data) && res.data.length > 0) {
        const item = res.data[Math.floor(Math.random() * res.data.length)];
        const url = item.file_url || item.sample_url || item.jpeg_url;
        if (url) {
          const formattedName = cleanQuery.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
          return { url, name: formattedName };
        }
      }
    } catch (e) {}
  }

  // Random Anime Waifu/Character:
  // 1. AniList Top Female/Popular Characters (Fixed GraphQL query & random page)
  try {
    const page = Math.floor(Math.random() * 35) + 1;
    const graphqlQuery = `
      query ($page: Int) {
        Page(page: $page, perPage: 50) {
          characters(sort: [FAVOURITES_DESC]) {
            name {
              full
            }
            gender
            image {
              large
              medium
            }
            media(perPage: 1) {
              nodes {
                title {
                  romaji
                  english
                }
              }
            }
          }
        }
      }
    `;
    const res = await axios.post("https://graphql.anilist.co", {
      query: graphqlQuery,
      variables: { page }
    }, {
      timeout: 8000,
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
      }
    });

    const rawList = res.data?.data?.Page?.characters || [];
    const list = rawList.filter(c => {
      if (!c?.gender) return true;
      const g = String(c.gender).toLowerCase();
      return g.includes("female") || g === "f";
    });

    if (list.length > 0) {
      const char = list[Math.floor(Math.random() * list.length)];
      const img = char?.image?.large || char?.image?.medium;
      if (img) {
        const anime = char.media?.nodes?.[0]?.title?.romaji || char.media?.nodes?.[0]?.title?.english || "";
        const fullName = anime ? `${char.name.full} (${anime})` : char.name.full;
        return { url: img, name: fullName };
      }
    }
  } catch (e) {}

  // 2. Safebooru Random Tag Search
  try {
    const pid = Math.floor(Math.random() * 80) + 1;
    const res = await axios.get(`https://safebooru.org/index.php?page=dapi&s=post&q=index&json=1&tags=1girl+solo&pid=${pid}&limit=20`, {
      timeout: 6000,
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" }
    });
    if (Array.isArray(res.data) && res.data.length > 0) {
      const item = res.data[Math.floor(Math.random() * res.data.length)];
      if (item?.directory && item?.image) {
        let charName = "Waifu Anime";
        if (item.tags) {
          const charTag = item.tags.split(" ").find(t => t.includes("_(") && !t.startsWith("artist:") && !t.startsWith("copyright:"));
          if (charTag) {
            const rawName = charTag.replace(/_\(/g, " (").replace(/\)/g, ")").replace(/_/g, " ");
            charName = rawName.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
          }
        }
        return {
          url: `https://safebooru.org/images/${item.directory}/${item.image}`,
          name: charName
        };
      }
    }
  } catch (e) {}

  // 3. Yande.re Random Safe Search
  try {
    const page = Math.floor(Math.random() * 50) + 1;
    const res = await axios.get(`https://yande.re/post.json?limit=20&page=${page}&tags=rating:safe+1girl`, {
      timeout: 5000,
      headers: { "User-Agent": "Mozilla/5.0" }
    });
    if (Array.isArray(res.data) && res.data.length > 0) {
      const item = res.data[Math.floor(Math.random() * res.data.length)];
      const url = item.file_url || item.sample_url;
      if (url) {
        return { url, name: "Waifu Anime Aleatoria" };
      }
    }
  } catch (e) {}

  // 4. nekos.life (vía helper centralizado)
  const fallbackUrl = await getAnimeMediaUrl("waifu");
  if (fallbackUrl) {
    return { url: fallbackUrl, name: "Waifu Anime" };
  }

  // 5. nekos.life neko
  const nekoUrl = await getAnimeMediaUrl("neko");
  if (nekoUrl) {
    return { url: nekoUrl, name: "Waifu Anime" };
  }

  return null;
}

const handler = async (m, { conn, text, args }) => {
  try {
    const query = text || args.join(" ");
    const waifuData = await fetchWaifuImage(query);
    if (!waifuData || !waifuData.url) {
      return m.reply(
        `✦━【 ❌ *ERROR* 】━✦\n` +
        `» ⚠️ No se pudo obtener la waifu${query ? ` "${query}"` : ""}.\n` +
        `» 📌 Intenta con otro nombre o intenta de nuevo.`
      );
    }

    const imageUrl = waifuData.url;

    // Determinar rareza
    const rarityRoll = Math.random() * 100;
    let cumulative = 0;
    let rarity = WAIFU_RARITIES[0];

    for (const r of WAIFU_RARITIES) {
      cumulative += r.chance;
      if (rarityRoll < cumulative) {
        rarity = r;
        break;
      }
    }

    const initialAffection = randomInt(10, 50) + rarity.bonus;
    const existingCount = (getWaifus(m.sender) || []).length;
    const waifuName = waifuData.name || `Waifu #${existingCount + 1} (${rarity.name})`;

    // Guardar en la base de datos
    addWaifu(m.sender, waifuName, imageUrl, initialAffection, rarity.name);

    const caption = 
      `✦━【 🌸 *¡NUEVA WAIFU!* 】━✦\n\n` +
      `◈ *Nombre:* ${waifuName}\n` +
      `◈ *Rareza:* ${rarity.emoji} ${rarity.name}\n` +
      `◈ *Afecto inicial:* ❤️ ${initialAffection}\n\n` +
      `✅ ¡Imagen adjunta y waifu guardada!\n` +
      `📚 Usa *!coleccion* para ver tus waifus\n` +
      `💗 Usa *!miwaifu* para ver tu favorita`;

    // Adjuntar la imagen del waifu obtenido siempre
    await conn.sendMessage(m.chatId, {
      image: { url: imageUrl },
      caption: caption
    }, { quoted: m });

  } catch (err) {
    console.error("Error en command waifu:", err);
    await m.reply(
      `✦━【 ❌ *ERROR* 】━✦\n` +
      `» ⚠️ Ocurrió un error al procesar el comando waifu.`
    );
  }
};

handler.command = /^(waifu)$/i;
handler.description = "Obtener una waifu aleatoria y guardar su imagen";
handler.category = "rpg";

export default handler;
