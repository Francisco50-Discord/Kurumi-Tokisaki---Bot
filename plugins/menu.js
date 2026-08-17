// ============================================================
//   Kurumi Tokisaki - Menú Principal v7.5 (Diseño Elegante)
// ============================================================

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { renderMainMenu } from "../lib/menuFormatter.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const menuImagePath = path.join(__dirname, "../assets/kurumi-menu.png");

const handler = async (m, { conn, isOwner }) => {
  const menuText = renderMainMenu(m, isOwner);

  let imageBuffer = null;
  if (fs.existsSync(menuImagePath)) {
    try {
      imageBuffer = fs.readFileSync(menuImagePath);
    } catch (e) {
      imageBuffer = null;
    }
  }

  if (imageBuffer) {
    try {
      await conn.sendMessage(
        m.chatId,
        {
          image: imageBuffer,
          caption: menuText,
          mentions: [m.sender]
        },
        { quoted: m }
      );
      return;
    } catch (e) {
      console.error("Error enviando menú con imagen:", e.message);
    }
  }

  await m.reply(menuText);
};

handler.command = /^(menu|menú|menucompleto|help|ayuda|start|inicio|comandos)$/i;
handler.description = "Muestra el menú principal del bot";
handler.category = "misc";

export default handler;
