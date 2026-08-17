// ============================================================
//   Kurumi Tokisaki - Limpiar (Clear AI History) Command
// ============================================================

import { clearAiHistory } from "../lib/database.js";

const handler = async (m, { sender }) => {
  clearAiHistory(sender);
  await m.reply(
    `✦━【 🧹 *HISTORIAL LIMPIADO* 】━✦\n\n` +
    `✅ Historial de IA limpiado correctamente.\n` +
    `💕 Empezamos una nueva conversación desde cero.`
  );
};

handler.command = /^(limpiar|clear|resetia|borrarhistorial)$/i;
handler.description = "Limpiar historial de conversación con la IA";
handler.category = "ia";

export default handler;
