// ============================================================
//   Kurumi Tokisaki - Menús por Categoría v3.0 (Estilo 3 Minimalista)
// ============================================================

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { config } from "../config/settings.js";
import { getUser } from "../lib/database.js";
import { formatDate } from "../lib/utils.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const menuImagePath = path.join(__dirname, "../assets/kurumi-menu.png");
const p = config.prefix[0] || "!";

function header(m, categoryName, icon) {
  const user = getUser(m.sender);
  const rawName = user.name && user.name !== "Usuario" ? user.name : m.sender.split("@")[0];
  const userName = rawName.length > 14 ? rawName.slice(0, 13) + "…" : rawName;
  const level = user.level || 1;
  const coins = (user.coins || 0).toLocaleString();
  const owner = config.creator;
  const date = formatDate();
  const totalCommands = user.total_commands || 0;

  return (
    `✦━【 時崎狂三 】━✦\n` +
    `🌸 *${config.botName}*\n` +
    `👑 Owner: *${owner}*\n` +
    `📅 *${date}*\n\n` +
    `◈ *ESTADO DE USUARIO*\n` +
    `• Usuario: *${userName}*\n` +
    `• Nivel: *${level}*  |  Coins: *${coins}*\n` +
    `• Comandos usados: *${totalCommands}*`
  );
}

function footer() {
  return `✦ *${config.botName}*`;
}

async function sendMenu(m, conn, text) {
  if (fs.existsSync(menuImagePath)) {
    try {
      const imageBuffer = fs.readFileSync(menuImagePath);
      await conn.sendMessage(
        m.chatId,
        { image: imageBuffer, caption: text, mentions: [m.sender] },
        { quoted: m }
      );
      return;
    } catch (e) {}
  }
  await m.reply(text);
}

// 1. Menú DESCARGAS
const handlerDescargas = async (m, { conn }) => {
  const text =
    header(m, "Descargas", "📥") + "\n\n" +
    `◈ *📥 DESCARGAS*\n` +
    `» ${p}tiktok <url>\n` +
    `» ${p}instagram <url>\n` +
    `» ${p}facebook <url>\n` +
    `» ${p}twitter <url>\n` +
    `» ${p}spotify <url>\n` +
    `» ${p}ytmp3 <url | búsqueda>\n` +
    `» ${p}ytmp4 <url | búsqueda>\n` +
    `» ${p}ytsearch <búsqueda>\n` +
    `» ${p}mediafire <url>\n` +
    `» ${p}pinterest <url>\n` +
    `» ${p}soundcloud <url>\n\n` +
    footer();

  await sendMenu(m, conn, text);
};
handlerDescargas.command = /^(menudescargas|menudescarga|menudl|menudownloads)$/i;
handlerDescargas.description = "Menú de Descargas de varias plataformas";
handlerDescargas.category = "menu";

// 2. Menú RPG & ECONOMÍA
const handlerRpg = async (m, { conn }) => {
  const text =
    header(m, "RPG & Economía", "⚔️") + "\n\n" +
    `◈ *⚔️ RPG & ECONOMÍA*\n` +
    `» ${p}perfil\n` +
    `» ${p}registro\n` +
    `» ${p}clase\n` +
    `» ${p}batalla\n` +
    `» ${p}dungeon\n` +
    `» ${p}inventario\n` +
    `» ${p}tienda\n` +
    `» ${p}comprar\n` +
    `» ${p}pescar\n` +
    `» ${p}minar\n` +
    `» ${p}saldo\n` +
    `» ${p}daily\n` +
    `» ${p}trabajo\n` +
    `» ${p}robar\n` +
    `» ${p}transferir\n` +
    `» ${p}ranking\n\n` +
    footer();

  await sendMenu(m, conn, text);
};
handlerRpg.command = /^(menurpg|menurpg economia|menueconomia|menu economía)$/i;
handlerRpg.description = "Menú de RPG y Economía";
handlerRpg.category = "menu";

// 2. Menú WAIFUS
const handlerWaifus = async (m, { conn }) => {
  const text =
    header(m, "Waifus", "💕") + "\n\n" +
    `◈ *💕 WAIFUS*\n` +
    `» ${p}waifu\n` +
    `» ${p}gacha\n` +
    `» ${p}coleccion\n` +
    `» ${p}miwaifu\n` +
    `» ${p}afecto\n` +
    `» ${p}fusionar\n` +
    `» ${p}venderwaifu <#1> <precio>\n` +
    `» ${p}comprarwaifu\n\n` +
    footer();

  await sendMenu(m, conn, text);
};
handlerWaifus.command = /^(menuwaifus|menuwaifu|menuhuifus)$/i;
handlerWaifus.description = "Menú de Waifus";
handlerWaifus.category = "menu";

