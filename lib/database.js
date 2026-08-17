// ============================================================
//   Kurumi Tokisaki - Sistema de Base de Datos (JSON Database)
//   Persistencia robusta con backups automáticos y auto-recuperación
// ============================================================

import fs from "fs-extra";
import path from "path";
import { config } from "../config/settings.js";
import { normalizeJid, areJidsEqual, groupMetadataCache } from "./utils.js";

// Estructura inicial de la base de datos
const initialData = {
  users: {},
  groups: {},
  cooldowns: {},
  ai_history: {},
  reminders: [],
  battles: [],
  waifus: {},
  inventory: {},
  settings: {
    menuStyle: 1,
    msgStyle: 1
  }
};

// Rutas de archivos JSON y backups
const DB_PATH = path.resolve(config.dbPath || path.join(process.cwd(), "data", "database.json"));
const DB_PATH_BAK = DB_PATH + ".bak";
const BACKUPS_DIR = path.join(path.dirname(DB_PATH), "backups");

// Asegurar que existan directorios de datos
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
if (!fs.existsSync(BACKUPS_DIR)) {
  fs.mkdirSync(BACKUPS_DIR, { recursive: true });
}

// Objeto global PERSISTENTE que sobrevive a los Hot-Reloads (ESM cache busting)
if (!globalThis.__KURUMI_DB__) {
  globalThis.__KURUMI_DB__ = { ...initialData };
}
let db = globalThis.__KURUMI_DB__;

// ============================================================
// Funciones de persistencia y auto-recuperación
// ============================================================

/**
 * Intenta cargar un archivo JSON de forma segura. Retorna null si falla o está vacío.
 */
function safeReadJson(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    const stats = fs.statSync(filePath);
    if (stats.size === 0) return null;
    const data = fs.readJsonSync(filePath);
    if (data && typeof data === "object") return data;
  } catch (e) {
    console.warn(`⚠️ [DB] No se pudo leer JSON de ${filePath}: ${e.message}`);
  }
  return null;
}

/**
 * Buscar la última copia de respaldo válida en /data/backups/
 */
function findLatestBackup() {
  try {
    if (!fs.existsSync(BACKUPS_DIR)) return null;
    const files = fs.readdirSync(BACKUPS_DIR)
      .filter(f => f.endsWith(".json"))
      .sort((a, b) => b.localeCompare(a)); // Orden descendente por nombre (fecha)
    
    for (const file of files) {
      const backupPath = path.join(BACKUPS_DIR, file);
      const data = safeReadJson(backupPath);
      if (data) return { data, path: backupPath };
    }
  } catch (e) {}
  return null;
}

// Cargar base de datos con auto-recuperación desde backups
export function initDatabase() {
  try {
    let loadedData = safeReadJson(DB_PATH);
    let loadedSource = "principal";

    // Si el principal falló o no existe, intentar .bak
    if (!loadedData) {
      console.warn("⚠️ [DB] Intentando recuperar desde archivo de respaldo database.json.bak...");
      loadedData = safeReadJson(DB_PATH_BAK);
      loadedSource = "bak";
    }

    // Si .bak también falló, intentar buscar en /data/backups/
    if (!loadedData) {
      console.warn("⚠️ [DB] Intentando recuperar desde historial de respaldos en /data/backups/...");
      const latest = findLatestBackup();
      if (latest) {
        loadedData = latest.data;
        loadedSource = latest.path;
      }
    }

    if (loadedData) {
      // Fusionar manteniendo el objeto global original en memoria
      Object.keys(initialData).forEach(key => {
        if (!loadedData[key]) loadedData[key] = Array.isArray(initialData[key]) ? [] : {};
      });
      
      // Actualizar el singleton global sin perder la referencia
      Object.assign(globalThis.__KURUMI_DB__, loadedData);
      db = globalThis.__KURUMI_DB__;
      console.log(`✅ Base de datos JSON cargada correctamente (Fuente: ${loadedSource})`);

      // Si se recuperó de un backup, guardar inmediatamente como principal para restaurarlo
      if (loadedSource !== "principal") {
        saveDatabaseNow();
      }
    } else {
      console.log("ℹ️ Base de datos no encontrada. Creando base de datos inicial...");
      saveDatabaseNow();
    }
  } catch (e) {
    console.error("❌ Error grave al cargar base de datos:", e);
  }
}

