// ============================================================
//   Kurumi Tokisaki - Ping Command
// ============================================================

function timestampToMilliseconds(value) {
  if (value === undefined || value === null) return null;

  try {
    if (typeof value === "object") {
      if (typeof value.toNumber === "function") value = value.toNumber();
      else if (Number.isFinite(value.low)) {
        value = value.low + (Number(value.high) || 0) * 2 ** 32;
      }
    }

    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) return null;
    return numeric < 1e12 ? numeric * 1000 : numeric;
  } catch {
    return null;
  }
}

const handler = async (m) => {
  const start = Date.now();
  const receivedAt = timestampToMilliseconds(m?.messageTimestamp);
  const ping = receivedAt ? Math.max(0, start - receivedAt) : Date.now() - start;

  await m.reply(
    `✦━【 *PONG* 】━✦\n\n` +
    `⚡ Latencia: *${ping}ms*\n` +
    `╰────────`
  );
};

handler.command = /^(ping|velocidad|latencia)$/i;
handler.description = "Ver la latencia del bot";
handler.category = "misc";

export default handler;
