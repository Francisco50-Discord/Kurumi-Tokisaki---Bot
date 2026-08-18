// ============================================================
//   Kurumi Tokisaki - NSFW Media Fetcher
//   Selección por categoría, calidad y medios animados
// ============================================================

import axios from "axios";
import https from "node:https";
import { randomInt } from "node:crypto";
import sharp from "sharp";
import { GoogleGenAI } from "@google/genai";
import { config } from "../config/settings.js";
import { convertGifToMp4Buffer } from "./animeMedia.js";

const DANBOORU_TAGS = {
  hentai: "rating:e -futanari -futa -gynomorph -andromorph -hermaphrodite -crossdressing -intersex -newhalf -otoko_no_ko -male_to_female -transgender -yaoi -bl -boys_love -boyslove -gay -male_on_male -male_male -bara",
  waifu: "bikini rating:e",
  nsfwwaifu: "swimsuit rating:e",
  neko: "catgirl rating:e",
  nsfwneko: "catgirl rating:e",
  blowjob: "fellatio rating:e",
  bj: "fellatio rating:e",
  cum: "cum rating:e",
  fuck: "sex rating:e",
  facial: "1girl cum_on_face facial rating:e -1boy -2boys -3boys -4boys -5boys -6+boys -male -male_focus -male_pov -futanari -crossdressing -intersex -newhalf -otoko_no_ko -cum_on_body -cum_on_breasts -cum_in_mouth -cum_on_lips -cum_on_tongue -cum_on_hair -after_fellatio -cum_on_ass -cum_on_pussy -blowjob -fellatio -oral -pussy -vagina -anal -ass -breasts -paizuri -penis -erect_penis -small_penis -large_penis -multiple_penises -male_genitalia -testicles -balls -ballsack",
  feet: "feet rating:e",
  yuri: "yuri rating:e",
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
  lewd: "panties rating:e",
  ahegao: "ahegao rating:e -futanari -futa -gynomorph -andromorph -hermaphrodite -crossdressing -intersex -newhalf -otoko_no_ko -male_to_female -transgender -yaoi -bl -boys_love -boyslove -gay -male_on_male -male_male -bara",
  succubus: "succubus rating:e",
  thighs: "thighhighs rating:e",
  paizuri: "paizuri rating:e",
  ecchi: "bikini rating:e",
  hentaigif: "animated rating:e"
};

