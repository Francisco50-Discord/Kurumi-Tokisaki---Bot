// ============================================================
//   Kurumi Tokisaki - Reload Command (Hot-Reload compatible)
// ============================================================

import { getModule, refreshAllModules } from "../lib/hotReload.js";

const handler = async (m, { isOwner }) => {
  if (!isOwner) return m.reply(`✦━【 ❌ *ERROR* 】━✦\n\nSolo el owner puede usar este comando.`);

  await m.reply(`⏳ *Recargando todos los módulos y plugins...*`);

  try {
    // Refrescar todos los módulos del registro (config, db, msg, handler, etc)
    await refreshAllModules();

    // Obtener loadPlugins y plugins del registry (hot-reloadable)
    const { loadPlugins, plugins } = getModule("pluginLoader");
    await loadPlugins();

    await m.reply(
      `✦━【 *PLUGINS RECARGADOS* 】━✦\n` +
      `\n\n` +
      `✅ *${plugins.length}* comandos\n` +
      `   activos correctamente.\n\n` +
      `🔥 Hot-Reload activo\n` +
      `   los cambios se aplican\n` +
      `   en tiempo real.\n` +
      ``
    );
  } catch (err) {
    await m.reply(`✦━【 ❌ *ERROR* 】━✦\n\nError al recargar plugins: ${err.message}`);
    throw err;
  }
};

handler.command = /^(reload|recargar)$/i;
handler.description = "Recargar todos los plugins manualmente";
handler.category = "admin";
handler.owner = true;

export default handler;