// Guardar base de datos inmediatamente (sincrónico y atómico)
export function saveDatabaseNow() {
  try {
    if (saveTimeout) {
      clearTimeout(saveTimeout);
      saveTimeout = null;
    }

    // No guardar si db está vacío o sin claves iniciales para prevenir sobreescritura accidental
    if (!db || typeof db !== "object" || !db.users) return;

    const tmpPath = DB_PATH + ".tmp";
    const jsonStr = JSON.stringify(db);
    fs.writeFileSync(tmpPath, jsonStr, "utf8");
    fs.renameSync(tmpPath, DB_PATH);

    // Crear o actualizar copia de respaldo rápida .bak
    try { fs.copyFileSync(DB_PATH, DB_PATH_BAK); } catch (e) {}

    // Guardar una copia diaria/periódica en /data/backups/ si es necesario
    createPeriodicBackup();
  } catch (e) {
    console.error("❌ Error al guardar base de datos en disco:", e);
  }
}

let lastBackupTime = 0;
function createPeriodicBackup() {
  const now = Date.now();
  // Crear backup periódico máximo una vez cada 6 horas
  if (now - lastBackupTime < 6 * 3600 * 1000) return;
  lastBackupTime = now;

  try {
    const dateStr = new Date().toISOString().replace(/:/g, "-").slice(0, 19);
    const backupFile = path.join(BACKUPS_DIR, `database_${dateStr}.json`);
    fs.copySync(DB_PATH, backupFile);

    // Mantener solo los últimos 10 respaldos periódicos
    const files = fs.readdirSync(BACKUPS_DIR)
      .filter(f => f.endsWith(".json"))
      .sort((a, b) => a.localeCompare(b)); // Orden ascendente (más antiguos primero)
    
    while (files.length > 10) {
      const oldFile = files.shift();
      try { fs.unlinkSync(path.join(BACKUPS_DIR, oldFile)); } catch (e) {}
    }
  } catch (e) {}
}

// Guardar base de datos con debounce de 500ms
let saveTimeout = null;
export function saveDatabase() {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    saveDatabaseNow();
  }, 500);
}

// Auto-inicializar al importar el módulo si la BD no está cargada aún
if (Object.keys(globalThis.__KURUMI_DB__.users).length === 0 && fs.existsSync(DB_PATH)) {
  initDatabase();
}

// Handlers para guardar la base de datos al apagar o reiniciar el proceso
let exitHandled = false;
const handleProcessExit = () => {
  if (exitHandled) return;
  exitHandled = true;
  console.log("💾 Guardando base de datos antes de finalizar...");
  saveDatabaseNow();
};

process.once("beforeExit", handleProcessExit);
process.once("SIGINT", handleProcessExit);
process.once("SIGTERM", handleProcessExit);

// ============================================================
// Funciones de usuario
// ============================================================

function getBestName(n1, n2) {
  if (n1 && n1 !== "Usuario" && !/^\d+$/.test(n1)) return n1;
  if (n2 && n2 !== "Usuario" && !/^\d+$/.test(n2)) return n2;
  return n1 || n2 || "Usuario";
}

export function resolveCanonicalJid(jid, groupParticipants = []) {
  if (!jid) return jid;
  const norm = normalizeJid(jid);
  const inputNum = norm.split("@")[0].replace(/[^0-9]/g, "");

  const findPhoneJidInParts = (parts) => {
    if (!Array.isArray(parts) || parts.length === 0) return null;
    for (const p of parts) {
      if (!p) continue;
      const pLid = p.lid ? normalizeJid(p.lid) : "";
      const pLidNum = pLid.split("@")[0].replace(/[^0-9]/g, "");
      const pId = p.id ? normalizeJid(p.id) : "";
      const pIdNum = pId.split("@")[0].replace(/[^0-9]/g, "");
      const pPn = p.pn ? normalizeJid(p.pn) : (p.idAlt ? normalizeJid(p.idAlt) : "");
      const pPnNum = pPn.split("@")[0].replace(/[^0-9]/g, "");

      if ((pLid && (pLid === norm || pLidNum === inputNum)) ||
          (pId && (pId === norm || pIdNum === inputNum)) ||
          (pPn && (pPn === norm || pPnNum === inputNum))) {
        const candidates = [p.pn, p.idAlt, p.id, p.jid].filter(Boolean);
        for (const cand of candidates) {
          const normCand = normalizeJid(cand);
          if (!normCand.endsWith("@lid") && normCand.endsWith("@s.whatsapp.net")) {
            const candNum = normCand.split("@")[0].replace(/[^0-9]/g, "");
            if (pLidNum && candNum === pLidNum) continue;
            return normCand;
          }
        }
      }
    }
    return null;
  };

  // 1. Buscar en groupParticipants
  const fromGroup = findPhoneJidInParts(groupParticipants);
  if (fromGroup) return fromGroup;

  // 2. Buscar en groupMetadataCache
  if (typeof groupMetadataCache !== "undefined" && groupMetadataCache.size > 0) {
    for (const entry of groupMetadataCache.values()) {
      const fromCache = findPhoneJidInParts(entry?.metadata?.participants);
      if (fromCache) return fromCache;
    }
  }

  // 3. Buscar en db.users por coincidencia de JID equivalente
  if (db.users) {
    for (const k of Object.keys(db.users)) {
      const normK = normalizeJid(k);
      if (normK.endsWith("@s.whatsapp.net") && areJidsEqual(normK, norm, groupParticipants)) {
        return normK;
      }
    }
  }

  return norm;
}

