// ============================================================
//   Kurumi Tokisaki - NSFW Media Fetcher
//   Selección por categoría, calidad y medios animados
// ============================================================

import axios from "axios";
import { randomInt } from "node:crypto";
import sharp from "sharp";
import { GoogleGenAI } from "@google/genai";
import { config } from "../config/settings.js";
import { convertGifToMp4Buffer } from "./animeMedia.js";

const DANBOORU_TAGS = {
  hentai: "rating:e -1boy -2boys -3boys -4boys -5boys -6+boys -male -male_focus -male_pov -futanari -crossdressing -intersex -newhalf -otoko_no_ko",
  waifu: "bikini rating:e",
  nsfwwaifu: "swimsuit rating:e",
  neko: "catgirl rating:e",
  nsfwneko: "catgirl rating:e",
  blowjob: "fellatio rating:e",
  bj: "fellatio rating:e",
  cum: "cum rating:e",
  facial: "1girl cum_on_face facial rating:e -1boy -2boys -3boys -4boys -5boys -6+boys -male -male_focus -male_pov -futanari -crossdressing -intersex -newhalf -otoko_no_ko -cum_on_body -cum_on_breasts -cum_in_mouth -cum_on_lips -cum_on_tongue -cum_on_hair -after_fellatio -cum_on_ass -cum_on_pussy -blowjob -fellatio -oral -pussy -vagina -anal -ass -breasts -paizuri -penis -erect_penis -small_penis -large_penis -multiple_penises -male_genitalia -testicles -balls -ballsack",
  feet: "feet rating:e",
  yuri: "yuri rating:e",
  lesbian: "yuri rating:e",
  boobs: "breasts rating:e",
  pussy: "pussy rating:e",
  ass: "ass rating:e",
  anal: "anal rating:e",
  kuni: "cunnilingus rating:e",
  keta: "bondage rating:e",
  erok: "kitsune rating:e",
  ero: "rating:e",
  holoero: "hololive rating:e",
  solo: "solo rating:e",
  gasm: "orgasm rating:e -1boy -2boys -3boys -4boys -5boys -6+boys -male -male_focus -male_pov -futanari -crossdressing -intersex -newhalf -otoko_no_ko",
  lewd: "panties rating:e",
  ahegao: "ahegao rating:e -1boy -2boys -3boys -4boys -5boys -6+boys -male -male_focus -male_pov -futanari -crossdressing -intersex -newhalf -otoko_no_ko",
  succubus: "succubus rating:e",
  thighs: "thighhighs rating:e",
  paizuri: "paizuri rating:e",
  ecchi: "bikini rating:e",
  hentaigif: "animated rating:e"
};

// Respaldo de alta calidad: se usa solo si Danbooru no aporta un candidato válido.
const BOORU_TAGS = {
  hentai: ["rating:explicit -1boy -2boys -3boys -4boys -5boys -6+boys -male -male_focus -male_pov -futanari -crossdressing -intersex -newhalf -otoko_no_ko -furry -anthro -feral"],
  hentaigif: ["animated rating:explicit -furry -anthro -feral"],
  waifu: ["bikini rating:explicit -furry -anthro -feral", "swimsuit rating:explicit -furry -anthro -feral"],
  nsfwwaifu: ["swimsuit rating:explicit -furry -anthro -feral"],
  neko: ["catgirl rating:explicit -furry -anthro -feral"],
  nsfwneko: ["catgirl rating:explicit -furry -anthro -feral"],
  blowjob: ["fellatio rating:explicit -furry -anthro -feral"],
  bj: ["fellatio rating:explicit -furry -anthro -feral"],
  cum: ["cum rating:explicit -furry -anthro -feral"],
  facial: ["1girl cum_on_face facial rating:explicit -1boy -2boys -3boys -4boys -5boys -6+boys -male -male_focus -male_pov -futanari -crossdressing -intersex -newhalf -otoko_no_ko -cum_on_body -cum_on_breasts -cum_in_mouth -cum_on_lips -cum_on_tongue -cum_on_hair -after_fellatio -cum_on_ass -cum_on_pussy -blowjob -fellatio -oral -pussy -vagina -anal -ass -breasts -paizuri -penis -furry -anthro -feral"],
  feet: ["feet rating:explicit -furry -anthro -feral"],
  yuri: ["yuri rating:explicit -furry -anthro -feral"],
  lesbian: ["yuri rating:explicit -furry -anthro -feral"],
  boobs: ["breasts rating:explicit -furry -anthro -feral"],
  pussy: ["pussy rating:explicit -furry -anthro -feral"],
  ass: ["ass rating:explicit -furry -anthro -feral"],
  anal: ["anal rating:explicit -furry -anthro -feral"],
  kuni: ["cunnilingus rating:explicit -furry -anthro -feral"],
  keta: ["bondage rating:explicit -furry -anthro -feral"],
  erok: ["kitsune rating:explicit -furry -anthro -feral"],
  holoero: ["hololive rating:explicit -furry -anthro -feral"],
  solo: ["solo rating:explicit -furry -anthro -feral"],
  gasm: ["orgasm rating:explicit -1boy -2boys -3boys -4boys -5boys -6+boys -male -male_focus -male_pov -futanari -crossdressing -intersex -newhalf -otoko_no_ko -furry -anthro -feral"],
  lewd: ["panties -furry -anthro -feral"],
  ahegao: ["ahegao rating:explicit -1boy -2boys -3boys -4boys -5boys -6+boys -male -male_focus -male_pov -futanari -crossdressing -intersex -newhalf -otoko_no_ko -furry -anthro -feral"],
  succubus: ["succubus rating:explicit -furry -anthro -feral"],
  thighs: ["thighhighs rating:explicit -furry -anthro -feral"],
  paizuri: ["paizuri rating:explicit -furry -anthro -feral"],
  ecchi: ["bikini -furry -anthro -feral"]
};

const CATEGORY_REQUIRED_TAGS = {
  boobs: ["breasts", "cleavage", "nipples"],
  waifu: ["bikini", "swimsuit"], nsfwwaifu: ["bikini", "swimsuit"],
  ass: ["ass", "butt", "buttocks"], feet: ["feet", "soles"],
  pussy: ["pussy", "vagina"], anal: ["anal"],
  blowjob: ["blowjob", "fellatio"], bj: ["blowjob", "fellatio"],
  paizuri: ["paizuri", "breast_hold"], yuri: ["yuri", "female_on_female"],
  lesbian: ["yuri", "female_on_female"], ahegao: ["ahegao"], gasm: ["orgasm", "female_orgasm"],
  neko: ["catgirl", "nekomimi"], nsfwneko: ["catgirl", "nekomimi"],
  thighs: ["thighs", "thighhighs"], succubus: ["succubus"],
  cum: ["cum", "ejaculation"], facial: ["cum_on_face", "facial"], solo: ["solo"],
  kuni: ["cunnilingus"], keta: ["bondage", "shibari"], erok: ["kitsune"],
  holoero: ["hololive"],
  hentaigif: ["animated"]
};

