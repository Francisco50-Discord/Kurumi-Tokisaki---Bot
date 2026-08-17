// ============================================================
//   Kurumi Tokisaki - Configuración del Bot
// ============================================================

import path from "path";

const readBoolean = (value, fallback) => {
  if (value === undefined || value === null || value === "") return fallback;
  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
};

// Cualquier host puede definir BOT_DATA_DIR con una ruta de disco persistente.
// Si no se define, el bot conserva su comportamiento local dentro del proyecto.
const configuredStorageDir = process.env.BOT_DATA_DIR || process.env.PERSISTENT_DIR;
const storageRoot = configuredStorageDir
  ? path.resolve(configuredStorageDir)
  : process.cwd();
const sessionName = process.env.SESSION_NAME?.trim() || "kurumi_session";
const sessionPath = process.env.SESSION_PATH
  ? path.resolve(process.env.SESSION_PATH)
  : path.join(storageRoot, sessionName);
const dbPath = process.env.DB_PATH
  ? path.resolve(process.env.DB_PATH)
  : path.join(storageRoot, "data", "database.json");

export const config = {
  botName: process.env.BOT_NAME?.trim() || "Kurumi Tokisaki",
  botNumber: process.env.BOT_NUMBER?.replace(/\D/g, "") || "529852277382",
  creator: "«[×𝐹ɾαɳƈιʂƈσ×]»",
  creatorNumber: process.env.CREATOR_NUMBER?.replace(/\D/g, "") || "529852270023",
  version: "1.0.9 V",

  prefix: ["!", "/", ".", "#"],
  owner: (process.env.OWNER_NUMBERS || "529852270023,5219852270023")
    .split(",")
    .map(number => number.replace(/\D/g, ""))
    .filter(Boolean),
  sessionName,
  sessionPath,
  usePairingCode: readBoolean(process.env.USE_PAIRING_CODE, true),
  dbPath,
  cooldown: 3,
  // NSFW global: puede deshabilitarse para toda la instancia mediante NSFW_ENABLED=false.
  nsfwEnabled: readBoolean(process.env.NSFW_ENABLED, true),
  // Permite NSFW privado en la instancia; cada usuario sigue teniendo que activarlo con !nsfw on.
  nsfwPrivateEnabled: readBoolean(process.env.NSFW_PRIVATE_ENABLED, true),
  aiEnabled: readBoolean(process.env.AI_ENABLED, true),
  autoRead: readBoolean(process.env.AUTO_READ, true),

  // En producción se desactiva por defecto: evita watchers y recargas innecesarias.
  // Para desarrollo local, usar HOT_RELOAD=true.
  hotReload: readBoolean(process.env.HOT_RELOAD, false),
  hotReloadNotify: readBoolean(process.env.HOT_RELOAD_NOTIFY, false),

  // Mensajes del sistema
  waitMessage: "⏳ Procesando tu solicitud...",
  errorMessage: "❌ Ocurrió un error. Inténtalo de nuevo.",

  // Stickers
  stickerPackName: "Kurumi Tokisaki",
  stickerAuthor: "«[×𝐹ɾαɳƈιʂƈσ×]»",
  menuColor: "🌸",
};

export default config;