export function cleanupAndMergeUsers(groupParticipants = []) {
  if (!db.users) return new Map();

  const entries = Object.entries(db.users);
  const map = new Map();

  for (const [rawKey, user] of entries) {
    if (!user || user.banned) continue;

    const normKey = normalizeJid(rawKey);
    const resolvedJid = resolveCanonicalJid(normKey, groupParticipants);

    let matchedTargetKey = null;
    for (const existingKey of map.keys()) {
      if (
        existingKey === resolvedJid ||
        areJidsEqual(existingKey, resolvedJid, groupParticipants) ||
        areJidsEqual(existingKey, normKey, groupParticipants)
      ) {
        matchedTargetKey = existingKey;
        break;
      }
    }

    let bestKey = resolvedJid;
    if (matchedTargetKey) {
      if (matchedTargetKey.endsWith("@s.whatsapp.net")) {
        bestKey = matchedTargetKey;
      } else if (resolvedJid.endsWith("@s.whatsapp.net")) {
        bestKey = resolvedJid;
      } else {
        bestKey = matchedTargetKey;
      }
    }

    const existingData = map.get(matchedTargetKey) || map.get(bestKey) || {};
    const merged = {
      ...existingData,
      ...user,
      id: bestKey,
      coins: Math.max(existingData.coins || 0, user.coins || 0),
      level: Math.max(existingData.level || 1, user.level || 1),
      exp: Math.max(existingData.exp || 0, user.exp || 0),
      wins: Math.max(existingData.wins || 0, user.wins || 0),
      gems: Math.max(existingData.gems || 0, user.gems || 0),
      total_commands: Math.max(existingData.total_commands || 0, user.total_commands || 0),
      registered: existingData.registered || user.registered,
      name: getBestName(existingData.name, user.name)
    };

    if (matchedTargetKey && matchedTargetKey !== bestKey) {
      map.delete(matchedTargetKey);
      if (db.users[matchedTargetKey]) {
        delete db.users[matchedTargetKey];
      }
    }

    if (rawKey !== bestKey && db.users[rawKey]) {
      delete db.users[rawKey];
    }

    map.set(bestKey, merged);
  }

  for (const [k, v] of map.entries()) {
    db.users[k] = v;
  }
  saveDatabase();

  return map;
}

export function getUser(userId, groupParticipants = []) {
  if (!userId) return null;
  const normId = normalizeJid(userId);
  const canonicalJid = resolveCanonicalJid(normId, groupParticipants);

  // La normalización global se ejecuta solo en operaciones administrativas,
  // no por cada mensaje. Así se evitan recorridos y escrituras de toda la base.

  let targetJid = canonicalJid;
  if (!targetJid.endsWith("@s.whatsapp.net")) {
    const foundNetKey = Object.keys(db.users).find(k => k.endsWith("@s.whatsapp.net") && areJidsEqual(k, targetJid, groupParticipants));
    if (foundNetKey) targetJid = foundNetKey;
  }

  if (userId !== targetJid && db.users[userId]) {
    const existingTarget = db.users[targetJid] || {};
    db.users[targetJid] = {
      ...existingTarget,
      ...db.users[userId],
      id: targetJid,
      coins: Math.max(existingTarget.coins || 0, db.users[userId].coins || 0),
      level: Math.max(existingTarget.level || 1, db.users[userId].level || 1),
      exp: Math.max(existingTarget.exp || 0, db.users[userId].exp || 0),
      wins: Math.max(existingTarget.wins || 0, db.users[userId].wins || 0),
      gems: Math.max(existingTarget.gems || 0, db.users[userId].gems || 0),
      total_commands: Math.max(existingTarget.total_commands || 0, db.users[userId].total_commands || 0),
      name: getBestName(existingTarget.name, db.users[userId].name)
    };
    if (userId !== targetJid) {
      delete db.users[userId];
    }
    saveDatabase();
  }

  if (!db.users[targetJid]) {
    db.users[targetJid] = {
      id: targetJid,
      name: "Usuario",
      level: 1,
      exp: 0,
      coins: 100,
      gems: 0,
      health: 100,
      max_health: 100,
      attack: 10,
      defense: 5,
      speed: 10,
      stamina: 100,
      max_stamina: 100,
      class: "Novato",
      waifu: null,
      daily_streak: 0,
      last_daily: null,
      last_work: null,
      last_rob: null,
      last_crime: null,
      last_fish: null,
      last_mine: null,
      last_hunt: null,
      wins: 0,
      losses: 0,
      total_commands: 0,
      banned: 0,
      premium: 0,
      registered: false,
      registered_at: null,
      ai_personality: "asistente",
      // Modo temporal: la IA privada requiere activación explícita con /ia on.
      ai_command_enabled: 0,
      // El contenido NSFW en privado es opt-in por usuario.
      nsfw: false,
      memories: {}
    };
    saveDatabase();
  } else {
    // Auto-curar usuarios que tenían progreso previo antes del fix
    const u = db.users[targetJid];
    if (!u.memories) u.memories = {};
    if (!u.registered && (u.level > 1 || (u.total_commands || 0) > 5)) {
      u.registered = true;
      saveDatabase();
    }
  }

  return db.users[targetJid];
}