const TAG_ALIASES = new Map([
  ["butt", ["buttocks"]], ["thighs", ["thighhighs"]],
  ["animated", ["video", "webm", "mp4", "gif"]]
]);

// Las etiquetas de IA y de baja calidad se rechazan localmente incluso si la fuente las marca como explícitas.
const BLOCKED_TAGS = new Set([
  "loli", "shota", "furry", "anthro", "feral", "scalie",
  // Cómics, páginas con viñetas y estilos de caricatura/franquicia.
  "western_cartoon", "western_animation", "comic", "comic_strip", "comic_book", "western_comic", "comic_page", "speech_bubble", "panel", "meme",
  "disney", "pixar", "nickelodeon", "cartoon_network", "looney_tunes", "warner_bros",
  "spongebob_squarepants", "my_little_pony", "the_simpsons", "family_guy", "south_park", "rick_and_morty",
  // Animales, bestialidad e interacciones humano-animal.
  "animal", "animal_focus", "animal_penetration", "animal_on_human", "human_on_animal", "animal_penis", "animal_genitalia", "bestiality", "zoophilia", "interspecies",
  "beast", "canine", "dog", "equine", "horse", "feline", "cat", "bovine", "cow", "ovine", "sheep", "reptile", "bird", "avian", "fish", "insect", "tentacle", "tentacles", "tentacle_monster", "tentacle_sex", "monster_girl",
  "ai_generated", "ai-assisted", "ai_assisted", "ai_art", "artificial_intelligence",
  "stable_diffusion", "novelai", "midjourney", "dall-e", "dall_e", "flux", "text_to_image",
  "bad_anatomy", "bad_hands", "bad_proportions", "deformed", "lowres", "jpeg_artifacts", "watermark"
]);

// Estas etiquetas no se permiten en ningún resultado restante.
const EXCLUDED_IDENTITY_TAGS = new Set([
  "futanari", "crossdressing", "intersex", "newhalf", "otoko_no_ko", "male_to_female"
]);

// /cum requiere una escena facial: se excluyen tags que suelen indicar cuerpo,
// genitales, pecho, sexo oral o presencia masculina en el mismo resultado.
const CATEGORY_EXCLUDED_TAGS = {
  facial: new Set([
    "cum_on_body", "cum_on_breasts", "cum_on_ass", "cum_on_pussy", "cum_in_mouth",
    "cum_in_pussy", "cum_in_ass", "cum_between_breasts", "cum_all_over", "bukkake",
    "cum_on_lips", "cum_on_tongue", "cum_on_hair", "after_fellatio", "blowjob", "fellatio", "oral", "oral_sex", "oral_penetration", "deepthroat", "face_fucking",
    "pussy", "vagina", "vulva", "anus", "ass", "anal", "penis", "erect_penis", "small_penis", "large_penis", "multiple_penises", "male_genitalia", "testicles", "balls", "ballsack",
    "breasts", "breast_focus", "breasts_apart", "large_breasts", "exposed_breasts", "nipples",
    "paizuri", "1boy", "1boy1girl", "2boys", "male", "male_focus", "male_pov", "hetero", "straight"
  ])
};

// Las categorías sensibles mantienen filtros por etiquetas de contenido no solicitado.
// La selección no depende de una revisión visual externa, que no está disponible en el
// despliegue gratuito y antes agotaba todas las fuentes válidas.
const STRICT_FEMALE_CATEGORIES = new Set(["hentai", "gasm", "ahegao", "facial"]);
const HARD_VISUAL_CATEGORIES = new Set();
const STRICT_MALE_TAGS = new Set([
  "1boy", "2boys", "3boys", "4boys", "5boys", "6+boys", "male", "male_focus", "male_pov", "male_only",
  "solo_male", "male_on_female", "male_on_male", "yaoi", "bl", "hetero", "straight", "penis", "erection",
  "penis_in_pussy", "penis_in_ass", "erect_penis", "small_penis", "large_penis", "multiple_penises", "male_genitalia", "testicles", "balls", "ballsack", "male_penetrating", "male_rape", "male_masturbation"
]);
const FEMALE_MARKER_TAGS = new Set([
  "1girl", "2girls", "3girls", "4girls", "5girls", "6+girls", "multiple_girls", "female", "female_focus", "female_only", "girls_only"
]);
const CATEGORY_CONFLICT_TAGS = {
  // Una obra marcada como ahegao nunca puede servir para gasm. Ahegao puede
  // compartir la etiqueta general de orgasmo, pero sigue fuera de gasm por esta regla.
  gasm: new Set(["ahegao"])
};

// Las categorías generales no deben entregar personajes de series, películas, videojuegos
// o franquicias, sean actuales o antiguas. El tag de copyright `original` de los boorus
// garantiza que el personaje no pertenece a una obra existente. Holoero se conserva como
// excepción porque el propio comando solicita contenido de Hololive.
const ORIGINAL_ART_EXEMPT_CATEGORIES = new Set(["holoero"]);
const METADATA_ORIGINAL_SOURCES = new Set(["danbooru", "xbooru", "yandere", "konachan"]);

function requiresOriginalArtwork(category) {
  return !ORIGINAL_ART_EXEMPT_CATEGORIES.has(String(category || "").toLowerCase());
}

// Estos cuatro comandos son deliberadamente más restrictivos que el resto del catálogo.
const STRICT_ANIMAL_TAGS = new Set([
  "animal", "animal_focus", "animal_penetration", "animal_on_human", "human_on_animal", "bestiality", "zoophilia", "interspecies",
  "beast", "canine", "dog", "equine", "horse", "feline", "cat", "bovine", "cow", "ovine", "sheep", "reptile", "tentacle_monster"
]);
const STRICT_CARTOON_TAGS = new Set([
  "cartoon", "western_cartoon", "western_animation", "comic_strip", "comic", "3d_cartoon", "chibi",
  "disney", "pixar", "nickelodeon", "cartoon_network", "looney_tunes", "warner_bros", "spongebob_squarepants",
  "my_little_pony", "the_simpsons", "family_guy", "south_park", "rick_and_morty"
]);
const GLOBAL_QUERY_EXCLUSIONS = "-animal -animal_focus -animal_penetration -animal_on_human -human_on_animal -animal_penis -animal_genitalia -bestiality -zoophilia -interspecies -beast -canine -dog -equine -horse -feline -cat -bovine -cow -ovine -sheep -reptile -bird -avian -fish -insect -tentacle -tentacles -tentacle_monster -tentacle_sex -monster_girl -cartoon -western_cartoon -western_animation -comic -comic_strip -comic_book -western_comic -comic_page -speech_bubble -panel -3d_cartoon -chibi";
const STRICT_QUERY_EXCLUSIONS = GLOBAL_QUERY_EXCLUSIONS;
const STRICT_MIN_TAGS = 18;
const STRICT_MIN_TAGS_BY_CATEGORY = { facial: 6 };
const STRICT_MIN_XBOORU_SCORE = 25;
const STRICT_MIN_SCORE_BY_CATEGORY = { facial: 5 };
const FACIAL_STYLE_TAGS = new Set(["anime", "hentai", "manga", "gif", "animated", "animation", "original", "original_character", "2d", "3d"]);
const PUBLIC_CATEGORY_TIMEOUT_MS = 2800;

