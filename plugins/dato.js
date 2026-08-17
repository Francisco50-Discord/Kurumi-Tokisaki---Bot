// ============================================================
//   Kurumi Tokisaki - Dato Curioso Command (Dinámico)
// ============================================================

import { generateTextWithAI } from "../lib/aiGenerator.js";
import { randomElement } from "../lib/utils.js";

const fallbackFacts = [
  "Los pulpos tienen tres corazones y sangre azul.",
  "Los delfines duermen con un ojo abierto.",
  "El ADN humano es 60% similar al de un plátano."
];

const handler = async (m) => {
  const prompt = "Proporciona un dato curioso e interesante en español sobre ciencia, naturaleza, historia o el universo. Responde ÚNICAMENTE con el dato curioso, sin introducciones.";
  const fact = await generateTextWithAI(prompt, randomElement(fallbackFacts));

  await m.reply(
    `✦━【 *DATO CURIOSO* 】━✦\n\n\n🤓 ${fact}\n╰────────`
  );
};

handler.command = /^(dato|fact|curiosidad|sabias)$/i;
handler.description = "Obtener un dato curioso generado por IA";
handler.category = "daily";

export default handler;