// Respaldo de alta calidad: se usa solo si Danbooru no aporta un candidato válido.
const BOORU_TAGS = {
  hentai: ["rating:explicit -futanari -futa -gynomorph -andromorph -hermaphrodite -crossdressing -intersex -newhalf -otoko_no_ko -male_to_female -transgender -yaoi -bl -boys_love -boyslove -gay -male_on_male -male_male -bara -furry -anthro -feral"],
  hentaigif: ["animated rating:explicit -furry -anthro -feral"],
  waifu: ["bikini rating:explicit -furry -anthro -feral", "swimsuit rating:explicit -furry -anthro -feral"],
  nsfwwaifu: ["swimsuit rating:explicit -furry -anthro -feral"],
  neko: ["catgirl rating:explicit -furry -anthro -feral"],
  nsfwneko: ["catgirl rating:explicit -furry -anthro -feral"],
  blowjob: ["fellatio rating:explicit -furry -anthro -feral"],
  bj: ["fellatio rating:explicit -furry -anthro -feral"],
  cum: ["cum rating:explicit -furry -anthro -feral"],
  fuck: ["sex rating:explicit -furry -anthro -feral"],
  facial: ["1girl cum_on_face facial rating:explicit -1boy -2boys -3boys -4boys -5boys -6+boys -male -male_focus -male_pov -futanari -crossdressing -intersex -newhalf -otoko_no_ko -cum_on_body -cum_on_breasts -cum_in_mouth -cum_on_lips -cum_on_tongue -cum_on_hair -after_fellatio -cum_on_ass -cum_on_pussy -blowjob -fellatio -oral -pussy -vagina -anal -ass -breasts -paizuri -penis -furry -anthro -feral"],
  feet: ["feet rating:explicit -furry -anthro -feral"],
  yuri: ["yuri rating:explicit -furry -anthro -feral"],
  boobs: ["breasts rating:explicit -furry -anthro -feral"],
  pussy: ["pussy rating:explicit -furry -anthro -feral"],
  ass: ["ass rating:explicit -furry -anthro -feral"],
  anal: ["anal rating:explicit -furry -anthro -feral"],
  kuni: ["cunnilingus rating:explicit -furry -anthro -feral"],
  keta: ["bondage rating:explicit -furry -anthro -feral"],
  erok: ["kitsune rating:explicit -furry -anthro -feral"],
  holoero: ["hololive rating:explicit -furry -anthro -feral"],
  solo: ["solo rating:explicit -furry -anthro -feral"],
  lewd: ["panties -furry -anthro -feral"],
  ahegao: ["ahegao rating:explicit -futanari -futa -gynomorph -andromorph -hermaphrodite -crossdressing -intersex -newhalf -otoko_no_ko -male_to_female -transgender -yaoi -bl -boys_love -boyslove -gay -male_on_male -male_male -bara -furry -anthro -feral"],
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
  ahegao: ["ahegao"],
  neko: ["catgirl", "nekomimi"], nsfwneko: ["catgirl", "nekomimi"],
  thighs: ["thighs", "thighhighs"], succubus: ["succubus", "demon_girl"],
  cum: ["cum", "ejaculation"], fuck: ["sex", "intercourse", "penetration", "vaginal_sex", "vaginal_penetration", "penis_in_pussy"], facial: ["cum_on_face", "facial"], solo: ["solo"],
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
  "spongebob_squarepants", "my_little_pony", "the_simpsons", "family_guy", "south_park", "rick_and_morty", "cartoon_character", "toons", "famous_toons", "famous_toons_facial",
  // Menores, apariencia infantil y franquicias reconocibles observadas en las muestras.
  "child", "underage", "minor", "preteen", "toddler", "lolicon", "shotacon", "ageplay", "aged_down", "young_looking",
  "pokemon", "pokemon_(anime)", "pokemon_(game)", "ash_ketchum", "satoshi", "misty", "kasumi", "ben_10", "ben_tennyson", "gwen_tennyson", "avatar_the_last_airbender", "the_last_airbender", "katara", "sokka", "aang", "patreon", "patreon_logo",
  // Sexo grupal, múltiples parejas o varios participantes sexuales.
  "group_sex", "groupsex", "gangbang", "gang_bang", "threesome", "foursome", "multiple_partners", "multiple_male", "polyamory",
  // Contenido sexual no consentido, coercitivo o de cautiverio.
  "rape", "nonconsensual", "non-consensual", "non_con", "forced", "forced_sex", "forced_fellatio", "coercion", "coercive", "captive", "captivity", "kidnapping", "prisoner", "cage", "torture", "torture_device", "let_me_go", "help", "please_no", "no_means_no", "struggle",
  // Animales, bestialidad e interacciones humano-animal.
  "animal", "animal_focus", "animal_penetration", "animal_on_human", "human_on_animal", "animal_on_animal", "animal_sex", "animal_mating", "animal_penis", "animal_genitalia", "bestiality", "zoophilia", "interspecies",
  "furry", "anthro", "feral", "beast", "canine", "dog", "equine", "horse", "feline", "cat", "bovine", "cow", "ovine", "sheep", "reptile", "bird", "avian", "fish", "insect", "tentacle", "tentacles", "tentacle_monster", "tentacle_sex", "monster_girl",
  "ai_generated", "ai-assisted", "ai_assisted", "ai_art", "artificial_intelligence",
  "stable_diffusion", "novelai", "midjourney", "dall-e", "dall_e", "flux", "text_to_image",
  // Relaciones o contenido exclusivamente masculino entre hombres.
  "yaoi", "bl", "boys_love", "boyslove", "gay", "male_on_male", "male_male", "m_m", "same_sex_male", "boy_on_boy", "bara",
  // Fetiches de expansión extrema y anatomía fálica en pezones.
  "hyper", "breast_expansion", "breast_expansion_animation", "breast_expansion_fetish", "breast_growth", "dick_nipples", "dicknipples", "phallic_nipples", "phallic_nipple",
  "bad_anatomy", "bad_hands", "bad_proportions", "deformed", "lowres", "jpeg_artifacts", "watermark"
]);

// Estas etiquetas no se permiten en ningún resultado restante.
const EXCLUDED_IDENTITY_TAGS = new Set([
  // Futa o personajes con anatomía masculina incompatible con el alcance femenino.
  "futanari", "futa", "gynomorph", "andromorph", "hermaphrodite", "intersex", "newhalf", "otoko_no_ko",
  "male_to_female", "transgender", "transgender_character", "transgender_female", "transgender_male", "crossdressing",
  // Sinónimos de anatomía masculina explícita en personajes presentados como femeninos.
  "dickgirl", "dick_girl", "shemale", "male_hermaphrodite", "penis_on_female", "female_with_penis", "female_penile"
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
  ]),
  // `/fuck` busca penetración vaginal adulta, no sexo oral, anal o fetiches de otra categoría.
  fuck: new Set([
    "blowjob", "fellatio", "oral", "oral_sex", "oral_penetration", "deepthroat", "face_fucking",
    "cunnilingus", "anal", "anal_sex", "anal_penetration", "paizuri", "handjob", "footjob"
  ])
};