// Endpoints públicos sin credenciales. Son catálogos NSFW por ruta, por lo que se
// consultan antes de los boorus que el alojamiento puede bloquear. `solo` se usa
// únicamente como respaldo para las categorías sin ruta especializada.
const PURRBOT_API_BASE = "https://api.purrbot.site/v2/img/nsfw";
const purrbotEndpoint = (path, isExactCategory = true) => ({ url: `${PURRBOT_API_BASE}/${path}/gif`, field: "link", isExactCategory });
const PUBLIC_CATEGORY_APIS = {
  hentai: { endpoints: [{ url: "https://nekobot.xyz/api/image?type=hentai", field: "message", isExactCategory: true }, purrbotEndpoint("solo", false)] },
  gasm: { endpoints: [{ url: "https://nekos.life/api/v2/img/gasm", field: "url", isExactCategory: true }, purrbotEndpoint("solo", false)] },
  ahegao: { endpoints: [purrbotEndpoint("solo", false), { url: "https://nekobot.xyz/api/image?type=hentai", field: "message", isExactCategory: false }] },
  anal: { endpoints: [purrbotEndpoint("anal")] },
  bj: { endpoints: [purrbotEndpoint("blowjob")] },
  blowjob: { endpoints: [purrbotEndpoint("blowjob")] },
  cum: { endpoints: [purrbotEndpoint("cum")] },
  pussy: { endpoints: [purrbotEndpoint("pussylick")] },
  pussylick: { endpoints: [purrbotEndpoint("pussylick")] },
  yuri: { endpoints: [purrbotEndpoint("yuri")] },
  lesbian: { endpoints: [purrbotEndpoint("yuri")] },
  boobs: { endpoints: [purrbotEndpoint("solo", false)] },
  ass: { endpoints: [purrbotEndpoint("solo", false)] },
  ecchi: { endpoints: [purrbotEndpoint("solo", false)] },
  erok: { endpoints: [purrbotEndpoint("solo", false)] },
  hentaigasm: { endpoints: [purrbotEndpoint("solo", false)] },
  lewd: { endpoints: [purrbotEndpoint("solo", false)] },
  nsfwwaifu: { endpoints: [purrbotEndpoint("solo", false)] },
  paizuri: { endpoints: [purrbotEndpoint("solo", false)] }
};
const PUBLIC_CATEGORY_SOURCES = new Set(["public-category-api"]);

// waifu.im expone estas etiquetas documentadas con metadatos suficientes para
// validar el tipo, el tamaño y el estado NSFW de cada resultado antes de enviarlo.
const WAIFU_IM_CATEGORY_TAGS = {
  ass: "ass", bj: "oral", blowjob: "oral", boobs: "oppai", ecchi: "ecchi",
  erok: "ero", hentai: "hentai", lewd: "ero", nsfwwaifu: "waifu", paizuri: "paizuri"
};

const FETCH_TIMEOUT_MS = 3500;
const DANBOORU_TIMEOUT_MS = 6800;
const XBOORU_TIMEOUT_MS = 5500;
const MIN_XBOORU_IMAGE_PIXELS = 550000;
const MIN_XBOORU_VIDEO_PIXELS = 100000;
const SELECTION_BUDGET_MS = 8000;
const VISUAL_TIMEOUT_MS = 2400;
const IMAGE_SEND_TIMEOUT_MS = 5000;
const VIDEO_SEND_TIMEOUT_MS = 16000;
const MAX_IMAGE_BYTES = 14 * 1024 * 1024;
const MAX_VIDEO_BYTES = 28 * 1024 * 1024;
const PREVIEW_MAX_BYTES = 2 * 1024 * 1024;
const RECENT_TTL_MS = 30 * 60 * 1000;
const MAX_RECENT_PER_SCOPE = 24;

const recentResults = new Map();
const visualReviewCache = new Map();
const danbooruCache = new Map();
const danbooruPageCursor = new Map();
const xbooruCache = new Map();
const sourcePageHistory = new Map();
const DANBOORU_CACHE_TTL_MS = 45 * 1000;
const XBOORU_CACHE_TTL_MS = 3 * 60 * 1000;
const openAiKey = process.env.OPENAI_API_KEY || "";
const openAiBase = (process.env.OPENAI_API_BASE || "https://api.openai.com/v1").replace(/\/$/, "");
const googleVision = process.env.GEMINI_API_KEY ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }) : null;

const CATEGORY_MEMORY_ALIASES = { bj: "blowjob", lesbian: "yuri", nsfwneko: "neko", nsfwwaifu: "waifu" };

