// ============================================================
//   Kurumi Tokisaki - Sistema de Hot-Reload
//   ──────────────────────────────────
//   Monitorea cambios en archivos del bot y los aplica
//   en tiempo real SIN necesidad de reiniciar.
//
//   ¿Cómo funciona?
//   • Plugins (/plugins/*.js): Al detectar un cambio,
//     recarga todos los plugins via loadPlugins(). Los
//     comandos se actualizan instantáneamente.
//
//   • Lib y Config: Usa un registro de módulos (Registry)
//     con cache busting (import dinámico + timestamp).
//     handler.js accede a los módulos via getModule(),
//     que siempre devuelve la versión más reciente.
//
//   • Archivos raíz (handler.js, index.js): No se pueden
//     hot-reload sin reiniciar. Se notifica al owner.
//
//   ¿Qué archivos se pueden editar en tiempo real?
//   ✅ plugins/*.js          (comandos)
//   ✅ lib/database.js       (funciones de BD)
//   ✅ lib/messages.js       (plantillas de mensajes)
//   ✅ lib/utils.js          (utilidades)
//   ✅ lib/errorReporter.js  (reportes de error)
//   ✅ lib/pluginLoader.js   (cargador de plugins)
//   ✅ lib/cron.js           (trabajos programados)
//   ✅ config/settings.js    (configuración del bot)
//
//   ❌ handler.js            (requiere reinicio manual)
//   ❌ index.js              (requiere reinicio manual)
// ============================================================

import fs from "fs";
import path from "path";
import chalk from "chalk";
import { fileURLToPath, pathToFileURL } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const botRoot = path.resolve(__dirname, "..");

// ══════════════════════════════════════════════════════════
//   REGISTRO DE MÓDULOS (Module Registry)
//   ──────────────────────────────────
//   Almacena módulos importados dinámicamente.
//   Cada módulo se importa con cache busting (?t=timestamp)
//   para forzar a Node.js a cargar la versión más reciente.
//
//   handler.js accede a los módulos via getModule(),
//   que devuelve la versión en caché (muy rápido, sin async).
//   Cuando un archivo cambia, refreshModule() re-importa
//   con un nuevo timestamp y actualiza el caché.
//   Si la re-importación falla (error de sintaxis),
//   se mantiene la versión anterior funcionando.
// ══════════════════════════════════════════════════════════

const registry = new Map();

/**
 * Cargar un módulo al registro (import dinámico con cache busting).
 * @param {string} key  - Nombre clave (ej: "db", "config", "msg")
 * @param {string} filePath - Ruta relativa al root del bot (ej: "./lib/database.js")
 * @returns {object} El módulo importado
 */
export async function loadModule(key, filePath) {
  const absolutePath = path.resolve(botRoot, filePath);
  const url = pathToFileURL(absolutePath).href + "?t=" + Date.now();

  try {
    const module = await import(url);
    registry.set(key, { module, filePath: absolutePath });
    return module;
  } catch (err) {
    console.error(chalk.red(`❌ [Hot-Reload] Error cargando módulo "${key}" (${filePath}): ${err.message}`));
    // Si ya existe en caché, mantener la versión anterior
    const cached = registry.get(key);
    if (cached) {
      console.log(chalk.yellow(`⚠️  [Hot-Reload] Manteniendo versión anterior de "${key}"`));
      return cached.module;
    }
    throw err;
  }
}

/**
 * Obtener un módulo del registro (sincrónico, muy rápido).
 * Esto es lo que handler.js usa en cada mensaje.
 * @param {string} key - Nombre clave del módulo
 * @returns {object} El módulo (versión más reciente en caché)
 */
export function getModule(key) {
  const entry = registry.get(key);
  if (!entry) {
    throw new Error(`[Hot-Reload] Módulo "${key}" no encontrado en el registro. ¿Se llamó loadModule() primero?`);
  }
  return entry.module;
}

/**
 * Recargar un módulo específico en el registro (re-import con cache busting).
 * Si falla (ej: error de sintaxis en el archivo editado), mantiene la versión anterior.
 * @param {string} key - Nombre clave del módulo
 * @returns {object} El módulo actualizado (o la versión anterior si falló)
 */
export async function refreshModule(key) {
  const entry = registry.get(key);
  if (!entry) return null;

  const url = pathToFileURL(entry.filePath).href + "?t=" + Date.now();

  try {
    const newModule = await import(url);
    registry.set(key, { module: newModule, filePath: entry.filePath });
    console.log(chalk.hex("#06ffa5")(`✅ [Hot-Reload] Módulo "${key}" recargado correctamente`));
    return newModule;
  } catch (err) {
    console.error(chalk.red(`❌ [Hot-Reload] Error recargando "${key}": ${err.message}`));
    console.log(chalk.yellow(`⚠️  [Hot-Reload] Manteniendo versión anterior de "${key}" — el archivo tiene un error`));
    // Mantener versión anterior funcionando — el bot NO se rompe
    return entry.module;
  }
}

