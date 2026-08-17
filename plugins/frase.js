// ============================================================
//   Kurumi Tokisaki - Frase Motivacional Command (Dinámico)
// ============================================================

import { generateTextWithAI } from "../lib/aiGenerator.js";
import { randomElement } from "../lib/utils.js";

const fallbackQuotes = [
  { text: "El éxito es la suma de pequeños esfuerzos repetidos día tras día.", author: "Robert Collier" },
  { text: "La única forma de hacer un gran trabajo es amar lo que haces.", author: "Steve Jobs" },
  { text: "Cree que puedes y ya estás a medio camino.", author: "Theodore Roosevelt" }
];

const handler = async (m) => {
  const prompt = `Proporciona una frase inspiradora o motivacional célebre en español. Responde en el formato estricto: "Texto de la frase" — Autor`;
  const resText = await generateTextWithAI(prompt, "");

  let quoteText = "";
  let author = "";

  if (resText && resText.includes("—")) {
    const parts = resText.split("—");
    quoteText = parts[0].replace(/^["'«]+|["'»]+$/g, "").trim();
    author = parts[1].trim();
  } else if (resText) {
    quoteText = resText.replace(/^["'«]+|["'»]+$/g, "").trim();
    author = "Desconocido";
  } else {
    const fallback = randomElement(fallbackQuotes);
    quoteText = fallback.text;
    author = fallback.author;
  }

  await m.reply(
    `✦━【 *FRASE MOTIVACIONAL* 】━✦\n\n\n✨ "${quoteText}"\n\n— *${author}*\n╰────────`
  );
};

handler.command = /^(frase|quote|motivacion|motivación)$/i;
handler.description = "Obtener una frase motivacional generada por IA";
handler.category = "daily";

export default handler;