// ============================================================
// Funciones de Memoria Persistente de IA (Memory System)
// ============================================================

export function getUserMemories(userId) {
  if (!userId) return {};
  const normId = normalizeJid(userId);
  const user = getUser(normId);
  return user?.memories || {};
}

export function setUserMemory(userId, key, value) {
  if (!userId || !key) return;
  const normId = normalizeJid(userId);
  const user = getUser(normId);
  if (!user.memories) user.memories = {};
  const normKey = key.toLowerCase().trim();
  user.memories[normKey] = {
    key: key.trim(),
    value: String(value).trim(),
    updated_at: new Date().toISOString()
  };
  saveDatabase();
  return user.memories[normKey];
}

export function deleteUserMemory(userId, key) {
  if (!userId || !key) return false;
  const normId = normalizeJid(userId);
  const user = getUser(normId);
  const normKey = key.toLowerCase().trim();
  if (user?.memories && user.memories[normKey]) {
    delete user.memories[normKey];
    saveDatabase();
    return true;
  }
  return false;
}

// ============================================================
// Funciones de Recordatorios y Tareas Programadas
// ============================================================

export function addReminder({ chat_id, user_id, message, remind_at, action = "reminder", payload = {}, message_id = null }) {
  if (!db.reminders) db.reminders = [];
  const reminder = {
    id: "rem_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
    chat_id: normalizeJid(chat_id),
    user_id: normalizeJid(user_id),
    message: message || "Recordatorio",
    remind_at: new Date(remind_at).toISOString(),
    action: action || "reminder",
    payload: payload || {},
    message_id: message_id || null,
    created_at: new Date().toISOString(),
    sent: 0
  };
  db.reminders.push(reminder);
  saveDatabase();
  return reminder;
}

export function getPendingReminders(chatIdOrUserId) {
  if (!db.reminders) return [];
  const normId = chatIdOrUserId ? normalizeJid(chatIdOrUserId) : null;
  return db.reminders.filter(r => !r.sent && (!normId || r.chat_id === normId || r.user_id === normId));
}

export function deleteReminder(id) {
  if (!db.reminders) return false;
  const idx = db.reminders.findIndex(r => r.id === id);
  if (idx !== -1) {
    db.reminders.splice(idx, 1);
    saveDatabase();
    return true;
  }
  return false;
}

export function updateUser(userId, data) {
  if (!userId) return;
  const normId = normalizeJid(userId);
  const user = getUser(normId);
  db.users[normId] = { ...user, ...data, id: normId };
  saveDatabase();
}

export function addCoins(userId, amount) {
  const normId = normalizeJid(userId || "");
  const user = getUser(normId);
  updateUser(normId, { coins: (user.coins || 0) + amount });
}

export function removeCoins(userId, amount) {
  const normId = normalizeJid(userId || "");
  const user = getUser(normId);
  updateUser(normId, { coins: Math.max(0, (user.coins || 0) - amount) });
}

export function addExp(userId, amount) {
  const normId = normalizeJid(userId || "");
  const user = getUser(normId);
  const newExp = (user.exp || 0) + amount;
  updateUser(normId, { exp: newExp });
  return checkLevelUp(normId);
}

export function checkLevelUp(userId) {
  const normId = normalizeJid(userId || "");
  const user = getUser(normId);
  const expNeeded = user.level * 100 + (user.level - 1) * 50;
  if (user.exp >= expNeeded) {
    const newLevel = user.level + 1;
    const newMaxHealth = 100 + (newLevel - 1) * 10;
    const newAttack = 10 + (newLevel - 1) * 2;
    const newDefense = 5 + (newLevel - 1) * 1;
    updateUser(normId, {
      level: newLevel,
      exp: user.exp - expNeeded,
      max_health: newMaxHealth,
      health: newMaxHealth,
      attack: newAttack,
      defense: newDefense,
    });
    return { leveledUp: true, newLevel };
  }
  return { leveledUp: false };
}

// ============================================================
// Funciones de grupo
// ============================================================

