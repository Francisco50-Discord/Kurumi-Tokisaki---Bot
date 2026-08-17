// ============================================================
//   Kurumi Tokisaki - Bot de WhatsApp
//   Creado por: «[×𝐹ɾαɳƈιʂƈσ×]»
//   Número: +52 985 227 0023
//   Versión: 5.1.0 (Limpieza: sin descargas ni video · Hot-Reload · APIs 2026)
// ============================================================

import { createRequire } from "module";
const require = createRequire(import.meta.url);

// Cargar Baileys usando require para evitar errores de ESM en Node v26
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  proto,
  Browsers,
} = require("@whiskeysockets/baileys");

import { Boom } from "@hapi/boom";
import chalk from "chalk";
import pino from "pino";
import readline from "readline";
import fs from "fs";
import path from "path";
import http from "http";
import { EventEmitter } from "events";
import { fileURLToPath } from "url";
import axios from "axios";

// Incrementar límite de listeners para evitar advertencias de MaxListenersExceeded en streams de Baileys / Node
EventEmitter.defaultMaxListeners = 100;
process.setMaxListeners(100);

// Protege los comandos que usan axios sin tiempo de espera propio. Las rutas de
// descarga que ya declaran un límite específico lo conservan sin modificación.
const defaultHttpTimeoutMs = Number(process.env.HTTP_TIMEOUT_MS) || 12_000;
axios.defaults.timeout = defaultHttpTimeoutMs;
axios.defaults.headers.common["User-Agent"] ||= "Kurumi-Tokisaki-Bot/5.1";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// La ruta puede apuntar a un volumen persistente en Heroku, Replit, Boxmine
// u otro proveedor. Si no se define, conserva la ruta local original.
function getSessionDir(config = {}) {
  const configuredPath = config?.sessionPath;
  const configuredName = config?.sessionName || "kurumi_session";
  return configuredPath
    ? path.resolve(configuredPath)
    : path.resolve(process.cwd(), configuredName);
}

// Capturadores globales de excepciones para evitar que el servidor colapse
process.on("uncaughtException", (err) => {
  const msg = err?.message || String(err);
  if (msg.includes("Bad MAC") || msg.includes("Failed to decrypt")) {
    console.warn(chalk.yellow("⚠️ [SESIÓN WHATSAPP] Advertencia de descifrado (Bad MAC / Clave antigua). Paquete omitido para evitar colapsos."));
    if (typeof addLog === "function") addLog("[SESIÓN] Advertencia de descifrado mitigada (Bad MAC).");
    return;
  }
  console.error("Uncaught Exception:", msg);
  if (typeof addLog === "function") addLog(`[ERROR NO CAPTURADO] ${msg}`);
});

process.on("unhandledRejection", (err) => {
  const msg = err?.message || String(err);
  if (msg.includes("Bad MAC") || msg.includes("Failed to decrypt")) {
    console.warn(chalk.yellow("⚠️ [SESIÓN WHATSAPP] Promesa rechazada por error de descifrado (Bad MAC / Pre-Key mismatch)."));
    if (typeof addLog === "function") addLog("[SESIÓN] Promesa rechazada por Bad MAC (manejada automáticamente).");
    return;
  }
  console.error("Unhandled Rejection:", msg);
  if (typeof addLog === "function") addLog(`[PROMESA RECHAZADA] ${msg}`);
});

// ══════════════════════════════════════════════════════════
//   Estado Global, Servidor Web Dashboard & Mutex de Reconexión
// ══════════════════════════════════════════════════════════

const PORT = process.env.PORT || 3000;
let globalConn = null;
let currentSocketId = 0;
let reconnectTimer = null;
let consecutiveDisconnects = 0;
let isStartingBot = false;
let isBotStopped = false;

const botState = {
  status: "initializing", // initializing, pairing, online, offline, stopped
  pairingCode: null,
  pairingNumber: null,
  uptime: Date.now(),
  pluginsCount: 0,
  logs: [],
  lastError: null,
};

function addLog(msg) {
  const timestamp = new Date().toLocaleTimeString();
  botState.logs.push(`[${timestamp}] ${msg}`);
  if (botState.logs.length > 60) botState.logs.shift();
}

globalThis.addLog = addLog;
globalThis.botState = botState;
// Expone exclusivamente el socket que ya alcanzó el estado "online". Los plugins
// no deben reutilizar un socket anterior mientras Baileys está reconectando.
globalThis.getActiveConnection = () => (
  botState.status === "online" && globalConn ? globalConn : null
);

function scheduleReconnect(delayMs, reason) {
  if (isBotStopped) {
    console.log(chalk.yellow(`🛑 [RECONNECT] Omitido porque el bot está apagado temporalmente.`));
    return;
  }
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  const sec = (delayMs / 1000).toFixed(1);
  addLog(`⏱️ Reconexión programada en ${sec}s (${reason})...`);
  console.log(chalk.cyan(`⏱️ [RECONNECT] Programado en ${sec}s (${reason})`));

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    safeStartBot();
  }, delayMs);
}

globalThis.scheduleReconnect = scheduleReconnect;
globalThis.safeStartBot = safeStartBot;

function stopBot() {
  isBotStopped = true;
  isStartingBot = false;
  currentSocketId++;
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (globalConn) {
    try {
      globalConn.ev.removeAllListeners();
      globalConn.ws?.close();
      globalConn.end?.();
    } catch (e) {}
    globalConn = null;
  }
  botState.status = "stopped";
  botState.pairingCode = null;
  botState.pairingNumber = null;
  addLog("🛑 Bot apagado temporalmente por orden del usuario.");
  console.log(chalk.yellow("🛑 [SISTEMA] Bot apagado temporalmente. Usa '▶️ Encender Bot' en la web para reanudar."));
}

function hasRegisteredSession(sessionPath) {
  const credsPath = path.join(sessionPath, "creds.json");
  try {
    const creds = JSON.parse(fs.readFileSync(credsPath, "utf-8"));
    return creds?.registered === true;
  } catch (error) {
    return false;
  }
}

// Un 401 indica que WhatsApp revocó la sesión; se conserva una copia antes de
// preparar una carpeta nueva. No se usa durante reinicios ni desconexiones normales.
function quarantineRevokedSession(sessionPath) {
  if (!fs.existsSync(sessionPath)) return null;

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = `${sessionPath}.revoked-${stamp}`;
  try {
    fs.renameSync(sessionPath, backupPath);
    fs.mkdirSync(sessionPath, { recursive: true });
    return backupPath;
  } catch (error) {
    console.warn(chalk.yellow(`⚠️ [SESIÓN] No se pudo respaldar la sesión revocada: ${error.message}`));
    return null;
  }
}