// 3. Menú ANIME & COMUNIDAD
const handlerAnime = async (m, { conn }) => {
  const text =
    header(m, "Anime & Comunidad", "🎌") + "\n\n" +
    `◈ *🎌 ANIME & REACCIONES*\n` +
    `» ${p}anime\n` +
    `» ${p}manga\n` +
    `» ${p}personaje\n` +
    `» ${p}topanime\n` +
    `» ${p}neko\n` +
    `» ${p}besar\n` +
    `» ${p}abrazar\n` +
    `» ${p}pat\n` +
    `» ${p}bofetada\n` +
    `» ${p}mimo\n` +
    `» ${p}cosquillas\n` +
    `» ${p}alimentar\n` +
    `» ${p}bailar\n` +
    `» ${p}sonreir\n` +
    `» ${p}sonrojar\n` +
    `» ${p}llorar\n` +
    `» ${p}presumir\n` +
    `» ${p}enojar\n` +
    `» ${p}cum\n` +
    `» ${p}fuck\n\n` +
    footer();

  await sendMenu(m, conn, text);
};
handlerAnime.command = /^(menuanime|menuinteraccion|menuanimeinteraccion)$/i;
handlerAnime.description = "Menú de Anime e Interacción";
handlerAnime.category = "menu";

// 4. Menú JUEGOS & DIVERSIÓN
const handlerJuegos = async (m, { conn }) => {
  const text =
    header(m, "Juegos & Diversión", "🎮") + "\n\n" +
    `◈ *🎮 JUEGOS & DIVERSIÓN*\n` +
    `» ${p}trivia\n` +
    `» ${p}ahorcado\n` +
    `» ${p}ppt\n` +
    `» ${p}8ball\n` +
    `» ${p}dados\n` +
    `» ${p}ruleta\n` +
    `» ${p}verdad\n` +
    `» ${p}reto\n` +
    `» ${p}meme\n` +
    `» ${p}chiste\n` +
    `» ${p}dato\n` +
    `» ${p}consejo\n` +
    `» ${p}frase\n` +
    `» ${p}horoscopo\n` +
    `» ${p}amor\n` +
    `» ${p}gay\n` +
    `» ${p}iq\n` +
    `» ${p}ship\n\n` +
    footer();

  await sendMenu(m, conn, text);
};
handlerJuegos.command = /^(menujuegos|menujuegos diversion|menudiversion|menujuego)$/i;
handlerJuegos.description = "Menú de Juegos y Diversión";
handlerJuegos.category = "menu";

// 5. Menú HERRAMIENTAS & BÚSQUEDA
const handlerBusqueda = async (m, { conn }) => {
  const text =
    header(m, "Herramientas & Búsqueda", "🔍") + "\n\n" +
    `◈ *🔍 HERRAMIENTAS & BÚSQUEDA*\n` +
    `» ${p}ytsearch <búsqueda>\n` +
    `» ${p}wikipedia\n` +
    `» ${p}imagen\n` +
    `» ${p}letra\n` +
    `» ${p}pelicula\n` +
    `» ${p}github\n` +
    `» ${p}sticker\n` +
    `» ${p}robarsticker\n` +
    `» ${p}toimg\n` +
    `» ${p}textsticker\n` +
    `» ${p}traducir\n` +
    `» ${p}screenshot\n` +
    `» ${p}shazam\n` +
    `» ${p}ping\n` +
    `» ${p}botinfo\n` +
    `» ${p}stats\n\n` +
    footer();

  await sendMenu(m, conn, text);
};
handlerBusqueda.command = /^(menubusqueda|menuherramientas|menubusqueda herramientas|menuutilidades)$/i;
handlerBusqueda.description = "Menú de Búsqueda y Herramientas";
handlerBusqueda.category = "menu";

// 6. Menú GRUPO
const handlerGrupo = async (m, { conn }) => {
  const text =
    header(m, "Administración de Grupo", "👥") + "\n\n" +
    `◈ *👥 GRUPO*\n` +
    `» ${p}hidetag\n` +
    `» ${p}grupo\n` +
    `» ${p}grupoinfo\n` +
    `» ${p}link\n` +
    `» ${p}revoke\n` +
    `» ${p}kick\n` +
    `» ${p}delete *(responder a un mensaje)*\n` +
    `» ${p}add\n` +
    `» ${p}promote\n` +
    `» ${p}demote\n` +
    `» ${p}bienvenida\n` +
    `» ${p}despedida\n` +
    `» ${p}antilink\n` +
    `» ${p}ajustes\n` +
    `» ${p}restablecerajustes confirmar *(admin)*\n` +
    `» ${p}iagrupo <personalidad>\n` +
    `» ${p}nsfw\n` +
    `» ${p}ban *(admin)*\n` +
    `» ${p}unban\n\n` +
    footer();

  await sendMenu(m, conn, text);
};
handlerGrupo.command = /^(menugrupo|menugrupos|menuadmin|menuadmin grupo)$/i;
handlerGrupo.description = "Menú de Grupo (administración)";
handlerGrupo.category = "menu";

