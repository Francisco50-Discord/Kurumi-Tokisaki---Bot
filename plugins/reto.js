// ============================================================
//   Kurumi Tokisaki - Reto Command (Dinámico)
// ============================================================

import { randomElement } from "../lib/utils.js";

const localDares = [
  "Envía una selfie haciendo una cara graciosa.",
  "Escribe un poema gracioso de 4 versos sobre un miembro del grupo.",
  "Imita a un animal durante 30 segundos en una nota de voz.",
  "Escribe tu siguiente mensaje usando solo tres palabras.",
  "Cambia tu estado por una frase dramática durante diez minutos.",
  "Describe tu desayuno como si fuera una reseña de restaurante de lujo.",
  "Envía un audio diciendo el abecedario con voz de presentador de noticias.",
  "Cuenta un chiste malo sin reírte mientras lo dices.",
  "Escribe una mini historia de terror en exactamente dos líneas.",
  "Usa tres emojis para resumir tu día y deja que el grupo adivine el contexto.",
  "Haz una lista de cinco cosas que llevarías a una isla desierta.",
  "Escribe una frase romántica dirigida a un objeto de la habitación.",
  "Imita durante un mensaje la forma de hablar de un personaje de anime.",
  "Comparte una recomendación de canción y explica tu elección en una oración.",
  "Inventa un nombre de superhéroe para la persona que escribió antes que tú.",
  "Escribe un trabalenguas y reta al siguiente participante a repetirlo.",
  "Describe tu película favorita sin decir su título ni sus personajes.",
  "Manda una foto de algo azul que tengas cerca.",
  "Escribe un mensaje completamente en mayúsculas y termina con una disculpa teatral.",
  "Cuenta una anécdota vergonzosa pero apta para todo público.",
  "Inventa un nuevo sabor de helado y ponle un nombre extravagante.",
  "Haz una predicción absurda sobre lo que pasará en el grupo mañana.",
  "Escribe un consejo como si fueras un sabio de un videojuego.",
  "Manda un audio de cinco segundos celebrando algo pequeño de tu día.",
  "Crea un eslogan para el grupo en menos de diez palabras.",
];

const handler = async (m) => {
  const dare = randomElement(localDares);

  await m.reply(
    `✦━【 🎯 *RETO* 】━✦\n\n🎯 @${m.sender.split("@")[0]}, tu reto:\n"${dare.replace(/^["'«]+|["'»]+$/g, "")}"\n╰──────`,
    { mentions: [m.sender] }
  );
};

handler.command = /^(reto|dare)$/i;
handler.description = "Obtener un reto aleatorio del banco local";
handler.category = "juegos";

export default handler;