// Valores seguros para las funciones configurables de cada grupo.
// El identificador, nombre y fecha de creación se conservan al restablecer.
export const DEFAULT_GROUP_SETTINGS = Object.freeze({
  welcome: 0,
  goodbye: 0,
  antispam: 0,
  antilink: 0,
  nsfw: 0,
  // La IA de grupo requiere una activación explícita de un administrador.
  ai_enabled: 0,
  // Modo temporal: la IA solo responde mediante /ia, /bot o aliases.
  ai_command_enabled: 0,
  ai_mode: "command",
  ai_personality: "asistente",
  mute: 0,
  language: "es",
  prefix: "!"
});

export function getGroup(groupId) {
  if (!groupId) return null;
  const normId = normalizeJid(groupId);

  // Migrar clave no normalizada si existe previamente
  if (groupId !== normId && db.groups[groupId]) {
    db.groups[normId] = { ...db.groups[normId], ...db.groups[groupId], id: normId };
    delete db.groups[groupId];
    saveDatabase();
  }

  if (!db.groups[normId]) {
    db.groups[normId] = {
      id: normId,
      name: "Grupo",
      ...DEFAULT_GROUP_SETTINGS,
      created_at: new Date().toISOString()
    };
    saveDatabase();
  }
  return db.groups[normId];
}

export function updateGroup(groupId, data) {
  if (!groupId) return;
  const normId = normalizeJid(groupId);
  const group = getGroup(normId);
  db.groups[normId] = { ...group, ...data, id: normId };
  saveDatabase();
}

export function resetGroupSettings(groupId) {
  if (!groupId) return null;
  const normId = normalizeJid(groupId);
  const group = getGroup(normId);
  const resetGroup = {
    ...group,
    ...DEFAULT_GROUP_SETTINGS,
    id: normId,
    name: group?.name || "Grupo",
    created_at: group?.created_at || new Date().toISOString()
  };
  db.groups[normId] = resetGroup;
  saveDatabase();
  return resetGroup;
}

// ============================================================
// Funciones de cooldown
// ============================================================

export function getCooldown(userId, command) {
  const key = `${userId}:${command}`;
  const expiresAt = db.cooldowns[key];
  if (!expiresAt) return 0;
  const remaining = new Date(expiresAt) - new Date();
  if (remaining <= 0) {
    delete db.cooldowns[key];
    saveDatabase();
    return 0;
  }
  return remaining;
}

export function setCooldown(userId, command, seconds) {
  const expiresAt = new Date(Date.now() + seconds * 1000).toISOString();
  const key = `${userId}:${command}`;
  db.cooldowns[key] = expiresAt;
  saveDatabase();
}

// ============================================================
// Funciones de inventario
// ============================================================

export function getInventory(userId) {
  if (!db.inventory[userId]) return [];
  return Object.values(db.inventory[userId]);
}

export async function getInventoryAsync(userId) {
  return getInventory(userId);
}

export function addItem(userId, itemName, itemType = "misc", quantity = 1) {
  if (!db.inventory[userId]) db.inventory[userId] = {};
  
  if (db.inventory[userId][itemName]) {
    db.inventory[userId][itemName].quantity += quantity;
  } else {
    db.inventory[userId][itemName] = {
      user_id: userId,
      item_name: itemName,
      item_type: itemType,
      quantity: quantity,
      equipped: 0,
      obtained_at: new Date().toISOString()
    };
  }
  saveDatabase();
}

export function removeItem(userId, itemName, quantity = 1) {
  if (!db.inventory[userId] || !db.inventory[userId][itemName]) return false;
  
  const item = db.inventory[userId][itemName];
  if (item.quantity <= quantity) {
    delete db.inventory[userId][itemName];
  } else {
    item.quantity -= quantity;
  }
  saveDatabase();
  return true;
}

// ============================================================
// Funciones de waifus
// ============================================================

export function getWaifus(userId) {
  if (!userId) return [];
  const normId = normalizeJid(userId);

  if (userId !== normId && db.waifus[userId]) {
    db.waifus[normId] = { ...db.waifus[normId], ...db.waifus[userId] };
    delete db.waifus[userId];
    saveDatabase();
  }

  if (!db.waifus[normId]) {
    const targetNum = normId.split("@")[0].split(":")[0];
    for (const key of Object.keys(db.waifus)) {
      const keyNum = key.split("@")[0].split(":")[0];
      if (keyNum === targetNum && key !== normId) {
        db.waifus[normId] = { ...db.waifus[normId], ...db.waifus[key] };
        delete db.waifus[key];
        saveDatabase();
        break;
      }
    }
  }

  if (!db.waifus[normId]) return [];
  return Object.values(db.waifus[normId]);
}

export async function getWaifusAsync(userId) {
  return getWaifus(userId);
}

