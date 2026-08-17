// ============================================================
//   Kurumi Tokisaki - Estado / Status Command
// ============================================================

import axios from "axios";
import { getMediaBuffer, getMediaType } from "../lib/utils.js";
import { config } from "../config/settings.js";
import db from "../lib/database.js";

/**
 * Helper: Generate AI Status text via Pollinations AI
 */
async function generateAiStatusText(prompt) {
  try {
    const systemPrompt = "Eres un creador de contenido experto para estados de WhatsApp. Genera un texto para estado que sea creativo, atractivo, estético e impactante, máximo 2-3 frases, en español con emojis adecuados.";
    const userPrompt = prompt && prompt.trim().length > 0 
      ? `Crea un estado basado en este tema o descripción: "${prompt}"` 
      : "Crea una frase genial, motivacional o profunda para estado de WhatsApp.";

    const res = await axios.post("https://text.pollinations.ai/", {
      model: "openai",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.8
    }, {
      headers: { "Content-Type": "application/json" },
      timeout: 25000
    });

    if (typeof res.data === "string" && res.data.trim()) {
      return res.data.trim();
    }
    if (res.data?.choices?.[0]?.message?.content) {
      return res.data.choices[0].message.content.trim();
    }
  } catch (e) {
    console.error("AI Status generation error:", e.message);
  }

  return prompt ? `✨ ${prompt}` : "✨ «Vive cada momento al máximo y disfruta el camino.» 🚀";
}

