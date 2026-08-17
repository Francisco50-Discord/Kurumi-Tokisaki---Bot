// ============================================================
//   Kurumi Tokisaki - Saldo Command
// ============================================================

import { getUser } from "../lib/database.js";

const handler = async (m, { sender }) => {
  const user = getUser(sender);
  await m.reply(
    `✦━【 💰 *TU SALDO* 】━✦\n\n◈ Monedas: 🪙 *${(user.coins || 0).toLocaleString()}*\n◈ Gemas: 💎 *${user.gems || 0}*`
  );
};

handler.command = /^(saldo|balance|coins|monedas|dinero)$/i;
handler.description = "Ver tus monedas";
handler.category = "rpg";

export default handler;