function shuffle(items) {
  // Fisher-Yates con aleatoriedad criptográfica: evita el sesgo y las secuencias
  // repetibles que produce sort(() => Math.random() - 0.5).
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(index + 1);
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

function randomSourcePage(source, tags, maxPage = 12) {
  const key = `${source}:${String(tags || "")}`;
  const history = sourcePageHistory.get(key) || [];
  const available = Array.from({ length: maxPage }, (_, index) => index + 1)
    .filter((page) => !history.includes(page));
  const choices = available.length ? available : Array.from({ length: maxPage }, (_, index) => index + 1);
  const page = choices[randomInt(choices.length)];
  sourcePageHistory.set(key, [...history, page].slice(-4));
  return page;
}

function normalizeTags(rawTags) {
  const values = Array.isArray(rawTags) ? rawTags : String(rawTags || "").split(/\s+/);
  return values.map((tag) => String(tag || "").trim().toLowerCase()).filter(Boolean);
}

function tagMatches(tag, expected) {
  return tag === expected || (TAG_ALIASES.get(expected) || []).includes(tag);
}

function candidateKey(candidate) {
  return candidate?.source && candidate?.id !== undefined ? `${candidate.source}:${candidate.id}` : String(candidate?.url || "");
}

function recentBucket(category, scopeKey) {
  const normalizedCategory = CATEGORY_MEMORY_ALIASES[String(category || "hentai").toLowerCase()] || String(category || "hentai").toLowerCase();
  const key = `${String(scopeKey || "global")}:${normalizedCategory}`;
  const now = Date.now();
  let bucket = recentResults.get(key);
  if (!bucket) {
    bucket = new Map();
    recentResults.set(key, bucket);
  }
  for (const [keyValue, sentAt] of bucket) if (now - sentAt > RECENT_TTL_MS) bucket.delete(keyValue);
  return bucket;
}

function wasRecentlySent(candidate, category, scopeKey) {
  return recentBucket(category, scopeKey).has(candidateKey(candidate));
}

function rememberSentCandidate(candidate, category, scopeKey) {
  const bucket = recentBucket(category, scopeKey);
  bucket.set(candidateKey(candidate), Date.now());
  while (bucket.size > MAX_RECENT_PER_SCOPE) bucket.delete(bucket.keys().next().value);
}

export function isNsfwCandidateAllowed(candidate, category) {
  const tags = normalizeTags(candidate?.tags);
  const normalizedCategory = String(category || "").toLowerCase();
  const isExactPublicCategory = PUBLIC_CATEGORY_SOURCES.has(candidate?.source)
    && candidate?.apiCategory === normalizedCategory
    && candidate?.requiresVisualApproval !== true
    && candidate?.isExactCategory !== false;
  const isExactCategory = isExactPublicCategory || (candidate?.isExactCategory === true && candidate?.apiCategory === normalizedCategory);
  if (!candidate?.url || (!tags.length && !isExactCategory)) return false;
  if (tags.some((tag) => BLOCKED_TAGS.has(tag) || EXCLUDED_IDENTITY_TAGS.has(tag))) return false;
  if (tags.some((tag) => CATEGORY_EXCLUDED_TAGS[normalizedCategory]?.has(tag))) return false;
  // El tag `original` se prioriza en las consultas, pero no se exige como condición
  // universal: varios catálogos gratuitos no exponen copyright y se quedaban sin resultados.
  // Las exclusiones explícitas de cómic, franquicias conocidas, animales y baja calidad
  // siguen aplicándose por etiqueta en todas las fuentes.
  if (STRICT_FEMALE_CATEGORIES.has(normalizedCategory)) {
    // Una API de categoría exacta no expone etiquetas; su revisión visual se fuerza más abajo.
    if (!isExactCategory) {
      if (tags.some((tag) => STRICT_MALE_TAGS.has(tag))) return false;
      if (tags.some((tag) => CATEGORY_CONFLICT_TAGS[normalizedCategory]?.has(tag))) return false;
      if (tags.some((tag) => STRICT_ANIMAL_TAGS.has(tag) || STRICT_CARTOON_TAGS.has(tag))) return false;
      if (!tags.some((tag) => FEMALE_MARKER_TAGS.has(tag))) return false;
      if (normalizedCategory === "facial" && !tags.some((tag) => FACIAL_STYLE_TAGS.has(tag))) return false;
      const minimumTags = STRICT_MIN_TAGS_BY_CATEGORY[normalizedCategory] || STRICT_MIN_TAGS;
      if (tags.length < minimumTags) return false;
      const minimumScore = STRICT_MIN_SCORE_BY_CATEGORY[normalizedCategory] || STRICT_MIN_XBOORU_SCORE;
      if (!["xbooru", "danbooru"].includes(candidate.source) || Number(candidate.score || 0) < minimumScore) return false;
      // Gasm y ahegao solo admiten obras originales y explícitas de Danbooru
      // cuando no hay una aprobación visual disponible: impide franquicias de caricatura.
      if (HARD_VISUAL_CATEGORIES.has(normalizedCategory) && (
        candidate.source !== "danbooru" || candidate.rating !== "e" || candidate.isOriginal !== true
      )) return false;
    }
  }
  if (Number(candidate.fileSize || 0) > MAX_IMAGE_BYTES && !candidate.isVideo) return false;
  if (candidate.isVideo && Number(candidate.fileSize || 0) > MAX_VIDEO_BYTES) return false;
  // La API pública no facilita etiquetas ni dimensiones: la revisión visual estricta
  // posterior es obligatoria y decide la admisión del candidato.
  if (isExactCategory) return true;
  const pixels = Number(candidate.width || 0) * Number(candidate.height || 0);
  if (candidate.source === "xbooru" && !candidate.isVideo && pixels < MIN_XBOORU_IMAGE_PIXELS) return false;
  if (candidate.source === "xbooru" && candidate.isVideo && pixels < MIN_XBOORU_VIDEO_PIXELS) return false;
  const requiredCategory = String(category || "").toLowerCase();
  const required = CATEGORY_REQUIRED_TAGS[requiredCategory];
  if (requiredCategory === "facial" && !(tags.includes("cum_on_face") && tags.includes("facial"))) return false;
  return !required || required.some((expected) => tags.some((tag) => tagMatches(tag, expected)));
}

function shouldUseVisualReview(candidate, category) {
  // Las categorías restringidas se revisan siempre; en las demás, solo cuando faltan metadatos.
  const normalizedCategory = String(category || "").toLowerCase();
  const requiresStrictReview = STRICT_FEMALE_CATEGORIES.has(normalizedCategory);
  const exactCategoryWithoutTags = candidate?.isExactCategory === true && (!normalizeTags(candidate?.tags).length || requiresStrictReview);
  return !candidate?.isVideo && (candidate?.requiresOriginalReview || PUBLIC_CATEGORY_SOURCES.has(candidate?.source) || exactCategoryWithoutTags || (candidate?.source === "xbooru" && (requiresStrictReview || normalizeTags(candidate.tags).length < 14)));
}

function withTimeout(promise, timeoutMs) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("timeout")), timeoutMs); })
  ]).finally(() => clearTimeout(timer));
}

function parseVisualDecision(value) {
  const decision = String(value || "").trim().toUpperCase();
  if (decision.includes("REJECT") || decision.includes("RECHAZ")) return false;
  if (decision.includes("ACCEPT") || decision.includes("ALLOW") || decision.includes("ACEPT")) return true;
  return null;
}

const VISUAL_REVIEW_PROMPT = [
  "Classify this mature anime artwork. Return exactly ACCEPT or REJECT.",
  "REJECT: visibly low-quality or malformed AI art, western/cartoon style, any recognizable character from a current or old TV series, movie, comic, game, or other franchise, child-franchise art, furry/anthropomorphic animals, or content with a watermark.",
  "ACCEPT only polished, coherent adult original anime, manga, 3D, CGI, animation, or model-style art with no recognizable franchise character."
].join(" ");

const STRICT_FEMALE_VISUAL_PROMPT = [
  "Classify this mature anime artwork. Return exactly ACCEPT or REJECT.",
  "REJECT: any animal, animal-like creature, human-animal interaction or bestiality; furry/anthropomorphic animals; any male-presenting character or male anatomy; western children-TV cartoon style, childish parody, or any recognizable character from a current or old TV series, movie, comic, game, or other franchise; visibly low-quality, malformed AI, grotesque, disturbing or poorly rendered art; or any watermark.",
  "Ordinary polished Japanese adult anime or manga is allowed and is NOT a western cartoon. Do not reject solely because the adult content is explicit. ACCEPT only polished, coherent adult female original Japanese-anime, manga, 3D, CGI, animation, or model-style art with no animals, no male anatomy and no recognizable franchise character."
].join(" ");

