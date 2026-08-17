// ============================================================
//   Kurumi Tokisaki - Eval Command
// ============================================================

const handler = async (m, { body, isOwner, conn, sender }) => {
  if (!isOwner) return;

  try {
    const result = await eval(`(async () => { ${body} })()`);
    const output = typeof result === "object" ? JSON.stringify(result, null, 2) : String(result);
    await m.reply(
      `✅ *Resultado*\n\n\`\`\`${output?.slice(0, 1000) || "undefined"}\`\`\``
    );
  } catch (err) {
    await m.reply(`✦━【 ❌ *ERROR* 】━✦\n\n\`\`\`${err.message}\`\`\``);
  }
};

handler.command = /^(eval|ejecutar|run)$/i;
handler.description = "Evaluar código JavaScript";
handler.category = "admin";
handler.owner = true;

export default handler;
