// ============================================================
//   Kurumi Tokisaki - Mercado / Venta de Waifus Command
// ============================================================

import { getUser, addCoins, getWaifus, removeWaifu, transferWaifu } from "../lib/database.js";
import { areJidsEqual, getGroupMetadata, resolveGroupParticipantJid } from "../lib/utils.js";

// Almacenar ofertas activas de mercado en memoria
const pendingOffers = global.pendingOffers = global.pendingOffers || new Map();

const rarityPrices = {
  "Común": 500,
  "Rara": 1500,
  "Épica": 3500,
  "Legendaria": 8000,
  "Mítica": 18000,
  "Divina": 40000
};

const handler = async (m, { conn, sender, chatId, args, usedPrefix, command, isGroup }) => {
  const isBuyCommand = /^(comprarwaifu|comprar|buywaifu|aceptarventa)$/i.test(command);

  // -------------------------------------------------------------
  // ACCIÓN DE COMPRAR / ACEPTAR OFERTA
  // -------------------------------------------------------------
  if (isBuyCommand) {
    const currentChatId = chatId || m.chatId || m.key?.remoteJid;
    const resolvedBuyerJid = (await resolveGroupParticipantJid(conn, currentChatId, sender)) || sender;

    let offerKey = null;
    let offer = pendingOffers.get(resolvedBuyerJid) || pendingOffers.get(sender);

    if (offer) {
      offerKey = pendingOffers.has(resolvedBuyerJid) ? resolvedBuyerJid : sender;
    } else {
      let participants = [];
      if (isGroup || currentChatId?.endsWith("@g.us")) {
        try {
          const meta = await getGroupMetadata(conn, currentChatId);
          participants = meta?.participants || [];
        } catch (e) {}
      }
      for (const [key, val] of pendingOffers.entries()) {
        if (areJidsEqual(key, sender, participants) || areJidsEqual(key, resolvedBuyerJid, participants)) {
          offer = val;
          offerKey = key;
          break;
        }
      }
    }

    if (!offer) {
      return m.reply(
        `✦━【 🏷️ *MERCADO DE WAIFUS* 】━✦\n\n` +
        `📭 No tienes ninguna oferta de compra pendiente.\n\n` +
        `💡 *¿Cómo funciona?*\n` +
        `Un usuario debe ofrecerte un personaje con:\n` +
        `\`${usedPrefix}venderwaifu <#1> @tu_usuario <precio>\``
      );
    }

    // Verificar expiración (10 minutos)
    if (Date.now() - offer.timestamp > 10 * 60 * 1000) {
      for (const [k, v] of pendingOffers.entries()) {
        if (v === offer) pendingOffers.delete(k);
      }
      return m.reply(`⏰ *Oferta expirada*\nLa oferta de venta de @${offer.sellerJid.split("@")[0]} ha expirado.`);
    }

    const buyerUser = getUser(sender);
    if ((buyerUser.coins || 0) < offer.price) {
      return m.reply(
        `❌ *Fondos insuficientes*\n` +
        `Necesitas 🪙 *${offer.price.toLocaleString()} monedas* para comprar a *${offer.waifu.waifu_name}*.\n` +
        `Tus monedas actuales: 🪙 ${(buyerUser.coins || 0).toLocaleString()}`
      );
    }

    // Realizar la transacción
    addCoins(sender, -offer.price);
    addCoins(offer.sellerJid, offer.price);

    const transferred = transferWaifu(offer.sellerJid, sender, offer.waifu.waifu_name);

    // Eliminar la oferta
    for (const [k, v] of pendingOffers.entries()) {
      if (v === offer) pendingOffers.delete(k);
    }

    if (!transferred) {
      // Reembolso si el personaje ya no existe
      addCoins(sender, offer.price);
      addCoins(offer.sellerJid, -offer.price);
      return m.reply(`✦━【 ❌ *ERROR* 】━✦\n\nEl vendedor ya no posee ese personaje en su colección.`);
    }

    return conn.sendMessage(
      currentChatId,
      {
        text:
          `✦━【 🎉 *TRANSACCIÓN EXITOSA* 】━✦\n\n` +
          `🤝 @${sender.split("@")[0]} ha comprado a *${transferred.waifu_name}*!\n` +
          `◈ *Vendedor:* @${offer.sellerJid.split("@")[0]}\n` +
          `◈ *Precio pagado:* 🪙 ${offer.price.toLocaleString()} monedas\n` +
          `◈ *Rareza:* ${transferred.rarity || "Común"}\n\n` +
          `🌸 ¡El personaje se ha añadido a tu \`${usedPrefix}coleccion\`!`,
        mentions: [sender, offer.sellerJid]
      },
      { quoted: m }
    );
  }

  // -------------------------------------------------------------
  // ACCIÓN DE VENDER / OFRECER PERSONAJE
  // -------------------------------------------------------------
  if (args.length === 0) {
    return m.reply(
      `✦━【 🏷️ *MERCADO DE WAIFUS* 】━✦\n\n` +
      `🛍️ *Opción 1: Vender al Bot (Venta rápida)*\n` +
      `• \`${usedPrefix}venderwaifu <#1> bot\`\n` +
      `  *(Obtienes monedas al instante según la rareza)*\n\n` +
      `🤝 *Opción 2: Vender a otro Usuario*\n` +
      `• \`${usedPrefix}venderwaifu <#1> @usuario <precio>\`\n` +
      `  *(Le envía la oferta para que la acepte con ${usedPrefix}comprarwaifu)*`
    );
  }

  const userWaifus = getWaifus(sender) || [];
  if (userWaifus.length === 0) {
    return m.reply(`📭 No tienes ningún personaje en tu colección para vender.`);
  }

  const targetInput = args[0];
  let waifuToSell = null;
  const index = parseInt(targetInput);

  if (!isNaN(index) && index >= 1 && index <= userWaifus.length) {
    waifuToSell = userWaifus[index - 1];
  } else {
    waifuToSell = userWaifus.find(w => w.waifu_name.toLowerCase().includes(targetInput.toLowerCase()));
  }

  if (!waifuToSell) {
    return m.reply(`❌ No se encontró ningún personaje con el índice o nombre "${targetInput}" en tu colección.`);
  }

  const targetArg = args[1] ? args[1].toLowerCase() : "";

  // VENTA AL BOT INSTANTÁNEA
  if (targetArg === "bot" || targetArg === "sistema") {
    const basePrice = rarityPrices[waifuToSell.rarity] || 500;
    const bonusAffection = Math.floor((waifuToSell.affection || 0) * 1.5);
    const totalPrice = basePrice + bonusAffection;

    const removed = removeWaifu(sender, waifuToSell.waifu_name);
    if (!removed) {
      return m.reply(`❌ Ocurrió un error al procesar la venta.`);
    }

    addCoins(sender, totalPrice);

    return m.reply(
      `✦━【 🪙 *VENTA AL BOT* 】━✦\n\n` +
      `◈ *Personaje vendido:* ${waifuToSell.waifu_name}\n` +
      `◈ *Rareza:* ${waifuToSell.rarity || "Común"}\n` +
      `◈ *Valor base:* 🪙 ${basePrice.toLocaleString()}\n` +
      `◈ *Bonus por afecto:* 🪙 ${bonusAffection.toLocaleString()}\n\n` +
      `✅ *TOTAL RECIBIDO:* 🪙 *${totalPrice.toLocaleString()} monedas*`
    );
  }

  // VENTA A OTRO USUARIO
  let rawMentioned = m.mentionedJid?.[0] || m.quoted?.sender;
  if (!rawMentioned) {
    for (let i = 1; i < args.length; i++) {
      if (args[i].includes("@") || args[i].replace(/[^0-9]/g, "").length >= 7) {
        rawMentioned = args[i].replace(/[^0-9]/g, "") + "@s.whatsapp.net";
        break;
      }
    }
  }

  const currentChatId = chatId || m.chatId || m.key?.remoteJid;
  const mentionedJid = rawMentioned ? await resolveGroupParticipantJid(conn, currentChatId, rawMentioned) : null;

  // Extraer precio del último argumento numérico válido
  let priceArg = NaN;
  for (let i = args.length - 1; i >= 1; i--) {
    const parsed = parseInt(args[i]);
    if (!isNaN(parsed) && parsed > 0) {
      priceArg = parsed;
      break;
    }
  }

  if (!mentionedJid || isNaN(priceArg) || priceArg <= 0) {
    return m.reply(
      `✦━【 ❌ *SINTAXIS* 】━✦\n\n` +
      `Usa:\n` +
      `• \`${usedPrefix}venderwaifu <#1> bot\` para vender al bot\n` +
      `• \`${usedPrefix}venderwaifu <#1> @usuario <precio>\` para vender a un usuario.`
    );
  }

  if (areJidsEqual(mentionedJid, sender)) {
    return m.reply(`❌ No puedes venderte un personaje a ti mismo.`);
  }

  const offerData = {
    sellerJid: sender,
    waifu: waifuToSell,
    price: priceArg,
    timestamp: Date.now()
  };

  // Guardar oferta bajo el JID resuelto y también under rawMentioned si difiere
  pendingOffers.set(mentionedJid, offerData);
  if (rawMentioned && rawMentioned !== mentionedJid) {
    pendingOffers.set(rawMentioned, offerData);
  }

  return conn.sendMessage(
    currentChatId,
    {
      text:
        `✦━【 🏷️ *OFERTA ENVIADA* 】━✦\n\n` +
        `◈ *Vendedor:* @${sender.split("@")[0]}\n` +
        `◈ *Comprador:* @${mentionedJid.split("@")[0]}\n` +
        `◈ *Personaje:* *${waifuToSell.waifu_name}* [${waifuToSell.rarity || "Común"}]\n` +
        `◈ *Precio solicitado:* 🪙 *${priceArg.toLocaleString()} monedas*\n\n` +
        `📩 @${mentionedJid.split("@")[0]}, usa \`${usedPrefix}comprarwaifu\` para aceptar la compra!`,
      mentions: [sender, mentionedJid]
    },
    { quoted: m }
  );
};

handler.command = /^(venderwaifu|vender|sellwaifu|comprarwaifu|comprar|buywaifu|mercado)$/i;
handler.description = "Vender o comprar personajes con otros usuarios o con el bot";
handler.category = "rpg";
handler.register = true;

export default handler;