const STRICT_CATEGORY_VISUAL_REQUIREMENTS = {
  facial: "It must clearly show adult female facial ejaculation/cum on the face only, with no visible breasts, genitals, oral sex or male anatomy.",
  hentai: "It must clearly depict adult female hentai and no male character or anatomy.",
  gasm: "It must clearly depict an adult female orgasm or climax and no male character or anatomy. REJECT any distinct ahegao expression or ahegao-styled face.",
  ahegao: "It must clearly depict the distinct adult female ahegao facial expression and no male character or anatomy. REJECT ordinary orgasm or climax content that does not clearly show ahegao."
};

function visualReviewPromptFor(category) {
  const normalizedCategory = String(category || "").toLowerCase();
  if (!STRICT_FEMALE_CATEGORIES.has(normalizedCategory)) return VISUAL_REVIEW_PROMPT;
  return `${STRICT_FEMALE_VISUAL_PROMPT} ${STRICT_CATEGORY_VISUAL_REQUIREMENTS[normalizedCategory] || ""}`;
}

async function createVisualPreview(buffer) {
  return sharp(buffer, { animated: false }).rotate().resize({ width: 448, height: 448, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 70, mozjpeg: true }).toBuffer();
}

async function requestOpenAiDecision(preview, prompt, strict = false) {
  if (!openAiKey) return null;
  const response = await axios.post(`${openAiBase}/chat/completions`, {
    model: strict ? (process.env.NSFW_STRICT_VISION_MODEL || "gpt-5-nano") : (process.env.NSFW_VISION_MODEL || "gpt-5-nano"),
    messages: [
      { role: "system", content: "You are an exact image-quality classifier." },
      { role: "user", content: [
        { type: "text", text: prompt },
        { type: "image_url", image_url: { url: `data:image/jpeg;base64,${preview.toString("base64")}`, detail: "low" } }
      ] }
    ],
    temperature: 0,
    max_completion_tokens: 20,
    reasoning: { effort: "minimal" }
  }, { timeout: VISUAL_TIMEOUT_MS, headers: { Authorization: `Bearer ${openAiKey}`, "Content-Type": "application/json" } });
  return parseVisualDecision(response.data?.choices?.[0]?.message?.content);
}

async function requestGeminiDecision(preview, prompt) {
  if (!googleVision) return null;
  const response = await googleVision.models.generateContent({
    model: process.env.NSFW_GEMINI_VISION_MODEL || "gemini-3.1-flash-lite",
    contents: [{ role: "user", parts: [{ text: prompt }, { inlineData: { mimeType: "image/jpeg", data: preview.toString("base64") } }] }],
    config: { temperature: 0, maxOutputTokens: 8 }
  });
  return parseVisualDecision(response?.text);
}

export async function checkImageVisuallyAllowed(candidate, deadline, category) {
  const prompt = visualReviewPromptFor(category);
  const strict = STRICT_FEMALE_CATEGORIES.has(String(category || "").toLowerCase());
  const key = `${candidateKey(candidate)}:${strict ? "strict-female" : "standard"}`;
  const cached = visualReviewCache.get(key);
  if (cached && Date.now() - cached.checkedAt < RECENT_TTL_MS) return cached.allowed;
  // Las fuentes públicas por categoría son preferibles; si la visión no está disponible,
  // siguen siendo la única vía sin metadatos. El respaldo de booru estricto no se acepta
  // sin una decisión visual positiva.
  const normalizedCategory = String(category || "").toLowerCase();
  const requiresHardVisualReview = HARD_VISUAL_CATEGORIES.has(normalizedCategory);
  const isPublicCategory = PUBLIC_CATEGORY_SOURCES.has(candidate?.source) || candidate?.isExactCategory === true;
  const requiresOriginalReview = candidate?.requiresOriginalReview === true;
  // Gasm y ahegao nunca degradan a Xbooru: solo Danbooru proporciona los
  // metadatos de obra original y clasificación explícita que exige esta ruta.
  const isStrictTaggedFallback = strict && (requiresHardVisualReview
    ? candidate?.source === "danbooru" && candidate?.rating === "e" && candidate?.isOriginal === true
    : ["danbooru", "xbooru"].includes(candidate?.source));
  // Los respaldos genéricos no se consideran de categoría exacta sin una clasificación
  // visual positiva; así no se confunde hentai genérico con ahegao.
  if (!openAiKey && !googleVision) {
    if (requiresOriginalReview) return false;
    return requiresHardVisualReview ? isStrictTaggedFallback : ((isPublicCategory && !candidate?.requiresVisualApproval) || isStrictTaggedFallback);
  }
  const remaining = deadline - Date.now();
  // Si ya no queda tiempo para clasificar, la degradación segura permite solo una
  // fuente pública exacta; los respaldos genéricos y de booru siguen bloqueados.
  if (remaining < 700) {
    if (requiresOriginalReview) return false;
    return strict ? (requiresHardVisualReview ? isStrictTaggedFallback : ((isPublicCategory && !candidate?.requiresVisualApproval) || isStrictTaggedFallback)) : false;
  }
  try {
    const raw = await downloadMediaBuffer(candidate.url, { timeout: Math.min(1200, remaining), maxBytes: PREVIEW_MAX_BYTES });
    candidate.preloadedBuffer = raw;
    const preview = await withTimeout(createVisualPreview(raw), 450);
    const decision = openAiKey
      ? await withTimeout(requestOpenAiDecision(preview, prompt, strict), Math.min(VISUAL_TIMEOUT_MS, deadline - Date.now()))
      : await withTimeout(requestGeminiDecision(preview, prompt), Math.min(VISUAL_TIMEOUT_MS, deadline - Date.now()));
    // Para las cuatro categorías estrictas solo una aprobación explícita permite el resultado.
    const allowed = strict || requiresOriginalReview ? decision === true : decision !== false;
    visualReviewCache.set(key, { allowed, checkedAt: Date.now() });
    return allowed;
  } catch {
    // La revisión es una defensa adicional; un error técnico no inutiliza la API pública
    // de categoría exacta. Los respaldos genéricos y los boorus permanecen bloqueados.
    if (requiresOriginalReview) return false;
    return strict ? (requiresHardVisualReview ? isStrictTaggedFallback : ((isPublicCategory && !candidate?.requiresVisualApproval) || isStrictTaggedFallback)) : true;
  }
}