// Las categorías sensibles mantienen filtros por etiquetas de contenido no solicitado.
// La selección no depende de una revisión visual externa, que no está disponible en el
// despliegue gratuito y antes agotaba todas las fuentes válidas.
const STRICT_FEMALE_CATEGORIES = new Set(["hentai", "ahegao", "facial", "fuck"]);
const HARD_VISUAL_CATEGORIES = new Set();
const FEMALE_MARKER_TAGS = new Set([
  "1girl", "2girls", "3girls", "4girls", "5girls", "6+girls", "multiple_girls", "female", "female_focus", "female_only", "girls_only"
]);
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
  "cartoon", "western_cartoon", "western_animation", "comic_strip", "comic", "3d_cartoon", "chibi", "cartoon_character", "toons", "famous_toons", "famous_toons_facial",
  "disney", "pixar", "nickelodeon", "cartoon_network", "looney_tunes", "warner_bros", "spongebob_squarepants",
  "my_little_pony", "the_simpsons", "family_guy", "south_park", "rick_and_morty"
]);
const GLOBAL_QUERY_EXCLUSIONS = "-group_sex -groupsex -gangbang -gang_bang -threesome -foursome -multiple_partners -multiple_male -polyamory -child -underage -minor -preteen -toddler -lolicon -shotacon -ageplay -aged_down -young_looking -pokemon -pokemon_(anime) -pokemon_(game) -ash_ketchum -satoshi -misty -kasumi -ben_10 -ben_tennyson -gwen_tennyson -avatar_the_last_airbender -the_last_airbender -katara -sokka -aang -patreon -patreon_logo -rape -nonconsensual -non-consensual -non_con -forced -forced_sex -forced_fellatio -coercion -coercive -captive -captivity -kidnapping -prisoner -cage -torture -torture_device -let_me_go -help -please_no -no_means_no -struggle -cartoon_character -toons -famous_toons -famous_toons_facial -watermark -animal -animal_focus -animal_penetration -animal_on_human -human_on_animal -animal_on_animal -animal_sex -animal_mating -animal_penis -animal_genitalia -bestiality -zoophilia -interspecies -furry -anthro -feral -beast -canine -dog -equine -horse -feline -cat -bovine -cow -ovine -sheep -reptile -bird -avian -fish -insect -tentacle -tentacles -tentacle_monster -tentacle_sex -monster_girl -cartoon -western_cartoon -western_animation -comic -comic_strip -comic_book -western_comic -comic_page -speech_bubble -panel -3d_cartoon -chibi -cartoon_character -toons -famous_toons -famous_toons_facial -futanari -futa -gynomorph -andromorph -hermaphrodite -intersex -newhalf -otoko_no_ko -male_to_female -transgender -transgender_character -transgender_female -transgender_male -crossdressing -dickgirl -dick_girl -shemale -male_hermaphrodite -penis_on_female -female_with_penis -female_penile -yaoi -bl -boys_love -boyslove -gay -male_on_male -male_male -m_m -same_sex_male -boy_on_boy -bara -hyper -breast_expansion -breast_expansion_animation -breast_expansion_fetish -breast_growth -dick_nipples -dicknipples -phallic_nipples -phallic_nipple -watermark";
const STRICT_QUERY_EXCLUSIONS = GLOBAL_QUERY_EXCLUSIONS;
const GLOBAL_QUERY_EXCLUSION_TOKENS = new Set(GLOBAL_QUERY_EXCLUSIONS.split(/\s+/));
const STRICT_MIN_TAGS = 18;
const STRICT_MIN_TAGS_BY_CATEGORY = { facial: 6 };
const STRICT_MIN_XBOORU_SCORE = 25;
const STRICT_MIN_SCORE_BY_CATEGORY = { facial: 5 };
const FACIAL_STYLE_TAGS = new Set(["anime", "hentai", "manga", "gif", "animated", "animation", "original", "original_character", "2d", "3d"]);
const PUBLIC_CATEGORY_TIMEOUT_MS = 2800;

