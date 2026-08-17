// ============================================================
//   Kurumi Tokisaki - Reporte Command
// ============================================================

import { config } from "../config/settings.js";

const handler = async (m, { conn, text, usedPrefix, command }) => {
    if (!text) {
        return m.reply(
            `✦━【 📢 *REPORTE* 】━✦\n\n` +
            `📝 *¿Encontraste un error?*\n` +
            `Usa este comando para avisar al creador directamente.\n\n` +
            `💡 *Sintaxis:* \`${usedPrefix}${command} <tu mensaje>\`\n` +
            `📌 *Ejemplo:* \`${usedPrefix}${command} El comando !play no funciona\``
        );
    }

    if (text.length < 10) {
        return m.reply(`✦━【 ⚠️ *AVISO* 】━✦\n\n📝 *El reporte es muy corto.*\n📌 *Explica mejor el problema.*`);
    }

    const targetNumber = config.creatorNumber || "529852270023";
    const reportText = `
✦━【 🚨 *NUEVO REPORTE* 】━✦

◈ *Usuario:* @${m.sender.split("@")[0]}
◈ *Mensaje:* ${text}
◈ *Chat:* ${m.chatId}
◈ *Fecha:* ${new Date().toLocaleString("es-MX", { timeZone: "America/Mexico_City" })}

✦ *${config.botName}* v${config.version}
    `.trim();

    try {
        let sent = false;

        // Intentar resolver JID real con WhatsApp
        if (conn?.onWhatsApp) {
            try {
                const res = await conn.onWhatsApp(targetNumber);
                if (res && res[0]?.jid) {
                    await conn.sendMessage(res[0].jid, { text: reportText, mentions: [m.sender] });
                    sent = true;
                }
            } catch (err) {}
        }

        // Fallback a JIDs directos (52... y 521...)
        if (!sent) {
            const jids = [`${targetNumber}@s.whatsapp.net`, `521${targetNumber.replace(/^52/, "")}@s.whatsapp.net`].filter((v, i, a) => a.indexOf(v) === i);
            for (const jid of jids) {
                try {
                    await conn.sendMessage(jid, { text: reportText, mentions: [m.sender] });
                    sent = true;
                    break;
                } catch (e) {}
            }
        }

        if (sent) {
            await m.reply(
                `✦━【 ✅ *REPORTE ENVIADO* 】━✦\n\n` +
                `✨ *¡Gracias por tu reporte!*\n` +
                `📨 *El creador (+${targetNumber}) lo revisará pronto.*\n` +
                `👤 *Tu ID:* @${m.sender.split("@")[0]}`,
                { mentions: [m.sender] }
            );
        } else {
            throw new Error("No se pudo entregar el mensaje a los JID del creador.");
        }
    } catch (e) {
        console.error("Error enviando reporte manual:", e.message);
        await m.reply(`✦━【 ❌ *ERROR* 】━✦\n\n⚠️ *No se pudo enviar el reporte.*\n📌 *Intenta de nuevo más tarde.*`);
    }
};

handler.command = /^(reporte|reportar|bug)$/i;
handler.description = "Enviar un reporte de error al creador";
handler.category = "misc";

export default handler;