export function addWaifu(userId, waifuName, waifuImage = null, initialAffection = 0, rarity = "Común") {
  if (!userId) return { success: false };
  const normId = normalizeJid(userId);
  if (!db.waifus[normId]) db.waifus[normId] = {};
  
  let key = waifuName;
  if (db.waifus[normId][key]) {
    let count = 2;
    while (db.waifus[normId][`${waifuName} #${count}`]) {
      count++;
    }
    key = `${waifuName} #${count}`;
  }

  const waifuList = Object.values(db.waifus[normId]);
  const isFirst = waifuList.length === 0;

  db.waifus[normId][key] = {
    user_id: normId,
    waifu_name: key,
    waifu_image: waifuImage,
    image_url: waifuImage,
    affection: initialAffection || 0,
    rarity: rarity || "Común",
    obtained_at: new Date().toISOString(),
    is_main: isFirst ? 1 : 0
  };
  saveDatabase();
  return { success: true, waifu: db.waifus[normId][key] };
}

export function setMainWaifu(userId, targetInput) {
  if (!userId) return false;
  const normId = normalizeJid(userId);
  getWaifus(normId); // Migra si es necesario

  if (!db.waifus[normId]) return false;
  const waifuList = Object.values(db.waifus[normId]);
  if (waifuList.length === 0) return false;

  let target = null;
  const index = parseInt(targetInput);
  if (!isNaN(index) && index >= 1 && index <= waifuList.length) {
    target = waifuList[index - 1];
  } else {
    target = waifuList.find(
      w => w.waifu_name.toLowerCase() === targetInput.toLowerCase() ||
           w.waifu_name.toLowerCase().includes(targetInput.toLowerCase())
    );
  }

  if (!target) return false;

  for (const key in db.waifus[normId]) {
    if (db.waifus[normId][key].waifu_name.toLowerCase() === target.waifu_name.toLowerCase()) {
      db.waifus[normId][key].is_main = 1;
    } else {
      db.waifus[normId][key].is_main = 0;
    }
  }
  saveDatabase();
  return target;
}

export function getMainWaifu(userId) {
  if (!userId) return null;
  const waifus = getWaifus(userId);
  if (waifus.length === 0) return null;
  return waifus.find(w => w.is_main === 1) || waifus[0];
}

export function updateWaifuAffection(userId, waifuName, amount) {
  if (!userId) return null;
  const normId = normalizeJid(userId);
  getWaifus(normId);

  if (!db.waifus[normId]) return null;
  const waifuKey = Object.keys(db.waifus[normId]).find(
    k => k.toLowerCase() === waifuName.toLowerCase() || db.waifus[normId][k].waifu_name.toLowerCase() === waifuName.toLowerCase()
  );
  if (!waifuKey) return null;
  const waifu = db.waifus[normId][waifuKey];
  waifu.affection = Math.max(0, (waifu.affection || 0) + amount);
  saveDatabase();
  return waifu;
}

export function removeWaifu(userId, waifuKeyOrName) {
  if (!userId) return false;
  const normId = normalizeJid(userId);
  getWaifus(normId);

  if (!db.waifus[normId]) return false;
  const waifuList = Object.keys(db.waifus[normId]);
  const foundKey = waifuList.find(
    k => k.toLowerCase() === waifuKeyOrName.toLowerCase() ||
         db.waifus[normId][k].waifu_name.toLowerCase() === waifuKeyOrName.toLowerCase()
  );
  if (foundKey) {
    delete db.waifus[normId][foundKey];
    saveDatabase();
    return true;
  }
  return false;
}

export function transferWaifu(fromUserId, toUserId, waifuKeyOrName) {
  if (!fromUserId || !toUserId) return null;
  const fromNorm = normalizeJid(fromUserId);
  const toNorm = normalizeJid(toUserId);
  getWaifus(fromNorm);

  if (!db.waifus[fromNorm]) return null;
  const waifuList = Object.keys(db.waifus[fromNorm]);
  const foundKey = waifuList.find(
    k => k.toLowerCase() === waifuKeyOrName.toLowerCase() ||
         db.waifus[fromNorm][k].waifu_name.toLowerCase() === waifuKeyOrName.toLowerCase()
  );
  if (!foundKey) return null;

  const waifu = { ...db.waifus[fromNorm][foundKey] };
  delete db.waifus[fromNorm][foundKey];

  if (!db.waifus[toNorm]) db.waifus[toNorm] = {};
  
  // Agregar al comprador
  let newKey = waifu.waifu_name;
  if (db.waifus[toNorm][newKey]) {
    let count = 2;
    while (db.waifus[toNorm][`${waifu.waifu_name} #${count}`]) {
      count++;
    }
    newKey = `${waifu.waifu_name} #${count}`;
  }

  waifu.user_id = toNorm;
  waifu.waifu_name = newKey;
  waifu.is_main = Object.keys(db.waifus[toNorm]).length === 0 ? 1 : 0;
  db.waifus[toNorm][newKey] = waifu;

  saveDatabase();
  return waifu;
}

