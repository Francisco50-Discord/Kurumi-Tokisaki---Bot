// ============================================================
//   Kurumi Tokisaki - Sistema de Reporte Automático de Errores
//   Envía traceback completo al número del owner (+529852270023)
//   cuando cualquier comando falla.
// ============================================================

import { config } from "../config/settings.js";

// Número al que se enviarán los reportes de error
const ERROR_REPORT_NUMBER = "529852270023@s.whatsapp.net";

// Referencia global a la conexión de WhatsApp
let _conn = null;

export function setErrorReporterConnection(conn) {
  _conn = conn;
}

/**
 * Captura el stack trace completo de un error de forma segura.
 */
function captureTrace(error) {
  if (!error) return "Error desconocido (sin objeto de error)";
  const lines = [];
  lines.push(`📋 Tipo: ${error.name || "Error"}`);
  lines.push(`💬 Mensaje: ${error.message || "Sin mensaje"}`);
  if (error.code) lines.push(`🏷️ Código: ${error.code}`);
  if (error.errno) lines.push(`🔢 Errno: ${error.errno}`);
  if (error.syscall) lines.push(`⚙️ Syscall: ${error.syscall}`);
  if (error.response?.status) {
    lines.push(`🌐 HTTP Status: ${error.response.status}`);
    if (error.response?.statusText) {
      lines.push(`📝 HTTP Status Text: ${error.response.statusText}`);
    }
    if (error.response?.config?.url) {
      lines.push(`🔗 URL: ${error.response.config.url}`);
    }
    if (error.response?.config?.method) {
      lines.push(`🔧 Método: ${error.response.config.method.toUpperCase()}`);
    }
  }
  lines.push("");
  lines.push("📚 Stack Trace:");
  if (error.stack) {
    lines.push(error.stack);
  } else {
    lines.push("(sin stack trace disponible)");
  }
  return lines.join("\n");
}

/**
 * Captura el contexto del comando que falló.
 */
function captureContext(m, ctx = {}) {
  const lines = [];
  lines.push("────────");
  lines.push("🚨 REPORTE DE ERROR — KURUMI TOKISAKI BOT");
  lines.push("────────");
  lines.push("");
  lines.push("📍 Contexto del comando:");
  lines.push(`   🕐 Fecha: ${new Date().toLocaleString("es-MX", { timeZone: "America/Mexico_City" })}`);
  lines.push(`   💬 Chat: ${ctx.chatId || m?.chatId || "?"}`);
  lines.push(`   👤 Usuario: ${ctx.sender || m?.sender || "?"}`);
  lines.push(`   👥 Es grupo: ${ctx.isGroup !== undefined ? ctx.isGroup : m?.isGroup ? "Sí" : "No"}`);
  if (ctx.usedPrefix && ctx.command) {
    lines.push(`   ⌨️ Comando: ${ctx.usedPrefix}${ctx.command}`);
  } else if (m?.text) {
    lines.push(`   ⌨️ Mensaje: ${String(m.text).slice(0, 200)}`);
  }
  if (ctx.args?.length) {
    lines.push(`   📝 Args: ${ctx.args.join(" ").slice(0, 200)}`);
  }
  lines.push("");
  return lines.join("\n");
}

/**
 * Reporta un error al número configurado del owner.
 *
 * @param {Error} error - el error capturado
 * @param {object} m - mensaje original
 * @param {object} ctx - contexto del comando (conn, args, command, etc.)
 */
export async function reportError(error, m = null, ctx = {}) {
  try {
    const errSummary = `🚨 [REPORTE ERROR] Cmd: ${ctx.usedPrefix || ''}${ctx.command || 'N/A'} | Msg: ${error?.message || error}`;
    console.error(errSummary);
    if (globalThis.addLog) globalThis.addLog(errSummary);

    if (!_conn || (globalThis.botState && globalThis.botState.status !== "online")) return;

    // Extraer el código que falló del stack trace
    const stack = error?.stack || "";
    const stackLines = stack.split("\n").slice(0, 10).join("\n");

    const report = [
      captureContext(m, ctx),
      "🔬 Detalles del error:",
      captureTrace(error),
      "",
      "📁 Archivo/Función que falló (estimado desde stack):",
      stackLines,
      "",
      `🌸 ${config.botName} v${config.version}`,
      `👤 Creador: ${config.creator}`,
      "────────",
    ].join("\n");

    // Enviar al owner — máximo 4000 caracteres por mensaje de WhatsApp
    const chunks = [];
    if (report.length > 3800) {
      // Dividir en chunks preservando líneas
      const lines = report.split("\n");
      let current = "";
      for (const line of lines) {
        if ((current + "\n" + line).length > 3800) {
          chunks.push(current);
          current = line;
        } else {
          current = current ? current + "\n" + line : line;
        }
      }
      if (current) chunks.push(current);
    } else {
      chunks.push(report);
    }

    // Resolver JID del owner (529852270023)
    const targetNumber = config.creatorNumber || "529852270023";
    let ownerJids = [`${targetNumber}@s.whatsapp.net`, `521${targetNumber.replace(/^52/, "")}@s.whatsapp.net`].filter((v, i, a) => a.indexOf(v) === i);

    if (_conn?.onWhatsApp) {
      try {
        const res = await _conn.onWhatsApp(targetNumber);
        if (res && res[0]?.jid) {
          ownerJids = [res[0].jid, ...ownerJids].filter((v, i, a) => a.indexOf(v) === i);
        }
      } catch (e) {}
    }

    for (let i = 0; i < chunks.length; i++) {
      const prefix = chunks.length > 1 ? ` (${i + 1}/${chunks.length})` : "";
      const textToSend = `🚨 *REPORTE DE ERROR${prefix}*\n\n${chunks[i]}`;
      
      let sentChunk = false;
      for (const targetJid of ownerJids) {
        try {
          await _conn.sendMessage(targetJid, { text: textToSend });
          sentChunk = true;
          break;
        } catch (e) {
          console.error(`Error enviando reporte de error a ${targetJid}:`, e.message);
        }
      }
    }
  } catch (e) {
    // Si el propio reporte falla, no queremos romper nada
    console.error("ErrorReporter falló:", e.message);
  }
}

/**
 * Wrapper que envuelve un handler de comando y captura errores automáticamente.
 * Uso:
 *   const handler = withErrorReporting(async (m, ctx) => { ... });
 */
export function withErrorReporting(handler) {
  return async (m, ctx = {}) => {
    try {
      return await handler(m, ctx);
    } catch (error) {
      // Enviar mensaje corto al usuario
      try {
        if (m?.reply) {
          await m.reply(
            `✦━【 ❌ *ERROR* 】━✦\n\n` +
            `Ocurrió un error al ejecutar el comando.\n` +
            `El reporte fue enviado automáticamente al creador. 📨\n\n` +
            `💬 ${error.message || "Error desconocido"}`
          );
        }
      } catch (e) {}

      // Reportar al owner
      await reportError(error, m, ctx);
      throw error; // Re-lanzar para que el handler principal también lo registre
    }
  };
}

export default {
  setErrorReporterConnection,
  reportError,
  withErrorReporting,
};
