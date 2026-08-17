// ============================================================
//   Kurumi Tokisaki - RPG Images & Banner Provider
//   v20.0: getRandomWaifuImage usa nekos.life (waifu.pics muerto en 2026)
// ============================================================

import axios from "axios";

export const DEFAULT_AVATAR = "https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png";

export const RPG_BANNERS = {
  shop: "https://images.unsplash.com/photo-1578632767115-351597cf2477?w=1280&q=90&auto=format&fit=crop",
  inventory: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1280&q=90&auto=format&fit=crop",
  dungeon: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=1280&q=90&auto=format&fit=crop",
  mining: "https://images.unsplash.com/photo-1563089145-599997674d42?w=1280&q=90&auto=format&fit=crop",
  work: "https://images.unsplash.com/photo-1569074187119-c87815b476da?w=1280&q=90&auto=format&fit=crop",
  fishing: "https://images.unsplash.com/photo-1534447677768-be436bb09401?w=1280&q=90&auto=format&fit=crop",
  ranking: "https://images.unsplash.com/photo-1579783902614-a3fb3927b675?w=1280&q=90&auto=format&fit=crop",
  classes: "https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=1280&q=90&auto=format&fit=crop",
  battle: "https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=1280&q=90&auto=format&fit=crop",
  welcome: "https://images.unsplash.com/photo-1578632767115-351597cf2477?w=1280&q=90&auto=format&fit=crop"
};

const ANIME_WAIFUS = [
  "https://images.unsplash.com/photo-1578632767115-351597cf2477?w=1280&q=90&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=1280&q=90&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1280&q=90&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1563089145-599997674d42?w=1280&q=90&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1534447677768-be436bb09401?w=1280&q=90&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=1280&q=90&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1579783902614-a3fb3927b675?w=1280&q=90&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1569074187119-c87815b476da?w=1280&q=90&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=1280&q=90&auto=format&fit=crop"
];

export async function getRandomWaifuImage() {
  // v20.0: nekos.life (waifu.pics DNS caído en 2026)
  try {
    const res = await axios.get("https://nekos.life/api/v2/img/waifu", {
      timeout: 6000,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        Accept: "application/json",
      },
    });
    if (res.data?.url) return res.data.url;
  } catch (e) {}

  try {
    const res = await axios.get("https://nekos.life/api/v2/img/neko", {
      timeout: 6000,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        Accept: "application/json",
      },
    });
    if (res.data?.url) return res.data.url;
  } catch (e) {}

  // Fallback to curated anime list
  const idx = Math.floor(Math.random() * ANIME_WAIFUS.length);
  return ANIME_WAIFUS[idx];
}