// Endpoints públicos sin credenciales. Solo se registran rutas cuya respuesta
// corresponde a la categoría solicitada; las categorías sin endpoint dedicado pasan
// por consultas etiquetadas de varios boorus y no se sustituyen por `solo`.
const PURRBOT_API_BASE = "https://api.purrbot.site/v2/img/nsfw";
const purrbotEndpoint = (path, isExactCategory = true) => ({ url: `${PURRBOT_API_BASE}/${path}/gif`, field: "link", isExactCategory });
const PUBLIC_CATEGORY_APIS = {
  hentai: { endpoints: [{ url: "https://nekobot.xyz/api/image?type=hentai", field: "message", isExactCategory: true }] },
  anal: { endpoints: [purrbotEndpoint("anal")] },
  bj: { endpoints: [purrbotEndpoint("blowjob")] },
  blowjob: { endpoints: [purrbotEndpoint("blowjob")] },
  cum: { endpoints: [purrbotEndpoint("cum")] },
  fuck: { endpoints: [purrbotEndpoint("fuck")] },
  yuri: { endpoints: [purrbotEndpoint("yuri")] }
};
const PUBLIC_CATEGORY_SOURCES = new Set(["public-category-api"]);

// waifu.im expone estas etiquetas documentadas con metadatos suficientes para
// validar el tipo, el tamaño y el estado NSFW de cada resultado antes de enviarlo.
const WAIFU_IM_CATEGORY_TAGS = {
  ass: "ass", boobs: "oppai", ecchi: "ecchi",
  hentai: "hentai", paizuri: "paizuri"
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

// Imágenes que el usuario pidió excluir de /ahegao y /succubus. Se guardan por
// MD5, ID de publicación y fragmento de URL para cubrir cambios de CDN o fuente.
const USER_EXCLUDED_MEDIA_CATEGORIES = new Set(["ahegao", "succubus"]);
const USER_EXCLUDED_MEDIA_MD5 = new Set([
  "221d9f8e0583e4a67aee1ad83699f150", "3133ced0b47e4eef98b83e80a1a29a7d",
  "597fcf06f5289dbfb9302940defb459e", "10c01afe46a4191176d2bdb5a30c7b21",
  "3760399f42077f109afe135f862a8567", "b8461fa1d348d085ade54c28de362ca8"
]);
const USER_EXCLUDED_MEDIA_URL_MARKERS = new Set(USER_EXCLUDED_MEDIA_MD5);
const USER_EXCLUDED_MEDIA_IDS = {
  xbooru: new Set(["790867", "289263", "776363", "218486", "328370", "345385"]),
  danbooru: new Set(["1569575"])
};

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

const CATEGORY_MEMORY_ALIASES = { bj: "blowjob", nsfwneko: "neko", nsfwwaifu: "waifu" };

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

function mediaHash(candidate) {
  const explicitHash = String(candidate?.md5 || "").trim().toLowerCase();
  if (/^[a-f0-9]{32}$/.test(explicitHash)) return explicitHash;
  const urlHash = String(candidate?.url || "").toLowerCase().match(/[a-f0-9]{32}/)?.[0];
  return urlHash || "";
}

function candidateKey(candidate) {
  const hash = mediaHash(candidate);
  if (hash) return `md5:${hash}`;
  return candidate?.source && candidate?.id !== undefined ? `${candidate.source}:${candidate.id}` : String(candidate?.url || "");
}

function isUserExcludedMedia(candidate, category) {
  const normalizedCategory = String(category || "").toLowerCase();
  if (!USER_EXCLUDED_MEDIA_CATEGORIES.has(normalizedCategory)) return false;
  const hash = mediaHash(candidate);
  if (hash && USER_EXCLUDED_MEDIA_MD5.has(hash)) return true;
  const source = String(candidate?.source || "").toLowerCase();
  const id = String(candidate?.id ?? "");
  if (USER_EXCLUDED_MEDIA_IDS[source]?.has(id)) return true;
  const url = String(candidate?.url || "").toLowerCase();
  return Array.from(USER_EXCLUDED_MEDIA_URL_MARKERS).some((marker) => url.includes(marker));
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
  const key = candidateKey(candidate);
  // Mover la entrada al final para que la antigüedad real de la publicación
  // también quede reflejada en el orden del bucket si alguna vez se reutiliza.
  bucket.delete(key);
  bucket.set(key, Date.now());
  while (bucket.size > MAX_RECENT_PER_SCOPE) bucket.delete(bucket.keys().next().value);
}

function wasSentWithinLast(candidate, category, scopeKey, count) {
  const bucket = recentBucket(category, scopeKey);
  const recentKeys = [...bucket.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, count)
    .map(([key]) => key);
  return recentKeys.includes(candidateKey(candidate));
}

function uniqueCandidates(items) {
  const seen = new Set();
  return items.filter((candidate) => {
    const key = candidateKey(candidate);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
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
  if (isUserExcludedMedia(candidate, normalizedCategory)) return false;
  if (tags.some((tag) => BLOCKED_TAGS.has(tag) || EXCLUDED_IDENTITY_TAGS.has(tag))) return false;
  if (tags.some((tag) => CATEGORY_EXCLUDED_TAGS[normalizedCategory]?.has(tag))) return false;
  // El tag `original` se prioriza en las consultas, pero no se exige como condición
  // universal: varios catálogos gratuitos no exponen copyright y se quedaban sin resultados.
  // Las exclusiones explícitas de cómic, franquicias conocidas, animales y baja calidad
  // siguen aplicándose por etiqueta en todas las fuentes.
  if (STRICT_FEMALE_CATEGORIES.has(normalizedCategory)) {
    // Una API de categoría exacta no expone etiquetas; su revisión visual se fuerza más abajo.
    if (!isExactCategory) {
      if (tags.some((tag) => STRICT_ANIMAL_TAGS.has(tag) || STRICT_CARTOON_TAGS.has(tag))) return false;
      if (!tags.some((tag) => FEMALE_MARKER_TAGS.has(tag))) return false;
      if (normalizedCategory === "facial" && !tags.some((tag) => FACIAL_STYLE_TAGS.has(tag))) return false;
      const minimumTags = STRICT_MIN_TAGS_BY_CATEGORY[normalizedCategory] || STRICT_MIN_TAGS;
      if (tags.length < minimumTags) return false;
      const minimumScore = STRICT_MIN_SCORE_BY_CATEGORY[normalizedCategory] || STRICT_MIN_XBOORU_SCORE;
      if (!["xbooru", "danbooru"].includes(candidate.source) || Number(candidate.score || 0) < minimumScore) return false;
      // Las categorías con revisión visual dura solo aceptan la fuente y metadatos
      // configurados para esa política cuando no hay aprobación visual disponible.
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
  "REJECT: visibly low-quality or malformed AI art, western/cartoon style, any recognizable character from a current or old TV series, movie, comic, game, or other franchise, child-franchise art, sexualized minors, loli, shota or childlike characters, furry/anthropomorphic animals, animal-on-animal or bestiality content, group sex, gangbang, threesome, foursome or multiple-partner content, except an otherwise compliant scene tagged orgy, orgia or harem, non-consensual, forced, rape, coercive, captive, prison or torture content, futa/dickgirl/shemale anatomy, or content with a watermark, logo or promotional text.",
  "ACCEPT only polished, coherent adult original anime, manga, 3D, CGI, animation, or model-style art with no recognizable franchise character."
].join(" ");

const STRICT_FEMALE_VISUAL_PROMPT = [
  "Classify this mature anime artwork. Return exactly ACCEPT or REJECT.",
  "REJECT: any animal, animal-like creature, human-animal interaction, animal-on-animal or bestiality content; furry/anthropomorphic animals; sexualized minors, loli, shota or childlike characters; group sex, gangbang, threesome, foursome or multiple-partner content, except an otherwise compliant scene tagged orgy, orgia or harem; non-consensual, forced, rape, coercive, captive, prison or torture content; futa, dickgirl, shemale, intersex, transgender or visible male anatomy on a female character; male-only or male-with-male content; western children-TV cartoon style, childish parody, or any recognizable character from a current or old TV series, movie, comic, game, or other franchise; visibly low-quality, malformed AI, grotesque, disturbing or poorly rendered art; or any watermark, logo or promotional text.",
  "A polished heterosexual scene with an adult man participating with an adult woman is allowed, including the tags hetero and straight. Ordinary polished Japanese adult anime or manga is allowed and is NOT a western cartoon. Do not reject solely because the adult content is explicit. ACCEPT polished, coherent adult anime, manga, 3D, CGI, animation, or model-style art when it satisfies the requested category and has no prohibited futa/dickgirl anatomy, animal content or male-with-male content."
].join(" ");

const STRICT_CATEGORY_VISUAL_REQUIREMENTS = {
  facial: "It must clearly show adult female facial ejaculation/cum on the face only, with no visible breasts, genitals, oral sex or male anatomy.",
  hentai: "It must clearly depict the requested adult female hentai content. A heterosexual adult man with an adult woman is allowed; reject futa, incompatible male anatomy, male-only and male-with-male content.",
  ahegao: "It must clearly depict the distinct adult female ahegao facial expression. A heterosexual adult man with an adult woman is allowed; reject futa, incompatible male anatomy, male-only and male-with-male content. REJECT ordinary orgasm or climax content that does not clearly show ahegao.",
  fuck: "It must clearly depict consensual adult heterosexual vaginal intercourse with an adult woman and adult man. Reject oral-only, anal-only, group sex, coercion, futa, male-only, male-with-male, animal or franchise content."
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
  // Una categoría con revisión visual dura no degrada a fuentes sin los
  // metadatos que exige esta ruta.
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

function fetchJsonOverHttpsOnce(url) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, {
      headers: { Accept: "application/json", "User-Agent": "KurumiTokisakiBot/1.0" }
    }, (response) => {
      let body = "";
      if (response.statusCode < 200 || response.statusCode >= 300) {
        response.resume();
        reject(new Error(`HTTP ${response.statusCode || 0}`));
        return;
      }
      response.setEncoding("utf8");
      response.on("data", (chunk) => {
        body += chunk;
        if (body.length > 256 * 1024) response.destroy(new Error("respuesta demasiado grande"));
      });
      response.on("end", () => {
        try {
          resolve(JSON.parse(body));
        } catch {
          reject(new Error("JSON inválido"));
        }
      });
      response.on("error", reject);
    });
    request.setTimeout(PUBLIC_CATEGORY_TIMEOUT_MS, () => request.destroy(new Error("timeout")));
    request.on("error", reject);
  });
}

async function fetchJsonOverHttps(url) {
  let lastError;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await fetchJsonOverHttpsOnce(url);
    } catch (error) {
      lastError = error;
      if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 180));
    }
  }
  throw lastError || new Error("fallo HTTPS");
}

