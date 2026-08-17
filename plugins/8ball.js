// ============================================================
//   Kurumi Tokisaki - 8ball Command (Dinámico)
// ============================================================

import { generateTextWithAI } from "../lib/aiGenerator.js";
import { randomElement } from "../lib/utils.js";

const fallbackResponses = [
  "🟢 Sí, definitivamente.",
  "🟢 Es cierto y los astros lo confirman.",
  "🟢 Puedes contar con ello.",
  "🟡 Respuesta confusa, la energía no está clara.",
  "🔴 Mis fuentes dicen que no.",
  "🔴 Las perspectivas no son buenas."
];

const handler = async (m, { args, body, usedPrefix }) => {
  if (!body) {
    return m.reply(
      `✦━【 *BOLA MÁGICA 8* 】━✦\n\n` +
      `📝 Pregunta algo a la bola mágica.\n` +
      `💡 Sintaxis:\n` +
      `   \`${usedPrefix}8ball <pregunta>\`\n` +
      `📌 Ejemplo:\n` +
      `   \`${usedPrefix}8ball ¿Voy a tener suerte hoy?\``
    );
  }

  const prompt = `Actúa como una mística Bola Mágica 8. El usuario pregunta: "${body}". Responde con una sola frase corta mística y contundente en español indicando si Sí, No, o Tal vez/Incierto, comenzando con un emoji (🟢 para sí, 🔴 para no, 🟡 para incierto/tal vez). Responde ÚNICAMENTE con la frase.`;
  const answer = await generateTextWithAI(prompt, randomElement(fallbackResponses));

  await m.reply(
    `✦━【 *BOLA MÁGICA 8* 】━✦\n\n` +
    `❓ *Pregunta:* ${body}\n\n` +
    `🔮 *Respuesta:* ${answer}\n\n✨ *Kurumi Tokisaki*`
  );
};

handler.command = /^(8ball|bola8|magia|oraculo|oráculo)$/i;
handler.description = "Pregúntale a la bola mágica (respuesta mística dinámicamente generada)";
handler.category = "juegos";

export default handler;

