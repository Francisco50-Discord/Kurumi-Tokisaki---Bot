// ============================================================
//   Kurumi Tokisaki - Verdad Command (Dinámico)
// ============================================================

import { randomElement } from "../lib/utils.js";

const localTruths = [
  "¿Cuál es tu mayor miedo en la vida?",
  "¿Cuál es la mentira más tonta que has dicho?",
  "¿Qué es lo más vergonzoso que te ha pasado?",
  "¿Qué hábito extraño tienes cuando nadie te ve?",
  "¿Cuál fue tu primer apodo y quién te lo puso?",
  "¿Qué canción te sabes completa pero te da pena admitirlo?",
  "¿Qué comida finges que te gusta para no quedar mal?",
  "¿Cuál ha sido tu peor excusa para cancelar un plan?",
  "¿Qué personaje de anime se parece más a tu personalidad?",
  "¿Qué pequeño logro te hace sentir orgulloso?",
  "¿Cuál fue la última búsqueda curiosa que hiciste en internet?",
  "¿Qué objeto perderías primero si tuvieras que mudarte mañana?",
  "¿Qué talento inútil te gustaría dominar?",
  "¿Cuál es el mensaje más raro que has recibido?",
  "¿Qué película puedes volver a ver sin cansarte?",
  "¿Qué decisión impulsiva terminó saliendo bien?",
  "¿Qué cosa te hace reír aunque sea muy absurda?",
  "¿Cuál es tu mayor manía al conversar por chat?",
  "¿Qué lugar te gustaría visitar al menos una vez?",
  "¿Qué consejo ignoraste y luego descubriste que era cierto?",
  "¿Cuál es la compra más innecesaria que has hecho?",
  "¿Qué superpoder elegirías si solo pudiera funcionar una hora al día?",
  "¿Qué recuerdo de la infancia todavía te hace sonreír?",
  "¿Qué palabra pronunciaste mal durante mucho tiempo?",
  "¿Qué harías si fueras invisible durante una hora?",
];

const handler = async (m) => {
  const truth = randomElement(localTruths);

  await m.reply(
    `✦━【 💬 *VERDAD* 】━✦\n\n💬 @${m.sender.split("@")[0]}, tu pregunta:\n"${truth.replace(/^["'«]+|["'»]+$/g, "")}"\n╰──────`,
    { mentions: [m.sender] }
  );
};

handler.command = /^(verdad|truth)$/i;
handler.description = "Obtener una pregunta de verdad del banco local";
handler.category = "juegos";

export default handler;