async function fetchPublicEndpointData(url) {
  if (/^https:\/\/api\.purrbot\.site\//i.test(url)) return fetchJsonOverHttps(url);
  const { data } = await axios.get(url, {
    timeout: PUBLIC_CATEGORY_TIMEOUT_MS,
    headers: { Accept: "application/json", "User-Agent": "KurumiTokisakiBot/1.0 (category client)" }
  });
  return data;
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
  const settled = await Promise.allSettled(endpoints.map(({ url, field }) => fetchPublicEndpointData(url).then((data) => data?.[field])));
  return settled.flatMap((result, index) => {
    const url = result.status === "fulfilled" ? result.value : null;
    if (typeof url !== "string" || !/^https:\/\//i.test(url)) return [];
    const extension = url.split("?")[0].split(".").pop().toLowerCase();
    return [{
      url,
      id: `${normalizedCategory}:${Buffer.from(url).toString("base64url").slice(0, 24)}`,
      tags: "",
      source: "public-category-api",
      apiCategory: normalizedCategory,
      requiresVisualApproval: !endpoints[index]?.isExactCategory,
      isExactCategory: Boolean(endpoints[index]?.isExactCategory),
      isVideo: ["gif", "mp4", "webm", "mov"].includes(extension),
      extension
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
    const limit = ["rating:e original", "ahegao original"].includes(normalizedTags) ? 100 : 18;
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
        md5: String(post.md5 || "").toLowerCase(),
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
    const requestedTags = normalizeTags(tags).filter((tag) => !GLOBAL_QUERY_EXCLUSION_TOKENS.has(tag)).join(" ");
    const qualityTags = `${requestedTags} sort:score ${GLOBAL_QUERY_EXCLUSIONS} -loli -shota -furry -anthro -feral -scalie -futanari -crossdressing -intersex -newhalf -otoko_no_ko -male_to_female -ai_generated -ai-assisted -ai_assisted -ai_art -artificial_intelligence -stable_diffusion -novelai -midjourney -dall-e -dall_e -flux -text_to_image -bad_anatomy -bad_hands -bad_proportions -deformed -lowres -jpeg_artifacts -watermark -disney -pixar -nickelodeon -cartoon_network -looney_tunes -warner_bros -spongebob_squarepants -my_little_pony -the_simpsons -family_guy -south_park -rick_and_morty`;
    const { data } = await axios.get("https://xbooru.com/index.php", {
      params: { page: "dapi", s: "post", q: "index", json: 1, limit: 36, pid: selectedPage, tags: qualityTags },
      headers: { "User-Agent": "KurumiTokisakiBot/1.0 (quality fallback)" }, timeout: XBOORU_TIMEOUT_MS
    });
    const items = Array.isArray(data) ? data.map((item) => {
      const url = normalizeXbooruUrl(item.file_url || item.sample_url);
      const extension = String(url || "").split("?")[0].split(".").pop().toLowerCase();
      return {
        url,
        id: item.id, md5: String(item.md5 || "").toLowerCase(), fileSize: item.file_size || 0, tags: item.tags, source: "xbooru",
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
      url: item.sample_url || item.jpeg_url || item.file_url, id: item.id, md5: String(item.md5 || "").toLowerCase(), fileSize: item.file_size, tags: item.tags, source: "yandere", isOriginal: normalizeTags(item.tags).includes("original"), isVideo: false
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
      url: item.sample_url || item.file_url, id: item.id, md5: String(item.md5 || "").toLowerCase(), fileSize: item.file_size, tags: item.tags, source: "konachan", isOriginal: normalizeTags(item.tags).includes("original"), isVideo: false
    })).filter((item) => item.url) : [];
  } catch { return []; }
}

async function pickAllowedCandidate(items, category, scopeKey, deadline) {
  const normalizedCategory = String(category || "").toLowerCase();
  const allowed = uniqueCandidates(shuffle(items).filter((candidate) => isNsfwCandidateAllowed(candidate, category)));
  const unseen = allowed.filter((candidate) => !wasRecentlySent(candidate, category, scopeKey));
  // Si una consulta agotó temporalmente el lote disponible, no fallar: en estas
  // categorías se permite reciclar solo una publicación que no esté entre las
  // últimas tres enviadas, evitando el patrón A-B-A sin bloquear el comando.
  const rotationFallback = ["ahegao", "succubus"].includes(normalizedCategory)
    ? allowed.filter((candidate) => !wasSentWithinLast(candidate, category, scopeKey, 3))
    : [];
  const candidates = unseen.length ? unseen : (rotationFallback.length ? rotationFallback : shuffle(allowed));
  // Estas categorías suelen concentrarse en pocas páginas; revisar más candidatos
  // evita caer repetidamente en el primer resultado válido del lote cacheado.
  const reviewLimit = ["ahegao", "succubus"].includes(normalizedCategory) ? 8 : 3;
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
  const booruBaseTags = BOORU_TAGS[normalizedCategory];
  const danbooruBaseTags = DANBOORU_TAGS[normalizedCategory];
  // Nunca sustituir una categoría desconocida por hentai: eso puede cruzar el
  // contenido de un comando y ocultar un error de configuración del plugin.
  if (!booruBaseTags || !danbooruBaseTags) return null;
  const preferredFallbackTags = booruBaseTags.map((tags) => `${tags} ${GLOBAL_QUERY_EXCLUSIONS}${preferOriginal ? " original" : ""}`);
  const broadFallbackTags = booruBaseTags.map((tags) => `${tags} ${GLOBAL_QUERY_EXCLUSIONS}`);
  const preferredDanbooruQuery = `${danbooruBaseTags} ${GLOBAL_QUERY_EXCLUSIONS}${preferOriginal ? " original" : ""}`;
  const broadDanbooruQuery = `${danbooruBaseTags} ${GLOBAL_QUERY_EXCLUSIONS}`;
  const filterMediaType = (items) => {
    const filtered = options.allowAnimated === true
      ? items
      : items.filter((item) => !item.isVideo);
    if (options.mediaMode === "image-or-gif") {
      return filtered.filter((item) => !item.isVideo || String(item.extension || "").toLowerCase() === "gif");
    }
    return filtered;
  };
  const extraXbooruPage = ["ahegao", "succubus"].includes(normalizedCategory);
  const xbooruRequests = (tags) => extraXbooruPage
    ? [fetchXbooru(tags), fetchXbooru(tags)]
    : [fetchXbooru(tags)];

  // Danbooru y los boorus se lanzan en paralelo, pero la fuente pública exacta
  // se procesa en cuanto responde para que una consulta lenta no agote el presupuesto.
  const preferredPublicPromise = fetchPublicCategoryApi(normalizedCategory);
  const preferredRequests = [
    fetchWaifuImCategoryApi(normalizedCategory),
    fetchDanbooru(preferredDanbooruQuery),
    ...shuffle(preferredFallbackTags).slice(0, 2).flatMap((tags) => [
      ...xbooruRequests(tags),
      fetchYandere(tags),
      fetchKonachan(tags)
    ])
  ];
  const preferredPublicItems = await preferredPublicPromise.catch(() => []);
  const preferredPublicCandidate = await pickAllowedCandidate(filterMediaType(preferredPublicItems), normalizedCategory, scopeKey, deadline);
  if (preferredPublicCandidate || Date.now() >= deadline) return preferredPublicCandidate;
  const preferredSettled = await Promise.allSettled(preferredRequests);
  const preferredItems = preferredSettled.flatMap((result) => result.status === "fulfilled" ? result.value : []);
  const preferredCandidate = await pickAllowedCandidate(filterMediaType(preferredItems), normalizedCategory, scopeKey, deadline);
  if (preferredCandidate || Date.now() >= deadline) return preferredCandidate;

  // Si no existe arte con `original`, se amplía la búsqueda sin eliminar ninguna
  // exclusión de seguridad. Esto mantiene fuera cómics, animales y contenido de baja calidad.
  const broadRequests = [
    fetchDanbooru(broadDanbooruQuery, { timeout: Math.min(DANBOORU_TIMEOUT_MS, Math.max(1000, deadline - Date.now() - 120)) }),
    ...shuffle(broadFallbackTags).slice(0, 1).flatMap((tags) => [
      ...xbooruRequests(tags),
      fetchYandere(tags),
      fetchKonachan(tags)
    ])
  ];
  const broadSettled = await Promise.allSettled(broadRequests);
  const broadItems = broadSettled.flatMap((result) => result.status === "fulfilled" ? result.value : []);
  const broadCandidate = await pickAllowedCandidate(filterMediaType(broadItems), normalizedCategory, scopeKey, deadline);
  if (broadCandidate || Date.now() >= deadline) return broadCandidate;

  const nextPageItems = await fetchNextDanbooruPage(broadDanbooruQuery, deadline);
  if (Date.now() >= deadline) return null;
  return pickAllowedCandidate(filterMediaType(nextPageItems), normalizedCategory, scopeKey, deadline);
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

function isGifBuffer(buffer) {
  return Buffer.isBuffer(buffer)
    && buffer.length >= 1000
    && (buffer.subarray(0, 6).equals(Buffer.from("GIF87a")) || buffer.subarray(0, 6).equals(Buffer.from("GIF89a")));
}

export async function sendNsfwMixedMedia(m, conn, category, caption, { mentions = [] } = {}) {
  const scopeKey = m.chatId || m.chat || "global";
  let candidate = await getNsfwImageCandidate(category, {
    scopeKey,
    allowAnimated: true,
    mediaMode: "image-or-gif"
  }).catch(() => null);
  if (!candidate?.url) {
    await m.reply("No encontré contenido válido y de buena calidad para esta categoría. Inténtalo de nuevo.");
    return false;
  }

  for (let attempt = 0; attempt < 3 && candidate?.url; attempt += 1) {
    try {
      const buffer = candidate.preloadedBuffer || await downloadMediaBuffer(candidate.url, {
        timeout: candidate.isVideo ? VIDEO_SEND_TIMEOUT_MS : IMAGE_SEND_TIMEOUT_MS,
        maxBytes: candidate.isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES
      });
      if (!buffer || buffer.length < 1000) throw new Error("archivo vacío");
      const animated = candidate.extension === "gif" || isGifBuffer(buffer);
      if (animated) {
        const mp4 = await convertGifToMp4Buffer(buffer);
        if (!mp4 || mp4.length < 3000) throw new Error("GIF convertido vacío");
        await conn.sendMessage(m.chatId, {
          video: mp4,
          mimetype: "video/mp4",
          gifPlayback: true,
          caption,
          mentions
        }, { quoted: m });
      } else {
        const isPng = buffer.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
        const isWebp = buffer.subarray(0, 4).equals(Buffer.from("RIFF"));
        await conn.sendMessage(m.chatId, {
          image: buffer,
          mimetype: isPng ? "image/png" : isWebp ? "image/webp" : "image/jpeg",
          caption,
          mentions
        }, { quoted: m });
      }
      rememberSentCandidate(candidate, category, scopeKey);
      return true;
    } catch (error) {
      rememberSentCandidate(candidate, category, scopeKey);
      console.warn(`[${category}] medio no disponible (${attempt + 1}/3):`, error.message);
      candidate = await getNsfwImageCandidate(category, {
        scopeKey,
        allowAnimated: true,
        mediaMode: "image-or-gif"
      }).catch(() => null);
    }
  }

  await m.reply(`✦━【 ❌ ERROR 】━✦\n\nEl contenido de *${category}* no pudo ser enviado.\nIntenta nuevamente.`);
  return false;
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
  sendNsfwMixedMedia,
  sendNsfwVideo,
  checkImageVisuallyAllowed,
  FALLBACK_IMAGES
};
