// ============================================================
//   Kurumi Tokisaki - Comprar Command
// ============================================================

import { getUser, removeCoins, addItem } from "../lib/database.js";

const SHOP_ITEMS = [
  { name: "Poción de Vida", type: "consumable", price: 50, emoji: "🧪", effect: "heal", value: 50 },
  { name: "Poción de Maná", type: "consumable", price: 40, emoji: "💙", effect: "stamina", value: 50 },
  { name: "Espada de Hierro", type: "weapon", price: 200, emoji: "⚔️", effect: "attack", value: 5 },
  { name: "Escudo de Madera", type: "armor", price: 150, emoji: "🛡️", effect: "defense", value: 3 },
  { name: "Botas Veloces", type: "armor", price: 180, emoji: "👢", effect: "speed", value: 4 },
  { name: "Amuleto Mágico", type: "accessory", price: 300, emoji: "📿", effect: "all", value: 2 },
  { name: "Espada de Acero", type: "weapon", price: 500, emoji: "🗡️", effect: "attack", value: 12 },
  { name: "Armadura de Hierro", type: "armor", price: 450, emoji: "🦺", effect: "defense", value: 10 },
  { name: "Arco Élfico", type: "weapon", price: 600, emoji: "🏹", effect: "attack", value: 15 },
  { name: "Grimorio Oscuro", type: "weapon", price: 700, emoji: "📖", effect: "attack", value: 18 },
];

const handler = async (m, { args, body, sender, usedPrefix }) => {
  if (!body) {
    return m.reply(`✦━【 *COMPRAR* 】━✦\n\n\n🛒 Uso: ${usedPrefix}comprar <nombre>\n╰────────`);
  }

  const itemName = body.toLowerCase();
  const item = SHOP_ITEMS.find((i) => i.name.toLowerCase().includes(itemName));

  if (!item) {
    return m.reply(`❌ Ítem no encontrado. Usa *${usedPrefix}tienda* para ver los disponibles.`);
  }

  const user = getUser(sender);
  if (user.coins < item.price) {
    return m.reply(
      `❌ No tienes suficientes monedas.\n\n` +
      `💰 Precio: ${item.price}\n` +
      `🪙 Tu saldo: ${user.coins}`
    );
  }

  removeCoins(sender, item.price);
  addItem(sender, item.name, item.type);

  await m.reply(
    `✦━【 *¡COMpra EXITOSA!* 】━✦\n\n\n` +
    `${item.emoji} Compraste: *${item.name}*\n` +
    `💰 Pagaste: ${item.price} monedas\n` +
    `🪙 Saldo: ${user.coins - item.price}\n` +
    ``
  );
};

handler.command = /^(comprar|buy|purchase)$/i;
handler.description = "Comprar un ítem de la tienda";
handler.category = "rpg";
handler.register = true;

export default handler;
