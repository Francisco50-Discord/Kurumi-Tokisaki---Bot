// ============================================================
//   Kurumi Tokisaki - Sistema Keep-Alive & Anti-Latencia
//   Mantiene el bot activo 24/7 en Heroku, Replit, Render, etc.
// ============================================================

import http from "http";
import https from "https";
import chalk from "chalk";

let keepAliveTimer = null;
let wsPingTimer = null;

/**
 * Inicia el sistema de autodetección y ping Keep-Alive
 */
export function startKeepAliveSystem(port = 3000) {
  if (keepAliveTimer) return;

  const getPublicUrl = () => {
    if (process.env.APP_URL) return process.env.APP_URL;
    if (process.env.HEROKU_APP_NAME) return `https://${process.env.HEROKU_APP_NAME}.herokuapp.com`;
    if (process.env.REPL_SLUG && process.env.REPL_OWNER) return `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`;
    if (process.env.RENDER_EXTERNAL_URL) return process.env.RENDER_EXTERNAL_URL;
    if (process.env.PROJECT_DOMAIN) return `https://${process.env.PROJECT_DOMAIN}.glitch.me`;
    return null;
  };

  const pingUrl = (targetUrl) => {
    try {
      const client = targetUrl.startsWith("https") ? https : http;
      const req = client.get(targetUrl, (res) => {
        res.on("data", () => {});
      });
      req.on("error", () => {});
      req.setTimeout(5000, () => req.destroy());
    } catch (e) {}
  };

  // Ping cada 25 segundos (25,000 ms) para evitar que Cloud Run, Replit o Heroku entren en reposo o cancelen solicitudes
  keepAliveTimer = setInterval(() => {
    pingUrl(`http://127.0.0.1:${port}/api/status`);

    const publicUrl = getPublicUrl();
    if (publicUrl) {
      pingUrl(`${publicUrl.replace(/\/$/, '')}/api/status`);
    }
  }, 25000);

  // Ejecutar un ping inicial
  pingUrl(`http://127.0.0.1:${port}/api/status`);

  console.log(chalk.cyan(`[KEEP-ALIVE] ⚡ Sistema de auto-ping anti-reposo activado (Local y Nube)`));
}

/**
 * Inicia el Keep-Alive a nivel de WebSocket para el cliente Baileys
 */
export function startWsKeepAlive(conn) {
  if (wsPingTimer) clearInterval(wsPingTimer);

  wsPingTimer = setInterval(async () => {
    if (!conn || !conn.ws || conn.ws.readyState !== 1) return;
    try {
      await conn.sendPresenceUpdate("available");
    } catch (e) {}
  }, 25000);
}

/**
 * Detiene el ping de WebSocket
 */
export function stopWsKeepAlive() {
  if (wsPingTimer) {
    clearInterval(wsPingTimer);
    wsPingTimer = null;
  }
}

export default {
  startKeepAliveSystem,
  startWsKeepAlive,
  stopWsKeepAlive
};
