// ============================================================
//   Kurumi Tokisaki - Ping Command
// ============================================================

const handler = async (m, { conn }) => {
  const start = Date.now();
  await m.reply("🏓 Pong!");
  const ping = Date.now() - start;
  await m.reply(
    `✦━【 *PONG* 】━✦\n\n\n⚡ Latencia: *${ping}ms*\n╰────────`
  );
};

handler.command = /^(ping|velocidad|latencia)$/i;
handler.description = "Ver la latencia del bot";
handler.category = "misc";

export default handler;