// 7. Menú IA & Memoria
const handlerIa = async (m, { conn }) => {
  const text =
    header(m, "IA & Memoria", "✨") + "\n\n" +
    `◈ *✨ IA & MEMORIA*\n` +
    `» ${p}ia <mensaje>\n` +
    `» ${p}kurumi <mensaje>\n` +
    `» ${p}personalidad [nombre]\n` +
    `» ${p}iagrupo <personalidad>\n` +
    `» ${p}memorias\n` +
    `» ${p}recuerda <clave> : <valor>\n` +
    `» ${p}olvida <clave>\n` +
    `» ${p}recordar <tiempo> | <mensaje>\n` +
    `» ${p}misrecordatorios\n` +
    `» ${p}eliminarrecordatorio <id>\n` +
    `» ${p}ia on/off\n` +
    `» ${p}limpiar\n\n` +
    footer();

  await sendMenu(m, conn, text);
};
handlerIa.command = /^(menuia|menuai|menugpt|menuchat)$/i;
handlerIa.description = "Menú de IA";
handlerIa.category = "menu";

// 8. Menú NSFW
const handlerNsfw = async (m, { conn }) => {
  const text =
    header(m, "NSFW (+18)", "🔞") + "\n\n" +
    `◈ *🔞 NSFW (+18)*\n` +
    `» ${p}hentai\n` +
    `» ${p}hentaigif\n` +
    `» ${p}pussy\n` +
    `» ${p}boobs\n` +
    `» ${p}blowjob\n` +
    `» ${p}anal\n` +
    `» ${p}cumshot\n` +
    `» ${p}feet\n` +
    `» ${p}ass\n` +
    `» ${p}erok\n` +
    `» ${p}ecchi\n` +
    `» ${p}ahegao\n` +
    `» ${p}succubus\n` +
    `» ${p}thighs\n` +
    `» ${p}paizuri\n` +
    `» ${p}kuni\n` +
    `» ${p}yuri\n` +
    `» ${p}nsfwneko\n` +
    `» ${p}nsfwwaifu\n` +
    `» ${p}holoero\n` +
    `» ${p}lewd\n` +
    `» ${p}keta\n\n` +
    footer();

  await sendMenu(m, conn, text);
};
handlerNsfw.command = /^(menunsfw|menuadultos|menu18|menu\+18)$/i;
handlerNsfw.description = "Menú NSFW (+18)";
handlerNsfw.category = "menu";
handlerNsfw.nsfw = true;

// 9. Menú OWNER
const handlerOwner = async (m, { conn, isOwner }) => {
  if (!isOwner) {
    return m.reply(
      `✦━【 ⚠️ *ACCESO DENEGADO* 】━✦\nSolo el creador del bot puede acceder a este menú.`
    );
  }

  const text =
    header(m, "Owner / Creador", "⚙️") + "\n\n" +
    `◈ *⚙️ OWNER / CREADOR*\n` +
    `» ${p}grupos\n` +
    `» ${p}unirse\n` +
    `» ${p}salir\n` +
    `» ${p}reload\n` +
    `» ${p}broadcast\n` +
    `» ${p}darmonedas\n` +
    `» ${p}eval\n\n` +
    footer();

  await sendMenu(m, conn, text);
};
handlerOwner.command = /^(menuowner|menuadmin bot|menucreador)$/i;
handlerOwner.description = "Menú exclusivo del Owner";
handlerOwner.category = "menu";
handlerOwner.owner = true;

// 10. Menú Categorías — Lista general
const handlerMenuCat = async (m, { conn, isOwner }) => {
  const text =
    header(m, "Categorías de Menús", "📋") + "\n\n" +
    `◈ *📋 MENÚS DISPONIBLES*\n` +
    `» ${p}menudescargas — Descargas & Multimedia\n` +
    `» ${p}menurpg — RPG & Economía\n` +
    `» ${p}menuwaifus — Waifus\n` +
    `» ${p}menuanime — Anime & Comunidad\n` +
    `» ${p}menujuegos — Juegos & Diversión\n` +
    `» ${p}menubusqueda — Herramientas\n` +
    `» ${p}menugrupo — Grupo\n` +
    `» ${p}menuia — IA de Kurumi\n` +
    `» ${p}menunsfw — NSFW (+18)\n` +
    (isOwner ? `» ${p}menuowner — Owner\n` : "") +
    `\n💡 *Tip:* Usa ${p}menu para ver el menú principal completo.\n\n` +
    footer();

  await sendMenu(m, conn, text);
};
handlerMenuCat.command = /^(menucategorias|menucategorías|menuscategorias|menuscategorías|menucat|menus|categorías|categorias)$/i;
handlerMenuCat.description = "Lista de todos los menús por categoría";
handlerMenuCat.category = "menu";

export default [
  handlerDescargas,
  handlerRpg,
  handlerWaifus,
  handlerAnime,
  handlerJuegos,
  handlerBusqueda,
  handlerGrupo,
  handlerIa,
  handlerNsfw,
  handlerOwner,
  handlerMenuCat,
];
