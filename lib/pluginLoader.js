// ============================================================
//   Kurumi Tokisaki - Cargador de Plugins
//   Estructura plana: todos los archivos .js directamente en /plugins
// ============================================================

import fs from "fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import chalk from "chalk";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pluginsDir = path.join(__dirname, "../plugins");

export const plugins = [];

export async function loadPlugins() {
  plugins.length = 0;
  let loaded = 0;
  let errors = 0;

  if (!fs.existsSync(pluginsDir)) {
    console.log(chalk.yellow("⚠️  Directorio /plugins no encontrado."));
    if (globalThis.botState) globalThis.botState.pluginsCount = 0;
    return plugins;
  }

  // Leer todos los archivos .js directamente en /plugins (sin subcarpetas)
  const files = fs.readdirSync(pluginsDir)
    .filter((f) => f.endsWith(".js") && fs.statSync(path.join(pluginsDir, f)).isFile());

  for (const file of files) {
    const filePath = path.join(pluginsDir, file);
    const importPath = pathToFileURL(filePath).href + "?t=" + Date.now();

    try {
      const module = await import(importPath);
      const handlers = [];

      if (module.default) {
        if (Array.isArray(module.default)) {
          for (const item of module.default) {
            if (item && (item.command || item.before) && !handlers.includes(item)) {
              handlers.push(item);
            }
          }
        } else if ((module.default.command || module.default.before) && !handlers.includes(module.default)) {
          handlers.push(module.default);
        }
      }

      for (const [key, value] of Object.entries(module)) {
        if (key !== "default" && typeof value === "function" && (value.command || value.before)) {
          if (!handlers.includes(value)) {
            handlers.push(value);
          }
        }
      }

      for (const handler of handlers) {
        if (handler.command || handler.before) {
          plugins.push(handler);
          loaded++;
        }
      }
    } catch (err) {
      console.error(chalk.red(`❌ Error cargando ${file}: ${err.message}`));
      errors++;
    }
  }

  if (globalThis.botState) {
    globalThis.botState.pluginsCount = plugins.length;
  }

  const msg = `✅ Plugins cargados: ${plugins.length} (${loaded} comandos activos${errors > 0 ? `, ${errors} errores` : ""})`;
  console.log(chalk.hex("#06ffa5").bold(msg));

  return plugins;
}

export async function reloadPlugins() {
  console.log(chalk.hex("#ffbe0b")("🔄 Recargando plugins..."));
  return loadPlugins();
}
