// ============================================================
//   Kurumi Tokisaki - Dato Curioso Command (Dinámico)
// ============================================================

import { randomElement } from "../lib/utils.js";

const localFacts = [
  "Los pulpos tienen tres corazones y sangre azul.",
  "Los delfines duermen con un ojo abierto.",
  "El ADN humano comparte cerca de la mitad de sus genes con un plátano.",
  "La miel puede conservarse durante miles de años si permanece bien sellada.",
  "Un día en Venus dura más que un año en Venus.",
  "Las jirafas tienen la misma cantidad de vértebras cervicales que los humanos: siete.",
  "Los plátanos son bayas desde el punto de vista botánico, pero las fresas no.",
  "La Torre Eiffel puede crecer varios centímetros durante el calor del verano.",
  "Los tiburones existen desde antes que los árboles.",
  "La luz del Sol tarda aproximadamente ocho minutos y veinte segundos en llegar a la Tierra.",
  "Los koalas tienen huellas dactilares muy parecidas a las humanas.",
  "El corazón de un camarón está en la cabeza.",
  "Saturno tiene una densidad media menor que la del agua.",
  "Las mariposas saborean usando receptores ubicados en sus patas.",
  "El sonido viaja más rápido en el agua que en el aire.",
  "La Gran Muralla China no se distingue a simple vista desde la Luna.",
  "Los cuervos pueden reconocer rostros humanos y recordar a quienes los trataron mal.",
  "El bambú puede crecer casi un metro en un solo día en algunas especies.",
  "La sangre de los cangrejos herradura es azul por una proteína basada en cobre.",
  "Los rayos pueden calentar el aire a temperaturas superiores a la superficie del Sol.",
  "La Antártida es el desierto más grande del planeta por sus escasas precipitaciones.",
  "Los gatos no pueden percibir el sabor dulce como lo hacemos los humanos.",
  "El corazón de una ballena azul puede pesar tanto como un automóvil pequeño.",
  "La nariz humana puede distinguir una enorme cantidad de olores diferentes.",
  "Los árboles pueden comunicarse mediante redes de hongos bajo el suelo.",
];

const handler = async (m) => {
  const fact = randomElement(localFacts);

  await m.reply(
    `✦━【 *DATO CURIOSO* 】━✦\n\n\n🤓 ${fact}\n╰────────`
  );
};

handler.command = /^(dato|fact|curiosidad|sabias)$/i;
handler.description = "Obtener un dato curioso del banco local";
handler.category = "daily";

export default handler;