async function requestPairingCodeWithRetry(rawNumber, { replaceSession = false } = {}) {
  const cleanNum = (rawNumber || "").replace(/[^0-9]/g, "");
  if (!cleanNum || cleanNum.length < 8) {
    throw new Error("Ingresa un número de WhatsApp válido con código de país (ejemplo: 529852270023)");
  }

  // Si el bot está activamente conectado y en línea
  if (botState.status === "online" && globalConn?.authState?.creds?.registered) {
    throw new Error("El bot ya se encuentra en línea y vinculado a WhatsApp. Si deseas vincular otro número, haz clic en '🔄 Reiniciar' primero.");
  }

  // Intentar primero con el número exacto ingresado por el usuario
  const numbersToTry = [cleanNum];
  if (cleanNum.startsWith("52") && cleanNum.length === 12 && !cleanNum.startsWith("521")) {
    numbersToTry.push("521" + cleanNum.slice(2));
  } else if (cleanNum.startsWith("54") && cleanNum.length === 12 && !cleanNum.startsWith("549")) {
    numbersToTry.push("549" + cleanNum.slice(2));
  }

  const { config } = (typeof getModule === "function" ? getModule("config") : null) || { config: { sessionName: "kurumi_session" } };
  const sessionPath = getSessionDir(config);
  // Una sesión ya registrada no debe borrarse al pulsar iniciar, reiniciar o pedir
  // un código por error. Un creds.json nuevo con registered:false sí puede recibir
  // su primer código de vinculación sin necesidad de borrarse.
  if (hasRegisteredSession(sessionPath) && !replaceSession) {
    throw new Error("Ya existe una sesión registrada. Usa «Reconectar» para reanudarla; solo limpia la sesión si deseas vincular otro número.");
  }

  let code = null;
  let lastErr = null;
  let successfulNumber = cleanNum;

  for (const numAttempt of numbersToTry) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        addLog(`[PAIRING] Solicitando código a WhatsApp para +${numAttempt} (intento ${attempt}/2)...`);
        console.log(chalk.cyan(`⏳ [PAIRING] Solicitando código a WhatsApp para +${numAttempt} (intento ${attempt}/2)...`));

        // 1. Cerrar socket anterior de forma limpia
        if (globalConn) {
          try {
            globalConn.ev.removeAllListeners();
            globalConn.ws?.close?.();
            globalConn.end?.();
          } catch (e) {}
          globalConn = null;
        }

        // 2. Crear una carpeta de sesión solo para un emparejamiento de reemplazo
        // autorizado. Nunca se eliminan credenciales durante un arranque normal.
        if (replaceSession) {
          try { fs.rmSync(sessionPath, { recursive: true, force: true }); } catch (e) {}
        }
        fs.mkdirSync(sessionPath, { recursive: true });

        // 3. Crear socket de Baileys
        const conn = await createWASocketConnection();

        // 4. Esperar a que la conexión y el handshake de WhatsApp se completen
        await new Promise(r => setTimeout(r, 2500));

        // 5. Solicitar código de vinculación a WhatsApp
        const codePromise = conn.requestPairingCode(numAttempt);
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Tiempo de espera agotado al conectar con el servidor de WhatsApp.")), 25000)
        );

        code = await Promise.race([codePromise, timeoutPromise]);
        if (code) {
          successfulNumber = numAttempt;
          break;
        }
      } catch (err) {
        lastErr = err;
        console.log(chalk.yellow(`⚠️ Intento con +${numAttempt} falló: ${err.message}`));
        addLog(`⚠️ Intento con +${numAttempt} falló: ${err.message}`);

        if (globalConn) {
          try {
            globalConn.ev.removeAllListeners();
            globalConn.ws?.close?.();
          } catch (e) {}
          globalConn = null;
        }

        if (attempt < 2) {
          await new Promise(r => setTimeout(r, 1500));
        }
      }
    }
    if (code) break;
  }

  if (!code) {
    const errMsg = lastErr?.message || "Desconocido";
    let hint = "";
    if (errMsg.includes("Connection Closed") || errMsg.includes("Timed Out") || errMsg.includes("bad-request")) {
      hint = "\n\n💡 Si el problema persiste:\n" +
             " • Revisa que el número esté registrado activamente en WhatsApp.\n" +
             " • Si has solicitado muchos códigos seguidos, WhatsApp te bloquea temporalmente por 10-15 min.";
    }
    throw new Error(`No se pudo obtener el código: ${errMsg}${hint}`);
  }

  const formattedCode = code.match(/.{1,4}/g)?.join("-") || code;
  botState.pairingNumber = successfulNumber;
  botState.pairingCode = formattedCode;
  botState.status = "pairing";

  addLog(`🔑 ¡CÓDIGO DE VINCULACIÓN GENERADO! +${successfulNumber}: ${formattedCode}`);

  console.log("");
  console.log(chalk.hex("#06ffa5").bold("  ╔══════════════════════════════════════════════════════════════╗"));
  console.log(chalk.hex("#06ffa5").bold(`  ║  🔑 CÓDIGO DE VINCULACIÓN (+${successfulNumber}): ${formattedCode.padEnd(16)}  ║`));
  console.log(chalk.hex("#06ffa5").bold("  ║  ──────────────────────────────────────────────────────────  ║"));
  console.log(chalk.hex("#06ffa5").bold(`  ║  Ingresa este código en tu WhatsApp (+${successfulNumber}):        ║`));
  console.log(chalk.hex("#06ffa5").bold("  ║  Vaya a: Dispositivos vinculados > Vincular con número      ║"));
  console.log(chalk.hex("#06ffa5").bold("  ╚══════════════════════════════════════════════════════════════╝"));
  console.log("");

  return { code: formattedCode, number: successfulNumber };
}

