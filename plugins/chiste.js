// ============================================================
//   Kurumi Tokisaki - Chiste Command (Dinámico e Infinito)
// ============================================================

import { generateTextWithAI } from "../lib/aiGenerator.js";
import { randomElement } from "../lib/utils.js";

const fallbackJokes = [
  "¿Qué le dice un bit al otro?\nNos vemos en el bus 🚌",
  "¿Qué hace una abeja en el gimnasio?\nZumba 🐝",
  "¿Qué le dijo el 0 al 8?\nBonito cinturón 🥋"
];

const handler = async (m) => {
  const prompt = "Escribe un chiste corto, ingenioso y divertido en español. Responde ÚNICAMENTE con el texto del chiste, sin comentarios adicionales.";
  const joke = await generateTextWithAI(prompt, randomElement(fallbackJokes));

  await m.reply(
    `✦━【 *CHISTE DEL DÍA* 】━✦\n\n\n${joke}\n╰────────`
  );
};

handler.command = /^(chiste|joke|humor|broma)$/i;
handler.description = "Obtener un chiste dinámico generado por IA";
handler.category = "daily";

export default handler;

