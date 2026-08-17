// ============================================================
//   Kurumi Tokisaki - Consejo Command (Dinámico)
// ============================================================

import { generateTextWithAI } from "../lib/aiGenerator.js";
import { randomElement } from "../lib/utils.js";

const fallbackAdvice = [
  "No te compares con los demás, compárate con quien eras ayer.",
  "La perseverancia es la clave del éxito.",
  "El tiempo es el recurso más valioso que tienes."
];

const handler = async (m) => {
  const prompt = "Da un consejo sabio, práctico e inspirador para la vida en español. Responde ÚNICAMENTE con el texto del consejo, sin introducciones.";
  const advice = await generateTextWithAI(prompt, randomElement(fallbackAdvice));

  await m.reply(
    `✦━【 *CONSEJO DEL DÍA* 】━✦\n\n\n💡 "${advice.replace(/^["'«]+|["'»]+$/g, "")}"\n╰────────`
  );
};

handler.command = /^(consejo|advice|tip)$/i;
handler.description = "Obtener un consejo generado por IA";
handler.category = "daily";

export default handler;