function startWebServer() {
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

    // Set CORS headers for all responses
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      res.writeHead(200);
      return res.end();
    }

    if (url.pathname === "/api/status") {
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({
        status: botState.status,
        pairingCode: botState.pairingCode,
        pairingNumber: botState.pairingNumber,
        uptimeSeconds: Math.floor((Date.now() - botState.uptime) / 1000),
        pluginsCount: botState.pluginsCount,
        logs: botState.logs,
        lastError: botState.lastError
      }));
    }

    if (url.pathname === "/api/stop" && req.method === "POST") {
      try {
        stopBot();
        res.writeHead(200, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ success: true, message: "Bot apagado temporalmente." }));
      } catch (err) {
        res.writeHead(500, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: err.message }));
      }
    }

    if (url.pathname === "/api/start" && req.method === "POST") {
      try {
        isBotStopped = false;
        isStartingBot = false;
        currentSocketId++;
        botState.status = "initializing";
        addLog("▶️ Reanudando bot desde el panel web...");
        scheduleReconnect(200, "Activación manual desde el panel");
        res.writeHead(200, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ success: true, message: "Iniciando bot..." }));
      } catch (err) {
        res.writeHead(500, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: err.message }));
      }
    }

    if (url.pathname === "/api/pair" && req.method === "POST") {
      let body = "";
      req.on("data", chunk => { body += chunk; });
      req.on("end", async () => {
        try {
          isBotStopped = false;
          isStartingBot = false;
          const data = JSON.parse(body || "{}");
          const result = await requestPairingCodeWithRetry(data.number, { replaceSession: data.replaceSession === true });
          res.writeHead(200, { "Content-Type": "application/json" });
          return res.end(JSON.stringify({ success: true, code: result.code, number: result.number }));
        } catch (err) {
          botState.lastError = err.message;
          addLog(`❌ Error al solicitar código: ${err.message}`);
          res.writeHead(400, { "Content-Type": "application/json" });
          return res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }

    if (url.pathname === "/api/upload-session" && req.method === "POST") {
      let body = "";
      req.on("data", chunk => { body += chunk; });
      req.on("end", async () => {
        try {
          isBotStopped = false;
          isStartingBot = false;
          currentSocketId++;
          const data = JSON.parse(body || "{}");
          let credsObj = data.creds;
          if (typeof credsObj === "string") {
            try { credsObj = JSON.parse(credsObj); } catch (e) { throw new Error("El texto introducido no es un JSON válido."); }
          }
          if (!credsObj || typeof credsObj !== "object" || !credsObj.noiseKey) {
            throw new Error("El objeto creds.json no parece tener la estructura válida de WhatsApp/Baileys (falta noiseKey).");
          }

          const { config } = getModule("config") || { config: { sessionName: "kurumi_session" } };
          const sessionDir = getSessionDir(config);
          if (!fs.existsSync(sessionDir)) fs.mkdirSync(sessionDir, { recursive: true });

          fs.writeFileSync(path.join(sessionDir, "creds.json"), JSON.stringify(credsObj, null, 2), "utf-8");
          addLog("📥 Archivo creds.json guardado correctamente en la carpeta de sesión.");

          botState.pairingCode = null;
          botState.pairingNumber = null;
          botState.status = "offline";
          consecutiveDisconnects = 0;

          if (globalConn) {
            try {
              globalConn.ev.removeAllListeners();
              globalConn.ws?.close();
              globalConn.end?.();
            } catch (e) {}
            globalConn = null;
          }

          scheduleReconnect(1000, "Iniciando bot con nuevas credenciales subidas");

          res.writeHead(200, { "Content-Type": "application/json" });
          return res.end(JSON.stringify({ success: true, message: "¡Sesión guardada exitosamente! Conectando bot..." }));
        } catch (err) {
          botState.lastError = err.message;
          addLog(`❌ Error al subir sesión: ${err.message}`);
          res.writeHead(400, { "Content-Type": "application/json" });
          return res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }

    if (url.pathname === "/api/reset" && req.method === "POST") {
      try {
        isBotStopped = false;
        isStartingBot = false;
        currentSocketId++;
        if (reconnectTimer) {
          clearTimeout(reconnectTimer);
          reconnectTimer = null;
        }

        if (globalConn) {
          try {
            globalConn.ev.removeAllListeners();
            globalConn.ws?.close();
            globalConn.end?.();
          } catch (e) {}
          globalConn = null;
        }

        botState.pairingCode = null;
        botState.pairingNumber = null;
        botState.status = "offline";
        consecutiveDisconnects = 0;

        const { config } = getModule("config") || { config: { sessionName: "kurumi_session" } };
        
        if (url.searchParams.get("clean") === "true") {
          const sessionDir = getSessionDir(config);
          try { fs.rmSync(sessionDir, { recursive: true, force: true }); } catch (e) {}
          addLog("🗑️ Credenciales y sesión eliminadas completamente. Listo para nueva vinculación...");
        } else {
          addLog("⚡ Reiniciando conexión manteniendo la sesión actual...");
        }

        scheduleReconnect(500, "Reinicio solicitado manualmente desde la web");

        res.writeHead(200, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ success: true, message: url.searchParams.get("clean") === "true" ? "Sesión limpiada correctamente. Genera un nuevo código para conectar." : "Bot reiniciado exitosamente." }));
      } catch (err) {
        res.writeHead(500, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: err.message }));
      }
    }

    if (url.pathname === "/api/repair-session" && req.method === "POST") {
      try {
        isBotStopped = false;
        isStartingBot = false;
        currentSocketId++;
        if (reconnectTimer) {
          clearTimeout(reconnectTimer);
          reconnectTimer = null;
        }

        if (globalConn) {
          try {
            globalConn.ev.removeAllListeners();
            globalConn.ws?.close();
            globalConn.end?.();
          } catch (e) {}
          globalConn = null;
        }

        botState.pairingCode = null;
        botState.pairingNumber = null;
        botState.status = "offline";
        consecutiveDisconnects = 0;

        const { config } = getModule("config") || { config: { sessionName: "kurumi_session" } };
        const sessionDir = getSessionDir(config);
        
        const count = repairSessionKeys(sessionDir);
        addLog(`🔧 Sesión verificada: las credenciales y claves existentes se conservaron. Reconectando...`);

        scheduleReconnect(500, "Reinicio tras reparar claves Bad MAC");

        res.writeHead(200, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ success: true, message: "Sesión verificada y reconectando sin eliminar credenciales." }));
      } catch (err) {
        res.writeHead(500, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: err.message }));
      }
    }

    // Pagina HTML Principal Dashboard
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Kurumi Tokisaki · Panel de Control</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600;700&display=swap');
    
    :root {
      --bg-dark: #0b0810;
      --card-bg: rgba(20, 14, 28, 0.75);
      --card-border: rgba(244, 63, 94, 0.18);
    }

    body {
      font-family: 'Plus Jakarta Sans', sans-serif;
      background-color: var(--bg-dark);
      background-image: 
        radial-gradient(circle at 15% 15%, rgba(225, 29, 72, 0.08) 0%, transparent 40%),
        radial-gradient(circle at 85% 85%, rgba(147, 51, 234, 0.06) 0%, transparent 40%);
      background-attachment: fixed;
      color: #f3f4f6;
    }

    .glass-panel {
      background: var(--card-bg);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid var(--card-border);
    }

    .font-mono-code {
      font-family: 'JetBrains Mono', monospace;
    }

    /* Custom Scrollbar */
    ::-webkit-scrollbar {
      width: 6px;
      height: 6px;
    }
    ::-webkit-scrollbar-track {
      background: rgba(10, 6, 16, 0.5);
    }
    ::-webkit-scrollbar-thumb {
      background: rgba(244, 63, 94, 0.3);
      border-radius: 9999px;
    }
    ::-webkit-scrollbar-thumb:hover {
      background: rgba(244, 63, 94, 0.6);
    }

    @keyframes pulseGlow {
      0%, 100% { opacity: 0.8; transform: scale(1); }
      50% { opacity: 0.3; transform: scale(1.1); }
    }
    .pulse-glow {
      animation: pulseGlow 2.5s infinite ease-in-out;
    }
  </style>