/**
 * Recargar TODOS los módulos del registro.
 */
export async function refreshAllModules() {
  const keys = Array.from(registry.keys());
  for (const key of keys) {
    await refreshModule(key);
  }
}

// ══════════════════════════════════════════════════════════
//   WATCHER DE ARCHIVOS (fs.watch)
//   ──────────────────────────────────
//   Monitorea los directorios del bot y detecta cambios.
//   Usa debounce (500ms) para evitar recargas múltiples
//   cuando un editor guarda varias veces rápido.
// ══════════════════════════════════════════════════════════

const watchers = [];
const debounceTimers = new Map();
const DEBOUNCE_MS = 500;

// Callbacks configurables
let callbacks = {
  onPluginChange: null,    // async (filename) => { ... }
  onLibChange: null,       // async (filename) => { ... }
  onConfigChange: null,    // async (filename) => { ... }
  onRootChange: null,      // async (filename) => { ... }
  notifyOwner: null,       // async (message) => { ... }
};

// Mapa de archivos lib → claves del registro
const LIB_REGISTRY_MAP = {
  "database.js":      ["db"],
  "messages.js":      ["msg"],
  "pluginLoader.js":  ["pluginLoader"],
  "errorReporter.js": ["error"],
  "utils.js":         ["utils"],
  "cron.js":          ["cron"],
  "hotReload.js":     ["hotReload"],
  "groupHandler.js":  ["groupHandler"],
};

// Mapa de archivos root → claves del registro
const ROOT_REGISTRY_MAP = {
  "handler.js": ["handler"],
};

// Mapa de archivos config → claves del registro
const CONFIG_REGISTRY_MAP = {
  "settings.js": ["config"],
};

/**
 * Iniciar el watcher de archivos.
 * @param {object} opts - Callbacks y configuración
 *   - onPluginChange: async (filename) — llamado cuando un plugin cambia
 *   - onLibChange: async (filename) — llamado cuando un archivo lib cambia
 *   - onConfigChange: async (filename) — llamado cuando config cambia
 *   - onRootChange: async (filename) — llamado cuando handler.js/index.js cambia
 *   - notifyOwner: async (message) — para enviar notificación WhatsApp al owner
 */
export function startWatcher(opts = {}) {
  callbacks = { ...callbacks, ...opts };

  const dirsToWatch = [
    {
      dir: path.join(botRoot, "plugins"),
      type: "plugin",
      filter: (f) => f.endsWith(".js"),
    },
    {
      dir: path.join(botRoot, "lib"),
      type: "lib",
      filter: (f) => f.endsWith(".js"),
    },
    {
      dir: path.join(botRoot, "config"),
      type: "config",
      filter: (f) => f.endsWith(".js"),
    },
    {
      // Directorio raíz: solo handler.js e index.js
      dir: botRoot,
      type: "root",
      filter: (f) => f === "handler.js" || f === "index.js",
    },
  ];

  for (const { dir, type, filter } of dirsToWatch) {
    if (!fs.existsSync(dir)) continue;

    try {
      const watcher = fs.watch(dir, { persistent: true, recursive: false }, (eventType, filename) => {
        const targetFile = filename || (type === "plugin" ? "plugin_changed.js" : `${type}.js`);
        if (filter && filename && !filter(filename)) return;

        // Debounce: evitar recargas múltiples por doble-guardado del editor
        const key = `${type}:${targetFile}`;
        if (debounceTimers.has(key)) {
          clearTimeout(debounceTimers.get(key));
        }

        debounceTimers.set(key, setTimeout(() => {
          debounceTimers.delete(key);
          handleFileChange(type, targetFile);
        }, DEBOUNCE_MS));
      });

      watchers.push(watcher);
      const relPath = path.relative(botRoot, dir) || "./";
      console.log(chalk.cyan(`👁️  Observando: ${relPath}/ (${type})`));
    } catch (e) {
      console.error(chalk.red(`❌ Error observando ${dir}: ${e.message}`));
    }
  }

  console.log(chalk.hex("#06ffa5").bold("🔥 Hot-Reload activado — los cambios se aplican en tiempo real"));
  console.log(chalk.gray("   ℹ️  Plugins, lib y config: recarga automática"));
  console.log(chalk.gray("   ℹ️  handler.js / index.js: requiere reinicio manual"));
}

/**
 * Procesar un cambio de archivo detectado por el watcher.
 */
