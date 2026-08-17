// ============================================================
//   Kurumi Tokisaki - Reto Command (Dinámico)
// ============================================================

import { generateTextWithAI } from "../lib/aiGenerator.js";
import { randomElement } from "../lib/utils.js";

const fallbackDares = [
  "Envía una selfie haciendo una cara graciosa",
  "Escribe un poema gracioso de 4 versos sobre un miembro del grupo",
  "Imita a un animal durante 30 segundos en una nota de voz"
];

const handler = async (m) => {
  const prompt = "Genera un reto divertido, gracioso e inocente para un grupo de WhatsApp en español. Responde ÚNICAMENTE con el texto del reto, sin introducciones.";
  const dare = await generateTextWithAI(prompt, randomElement(fallbackDares));

  await m.reply(
    `✦━【 🎯 *RETO* 】━✦\n\n🎯 @${m.sender.split("@")[0]}, tu reto:\n"${dare.replace(/^["'«]+|["'»]+$/g, "")}"\n╰──────`,
    { mentions: [m.sender] }
  );
};

handler.command = /^(reto|dare)$/i;
handler.description = "Obtener un reto generado por IA";
handler.category = "juegos";

export default handler;