</head>
<body class="min-h-screen p-3 sm:p-6 md:p-8 flex flex-col items-center justify-start antialiased">

  <div class="max-w-5xl w-full space-y-6">
    
    <!-- Header Principal -->
    <header class="glass-panel rounded-3xl p-5 sm:p-6 shadow-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
      <div class="flex items-center gap-4">
        <div class="relative flex-shrink-0">
          <div class="w-14 h-14 rounded-2xl bg-gradient-to-br from-rose-600 via-pink-600 to-purple-800 flex items-center justify-center text-2xl shadow-lg shadow-rose-600/30 border border-rose-400/30">
            ⏳
          </div>
          <span id="headerDot" class="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-amber-400 border-2 border-[#0b0810]"></span>
        </div>
        <div>
          <div class="flex items-center gap-2">
            <h1 class="text-xl sm:text-2xl font-extrabold tracking-tight text-white">
              Kurumi Tokisaki
            </h1>
            <span class="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-rose-950/80 text-rose-300 border border-rose-500/30">v1.0.9</span>
          </div>
          <p class="text-xs text-rose-200/60 mt-0.5">WhatsApp Automation · Spirit of Time Controller</p>
        </div>
      </div>
      
      <div id="statusBadge" class="flex items-center gap-2 px-4 py-2 rounded-full glass-panel text-xs font-semibold text-amber-300 border-amber-500/30 self-start md:self-auto">
        <span class="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse"></span>
        <span id="statusBadgeText">Iniciando sistema...</span>
      </div>
    </header>

    <!-- Métricas en Tiempo Real -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
      <div class="glass-panel p-4 rounded-2xl flex flex-col justify-between">
        <span class="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Estado Conexión</span>
        <div id="statStatus" class="text-lg font-bold text-rose-400 mt-2 flex items-center gap-1.5">
          <span>---</span>
        </div>
      </div>
      <div class="glass-panel p-4 rounded-2xl flex flex-col justify-between">
        <span class="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Plugins Activos</span>
        <div id="statPlugins" class="text-lg font-bold text-purple-300 font-mono-code mt-2">0</div>
      </div>
      <div class="glass-panel p-4 rounded-2xl flex flex-col justify-between">
        <span class="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Tiempo de Actividad</span>
        <div id="statUptime" class="text-lg font-bold text-emerald-400 font-mono-code mt-2">0s</div>
      </div>
      <div class="glass-panel p-4 rounded-2xl flex flex-col justify-between">
        <span class="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Keep-Alive</span>
        <div class="text-lg font-bold text-cyan-400 mt-2 flex items-center gap-1.5">
          <span class="w-2 h-2 rounded-full bg-cyan-400"></span>
          <span class="text-sm font-semibold">ACTIVO</span>
        </div>
      </div>
    </div>

    <!-- Barra de Controles Rápidos -->
    <div class="glass-panel rounded-3xl p-5 space-y-4">
      <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-rose-500/10 pb-3">
        <h2 class="text-sm font-bold text-rose-200 uppercase tracking-wider flex items-center gap-2">
          ⚙️ Acciones & Control de Sesión
        </h2>
        <span class="text-[11px] text-gray-400">Gestión instantánea en tiempo real</span>
      </div>

      <div class="flex flex-wrap gap-2.5">
        <button onclick="startBotWeb()" class="flex-1 sm:flex-none px-4 py-2.5 rounded-xl text-xs font-bold bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/40 text-emerald-200 transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/50">
          <span>▶</span> Encender Bot
        </button>
        <button onclick="stopBotWeb()" class="flex-1 sm:flex-none px-4 py-2.5 rounded-xl text-xs font-bold bg-rose-950/80 hover:bg-rose-900 border border-rose-500/40 text-rose-200 transition-all flex items-center justify-center gap-2 shadow-lg shadow-rose-950/50">
          <span>🛑</span> Apagar Bot
        </button>
        <button onclick="resetSession(false)" class="flex-1 sm:flex-none px-4 py-2.5 rounded-xl text-xs font-bold bg-indigo-950/80 hover:bg-indigo-900 border border-indigo-500/40 text-indigo-200 transition-all flex items-center justify-center gap-2">
          <span>⚡</span> Reconectar
        </button>
        <button onclick="repairSession()" class="flex-1 sm:flex-none px-4 py-2.5 rounded-xl text-xs font-bold bg-amber-950/80 hover:bg-amber-900 border border-amber-500/40 text-amber-200 transition-all flex items-center justify-center gap-2">
          <span>🔧</span> Reparar Bad MAC
        </button>
        <button onclick="toggleSessionUpload()" class="flex-1 sm:flex-none px-4 py-2.5 rounded-xl text-xs font-bold bg-purple-950/80 hover:bg-purple-900 border border-purple-500/40 text-purple-200 transition-all flex items-center justify-center gap-2">
          <span>📥</span> Importar creds.json
        </button>
        <button onclick="resetSession(true)" class="flex-1 sm:flex-none px-4 py-2.5 rounded-xl text-xs font-bold bg-red-950/80 hover:bg-red-900 border border-red-500/40 text-red-200 transition-all flex items-center justify-center gap-2">
          <span>🗑️</span> Limpiar Sesión
        </button>
      </div>

      <!-- Importar creds.json deslizable -->
      <div id="uploadContainer" class="hidden p-4 rounded-2xl bg-[#0e0915] border border-purple-500/30 space-y-3 mt-3">
        <div class="flex justify-between items-center">
          <h3 class="text-xs font-bold text-purple-300 flex items-center gap-2">
            <span>📥</span> Cargar Credenciales Manuales
          </h3>
          <button onclick="toggleSessionUpload()" class="text-gray-400 hover:text-white text-xs">✕ Cerrar</button>
        </div>
        <p class="text-xs text-gray-400">Pega el contenido completo del archivo <code class="bg-black/60 px-1.5 py-0.5 rounded text-rose-300 font-mono-code">creds.json</code> para restaurar la sesión directamente:</p>
        <textarea id="credsTextarea" rows="4" placeholder='{"noiseKey":{...},"pairingEphemeralKeyPair":{...},"creds":{...}}' class="w-full bg-black/80 border border-purple-500/30 rounded-xl p-3 text-xs font-mono-code text-emerald-300 focus:outline-none focus:border-rose-500 transition-all"></textarea>
        <div class="flex justify-end">
          <button onclick="uploadCreds()" class="px-5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20 transition-all">
            Guardar e Iniciar
          </button>
        </div>
      </div>
    </div>

    <!-- Sección de Vinculación por Código -->
    <div class="glass-panel rounded-3xl p-6 space-y-5">
      <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <h2 class="text-sm font-bold text-rose-200 uppercase tracking-wider flex items-center gap-2">
          📱 Vinculación de WhatsApp
        </h2>
        <span class="text-[11px] text-gray-400">Conecta tu número fácilmente por código de 8 dígitos</span>
      </div>

      <!-- Pantalla de Código Si Está Generado -->
      <div id="codeDisplay" class="hidden p-6 rounded-2xl bg-gradient-to-b from-amber-950/30 to-black/60 border border-amber-500/40 text-center space-y-4">
        <p id="codeForNum" class="text-xs uppercase tracking-widest text-amber-300 font-bold">Código de Vinculación Generado</p>
        
        <div class="flex items-center justify-center gap-3">
          <div id="codeValue" class="text-3xl sm:text-5xl font-black text-amber-300 tracking-wider font-mono-code bg-black/80 py-3 px-6 rounded-2xl border border-amber-500/50 shadow-inner select-all">
            ----
          </div>
          <button onclick="copyCode()" id="copyBtn" class="px-3.5 py-3 rounded-2xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 text-xs font-bold transition-all flex flex-col items-center gap-1">
            <span>📋</span>
            <span class="text-[10px]">Copiar</span>
          </button>
        </div>

        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 text-left max-w-xl mx-auto pt-2 text-[11px] text-gray-300">
          <div class="p-2 rounded-xl bg-black/40 border border-white/5">1. Abre WhatsApp</div>
          <div class="p-2 rounded-xl bg-black/40 border border-white/5">2. Dispositivos vinculados</div>
          <div class="p-2 rounded-xl bg-black/40 border border-white/5">3. Vincular con código</div>
          <div class="p-2 rounded-xl bg-black/40 border border-white/5">4. Ingresa el código arriba</div>
        </div>
      </div>

      <!-- Formulario para pedir Código -->
      <div class="flex flex-col sm:flex-row gap-2.5 max-w-lg mx-auto">
        <input id="numInput" type="text" placeholder="Número con código de país (Ej: 5219998887766)" class="flex-1 bg-black/60 border border-rose-500/30 rounded-xl px-4 py-2.5 text-xs text-white placeholder-gray-500 font-mono-code focus:outline-none focus:border-rose-500 transition-all">
        <button onclick="requestPairing()" class="px-6 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white shadow-lg shadow-rose-600/30 transition-all whitespace-nowrap">
          Solicitar Código
        </button>
      </div>
    </div>

    <!-- Consola de Registros -->
    <div class="glass-panel rounded-3xl p-6 space-y-3">
      <div class="flex justify-between items-center">
        <h2 class="text-sm font-bold text-rose-200 uppercase tracking-wider flex items-center gap-2">
          💻 Consola del Sistema en Tiempo Real
        </h2>
        <button onclick="clearLogsUI()" class="text-[11px] text-gray-400 hover:text-white px-2 py-1 rounded bg-black/40 border border-white/10">
          Limpiar Consola
        </button>
      </div>

      <div id="logsBox" class="bg-[#07050a] rounded-2xl p-4 h-60 overflow-y-auto font-mono-code text-xs text-gray-300 space-y-1.5 border border-rose-950/60 shadow-inner">
        <p class="text-gray-500">Esperando eventos del sistema...</p>
      </div>
    </div>

  </div>

  <!-- Modal Personalizado para Confirmaciones -->
  <div id="confirmModal" class="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 hidden">
    <div class="glass-panel max-w-sm w-full rounded-3xl p-6 space-y-4 border border-rose-500/40 shadow-2xl">
      <h3 id="modalTitle" class="text-base font-bold text-rose-300">Confirmar Acción</h3>
      <p id="modalMessage" class="text-xs text-gray-300 leading-relaxed">¿Estás seguro de realizar esta acción?</p>
      <div class="flex justify-end gap-2 pt-2">
        <button onclick="closeConfirmModal(false)" class="px-4 py-2 rounded-xl text-xs font-semibold bg-gray-800 hover:bg-gray-700 text-gray-300 transition-all">
          Cancelar
        </button>
        <button id="modalConfirmBtn" onclick="closeConfirmModal(true)" class="px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white shadow-lg shadow-rose-600/30 transition-all">
          Aceptar
        </button>
      </div>
    </div>
  </div>

  <!-- Contenedor de Toasts -->
  <div id="toastContainer" class="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-xs pointer-events-none"></div>

  <script>
    let pendingConfirmAction = null;

    function customConfirm(title, message, onConfirm) {
      document.getElementById('modalTitle').innerText = title;
      document.getElementById('modalMessage').innerText = message;
      pendingConfirmAction = onConfirm;
      document.getElementById('confirmModal').classList.remove('hidden');
    }

    function closeConfirmModal(accepted) {
      document.getElementById('confirmModal').classList.add('hidden');
      if (accepted && typeof pendingConfirmAction === 'function') {
        const action = pendingConfirmAction;
        pendingConfirmAction = null;
        action();
      } else {
        pendingConfirmAction = null;
      }
    }

    function showToast(msg, isError = false) {
      const container = document.getElementById('toastContainer');
      const toast = document.createElement('div');
      toast.className = 'pointer-events-auto p-3.5 rounded-2xl text-xs font-semibold shadow-2xl border flex items-center justify-between gap-3 transition-all ' +
        (isError ? 'border-rose-500/60 text-rose-200 bg-rose-950/90' : 'border-emerald-500/60 text-emerald-200 bg-emerald-950/90');
      toast.innerHTML = '<span>' + msg + '</span><button onclick="this.parentElement.remove()" class="opacity-60 hover:opacity-100 text-sm">✕</button>';
      container.appendChild(toast);
      setTimeout(() => { if (toast.parentElement) toast.remove(); }, 4000);
    }

    function copyCode() {
      const codeVal = document.getElementById('codeValue').innerText.trim();
      if (!codeVal || codeVal === '----') return;
      navigator.clipboard.writeText(codeVal);
      showToast('¡Código copiado al portapapeles!');
      const btn = document.getElementById('copyBtn');
      if (btn) {
        btn.classList.add('text-emerald-300');
        setTimeout(() => btn.classList.remove('text-emerald-300'), 1500);
      }
    }

    function clearLogsUI() {
      document.getElementById('logsBox').innerHTML = '<p class="text-gray-500">Consola limpiada...</p>';
    }

    function toggleSessionUpload() {
      document.getElementById('uploadContainer').classList.toggle('hidden');
    }

    async function uploadCreds() {
      const text = document.getElementById('credsTextarea').value.trim();
      if (!text) return showToast('Por favor pega el contenido JSON de tu creds.json', true);
      try {
        const res = await fetch('/api/upload-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ creds: text })
        });
        const data = await res.json();
        if (data.error) showToast('Error: ' + data.error, true);
        else {
          showToast(data.message || 'Sesión guardada correctamente.');
          document.getElementById('uploadContainer').classList.add('hidden');
          updateStatus();
        }
      } catch (e) {
        showToast('Error al enviar la sesión al servidor.', true);
      }
    }

    async function updateStatus() {
      try {
        const res = await fetch('/api/status');
        const data = await res.json();
        
        const badge = document.getElementById('statusBadge');
        const badgeText = document.getElementById('statusBadgeText');
        const statStatus = document.getElementById('statStatus');
        const headerDot = document.getElementById('headerDot');

        if (data.status === 'online') {
          badge.className = "flex items-center gap-2 px-4 py-2 rounded-full glass-panel text-xs font-semibold text-emerald-300 border-emerald-500/40";
          badgeText.innerText = "Conectado";
          headerDot.className = "absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-400 border-2 border-[#0b0810] shadow-sm shadow-emerald-400";
          statStatus.innerHTML = '<span class="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span> ONLINE';
          statStatus.className = "text-lg font-bold text-emerald-400 mt-2 flex items-center gap-1.5";
        } else if (data.status === 'pairing') {
          badge.className = "flex items-center gap-2 px-4 py-2 rounded-full glass-panel text-xs font-semibold text-amber-300 border-amber-500/40";
          badgeText.innerText = "Esperando Par";
          headerDot.className = "absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-amber-400 border-2 border-[#0b0810]";
          statStatus.innerHTML = '<span class="w-2.5 h-2.5 rounded-full bg-amber-400 animate-bounce"></span> PAIRING';
          statStatus.className = "text-lg font-bold text-amber-400 mt-2 flex items-center gap-1.5";
        } else if (data.status === 'stopped') {
          badge.className = "flex items-center gap-2 px-4 py-2 rounded-full glass-panel text-xs font-semibold text-rose-300 border-rose-500/40";
          badgeText.innerText = "Apagado";
          headerDot.className = "absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-rose-500 border-2 border-[#0b0810]";
          statStatus.innerHTML = '<span class="w-2.5 h-2.5 rounded-full bg-rose-500"></span> APAGADO';
          statStatus.className = "text-lg font-bold text-rose-400 mt-2 flex items-center gap-1.5";
        } else {
          badge.className = "flex items-center gap-2 px-4 py-2 rounded-full glass-panel text-xs font-semibold text-gray-300 border-gray-500/40";
          badgeText.innerText = "Iniciando...";
          headerDot.className = "absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-gray-500 border-2 border-[#0b0810]";
          statStatus.innerHTML = '<span class="w-2.5 h-2.5 rounded-full bg-gray-400"></span> ' + (data.status || 'OFFLINE').toUpperCase();
          statStatus.className = "text-lg font-bold text-rose-300 mt-2 flex items-center gap-1.5";
        }

        document.getElementById('statPlugins').innerText = data.pluginsCount || 0;
        
        const sec = data.uptimeSeconds || 0;
        const mins = Math.floor(sec / 60);
        const hrs = Math.floor(mins / 60);
        document.getElementById('statUptime').innerText = hrs > 0 ? (hrs + 'h ' + (mins%60) + 'm') : (mins + 'm ' + (sec%60) + 's');

        const codeDisplay = document.getElementById('codeDisplay');
        const codeValue = document.getElementById('codeValue');
        const codeForNum = document.getElementById('codeForNum');
        if (data.pairingCode) {
          codeDisplay.classList.remove('hidden');
          codeValue.innerText = data.pairingCode;
          if (codeForNum) {
            codeForNum.innerText = data.pairingNumber ? ('Código generado para +' + data.pairingNumber) : 'Código de Vinculación Generado';
          }
        } else {
          codeDisplay.classList.add('hidden');
        }

        const numInput = document.getElementById('numInput');
        if (data.pairingNumber && numInput && !numInput.value) {
          numInput.value = data.pairingNumber;
        }

        const logsBox = document.getElementById('logsBox');
        if (data.logs && data.logs.length > 0) {
          logsBox.innerHTML = data.logs.map(l => {
            let color = 'text-gray-300';
            if (l.includes('ERROR') || l.includes('fallo')) color = 'text-rose-400';
            else if (l.includes('conectada') || l.includes('exitosa') || l.includes('▶️')) color = 'text-emerald-400';
            else if (l.includes('Reinicio') || l.includes('⏱️')) color = 'text-amber-300';
            return '<div class="' + color + '">' + l + '</div>';
          }).join('');
          logsBox.scrollTop = logsBox.scrollHeight;
        }
      } catch (err) {}
    }

    async function requestPairing() {
      const num = document.getElementById('numInput').value;
      if (!num) return showToast('Por favor ingresa un número de teléfono válido.', true);
      try {
        const res = await fetch('/api/pair', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ number: num })
        });
        const data = await res.json();
        if (data.error) showToast('Error: ' + data.error, true);
        else {
          showToast('Código solicitado exitosamente: ' + data.code);
          updateStatus();
        }
      } catch (e) {
        showToast('Error al conectar con el servidor.', true);
      }
    }

    function stopBotWeb() {
      customConfirm('🛑 Apagar Bot', '¿Deseas apagar el bot temporalmente?', async () => {
        try {
          const res = await fetch('/api/stop', { method: 'POST' });
          const data = await res.json();
          if (data.error) showToast('Error: ' + data.error, true);
          else {
            showToast('Bot apagado temporalmente.');
            updateStatus();
          }
        } catch (e) {
          showToast('Error al apagar el bot.', true);
        }
      });
    }

    async function startBotWeb() {
      try {
        const res = await fetch('/api/start', { method: 'POST' });
        const data = await res.json();
        if (data.error) showToast('Error: ' + data.error, true);
        else {
          showToast('Bot iniciado.');
          updateStatus();
        }
      } catch (e) {
        showToast('Error al encender el bot.', true);
      }
    }

    function repairSession() {
      customConfirm('🔧 Verificar Sesión', '¿Deseas reconectar usando las credenciales existentes? No se eliminarán claves ni tu número.', async () => {
        try {
          const res = await fetch('/api/repair-session', { method: 'POST' });
          const data = await res.json();
          if (data.error) showToast('Error: ' + data.error, true);
          else {
            showToast(data.message || 'Sesión reparada exitosamente.');
            updateStatus();
          }
        } catch (e) {
          showToast('Error al reparar la sesión.', true);
        }
      });
    }

    function resetSession(clean) {
      const title = clean ? '🗑️ Limpiar Sesión' : '⚡ Reconectar';
      const msg = clean 
        ? '¿Estás seguro de que deseas ELIMINAR las credenciales guardadas y empezar de cero?' 
        : '¿Reconectar el bot manteniendo las credenciales actuales?';
      
      customConfirm(title, msg, async () => {
        try {
          const res = await fetch('/api/reset' + (clean ? '?clean=true' : ''), { method: 'POST' });
          const data = await res.json();
          if (data.error) showToast('Error: ' + data.error, true);
          else {
            showToast(data.message || 'Acción ejecutada.');
            updateStatus();
          }
        } catch (e) {
          showToast('Error al procesar la solicitud.', true);
        }
      });
    }

    setInterval(updateStatus, 3000);
    updateStatus();
  </script>