async function handleFileChange(type, filename) {
  const timestamp = new Date().toLocaleTimeString("es-MX", { timeZone: "America/Mexico_City" });
  console.log(
    chalk.hex("#ffbe0b").bold(`🔄 [${timestamp}] Cambio detectado: ${type}/${filename}`)
  );

  // ──── Plugin cambiado ────
  if (type === "plugin") {
    try {
      if (callbacks.onPluginChange) {
        await callbacks.onPluginChange(filename);
      }

      // Si ia.js cambió, también refrescar el módulo "ia" del registro
      if (filename === "ia.js") {
        await refreshModule("ia");
      }
    } catch (e) {
      console.error(chalk.red(`❌ [Hot-Reload] Error procesando cambio de plugin: ${e.message}`));
    }
    return;
  }

  // ──── Lib cambiado ────
  if (type === "lib") {
    const keys = LIB_REGISTRY_MAP[filename];
    if (keys) {
      for (const key of keys) {
        try {
          const mod = await refreshModule(key);
        } catch (e) {
          console.error(chalk.red(`❌ [Hot-Reload] Error recargando "${key}": ${e.message}`));
        }
      }
    } else {
      // Archivo lib desconocido → refrescar todo
      console.log(chalk.yellow(`⚠️  [Hot-Reload] Archivo lib desconocido "${filename}" — refrescando todos los módulos`));
      await refreshAllModules();
    }

    // Al cambiar cualquier archivo lib, recargar los plugins para que tomen las nuevas referencias
    try {
      const { loadPlugins } = getModule("pluginLoader");
      if (loadPlugins) await loadPlugins();
    } catch (e) {}

    if (globalThis.addLog) globalThis.addLog(`🔥 [HOT-RELOAD] Módulo lib/${filename} actualizado en tiempo real`);

    try {
      if (callbacks.onLibChange) {
        await callbacks.onLibChange(filename);
      }
    } catch (e) {
      console.error(chalk.red(`❌ [Hot-Reload] Error en callback onLibChange: ${e.message}`));
    }

    // Notificar al owner (opcional)
    if (callbacks.notifyOwner) {
      await callbacks.notifyOwner(
        `🔥 *Hot-Reload*\n${"─".repeat(23)}\n` +
        `Archivo actualizado: *lib/${filename}*\n` +
        `✅ Cambio aplicado en tiempo real.\n` +
        `No necesitas reiniciar el bot.`
      );
    }
    return;
  }

  // ──── Config cambiado ────
  if (type === "config") {
    const keys = CONFIG_REGISTRY_MAP[filename];
    if (keys) {
      for (const key of keys) {
        await refreshModule(key);
      }
    }

    try {
      if (callbacks.onConfigChange) {
        await callbacks.onConfigChange(filename);
      }
    } catch (e) {}

    if (callbacks.notifyOwner) {
      await callbacks.notifyOwner(
        `🔥 *Hot-Reload*\n${"─".repeat(23)}\n` +
        `Archivo actualizado: *config/${filename}*\n` +
        `✅ Cambio aplicado en tiempo real.\n` +
        `No necesitas reiniciar el bot.`
      );
    }
    return;
  }

  // ──── Archivo raíz cambiado (handler.js / index.js) ────
  if (type === "root") {
    const keys = ROOT_REGISTRY_MAP[filename];
    if (keys) {
      for (const key of keys) {
        try {
          await refreshModule(key);
          console.log(chalk.hex("#06ffa5")(`✅ [Hot-Reload] Archivo raíz "${filename}" recargado en tiempo real`));
        } catch (e) {
          console.error(chalk.red(`❌ [Hot-Reload] Error recargando "${key}": ${e.message}`));
        }
      }

      if (callbacks.onRootChange) {
        await callbacks.onRootChange(filename);
      }

      if (callbacks.notifyOwner) {
        await callbacks.notifyOwner(
          `🔥 *Hot-Reload — Handler*\n${"─".repeat(23)}\n` +
          `Archivo actualizado: *${filename}*\n` +
          `✅ Cambio aplicado en tiempo real.\n` +
          `No necesitas reiniciar el bot.`
        );
      }
      return;
    }

    console.log(
      chalk.hex("#ff006e").bold(`⚠️  [Hot-Reload] "${filename}" NO se puede hot-reload — requiere reinicio manual`)
    );

    if (callbacks.notifyOwner) {
      await callbacks.notifyOwner(
        `⚠️ *Hot-Reload — Reinicio Necesario*\n${"─".repeat(23)}\n` +
        `El archivo *${filename}* fue modificado.\n` +
        `❌ Este archivo NO se puede recargar en tiempo real.\n` +
        `Requiere reinicio manual del bot.\n\n` +
        `Usa \`!restart\` o ejecuta:\n` +
        `\`\`\`\npm2 restart kurumi\n\`\`\``
      );
    }

    if (callbacks.onRootChange) {
      await callbacks.onRootChange(filename);
    }
    return;
  }
}

/**
 * Detener todos los watchers.
 */
export function stopWatcher() {
  for (const w of watchers) {
    w.close();
  }
  watchers.length = 0;
  for (const timer of debounceTimers.values()) {
    clearTimeout(timer);
  }
  debounceTimers.clear();
  console.log(chalk.yellow("👁️  Hot-Reload desactivado"));
}

/**
 * Obtener la lista de claves del registro (para diagnóstico).
 */
export function getRegistryKeys() {
  return Array.from(registry.keys());
}
