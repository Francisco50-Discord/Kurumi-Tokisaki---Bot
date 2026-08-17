// ============================================================
//   Kurumi Tokisaki - Plantillas de Mensajes v3.0 (Estilo 3 Japanese)
// ============================================================

import { config } from "../config/settings.js";

export function header(title, icon = "🌸") {
  let cleanTitle = typeof title === "string" ? title.trim() : String(title || "").trim();
  if (cleanTitle.length > 18) {
    cleanTitle = cleanTitle.slice(0, 17) + "…";
  }

  const iconStr = icon ? `${icon} ` : "";
  const fullTitle = `${iconStr}${cleanTitle.toUpperCase()}`;
  
  // Adapt dash length dynamically so total line fits within 16-20 chars on mobile viewports
  const dashes = fullTitle.length > 8 ? "━" : "━━";
  return `✦${dashes}【 ${fullTitle} 】${dashes}✦`;
}

export function footer() {
  return `✦ *${config.botName}* v${config.version}`;
}

export function error(message) {
  return `${header("ERROR", "❌")}\n\n${message}`;
}

export function warning(message) {
  return `${header("ADVERTENCIA", "⚠️")}\n\n${message}`;
}

export function success(title, body = "") {
  return `${header(title, "✅")}\n\n${body}`;
}

// Mensajes de carga / procesamiento
const loadingMessages = [
  "⏳ *Procesando tu solicitud...*\n🌸 Déjame encargarme~",
  "⏳ *Un momento, por favor...*\n🌸 Kurumi está trabajando en ello~",
  "⏳ *Procesando...*\n🌸 Enseguida está listo~",
];

export function getKurumiLoadingMsg() {
  return loadingMessages[Math.floor(Math.random() * loadingMessages.length)];
}

export default {
  header,
  footer,
  error,
  warning,
  success,
  getKurumiLoadingMsg,
};