</body>
</html>`);
  });

  server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.log(chalk.yellow(`⚠️ Puerto ${PORT} ya está en uso. Servidor reutilizando socket.`));
    } else {
      console.error(chalk.red(`❌ Error en servidor HTTP:`), err.message);
    }
  });

  server.listen(PORT, "0.0.0.0", () => {
    console.log(chalk.hex("#06ffa5").bold(`🌐 Dashboard web del bot iniciado en http://localhost:${PORT}`));
    addLog(`Servidor Web activo en puerto ${PORT}`);
  });
}

// Iniciar servidor web de inmediato para que el dashboard y preview respondan sin demoras
startWebServer();

// En un primer arranque sin sesión registrada se solicita un código para el número
// configurado. Una sesión ya vinculada se conserva y nunca se reemplaza sola.
async function requestStartupPairingWhenSessionIsMissing() {
  try {
    const { config } = getModule("config") || {};
    if (!config?.usePairingCode || isBotStopped || botState.status === "online" || botState.pairingCode) return;

    const sessionPath = getSessionDir(config);
    if (hasRegisteredSession(sessionPath)) {
      console.log(chalk.cyan("🔐 [SESIÓN] Sesión registrada detectada; se conserva y no se solicitará un código."));
      return;
    }

    const defaultNum = config.botNumber || process.env.BOT_NUMBER || process.env.PHONE_NUMBER;
    if (!defaultNum) {
      console.log(chalk.yellow("ℹ️ [PAIRING] No hay un número configurado; solicita el código desde el dashboard."));
      return;
    }

    console.log(chalk.cyan(`🤖 [PAIRING] No existe una sesión registrada. Solicitando código para +${defaultNum}...`));
    await requestPairingCodeWithRetry(defaultNum);
  } catch (error) {
    console.log(chalk.yellow(`ℹ️ [PAIRING] Esperando acción del dashboard: ${error.message}`));
  }
}

