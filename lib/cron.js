// ============================================================
//   Kurumi Tokisaki - Trabajos Programados (Cron)
// ============================================================

import { cleanTemp } from "./utils.js";
import chalk from "chalk";

let _conn = null;
let _cronStarted = false;

export function setConnection(conn) {
  _conn = conn;
}

export function setCronConnection(conn) {
  _conn = conn;
}

export function startCronJobs() {
  if (_cronStarted) return;
  _cronStarted = true;
  // Limpiar archivos temporales cada hora
  setInterval(() => {
    const cleaned = cleanTemp(3600000);
    if (cleaned > 0) {
      console.log(chalk.gray(`🧹 Limpieza automática: ${cleaned} archivos temporales eliminados`));
    }
  }, 3600000);

  // Verificar recordatorios y acciones programadas cada 10 segundos
  setInterval(async () => {
    try {
      await checkReminders();
    } catch (e) {}
  }, 10000);

  console.log(chalk.cyan("⏰ Trabajos programados y motor de recordatorios activo"));
}

async function checkReminders() {
  if (!_conn) return;

  const { default: db, saveDatabase, getUser } = await import("./database.js");
  const now = new Date();
  
  if (!db.reminders) db.reminders = [];
  
  const pending = db.reminders.filter(r => new Date(r.remind_at) <= now && !r.sent);
  
  if (pending.length === 0) return;

  for (const reminder of pending) {
    try {
      const action = reminder.action || "reminder";

      if (action === "group_close") {
        await _conn.groupSettingUpdate(reminder.chat_id, 'announcement');
        await _conn.sendMessage(reminder.chat_id, {
          text: `✦━【 🔒 *GRUPO CERRADO* 】━✦\n\n` +
            `⏰ *Acción Ejecutada:* El grupo ha sido cerrado automáticamente según la hora programada por un administrador.\n` +
            `💬 *Mensaje:* ${reminder.message || "Solo administradores pueden enviar mensajes."}`
        });
      } else if (action === "group_open") {
        await _conn.groupSettingUpdate(reminder.chat_id, 'not_announcement');
        await _conn.sendMessage(reminder.chat_id, {
          text: `✦━【 🔓 *GRUPO ABIERTO* 】━✦\n\n` +
            `⏰ *Acción Ejecutada:* El grupo ha sido abierto automáticamente según la hora programada.\n` +
            `💬 *Mensaje:* ${reminder.message || "Todos los participantes pueden enviar mensajes ahora."}`
        });
      } else {
        // No existe un mensaje entrante del que obtener aliases. Se usa el LID
        // persistido del usuario cuando está disponible y el Phone JID como respaldo.
        const reminderUser = reminder.user_id ? getUser(reminder.user_id) : null;
        const mentionJid = reminderUser?.lid || reminder.user_id;
        const mentionNum = (mentionJid || "").split("@")[0].split(":")[0];
        await _conn.sendMessage(reminder.chat_id, {
          text: `✦━【 ⏰ *RECORDATORIO* 】━✦\n\n` +
            `🔔 *Aviso para:* @${mentionNum}\n` +
            `📝 *Mensaje:* ${reminder.message}\n\n` +
            `📌 *Tip:* Puedes usar \`!daily\`, \`!minar\`, \`!pescar\` o lo que tenías pendiente.`,
          mentions: mentionJid ? [mentionJid] : []
        });
      }

      reminder.sent = 1;
    } catch (e) {
      console.error("Error ejecutando recordatorio programado:", e);
      reminder.sent = 1; // Marcar para no bloquear bucle
    }
  }
  
  saveDatabase();
}
