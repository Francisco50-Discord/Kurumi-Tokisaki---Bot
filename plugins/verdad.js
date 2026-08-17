// ============================================================
//   Kurumi Tokisaki - Verdad Command (Dinámico)
// ============================================================

import { generateTextWithAI } from "../lib/aiGenerator.js";
import { randomElement } from "../lib/utils.js";

const fallbackTruths = [
  "¿Cuál es tu mayor miedo en la vida?",
  "¿Cuál es la mentira más tonta que has dicho?",
  "¿Qué es lo más vergonzoso que te ha pasado?"
];

const handler = async (m) => {
  const prompt = "Genera una pregunta comprometida, graciosa e interesante para el juego de Verdad en español. Responde ÚNICAMENTE con la pregunta, sin introducciones.";
  const truth = await generateTextWithAI(prompt, randomElement(fallbackTruths));

  await m.reply(
    `✦━【 💬 *VERDAD* 】━✦\n\n💬 @${m.sender.split("@")[0]}, tu pregunta:\n"${truth.replace(/^["'«]+|["'»]+$/g, "")}"\n╰──────`,
    { mentions: [m.sender] }
  );
};

handler.command = /^(verdad|truth)$/i;
handler.description = "Obtener una pregunta de verdad generada por IA";
handler.category = "juegos";

export default handler;