setTimeout(requestStartupPairingWhenSessionIsMissing, 6500);

// ══════════════════════════════════════════════════════════
//   Hot-Reload: Registro de módulos + Watcher
// ══════════════════════════════════════════════════════════

import { loadModule, getModule, refreshModule, startWatcher, stopWatcher } from "./lib/hotReload.js";
import { checkDependencies, setupBinPath } from "./lib/autoInstall.js";
import { startTempCleaner } from "./lib/tempCleaner.js";
import { startKeepAliveSystem, startWsKeepAlive, stopWsKeepAlive } from "./lib/keepAlive.js";

const logger = pino({ level: "silent" });

// Configurar bin/ en PATH para binarios ffmpeg/ffprobe
setupBinPath();

// Iniciar limpiador de temporales y sistema Keep-Alive
startTempCleaner();
startKeepAliveSystem(PORT);

// Auto-instalación asíncrona (descarga binarios faltantes en background)
checkDependencies().catch(err => console.error("Error en checkDependencies:", err.message));

// ══════════════════════════════════════════════════════════
// Store en memoria compatible con Baileys v7
// ══════════════════════════════════════════════════════════

function makeSimpleStore() {
  const messageCache = new Map();
  const MAX_CHATS = 30;
  const MAX_MSGS_PER_CHAT = 15;

  return {
    loadMessage(jid, id) {
      const jidCache = messageCache.get(jid);
      if (!jidCache) return Promise.resolve(undefined);
      return Promise.resolve(jidCache.get(id) || undefined);
    },
    bind(ev) {
      ev.on("messages.upsert", ({ messages }) => {
        for (const m of messages) {
          const jid = m.key.remoteJid;
          if (!jid) continue;
          if (!messageCache.has(jid)) {
            if (messageCache.size >= MAX_CHATS) {
              const firstKey = messageCache.keys().next().value;
              messageCache.delete(firstKey);
            }
            messageCache.set(jid, new Map());
          }
          const chatMap = messageCache.get(jid);
          if (chatMap.size >= MAX_MSGS_PER_CHAT) {
            const oldestKey = chatMap.keys().next().value;
            chatMap.delete(oldestKey);
          }
          chatMap.set(m.key.id, m);
        }
      });
      ev.on("messages.delete", ({ keys }) => {
        for (const k of keys) {
          const jidCache = messageCache.get(k.remoteJid);
          if (jidCache) jidCache.delete(k.id);
        }
      });
    },
  };
}

// Limpieza periódica de basura en V8 (si está habilitado --expose-gc)
setInterval(() => {
  if (global.gc) {
    try { global.gc(); } catch (e) {}
  }
}, 10 * 60 * 1000);

const store = makeSimpleStore();

// ══════════════════════════════════════════════════════════
// Banner de inicio
// ══════════════════════════════════════════════════════════

function printBanner() {
  const c = (hex) => chalk.hex(hex).bold;
  const pink = "#ff4d9d";
  const hotPink = "#ff006e";
  const orange = "#fb5607";
  const yellow = "#ffbe0b";
  const purple = "#8338ec";
  const blue = "#3a86ff";
  const cyan = "#06ffd5";
  const green = "#06ffa5";
  const red = "#e63946";

  const lines = [
    "",
    c(pink)("  ╔══════════════════════════════════════════════════════════╗"),
    c(pink)("  ║") + c(hotPink)("  ░▒▓▆▇█▓▒░  KURUMI TOKISAKI BOT  ░▒▓▆▇█▓▒░          ") + c(pink)("║"),
    c(pink)("  ║") + c(orange)("  ✦  ·  *  ·  ✦  ·  *  ·  ✦  ·  *  ·  ✦  ·  *  ·  ✦   ") + c(pink)("║"),
    c(pink)("  ║") + c(yellow)("  ╭─────────────────────────────────────────────────╮     ") + c(pink)("║"),
    c(pink)("  ║") + c(yellow)("  │  ") + c(purple)("🌸 Spirit of Time — WhatsApp AI Bot            ") + c(yellow)("│     ") + c(pink)("║"),
    c(pink)("  ║") + c(yellow)("  │  ") + c(blue)("⚡ Sistema RPG · Waifus · NSFW · IA             ") + c(yellow)("│     ") + c(pink)("║"),
    c(pink)("  ║") + c(yellow)("  │  ") + c(green)("👤 Creador: «[×𝐹ɾαɳƈιʂƈσ×]»                  ") + c(yellow)("│     ") + c(pink)("║"),
    c(pink)("  ║") + c(yellow)("  │  ") + c(cyan)("📱 +52 985 227 0023                            ") + c(yellow)("│     ") + c(pink)("║"),
    c(pink)("  ║") + c(yellow)("  │  ") + c(red)("🏷️  Versión: 5.0.0 — APIs 2026                  ") + c(yellow)("│     ") + c(pink)("║"),
    c(pink)("  ║") + c(yellow)("  ╰─────────────────────────────────────────────────╯     ") + c(pink)("║"),
    c(pink)("  ║") + c(hotPink)("  ◤━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━◥     ") + c(pink)("║"),
    c(pink)("  ║") + c(purple)("     ⏰  「 Tiempo detenido, comandos en marcha 」       ") + c(pink)("║"),
    c(pink)("  ║") + c(hotPink)("  ◣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━◢     ") + c(pink)("║"),
    c(pink)("  ╚══════════════════════════════════════════════════════════╝"),
    "",
    c(green)("  ▸▲▸ ") + c(cyan)("Inicializando sistema de mensajería Baileys v7..."),
    c(green)("  ▸▲▸ ") + c(cyan)("Cargando módulos al registry (hot-reloadable)..."),
    c(green)("  ▸▲▸ ") + c(cyan)("Cargando plugins y dependencias..."),
    c(green)("  ▸▲▸ ") + c(cyan)("Configurando reportes de error automáticos..."),
    c(green)("  ▸▲▸ ") + c(cyan)("Activando sistema RPG y economía..."),
    "",
    c(yellow)("  ┌─[ ") + c(red)("STATUS") + c(yellow)(" ]────────────────────────────────────┐"),
    c(yellow)("  │ ") + c(green)("●") + c(yellow)(" ONLINE  ") + c(blue)("●") + c(yellow)(" READY  ") + c(purple)("●") + c(yellow)(" HOT-RELOAD                        │"),
    c(yellow)("  └─────────────────────────────────────────────┘"),
    "",
  ];
  console.log(lines.join("\n"));
}