export function fuseWaifus(userId, input1, input2) {
  if (!db.waifus[userId]) return { success: false, error: "No tienes ningún personaje en tu colección." };
  const waifuList = Object.values(db.waifus[userId]);
  if (waifuList.length < 2) return { success: false, error: "Necesitas al menos 2 personajes en tu colección para fusionar." };

  let w1 = null;
  let w2 = null;

  const idx1 = parseInt(input1);
  const idx2 = parseInt(input2);

  if (!isNaN(idx1) && idx1 >= 1 && idx1 <= waifuList.length) {
    w1 = waifuList[idx1 - 1];
  } else {
    w1 = waifuList.find(w => w.waifu_name.toLowerCase().includes(input1.toLowerCase()));
  }

  if (!isNaN(idx2) && idx2 >= 1 && idx2 <= waifuList.length) {
    w2 = waifuList[idx2 - 1];
  } else {
    w2 = waifuList.find(w => w.waifu_name.toLowerCase().includes(input2.toLowerCase()) && w !== w1);
  }

  if (!w1 || !w2) {
    return { success: false, error: "No se encontraron los dos personajes especificados. Verifica sus índices o nombres en tu !coleccion." };
  }

  if (w1.waifu_name === w2.waifu_name) {
    return { success: false, error: "No puedes fusionar el mismo personaje consigo mismo." };
  }

  const rarityTier = {
    "Común": 1,
    "Rara": 2,
    "Épica": 3,
    "Legendaria": 4,
    "Mítica": 5,
    "Divina": 6
  };

  const rarityNames = ["Común", "Rara", "Épica", "Legendaria", "Mítica", "Divina"];

  const tier1 = rarityTier[w1.rarity] || 1;
  const tier2 = rarityTier[w2.rarity] || 1;

  // Nueva rareza calculada (mínimo el nivel más alto + 1 si son iguales, o el mayor)
  let newTier = Math.max(tier1, tier2);
  if (tier1 === tier2 && newTier < 6) {
    newTier += 1;
  } else if (newTier < 6) {
    newTier = Math.min(6, newTier + 1);
  }

  const newRarity = rarityNames[newTier - 1];

  // Nuevo afecto/poder combinado con bonus de fusión (+200 afecto)
  const newAffection = (w1.affection || 0) + (w2.affection || 0) + 200;

  // Imagen retenida (priorizar w1 o la de mayor rareza)
  const finalImage = (tier1 >= tier2 ? w1.waifu_image : w2.waifu_image) || w1.waifu_image || w2.waifu_image;

  // Eliminar w2 de la base de datos
  removeWaifu(userId, w2.waifu_name);

  // Actualizar w1
  const key1 = Object.keys(db.waifus[userId]).find(k => db.waifus[userId][k] === w1 || db.waifus[userId][k].waifu_name === w1.waifu_name);
  if (key1 && db.waifus[userId][key1]) {
    db.waifus[userId][key1].rarity = newRarity;
    db.waifus[userId][key1].affection = newAffection;
    db.waifus[userId][key1].waifu_image = finalImage;
    db.waifus[userId][key1].image_url = finalImage;
  }

  saveDatabase();

  return {
    success: true,
    fusedWaifu: db.waifus[userId][key1],
    consumed: w2.waifu_name,
    previousRarity: w1.rarity,
    newRarity,
    newAffection
  };
}

export function getWaifuByName(userId, waifuName) {
  if (!db.waifus[userId]) return null;
  const waifuKey = Object.keys(db.waifus[userId]).find(
    k => k.toLowerCase() === waifuName.toLowerCase() || db.waifus[userId][k].waifu_name.toLowerCase() === waifuName.toLowerCase()
  );
  return waifuKey ? db.waifus[userId][waifuKey] : null;
}

// ============================================================
// Historial de IA
// ============================================================

export function getAiHistory(userId, limit = 10) {
  if (!db.ai_history[userId]) return [];
  return db.ai_history[userId].slice(-limit);
}

export function addAiMessage(userId, role, content) {
  if (!db.ai_history[userId]) db.ai_history[userId] = [];
  
  if (!content || typeof content !== "string" || !content.trim()) return;

  const trimmed = content.trim();
  const last = db.ai_history[userId][db.ai_history[userId].length - 1];
  if (last && last.role === role && last.content === trimmed) {
    return;
  }

  db.ai_history[userId].push({
    role,
    content: trimmed,
    created_at: new Date().toISOString()
  });
  
  // Mantener solo los últimos 30 mensajes para memoria continua
  if (db.ai_history[userId].length > 30) {
    db.ai_history[userId].splice(0, db.ai_history[userId].length - 30);
  }
  saveDatabase();
}

export function clearAiHistory(userId) {
  delete db.ai_history[userId];
  saveDatabase();
}