async function fetchPublicCategoryApi(category) {
  const normalizedCategory = String(category || "").toLowerCase();
  const api = PUBLIC_CATEGORY_APIS[normalizedCategory];
  if (!api) return [];
  const endpoints = Array.isArray(api.endpoints) && api.endpoints.length
    ? api.endpoints
    : [
      ...Array.from({ length: Math.max(1, Number(api.attempts) || 1) }, () => ({
        url: api.url, field: api.field, isExactCategory: true
      })),
      ...(api.fallbackUrl ? [{ url: api.fallbackUrl, field: api.fallbackField, isExactCategory: false }] : [])
    ];
  const settled = await Promise.allSettled(endpoints.map(({ url, field }) => axios.get(url, {
    timeout: PUBLIC_CATEGORY_TIMEOUT_MS,
    headers: { Accept: "application/json", "User-Agent": "KurumiTokisakiBot/1.0 (category client)" }
  }).then(({ data }) => data?.[field])));
  return settled.flatMap((result, index) => {
    const url = result.status === "fulfilled" ? result.value : null;
    if (typeof url !== "string" || !/^https:\/\//i.test(url)) return [];
    return [{
      url,
      id: `${normalizedCategory}:${Buffer.from(url).toString("base64url").slice(0, 24)}`,
      tags: "",
      source: "public-category-api",
      apiCategory: normalizedCategory,
      requiresVisualApproval: !endpoints[index]?.isExactCategory,
      isExactCategory: Boolean(endpoints[index]?.isExactCategory),
      isVideo: false
    }];
  });
}

async function fetchWaifuImCategoryApi(category) {
  const normalizedCategory = String(category || "").toLowerCase();
  const tag = WAIFU_IM_CATEGORY_TAGS[normalizedCategory];
  if (!tag) return [];
  try {
    const { data } = await axios.get("https://api.waifu.im/images", {
      params: { IsNsfw: "True", IncludedTags: tag, PageSize: 8 },
      timeout: PUBLIC_CATEGORY_TIMEOUT_MS,
      headers: { Accept: "application/json", "User-Agent": "KurumiTokisakiBot/1.0 (category client)" }
    });
    return (Array.isArray(data?.items) ? data.items : []).flatMap((item) => {
      const url = item?.url;
      if (!item?.isNsfw || typeof url !== "string" || !/^https:\/\//i.test(url)) return [];
      const tags = (Array.isArray(item.tags) ? item.tags : []).map((value) => value?.slug || value?.name || "").filter(Boolean).join(" ");
      return [{
        url,
        id: `waifu-im:${item?.id || Buffer.from(url).toString("base64url").slice(0, 24)}`,
        tags,
        source: "waifu-im",
        provider: "waifu.im",
        apiCategory: normalizedCategory,
        isExactCategory: true,
        // La API aporta etiqueta NSFW y categoría exacta. No se exige visión externa:
        // si no está configurada, ese requisito dejaba vacíos los comandos gratuitos.
        requiresOriginalReview: false,
        fileSize: Number(item?.byteSize || 0),
        width: Number(item?.width || 0),
        height: Number(item?.height || 0),
        isVideo: Boolean(item?.isAnimated),
        extension: String(item?.extension || "").replace(/^\./, "").toLowerCase()
      }];
    });
  } catch {
    return [];
  }
}

async function fetchDanbooru(tags, { page = null, timeout = DANBOORU_TIMEOUT_MS } = {}) {
  const normalizedTags = String(tags || "rating:e");
  const cacheKey = `${normalizedTags}:${page || "latest"}`;
  const cached = danbooruCache.get(cacheKey);
  if (cached && Date.now() - cached.storedAt < DANBOORU_CACHE_TTL_MS) return shuffle(cached.items);
  try {
    // Las consultas originales estrictas usan una muestra mayor: después se aplican
    // localmente exclusiones de identidad, franquicia, animal y puntuación.
    const limit = ["rating:e original", "orgasm original", "ahegao original"].includes(normalizedTags) ? 100 : 18;
    const { data } = await axios.get("https://danbooru.donmai.us/posts.json", {
      params: { tags: normalizedTags, limit, ...(page ? { page } : {}) },
      headers: { "User-Agent": "KurumiTokisakiBot/1.0 (quality media fetcher)" },
      timeout
    });
    const items = Array.isArray(data) ? data.map((post) => {
      const extension = String(post.file_ext || "").toLowerCase();
      const isVideo = ["webm", "mp4", "gif"].includes(extension);
      return {
        url: post.large_file_url || post.file_url || post.preview_file_url || null,
        id: post.id,
        fileSize: post.file_size,
        tags: [post.tag_string_general, post.tag_string_character, post.tag_string_copyright, post.tag_string_meta].filter(Boolean).join(" "),
        source: "danbooru",
        rating: String(post.rating || "").toLowerCase(),
        isOriginal: normalizeTags(post.tag_string_copyright).includes("original"),
        width: Number(post.image_width || 0), height: Number(post.image_height || 0), score: Number(post.score || 0),
        isVideo,
        extension
      };
    }).filter((item) => item.url) : [];
    if (items.length) {
      danbooruCache.set(cacheKey, { items, storedAt: Date.now() });
      const oldestId = Math.min(...items.map((item) => Number(item.id)).filter(Number.isFinite));
      if (Number.isFinite(oldestId)) danbooruPageCursor.set(normalizedTags, oldestId);
    }
    return shuffle(items);
  } catch {
    return cached?.items ? shuffle(cached.items) : [];
  }
}

async function fetchNextDanbooruPage(tags, deadline) {
  const normalizedTags = String(tags || "rating:e");
  const cursor = danbooruPageCursor.get(normalizedTags);
  const remaining = deadline - Date.now();
  if (!Number.isFinite(cursor) || remaining < 900) return [];
  return fetchDanbooru(normalizedTags, {
    page: `b${cursor}`,
    timeout: Math.min(DANBOORU_TIMEOUT_MS, Math.max(800, remaining - 120))
  });
}

function normalizeXbooruUrl(rawUrl) {
  const value = String(rawUrl || "");
  if (!value) return null;
  if (value.startsWith("//")) return `https:${value}`;
  if (/^https?:\/\//i.test(value)) return value.replace(/^http:\/\//i, "https://");
  return `https://xbooru.com${value.startsWith("/") ? "" : "/"}${value}`;
}

export async function fetchXbooru(tags, { page = null } = {}) {
  const selectedPage = Number.isInteger(page) && page >= 0 ? page : randomSourcePage("xbooru", tags, 12) - 1;
  const cacheKey = `${String(tags || "")}:page:${selectedPage}`;
  const cached = xbooruCache.get(cacheKey);
  if (cached && Date.now() - cached.storedAt < XBOORU_CACHE_TTL_MS) return shuffle(cached.items);
  try {
    const qualityTags = `${tags} sort:score ${GLOBAL_QUERY_EXCLUSIONS} -loli -shota -furry -anthro -feral -scalie -futanari -crossdressing -intersex -newhalf -otoko_no_ko -male_to_female -ai_generated -ai-assisted -ai_assisted -ai_art -artificial_intelligence -stable_diffusion -novelai -midjourney -dall-e -dall_e -flux -text_to_image -bad_anatomy -bad_hands -bad_proportions -deformed -lowres -jpeg_artifacts -watermark -disney -pixar -nickelodeon -cartoon_network -looney_tunes -warner_bros -spongebob_squarepants -my_little_pony -the_simpsons -family_guy -south_park -rick_and_morty`;
    const { data } = await axios.get("https://xbooru.com/index.php", {
      params: { page: "dapi", s: "post", q: "index", json: 1, limit: 36, pid: selectedPage, tags: qualityTags },
      headers: { "User-Agent": "KurumiTokisakiBot/1.0 (quality fallback)" }, timeout: XBOORU_TIMEOUT_MS
    });
    const items = Array.isArray(data) ? data.map((item) => {
      const url = normalizeXbooruUrl(item.file_url || item.sample_url);
      const extension = String(url || "").split("?")[0].split(".").pop().toLowerCase();
      return {
        url, id: item.id, fileSize: item.file_size || 0, tags: item.tags, source: "xbooru",
        isOriginal: normalizeTags(item.tags).includes("original"),
        width: Number(item.width || 0), height: Number(item.height || 0), score: Number(item.score || 0),
        isVideo: ["webm", "mp4", "gif"].includes(extension), extension
      };
    }).filter((item) => item.url) : [];
    if (items.length) xbooruCache.set(cacheKey, { items, storedAt: Date.now() });
    return shuffle(items);
  } catch { return cached?.items ? shuffle(cached.items) : []; }
}

async function fetchYandere(tags) {
  try {
    const { data } = await axios.get("https://yande.re/post.json", {
      params: { limit: 25, page: randomSourcePage("yandere", tags), tags },
      headers: { "User-Agent": "Mozilla/5.0" }, timeout: FETCH_TIMEOUT_MS
    });
    return Array.isArray(data) ? data.map((item) => ({
      url: item.sample_url || item.jpeg_url || item.file_url, id: item.id, fileSize: item.file_size, tags: item.tags, source: "yandere", isOriginal: normalizeTags(item.tags).includes("original"), isVideo: false
    })).filter((item) => item.url) : [];
  } catch { return []; }
}

async function fetchKonachan(tags) {
  try {
    const { data } = await axios.get("https://konachan.com/post.json", {
      params: { limit: 25, page: randomSourcePage("konachan", tags), tags },
      headers: { "User-Agent": "Mozilla/5.0" }, timeout: FETCH_TIMEOUT_MS
    });
    return Array.isArray(data) ? data.map((item) => ({
      url: item.sample_url || item.file_url, id: item.id, fileSize: item.file_size, tags: item.tags, source: "konachan", isOriginal: normalizeTags(item.tags).includes("original"), isVideo: false
    })).filter((item) => item.url) : [];
  } catch { return []; }
}

async function pickAllowedCandidate(items, category, scopeKey, deadline) {
  const candidates = shuffle(items).filter((candidate) => isNsfwCandidateAllowed(candidate, category) && !wasRecentlySent(candidate, category, scopeKey));
  const reviewLimit = STRICT_FEMALE_CATEGORIES.has(String(category || "").toLowerCase()) ? 3 : 3;
  for (const candidate of candidates.slice(0, reviewLimit)) {
    if (Date.now() >= deadline) break;
    if (!shouldUseVisualReview(candidate, category) || await checkImageVisuallyAllowed(candidate, deadline, category)) return candidate;
  }
  return null;
}

export async function getNsfwImageCandidate(category, options = {}) {
  const normalizedCategory = String(category || "hentai").toLowerCase();
  const scopeKey = options.scopeKey || "global";
  const deadline = Date.now() + SELECTION_BUDGET_MS;
  const preferOriginal = requiresOriginalArtwork(normalizedCategory);
  const booruBaseTags = BOORU_TAGS[normalizedCategory] || BOORU_TAGS.hentai;
  const preferredFallbackTags = booruBaseTags.map((tags) => `${tags} ${GLOBAL_QUERY_EXCLUSIONS}${preferOriginal ? " original" : ""}`);
  const broadFallbackTags = booruBaseTags.map((tags) => `${tags} ${GLOBAL_QUERY_EXCLUSIONS}`);
  const danbooruBaseTags = DANBOORU_TAGS[normalizedCategory] || DANBOORU_TAGS.hentai;
  const preferredDanbooruQuery = `${danbooruBaseTags} ${GLOBAL_QUERY_EXCLUSIONS}${preferOriginal ? " original" : ""}`;
  const broadDanbooruQuery = `${danbooruBaseTags} ${GLOBAL_QUERY_EXCLUSIONS}`;

  // Danbooru se consulta desde el inicio junto con los respaldos. Antes quedaba para
  // el final y los tiempos de espera de otros boorus agotaban el presupuesto del comando.
  const preferredRequests = [
    fetchPublicCategoryApi(normalizedCategory),
    fetchWaifuImCategoryApi(normalizedCategory),
    fetchDanbooru(preferredDanbooruQuery),
    ...shuffle(preferredFallbackTags).slice(0, 2).flatMap((tags) => [
      fetchXbooru(tags, normalizedCategory === "facial" ? { page: 0 } : {}),
      fetchYandere(tags),
      fetchKonachan(tags)
    ])
  ];
  const preferredSettled = await Promise.allSettled(preferredRequests);
  const preferredItems = preferredSettled.flatMap((result) => result.status === "fulfilled" ? result.value : []);
  const preferredCandidate = await pickAllowedCandidate(preferredItems.filter((item) => !item.isVideo), normalizedCategory, scopeKey, deadline);
  if (preferredCandidate || Date.now() >= deadline) return preferredCandidate;

  // Si no existe arte con `original`, se amplía la búsqueda sin eliminar ninguna
  // exclusión de seguridad. Esto mantiene fuera cómics, animales y contenido de baja calidad.
  const broadRequests = [
    fetchDanbooru(broadDanbooruQuery, { timeout: Math.min(DANBOORU_TIMEOUT_MS, Math.max(1000, deadline - Date.now() - 120)) }),
    ...shuffle(broadFallbackTags).slice(0, 1).flatMap((tags) => [
      fetchXbooru(tags, normalizedCategory === "facial" ? { page: 0 } : {}),
      fetchYandere(tags),
      fetchKonachan(tags)
    ])
  ];
  const broadSettled = await Promise.allSettled(broadRequests);
  const broadItems = broadSettled.flatMap((result) => result.status === "fulfilled" ? result.value : []);
  const broadCandidate = await pickAllowedCandidate(broadItems.filter((item) => !item.isVideo), normalizedCategory, scopeKey, deadline);
  if (broadCandidate || Date.now() >= deadline) return broadCandidate;

  const nextPageItems = await fetchNextDanbooruPage(broadDanbooruQuery, deadline);
  if (Date.now() >= deadline) return null;
  return pickAllowedCandidate(nextPageItems.filter((item) => !item.isVideo), normalizedCategory, scopeKey, deadline);
}

export async function getNsfwVideoCandidate(options = {}) {
  const scopeKey = options.scopeKey || "global";
  const deadline = Date.now() + SELECTION_BUDGET_MS;
  const tags = `animated rating:explicit original ${GLOBAL_QUERY_EXCLUSIONS} -loli -shota -furry -anthro -feral -ai_generated -ai-assisted`;
  const posts = await fetchXbooru(tags);
  const videoPosts = posts.filter((post) => post.isVideo && ["webm", "mp4", "gif"].includes(post.extension));
  const selected = await pickAllowedCandidate(videoPosts, "hentaigif", scopeKey, deadline);
  if (selected || Date.now() >= deadline) return selected;
  const nextPosts = await fetchXbooru(tags);
  const nextVideoPosts = nextPosts.filter((post) => post.isVideo && ["webm", "mp4", "gif"].includes(post.extension));
  return pickAllowedCandidate(nextVideoPosts, "hentaigif", scopeKey, deadline);
}

export async function getNsfwImageUrl(category, options = {}) {
  return (await getNsfwImageCandidate(category, options))?.url || null;
}

export async function downloadMediaBuffer(url, { timeout = IMAGE_SEND_TIMEOUT_MS, maxBytes = MAX_IMAGE_BYTES } = {}) {
  if (!url || typeof url !== "string") throw new Error("URL inválida");
  const fixedUrl = url.replace(/^http:\/\//, "https://");
  const isDanbooruMedia = /(?:danbooru|donmai)/i.test(fixedUrl);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const { data } = await axios.get(fixedUrl, {
      responseType: "arraybuffer", timeout, signal: controller.signal,
      maxContentLength: maxBytes, maxBodyLength: maxBytes, maxRedirects: 5,
      // El CDN de Danbooru bloquea este tipo de cabeceras automatizadas con 403.
      // Para esa fuente se conserva el cliente nativo de Axios sin Referer ni UA forzado.
      headers: mediaHeadersForUrl(fixedUrl)
    });
    return Buffer.from(data);
  } finally {
    clearTimeout(timer);
  }
}

// Alias compatible con módulos existentes.
export const downloadImageBuffer = downloadMediaBuffer;

function mediaHeadersForUrl(url) {
  if (/(?:danbooru|donmai)/i.test(url)) return undefined;
  const referer = /gelbooru/i.test(url)
    ? "https://gelbooru.com/"
    : /xbooru/i.test(url)
      ? "https://xbooru.com/"
      : /purrbot/i.test(url)
        ? "https://purrbot.site/"
        : /rule34/i.test(url)
          ? "https://rule34.xxx/"
          : "https://yande.re/";
  return {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Referer": referer,
    "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,video/*,*/*;q=0.8"
  };
}

function captionFor(category, displayName) {
  const cleanName = String(displayName || category).slice(0, 16);
  return `✦━【 🔞 *${cleanName.toUpperCase()}* 】━✦\n◈ Categoría: *${category}*\n🌸 *${config.botName}*`;
}

export async function sendNsfwImage(m, conn, category, displayName) {
  const scopeKey = m.chatId || m.chat || "global";
  let candidate = await getNsfwImageCandidate(category, { scopeKey }).catch(() => null);
  if (!candidate?.url) return m.reply("No encontré contenido válido y de buena calidad para esta categoría. Inténtalo de nuevo.");

  // Algunos hosts pueden cancelar una descarga puntual. Se descarta ese archivo y se
  // intenta una vez más con otra selección, manteniendo la misma memoria del chat.
  for (let attempt = 0; attempt < 2 && candidate?.url; attempt += 1) {
    try {
      const buffer = candidate.preloadedBuffer || await downloadMediaBuffer(candidate.url, { timeout: IMAGE_SEND_TIMEOUT_MS, maxBytes: MAX_IMAGE_BYTES });
      if (!buffer || buffer.length < 1000) throw new Error("archivo vacío");
      const isPng = buffer.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
      const isWebp = buffer.subarray(0, 4).equals(Buffer.from("RIFF"));
      await conn.sendMessage(m.chatId, { image: buffer, mimetype: isPng ? "image/png" : isWebp ? "image/webp" : "image/jpeg", caption: captionFor(category, displayName) }, { quoted: m });
      rememberSentCandidate(candidate, category, scopeKey);
      return;
    } catch {
      // Impide que un archivo inaccesible vuelva a elegirse durante la ventana actual.
      rememberSentCandidate(candidate, category, scopeKey);
      if (attempt === 0) candidate = await getNsfwImageCandidate(category, { scopeKey }).catch(() => null);
    }
  }

  await m.reply(`✦━【 ❌ ERROR 】━✦\n\nLa imagen de *${displayName}* no pudo ser enviada.\nIntenta nuevamente.`);
}

export async function sendNsfwVideo(m, conn, displayName = "Hentai GIF") {
  const scopeKey = m.chatId || m.chat || "global";
  const candidate = await getNsfwVideoCandidate({ scopeKey }).catch(() => null);
  if (!candidate?.url) return m.reply("No encontré un clip animado válido y de buena calidad. Inténtalo de nuevo.");
  try {
    const rawVideo = await downloadMediaBuffer(candidate.url, { timeout: VIDEO_SEND_TIMEOUT_MS, maxBytes: MAX_VIDEO_BYTES });
    if (!rawVideo || rawVideo.length < 3000) throw new Error("clip vacío");
    // La conversión normaliza GIF, WEBM y MP4 para una reproducción directa en WhatsApp.
    const mp4 = await convertGifToMp4Buffer(rawVideo);
    if (!mp4 || mp4.length < 3000) throw new Error("conversión vacía");
    await conn.sendMessage(m.chatId, {
      video: mp4,
      mimetype: "video/mp4",
      gifPlayback: true,
      caption: captionFor("hentaigif", displayName)
    }, { quoted: m });
    rememberSentCandidate(candidate, "hentaigif", scopeKey);
  } catch {
    await m.reply("No pude preparar un clip animado compatible. Inténtalo de nuevo.");
  }
}

// Se conserva por compatibilidad de importación; ya no se usa un conjunto de URLs estáticas sin filtrar.
export const FALLBACK_IMAGES = {};

export default {
  getNsfwImageCandidate,
  getNsfwImageUrl,
  getNsfwVideoCandidate,
  isNsfwCandidateAllowed,
  downloadImageBuffer,
  downloadMediaBuffer,
  sendNsfwImage,
  sendNsfwVideo,
  checkImageVisuallyAllowed,
  FALLBACK_IMAGES
};
