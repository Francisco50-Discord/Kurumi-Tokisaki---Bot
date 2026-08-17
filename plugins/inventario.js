// ============================================================
//   Kurumi Tokisaki - Inventario Command
// ============================================================

import { getInventory } from "../lib/database.js";

const handler = async (m, { sender }) => {
  const items = getInventory(sender);

  if (items.length === 0) {
    return m.reply(
      `✦━【 *INVENTARIO* 】━✦\n\n\n🎒 Vacío.\n\nUsa *!tienda* para comprar.\n╰────────`
    );
  }

  let invText = `✦━【 *TU INVENTARIO* 】━✦\n\n\n`;

  const grouped = {};
  for (const item of items) {
    if (!grouped[item.item_type]) grouped[item.item_type] = [];
    grouped[item.item_type].push(item);
  }

  for (const [type, typeItems] of Object.entries(grouped)) {
    invText += `📦 *${type.toUpperCase()}*\n`;
    for (const item of typeItems) {
      invText += `  • ${item.item_name} x${item.quantity}${item.equipped ? " ✅" : ""}\n`;
    }
    invText += "\n";
  }
  invText += ``;

  await m.reply(invText.trim());
};

handler.command = /^(inventario|inventory|inv|mochila)$/i;
handler.description = "Ver tu inventario";
handler.category = "rpg";
handler.register = true;

export default handler;
