// ============================================================
//   Kurumi Tokisaki - Sistema de Limpieza Automática
//   Elimina temporales huérfanos con más de cinco minutos de antigüedad
// ============================================================

import fs from "fs";
import path from "path";
import chalk from "chalk";

const TEMP_DIR = path.resolve("./temp");
const MAX_AGE_MS = 5 * 60 * 1000;
const CHECK_INTERVAL_MS = 60 * 1000;

/**
 * Limpia archivos y directorios temporales que ya no están en uso.
 * Los trabajos activos de Ytmp4 se eliminan inmediatamente en su bloque finally;
 * esta rutina solo actúa como respaldo ante reinicios o fallos inesperados.
 */
export async function cleanTempFolder() {
  try {
    await fs.promises.mkdir(TEMP_DIR, { recursive: true });
    const entries = await fs.promises.readdir(TEMP_DIR, { withFileTypes: true });
    const now = Date.now();
    let deletedCount = 0;

    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue;

      const entryPath = path.join(TEMP_DIR, entry.name);
      try {
        const stats = await fs.promises.stat(entryPath);
        if (now - stats.mtimeMs <= MAX_AGE_MS) continue;

        await fs.promises.rm(entryPath, {
          recursive: entry.isDirectory(),
          force: true
        });
        deletedCount += 1;
      } catch (error) {
        console.warn(chalk.yellow(`[LIMPIEZA] No se pudo revisar ${entry.name}: ${error.message}`));
      }
    }

    if (deletedCount > 0) {
      console.log(chalk.cyan(`[LIMPIEZA] Se eliminaron ${deletedCount} temporales con más de 5 minutos.`));
    }
  } catch (error) {
    console.error(chalk.red(`[LIMPIEZA] Error al limpiar /temp: ${error.message}`));
  }
}

let cleanerStarted = false;

/**
 * Inicia el respaldo de limpieza. Se revisa cada minuto para que los temporales
 * abandonados se eliminen aproximadamente cinco minutos después de su creación.
 */
export function startTempCleaner() {
  if (cleanerStarted) return;
  cleanerStarted = true;
  console.log(chalk.green("[SISTEMA] Limpiador de temporales iniciado (límite: 5 min)."));

  void cleanTempFolder();
  setInterval(() => {
    void cleanTempFolder();
  }, CHECK_INTERVAL_MS);
}

export default {
  cleanTempFolder,
  startTempCleaner
};