const handler = async (m, { conn, args, body, sender, chatId, usedPrefix }) => {
  const lowerBody = (body || "").toLowerCase().trim();
  const argsList = args.map(a => a.toLowerCase());

  // Detectar si pide IA
  const isAi = argsList.includes("ia") || argsList.includes("ai") || lowerBody.includes("--ia");

  // Detectar destino: bot o grupo
  let target = null;
  if (argsList.includes("bot") || argsList.includes("whatsapp") || argsList.includes("wa")) {
    target = "bot";
  } else if (argsList.includes("grupo") || argsList.includes("chat") || argsList.includes("group")) {
    target = "grupo";
  }

  // Limpiar argumentos eliminando palabras clave de control ("bot", "grupo", "ia", "ai")
  const cleanText = args
    .filter(a => !["bot", "grupo", "chat", "group", "whatsapp", "wa", "ia", "ai"].includes(a.toLowerCase()))
    .join(" ")
    .replace(/--ia/gi, "")
    .trim();

  // Verificar si hay multimedia adjunta o citada
  const mediaBuffer = await getMediaBuffer(m);
  const mediaType = getMediaType(m);

  // Si no especificó destino ni texto ni imagen, mostrar menú explicativo
  if (!target && !cleanText && !mediaBuffer && !isAi) {
    return m.reply(
      `✦━【 📢 *PUBLICAR ESTADO* 】━✦\n\n` +
      `¿Dónde deseas publicar tu estado?\n\n` +
      `📌 *OPCIONES:* \n` +
      ` • \`${usedPrefix}estado bot <texto>\` — Subir a estado de WhatsApp del Bot\n` +
      ` • \`${usedPrefix}estado grupo <texto>\` — Subir a este Grupo\n` +
      ` • \`${usedPrefix}estado bot ia <tema>\` — La IA genera el estado para el Bot\n` +
      ` • \`${usedPrefix}estado grupo ia <tema>\` — La IA genera el estado para el Grupo\n\n` +
      `💡 Adjunta o responde a una foto o video con el comando.\n` +
      ``
    );
  }

  // Si no se especificó destino pero hay contenido, por defecto publicar en AMBOS (Estado de WhatsApp del Bot y Grupo)
  if (!target) {
    target = "both";
  }

  await m.reply(`⏳ *Preparando publicación en el estado del bot...*`);

  let finalCaption = cleanText;

  // Si activó la IA, generar texto con IA
  if (isAi) {
    const generatedText = await generateAiStatusText(cleanText);
    if (generatedText) {
      finalCaption = generatedText;
    }
  }

  try {
    const senderNum = sender.split("@")[0];

    // Construir lista de JIDs receptores (statusJidList es obligatorio para que WhatsApp distribuya el estado)
    const jidSet = new Set();
    if (sender) {
      const normSender = sender.includes("@s.whatsapp.net") ? sender : `${sender.split("@")[0]}@s.whatsapp.net`;
      jidSet.add(normSender);
    }

    // Agregar owners
    for (const o of config.owner || []) {
      const cleanOwner = o.replace(/[^0-9]/g, "");
      if (cleanOwner) jidSet.add(`${cleanOwner}@s.whatsapp.net`);
    }

    // Agregar usuarios registrados en la base de datos
    if (db && db.users) {
      for (const uid of Object.keys(db.users)) {
        const cleanUid = uid.replace(/[^0-9]/g, "");
        if (cleanUid) jidSet.add(`${cleanUid}@s.whatsapp.net`);
      }
    }

    // Si es un grupo, agregar participantes
    if (m.isGroup && chatId) {
      try {
        const groupMeta = await conn.groupMetadata(chatId).catch(() => null);
        if (groupMeta?.participants) {
          for (const p of groupMeta.participants) {
            if (p.id) jidSet.add(p.id);
          }
        }
      } catch (e) {}
    }

    const statusJidList = Array.from(jidSet).filter(Boolean);

    // 1. Publicar en el estado de WhatsApp del Bot (status@broadcast) si el destino es "bot" o "both"
    let statusSuccess = false;
    if (target === "bot" || target === "both") {
      try {
        const options = {
          statusJidList,
          backgroundColor: 0xff161616,
          font: 1
        };

        if (mediaBuffer) {
          if (mediaType === "image") {
            await conn.sendMessage("status@broadcast", {
              image: mediaBuffer,
              caption: finalCaption || `✨ Estado subido por @${senderNum}`
            }, options);
          } else if (mediaType === "video") {
            await conn.sendMessage("status@broadcast", {
              video: mediaBuffer,
              caption: finalCaption || `✨ Estado subido por @${senderNum}`
            }, options);
          } else if (mediaType === "audio") {
            await conn.sendMessage("status@broadcast", {
              audio: mediaBuffer,
              mimetype: "audio/mp4",
              ptt: true
            }, options);
          }
        } else {
          await conn.sendMessage("status@broadcast", {
            text: finalCaption || `✨ Estado subido por @${senderNum}`
          }, options);
        }
        statusSuccess = true;
      } catch (broadcastErr) {
        console.error("Error al enviar a status@broadcast:", broadcastErr.message);
      }
    }

    // 2. Publicar/Notificar en el Chat / Grupo actual si el destino es "grupo" o "both"
    if (target === "grupo" || target === "both") {
      const cardHeader = `✦━【 📢 *NUEVO ESTADO SUBIDO* 】━✦\n` +
                         `👤 *Por:* @${senderNum}\n` +
                         `📱 *Publicado en:* Estado del Bot\n` +
                         (isAi ? `✨ *Modo IA:* Generado por IA\n` : "") +
                         `\n📝 *Mensaje:*\n${finalCaption || "Sin descripción"}\n` +
                         ``;

      if (mediaBuffer) {
        if (mediaType === "image") {
          await conn.sendMessage(chatId, {
            image: mediaBuffer,
            caption: cardHeader,
            mentions: [sender]
          }, { quoted: m });
        } else if (mediaType === "video") {
          await conn.sendMessage(chatId, {
            video: mediaBuffer,
            caption: cardHeader,
            mentions: [sender]
          }, { quoted: m });
        } else if (mediaType === "audio") {
          await conn.sendMessage(chatId, {
            audio: mediaBuffer,
            mimetype: "audio/mp4",
            ptt: true
          });
          await conn.sendMessage(chatId, {
            text: cardHeader,
            mentions: [sender]
          }, { quoted: m });
        }
      } else {
        await conn.sendMessage(chatId, {
          text: cardHeader,
          mentions: [sender]
        }, { quoted: m });
      }
    } else {
      // Si fue solo "bot", enviar mensaje de confirmación simple en el chat
      await conn.sendMessage(chatId, {
        text: `✦━【 ✅ *ESTADO PUBLICADO* 】━✦\n\n📱 *Destino:* Estado de WhatsApp del Bot\n` +
              (finalCaption ? `📝 *Texto:* ${finalCaption}\n` : "") +
              (isAi ? `✨ *Generado por IA:* Sí\n` : "") +
              `\n💡 *Nota:* Recuerda tener guardado el número del Bot en tus contactos de WhatsApp para visualizar sus estados en la pestaña Novedades.`
      }, { quoted: m });
    }
  } catch (err) {
    console.error("Error al publicar estado:", err);
    await m.reply(`✦━【 ❌ *ERROR* 】━✦\n\nNo se pudo publicar el estado. Intenta de nuevo.`);
  }
};

handler.command = /^(estado|status|subirestado|subir|postestado)$/i;
handler.description = "Publicar foto, video o texto en el estado del Bot o en el Grupo (con o sin IA)";
handler.category = "general";
handler.register = true;

export default handler;