// ══════════════════════════════════════════════════════════
// Sanitización y Reparación de Sesión (Bad MAC / Pre-Key fix)
// ══════════════════════════════════════════════════════════

function sanitizeSessionFolder(sessionDir) {
  if (!fs.existsSync(sessionDir)) return;

  // Las credenciales y las claves de Baileys forman un conjunto. Eliminar pre-keys
  // "antiguas" en cada arranque puede invalidar una sesión perfectamente válida.
  // Solo se informa de archivos corruptos; nunca se borran automáticamente.
  try {
    const invalidFiles = [];
    for (const file of fs.readdirSync(sessionDir)) {
      const filePath = path.join(sessionDir, file);
      const stat = fs.statSync(filePath);
      if (!stat.isFile() || !file.endsWith('.json')) continue;

      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        JSON.parse(content);
      } catch (error) {
        invalidFiles.push(file);
      }
    }

    if (invalidFiles.length > 0) {
      console.warn(chalk.yellow(`⚠️ [SESIÓN] Se detectaron ${invalidFiles.length} archivo(s) de sesión no válidos. No se eliminaron automáticamente para proteger la vinculación actual.`));
      addLog(`⚠️ Sesión: ${invalidFiles.length} archivo(s) requiere(n) revisión manual; las credenciales se preservaron.`);
    }
  } catch (error) {
    console.error('Error al verificar carpeta de sesión:', error.message);
  }
}

function repairSessionKeys(sessionDir) {
  // Conserva todas las claves. La reparación segura consiste en reconectar usando
  // el estado almacenado; destruir claves causa una nueva vinculación innecesaria.
  if (!fs.existsSync(sessionDir)) return 0;
  return 0;
}

let isAppInitialized = false;

async function initApp() {
  if (isAppInitialized) return;
  isAppInitialized = true;

  printBanner();

  console.log(chalk.hex("#3a86ff")("📦 Cargando módulos al registry..."));

  await loadModule("config",       "./config/settings.js");
  await loadModule("db",           "./lib/database.js");
  await loadModule("msg",          "./lib/messages.js");
  await loadModule("pluginLoader", "./lib/pluginLoader.js");
  await loadModule("error",        "./lib/errorReporter.js");
  await loadModule("utils",        "./lib/utils.js");
  await loadModule("cron",         "./lib/cron.js");
  await loadModule("ia",           "./plugins/ia.js");
  await loadModule("groupHandler", "./lib/groupHandler.js");
  await loadModule("handler",      "./handler.js");

  console.log(chalk.hex("#06ffa5").bold("✅ Registry cargado — todos los módulos son hot-reloadable"));

  const { initDatabase } = getModule("db");
  const { loadPlugins } = getModule("pluginLoader");
  const { startCronJobs } = getModule("cron");

  initDatabase();
  await loadPlugins();
  startCronJobs();
  startTempCleaner();

  // Iniciar Hot-Reload Watcher una sola vez
  const { config } = getModule("config");
  if (config.hotReload !== false) {
    console.log(chalk.hex("#3a86ff")("🔥 Iniciando sistema de Hot-Reload..."));
    stopWatcher();
    const shouldNotify = config.hotReloadNotify;

    startWatcher({
      onPluginChange: async (filename) => {
        const { loadPlugins: reloadPlugins } = getModule("pluginLoader");
        await reloadPlugins();
        if (filename === "ia.js") {
          try { await refreshModule("ia"); } catch (e) {}
        }
        console.log(chalk.hex("#06ffa5")(`✅ Plugins recargados (cambio: plugins/${filename})`));

        if (shouldNotify && globalConn) {
          try {
            await globalConn.sendMessage(config.owner[0] + "@s.whatsapp.net", {
              text: `🔥 *Hot-Reload — Plugin*\n${"─".repeat(23)}\n` +
                    `Archivo: *plugins/${filename}*\n` +
                    `✅ Comandos recargados en tiempo real.\n` +
                    `No necesitas reiniciar el bot.`
            });
          } catch (e) {}
        }
      },
      onLibChange: async (filename) => {
        console.log(chalk.hex("#06ffa5")(`✅ Módulo lib/${filename} recargado en tiempo real`));
      },
      onConfigChange: async (filename) => {
        console.log(chalk.hex("#06ffa5")(`✅ Config ${filename} recargado en tiempo real`));
      },
      onRootChange: async (filename) => {
        console.log(chalk.hex("#ff006e")(`⚠️  ${filename} requiere reinicio manual`));
      },
      notifyOwner: shouldNotify ? async (message) => {
        if (!globalConn) return;
        try {
          await globalConn.sendMessage(config.owner[0] + "@s.whatsapp.net", { text: message });
        } catch (e) {
          console.error("Error notificando owner:", e.message);
        }
      } : null,
    });
  }
}

