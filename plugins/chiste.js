// ============================================================
//   Kurumi Tokisaki - Chiste Command (Dinámico e Infinito)
// ============================================================

import { randomElement } from "../lib/utils.js";

const localJokes = [
  "¿Qué le dice un bit al otro?\nNos vemos en el bus 🚌",
  "¿Qué hace una abeja en el gimnasio?\nZumba 🐝",
  "¿Qué le dijo el 0 al 8?\nBonito cinturón 🥋",
  "¿Por qué el libro de matemáticas estaba triste?\nPorque tenía demasiados problemas.",
  "¿Qué hace una computadora cuando tiene frío?\nCierra Windows.",
  "¿Cómo se despiden los químicos?\nÁcido un placer.",
  "¿Qué le dijo una pared a la otra?\nNos vemos en la esquina.",
  "¿Cuál es el colmo de un jardinero?\nQue siempre lo dejen plantado.",
  "¿Por qué el tomate se puso rojo?\nPorque vio la ensalada desnuda.",
  "¿Qué hace una vaca con los ojos cerrados?\nLeche concentrada.",
  "¿Cómo se llama el campeón de buceo japonés?\nTokofondo.",
  "¿Y el subcampeón?\nKasitoko.",
  "¿Qué le dijo el café al azúcar?\nSin ti mi vida es amarga.",
  "¿Cuál es el animal más antiguo?\nLa cebra, porque está en blanco y negro.",
  "¿Qué hace un pez?\n¡Nada! 🐟",
  "¿Qué le dijo el semáforo al coche?\nNo me mires, me estoy cambiando.",
  "¿Por qué la escoba llegó tarde?\nPorque se quedó barriendo el camino.",
  "¿Cuál es el colmo de un fotógrafo?\nQue se le revele todo.",
  "¿Qué hace un perro con un taladro?\nTaladrando, no haciendo perrerías.",
  "¿Por qué el lápiz fue al médico?\nPorque se sentía sin punta.",
  "¿Qué le dice una iguana a su hermana gemela?\nSomos iguanitas.",
  "¿Cuál es el café más peligroso?\nEl ex-preso.",
  "¿Qué le dijo una impresora a otra?\n¿Esa hoja es tuya o es impresión mía?",
  "¿Por qué el calendario está feliz?\nPorque tiene todos sus días contados.",
  "¿Qué hace una naranja en la playa?\nToma el sol y se pone de buen zumo.",
];

const handler = async (m) => {
  const joke = randomElement(localJokes);

  await m.reply(
    `✦━【 *CHISTE DEL DÍA* 】━✦\n\n\n${joke}\n╰────────`
  );
};

handler.command = /^(chiste|joke|humor|broma)$/i;
handler.description = "Obtener un chiste aleatorio del banco local";
handler.category = "daily";

export default handler;

