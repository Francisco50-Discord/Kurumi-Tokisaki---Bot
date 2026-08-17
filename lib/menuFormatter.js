// ============================================================
//   Kurumi Tokisaki - Formateador de Menús (Estilo 3 Minimalista)
//   Optimizado para WhatsApp Móvil (Sin desbordes ni texto cortado)
// ============================================================

import { config } from "../config/settings.js";
import { getUser } from "./database.js";
import { formatDate } from "./utils.js";

export function renderMainMenu(m, isOwner) {
  const user = getUser(m.sender);
  const rawName = user.name && user.name !== "Usuario" ? user.name : m.sender.split("@")[0];
  const userName = rawName.length > 14 ? rawName.slice(0, 13) + "…" : rawName;
  const level = user.level || 1;
  const coins = (user.coins || 0).toLocaleString();
  const p = config.prefix[0] || "!";
  const owner = config.creator;
  const date = formatDate();
  const totalCommands = user.total_commands || 0;

  return (
`✦━【 時崎狂三 】━✦
🌸 *${config.botName}*
👑 Owner: *${owner}*
📅 *${date}*

◈ *ESTADO DE USUARIO*
• Usuario: *${userName}*
• Nivel: *${level}*  |  Coins: *${coins}*
• Comandos usados: *${totalCommands}*

◈ *📥 DESCARGAS*
» ${p}tiktok <url>
» ${p}instagram <url>
» ${p}facebook <url>
» ${p}twitter <url>
» ${p}spotify <url>
» ${p}ytmp3 <url | búsqueda>
» ${p}ytmp4 <url | búsqueda>
» ${p}ytsearch <búsqueda>
» ${p}mediafire <url>
» ${p}pinterest <url>
» ${p}soundcloud <url>

◈ *⚔️ RPG & ECONOMÍA*
» ${p}perfil
» ${p}registro
» ${p}clase
» ${p}batalla
» ${p}dungeon
» ${p}inventario
» ${p}tienda
» ${p}comprar
» ${p}pescar
» ${p}minar
» ${p}saldo
» ${p}daily
» ${p}trabajo
» ${p}robar
» ${p}transferir
» ${p}ranking

◈ *💕 WAIFUS*
» ${p}waifu
» ${p}gacha
» ${p}coleccion
» ${p}miwaifu
» ${p}afecto
» ${p}fusionar
» ${p}venderwaifu <#1> <precio>
» ${p}comprarwaifu

◈ *🎌 ANIME & REACCIONES*
» ${p}anime
» ${p}manga
» ${p}personaje
» ${p}topanime
» ${p}neko
» ${p}gif
» ${p}besar
» ${p}abrazar
» ${p}pat
» ${p}bofetada
» ${p}mimo
» ${p}cosquillas
» ${p}alimentar
» ${p}bailar
» ${p}sonreir
» ${p}sonrojar
» ${p}llorar
» ${p}presumir
» ${p}maullar
» ${p}enojar

◈ *🎮 JUEGOS & DIVERSIÓN*
» ${p}trivia
» ${p}ahorcado
» ${p}ppt
» ${p}8ball
» ${p}dados
» ${p}ruleta
» ${p}verdad
» ${p}reto
» ${p}meme
» ${p}chiste
» ${p}dato
» ${p}consejo
» ${p}frase
» ${p}horoscopo
» ${p}amor
» ${p}gay
» ${p}iq
» ${p}ship

◈ *🔍 HERRAMIENTAS*
» ${p}ytsearch <búsqueda>
» ${p}wikipedia
» ${p}imagen
» ${p}letra
» ${p}pelicula
» ${p}github
» ${p}definicion
» ${p}telefono
» ${p}sticker
» ${p}robarsticker
» ${p}toimg
» ${p}textsticker
» ${p}traducir
» ${p}screenshot
» ${p}shazam
» ${p}ping
» ${p}botinfo
» ${p}stats

◈ *👥 GRUPO*
» ${p}hidetag
» ${p}grupo
» ${p}grupoinfo
» ${p}link
» ${p}revoke
» ${p}kick
» ${p}add
» ${p}promote
» ${p}demote
» ${p}bienvenida
» ${p}despedida
» ${p}antilink
» ${p}ajustes
» ${p}restablecerajustes confirmar *(admin)*
» ${p}iagrupo <personalidad>
» ${p}nsfw

◈ *✨ IA DE KURUMI & MEMORIA*
» ${p}ia <mensaje>
» ${p}kurumi <mensaje>
» ${p}personalidad [nombre]
» ${p}iagrupo <personalidad>
» ${p}memorias
» ${p}recuerda <clave> : <valor>
» ${p}olvida <clave>
» ${p}recordar <tiempo> | <mensaje>
» ${p}misrecordatorios
» ${p}eliminarrecordatorio <id>
» ${p}ia on/off

» ${p}limpiar

◈ *🔞 NSFW (+18)*
» ${p}hentai
» ${p}hentaigif
» ${p}pussy
» ${p}boobs
» ${p}blowjob
» ${p}anal
» ${p}cum
» ${p}feet
» ${p}ass
» ${p}erok
» ${p}ecchi
» ${p}ahegao
» ${p}succubus
» ${p}thighs
» ${p}paizuri
» ${p}kuni
» ${p}yuri
» ${p}lesbian
» ${p}nsfwneko
» ${p}nsfwwaifu
» ${p}holoero
» ${p}lewd
» ${p}gasm
» ${p}keta

◈ *📋 MENÚS POR CATEGORÍA*
» ${p}menucategorias
» ${p}menudescargas
» ${p}menurpg
» ${p}menuwaifus
» ${p}menuanime
» ${p}menujuegos
» ${p}menubusqueda
» ${p}menugrupo
» ${p}menuia
» ${p}menunsfw` +
(isOwner ? `\n\n◈ *⚙️ OWNER*
» ${p}grupos
» ${p}unirse
» ${p}salir
» ${p}reload
» ${p}broadcast
» ${p}darmonedas
» ${p}ban
» ${p}unban
» ${p}eval` : "") + `\n\n✦ *${config.botName}* v${config.version}`
  );
}
