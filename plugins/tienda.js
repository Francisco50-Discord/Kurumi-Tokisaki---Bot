// ============================================================
//   Kurumi Tokisaki - Tienda Command
// ============================================================

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

const handler = async (m, { usedPrefix }) => {
  let shopText = `✦━【 🛒 *TIENDA RPG* 】━✦\n\n`;

  SHOP_ITEMS.forEach((item, i) => {
    shopText += `» ${item.emoji} *${item.name}*\n`;
    shopText += `   └ 💰 *Precio:* ${item.price} monedas | 📦 *Tipo:* ${item.type}\n\n`;
  });

  shopText += `💡 Usa \`${usedPrefix}comprar <nombre>\` para adquirir un objeto.`;

  await m.reply(shopText);
};

handler.command = /^(tienda|shop|store)$/i;
handler.description = "Ver la tienda del bot";
handler.category = "rpg";

export default handler;