// ============================================================
// Leaderboard
// ============================================================

export function getLeaderboard(type = "level", limit = 10, groupParticipants = []) {
  // 1. Unificar y fusionar todos los registros de usuarios en db.users
  const cleanUserMap = cleanupAndMergeUsers(groupParticipants);

  // 2. Determinar la lista de candidatos
  let candidates = [];
  const isGroupFilter = Array.isArray(groupParticipants) && groupParticipants.length > 0;
  const processedJids = new Set();

  if (isGroupFilter) {
    // a) Buscar todos los usuarios registrados en db.users que pertenezcan al grupo
    for (const u of cleanUserMap.values()) {
      if (!u || u.banned) continue;

      const belongsToGroup = groupParticipants.some(p => {
        if (!p) return false;
        const pId = p.id ? normalizeJid(p.id) : "";
        const pLid = p.lid ? normalizeJid(p.lid) : "";
        const pPn = p.pn ? normalizeJid(p.pn) : (p.idAlt ? normalizeJid(p.idAlt) : "");

        if (pId && (pId === u.id || pId === u.lid || areJidsEqual(pId, u.id, groupParticipants))) return true;
        if (pLid && (pLid === u.id || pLid === u.lid || areJidsEqual(pLid, u.id, groupParticipants))) return true;
        if (pPn && (pPn === u.id || pPn === u.lid || areJidsEqual(pPn, u.id, groupParticipants))) return true;

        if (p.name && u.name && p.name !== "Usuario" && u.name !== "Usuario") {
          const pNameClean = p.name.toLowerCase().replace(/[^a-z0-9]/g, "");
          const uNameClean = u.name.toLowerCase().replace(/[^a-z0-9]/g, "");
          if (pNameClean && uNameClean && (pNameClean.includes(uNameClean) || uNameClean.includes(pNameClean))) return true;
        }
        return false;
      });

      if (belongsToGroup) {
        processedJids.add(u.id);
        if (u.lid) processedJids.add(u.lid);
        candidates.push(u);
      }
    }

    // b) Agregar participantes del grupo no presentes en db.users con nivel por defecto
    for (const p of groupParticipants) {
      if (!p) continue;
      const pId = p.id ? normalizeJid(p.id) : "";
      const pLid = p.lid ? normalizeJid(p.lid) : "";
      const pPn = p.pn ? normalizeJid(p.pn) : "";

      if ((pId && processedJids.has(pId)) || (pLid && processedJids.has(pLid)) || (pPn && processedJids.has(pPn))) continue;

      const rawJid = pId || pLid || pPn;
      if (!rawJid) continue;
      processedJids.add(rawJid);
      candidates.push({
        id: rawJid,
        name: (p.name && p.name !== "Usuario") ? p.name : "Usuario",
        level: 1,
        exp: 0,
        coins: 100,
        gems: 0,
        wins: 0,
        total_commands: 0
      });
    }
  } else {
    candidates = Array.from(cleanUserMap.values());
  }

  // 3. Filtrar y ordenar por Nivel (y EXP como desempate)
  return candidates
    .filter(u => u && !u.banned)
    .sort((a, b) => {
      const levelDiff = (b.level || 1) - (a.level || 1);
      if (levelDiff !== 0) return levelDiff;
      return (b.exp || 0) - (a.exp || 0);
    })
    .slice(0, limit);
}

// ============================================================
// Configuración global del bot (Estilos de menú, etc.)
// ============================================================

export function getBotSettings() {
  if (!db.settings) {
    db.settings = { menuStyle: 1, msgStyle: 1 };
  }
  return db.settings;
}

export function updateBotSettings(newSettings = {}) {
  if (!db.settings) db.settings = { menuStyle: 1, msgStyle: 1 };
  Object.assign(db.settings, newSettings);
  saveDatabase();
  return db.settings;
}

// ============================================================
// Funciones de compatibilidad (Wrappers async para evitar errores)
// ============================================================

export async function dbRun(sql, params = []) { return { changes: 1 }; }
export async function dbGet(sql, params = []) { 
  if (sql.includes("FROM groups")) {
    return { count: Object.keys(db.groups || {}).length };
  }
  if (sql.includes("WHERE banned = 1")) {
    const count = Object.values(db.users || {}).filter(u => u.banned === 1).length;
    return { count };
  }
  if (sql.includes("COUNT(*)")) {
    return { count: Object.keys(db.users || {}).length };
  }
  if (sql.includes("SUM(total_commands)")) {
    const total = Object.values(db.users || {}).reduce((acc, u) => acc + (u.total_commands || 0), 0);
    return { total };
  }
  return null;
}
export async function dbAll(sql, params = []) { 
  if (sql.includes("SELECT id FROM groups")) return Object.keys(db.groups).map(id => ({ id }));
  return [];
}

export default db;