async function createWASocketConnection() {
  await initApp();

  const socketId = ++currentSocketId;

  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  const { config } = getModule("config");
  const { setCronConnection } = getModule("cron");
  const { setErrorReporterConnection } = getModule("error");

  // Desconectar socket anterior si existe
  if (globalConn) {
    const oldConn = globalConn;
    globalConn = null;
    try {
      oldConn.ev.removeAllListeners();
      oldConn.ws?.close?.();
      oldConn.ws?.terminate?.();
      oldConn.end?.();
    } catch (e) {}
    await new Promise(r => setTimeout(r, 500));
  }

  const sessionDir = getSessionDir(config);
  if (!fs.existsSync(sessionDir)) fs.mkdirSync(sessionDir, { recursive: true });

  sanitizeSessionFolder(sessionDir);

  const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
  let version = [2, 3000, 1043857760];
  try {
    const v = await fetchLatestBaileysVersion();
    if (v && v.version) version = v.version;
  } catch (err) {
    console.log(chalk.yellow("⚠️ Usando versión por defecto de Baileys."));
  }

  const safeKeys = {
    get: async (type, ids) => {
      try {
        return await state.keys.get(type, ids);
      } catch (err) {
        console.warn(chalk.yellow(`⚠️ [SESIÓN] Error leyendo clave (${type}): ${err.message}. Sanitizando...`));
        for (const id of ids) {
          const pkPath = path.join(sessionDir, `${type}-${id}.json`);
          try { if (fs.existsSync(pkPath)) fs.unlinkSync(pkPath); } catch (e) {}
        }
        return {};
      }
    },
    set: async (data) => {
      try {
        await state.keys.set(data);
      } catch (err) {
        console.warn(chalk.yellow(`⚠️ [SESIÓN] Error guardando clave: ${err.message}`));
      }
    }
  };

  const msgRetryCounterCache = new Map();

  const { groupMetadataCache } = await import("./lib/utils.js");

  const conn = makeWASocket({
    version,
    logger,
    printQRInTerminal: !config.usePairingCode,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(safeKeys, logger),
    },
    msgRetryCounterCache,
    cachedGroupMetadata: async (jid) => groupMetadataCache.get(jid)?.metadata,
    browser: ["Ubuntu", "Chrome", "20.0.04"],
    connectTimeoutMs: 60000,
    keepAliveIntervalMs: 10000,
    defaultQueryTimeoutMs: 60000,
    retryRequestDelayMs: 200,
    maxMsgRetryCount: 5,
    markOnlineOnConnect: false,
    generateHighQualityLinkPreview: false,
    syncFullHistory: false,
    downloadHistory: false,
    fireInitQueries: false,
    shouldSyncHistoryMessage: () => false,
    getMessage: async (key) => {
      if (store) {
        const msg = await store.loadMessage(key.remoteJid, key.id);
        return msg?.message || undefined;
      }
      return proto.Message.fromObject({});
    },
  });

  globalConn = conn;
  store?.bind(conn.ev);
  setErrorReporterConnection(conn);

  if (config.usePairingCode && !conn.authState.creds.registered) {
    botState.status = "pairing";
    if (botState.pairingCode && botState.pairingNumber) {
      addLog(`Código de vinculación activo para +${botState.pairingNumber}: ${botState.pairingCode}`);
    }
  }

  conn.ev.on("connection.update", async (update) => {
    if (socketId !== currentSocketId || (globalConn && globalConn !== conn)) return;

    const { connection, lastDisconnect, qr } = update;

    if (qr && !config.usePairingCode) {
      const c = (hex) => chalk.hex(hex).bold;
      console.log("");
      console.log(c("#3a86ff")("  ╔══════════════════════════════════════╗"));
      console.log(c("#3a86ff")("  ║") + c("#ffbe0b")("  📱 ESCANEA EL CÓDIGO QR CON WHATSAPP ") + c("#3a86ff")("║"));
      console.log(c("#3a86ff")("  ╚══════════════════════════════════════╝"));
      console.log("");
    }

    if (connection === "close") {
      stopWsKeepAlive();
      if (isBotStopped) {
        botState.status = "stopped";
        return;
      }
      botState.status = "offline";
      const error = lastDisconnect?.error;
      const statusCode = (error instanceof Boom)
        ? error.output?.statusCode
        : (error?.output?.statusCode || error?.statusCode || error?.code);
      const reasonMsg = error?.message || "Desconocido";

      const isLoggedOut = statusCode === DisconnectReason.loggedOut || statusCode === 401 || statusCode === 403 || statusCode === 405;
      const isReplaced = statusCode === DisconnectReason.connectionReplaced || statusCode === 440;
      const isRestartRequired = statusCode === DisconnectReason.restartRequired || statusCode === 515;
      const isBadSession = statusCode === DisconnectReason.badSession || statusCode === 500;

      if (isLoggedOut || isBadSession) {
        const cause = isLoggedOut
          ? `WhatsApp rechazó la sesión actual (Código: ${statusCode || 401})`
          : `WhatsApp informó un estado de sesión no válido (Código: ${statusCode})`;

        botState.pairingCode = null;
        botState.pairingNumber = null;
        botState.status = "offline";
        botState.lastError = cause;
        consecutiveDisconnects = 0;

        if (reconnectTimer) {
          clearTimeout(reconnectTimer);
          reconnectTimer = null;
        }

        // El 401 es una revocación confirmada por WhatsApp, no una desconexión
        // transitoria. Guardamos la sesión intacta en una copia y creamos una
        // carpeta nueva para que el código se solicite automáticamente.
        if (statusCode === 401 || statusCode === DisconnectReason.loggedOut) {
          const backupPath = quarantineRevokedSession(sessionDir);
          if (backupPath) {
            botState.status = "pairing";
            console.log(chalk.yellow(`⚠️ ${cause}. Sesión revocada respaldada; se solicitará un código nuevo.`));
            addLog(`⚠️ ${cause}. Se creó una copia de respaldo de la sesión revocada y se solicitará un nuevo código.`);
            setTimeout(requestStartupPairingWhenSessionIsMissing, 1000);
            return;
          }
        }

        console.log(chalk.yellow(`⚠️ ${cause}. Las credenciales se conservaron; no se solicitará un código automáticamente.`));
        addLog(`⚠️ ${cause}. Credenciales preservadas. Usa «Reconectar»; solo limpia y vincula de nuevo si confirmas que la sesión ya no es válida.`);
      } else if (isReplaced) {
        if (reconnectTimer) {
          clearTimeout(reconnectTimer);
          reconnectTimer = null;
        }
        botState.status = "offline";
        botState.lastError = "Conexión reemplazada (Código 440): Se detectó otra sesión activa en este número.";
        addLog(`⚠️ Conexión reemplazada (Código 440). Reconexión automática detenida.`);
      } else if (isRestartRequired) {
        addLog(`🔄 Reinicio de flujo solicitado por WhatsApp (Código 515). Reconectando...`);
        scheduleReconnect(1000, "Reinicio de flujo (515)");
      } else {
        consecutiveDisconnects++;
        const delay = Math.min(2500 * consecutiveDisconnects, 15000);
        addLog(`⚠️ Conexión cerrada (${statusCode || 'desconocido'}). Reconectando en ${(delay/1000).toFixed(1)}s (intento ${consecutiveDisconnects})...`);
        scheduleReconnect(delay, `Reintento ${consecutiveDisconnects}`);
      }
    }

    if (connection === "open") {
      botState.status = "online";
      botState.pairingCode = null;
      botState.lastError = null;
      consecutiveDisconnects = 0;

      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }

      startWsKeepAlive(conn);

      botState.pluginsCount = Object.keys(globalThis.plugins || {}).length || 124;
      addLog("¡Kurumi Tokisaki está conectada y lista en WhatsApp!");
      setCronConnection(conn);

      const c = (hex) => chalk.hex(hex).bold;
      console.log(c("#06ffa5")("\n🌸 ✨ ¡KURUMI TOKISAKI ESTÁ EN LÍNEA! ✨ 🌸\n"));

      try {
        const ownerJid = config.owner[0] + "@s.whatsapp.net";
        await conn.sendMessage(ownerJid, {
          text: `╭──「 🌸 *SISTEMA ONLINE* 」──╮\n${"─".repeat(23)}\n┃ 🌸 *Kurumi Tokisaki* está lista.\n┃ ✨ Versión: *${config.version}*\n┃ 🔥 Hot-Reload: *Activo*\n┃ ✅ ¡Lista para servirte!\n╰──────────────────────╯`
        });
      } catch (e) {}
    }
  });

  conn.ev.on("creds.update", saveCreds);

  conn.ev.on("group-participants.update", async (update) => {
    try {
      const { handleGroupParticipantsUpdate } = getModule("groupHandler");
      await handleGroupParticipantsUpdate(conn, update);
    } catch (err) {
      console.error(chalk.red("❌ Error en group-participants.update:"), err);
    }
  });

  conn.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;
    for (const m of messages) {
      if (!m.message) continue;

      // Nunca volver a procesar mensajes enviados por esta misma cuenta.
      // Las acciones internas de IA se invocan directamente y no pasan por este evento.
      if (m.key?.fromMe) continue;

      // Lectura en tiempo real (Marcar mensaje como leído / Palomitas azules)
      try {
        const { config: cfg } = getModule("config") || {};
        if (cfg?.autoRead !== false && !m.key.fromMe && typeof conn.readMessages === "function") {
          conn.readMessages([m.key]).catch(() => null);
        }
      } catch (e) {}

      (async () => {
        try {
          const { handleMessage } = getModule("handler");
          await handleMessage(conn, m, store);
        } catch (err) {
          const errMsg = err?.message || String(err);
          if (errMsg.includes("Bad MAC") || errMsg.includes("Failed to decrypt")) {
            console.warn(chalk.yellow("⚠️ [SESIÓN] Error de descifrado en mensaje (Bad MAC). Omitido."));
          } else {
            console.error(chalk.red("❌ Error procesando mensaje:"), err);
          }
        }
      })();
    }
  });

  return conn;
}

async function startBot() {
  await createWASocketConnection();
}

async function safeStartBot() {
  if (isBotStopped) {
    console.log(chalk.yellow("🛑 safeStartBot omitido: El bot está apagado temporalmente."));
    return;
  }
  if (isStartingBot) return;
  isStartingBot = true;

  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  try {
    await startBot();
  } catch (err) {
    botState.lastError = err.message;
    console.error(chalk.red("❌ Error en la inicialización del bot:"), err.message);
    if (typeof addLog === "function") addLog(`[ERROR INICIO] ${err.message}. Reintentando en 10s...`);
    scheduleReconnect(10000, "Error en inicialización de startBot");
  } finally {
    isStartingBot = false;
  }
}

// Iniciar el bot de forma segura al arrancar
safeStartBot();
