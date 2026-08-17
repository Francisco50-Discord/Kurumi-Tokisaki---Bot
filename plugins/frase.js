// ============================================================
//   Kurumi Tokisaki - Frase Motivacional Command (Dinámico)
// ============================================================

import { randomElement } from "../lib/utils.js";

const localQuotes = [
  { text: "El éxito es la suma de pequeños esfuerzos repetidos día tras día.", author: "Robert Collier" },
  { text: "La única forma de hacer un gran trabajo es amar lo que haces.", author: "Steve Jobs" },
  { text: "Cree que puedes y ya estás a medio camino.", author: "Theodore Roosevelt" },
  { text: "El futuro depende de lo que haces hoy.", author: "Mahatma Gandhi" },
  { text: "No cuentes los días, haz que los días cuenten.", author: "Muhammad Ali" },
  { text: "La vida es 10% lo que te ocurre y 90% cómo reaccionas.", author: "Charles R. Swindoll" },
  { text: "Siempre parece imposible hasta que se hace.", author: "Nelson Mandela" },
  { text: "El comienzo es la parte más importante del trabajo.", author: "Platón" },
  { text: "La energía y la persistencia conquistan todas las cosas.", author: "Benjamin Franklin" },
  { text: "Actúa como si lo que haces marcara la diferencia. Porque la marca.", author: "William James" },
  { text: "La disciplina es el puente entre las metas y los logros.", author: "Jim Rohn" },
  { text: "El único modo de hacer un gran trabajo es amar lo que haces.", author: "Steve Jobs" },
  { text: "No tienes que ser grande para empezar, pero tienes que empezar para ser grande.", author: "Zig Ziglar" },
  { text: "La mente es todo. Te conviertes en lo que piensas.", author: "Buda" },
  { text: "La excelencia no es un acto, sino un hábito.", author: "Aristóteles" },
  { text: "La oportunidad se pierde al estar ocupados buscando otra.", author: "Publilio Siro" },
  { text: "La mejor manera de predecir el futuro es crearlo.", author: "Peter Drucker" },
  { text: "El éxito no es definitivo y el fracaso no es fatal: lo que cuenta es el valor para continuar.", author: "Winston Churchill" },
  { text: "La felicidad no es algo hecho; proviene de tus propias acciones.", author: "Dalái Lama" },
  { text: "Cada día es una nueva oportunidad para cambiar tu vida.", author: "Anónimo" },
  { text: "Haz lo que puedas, con lo que tengas, donde estés.", author: "Theodore Roosevelt" },
  { text: "La acción es la clave fundamental de todo éxito.", author: "Pablo Picasso" },
  { text: "El secreto para salir adelante es comenzar.", author: "Mark Twain" },
  { text: "Si puedes soñarlo, puedes hacerlo.", author: "Walt Disney" },
  { text: "La persistencia es el camino del éxito.", author: "Charles Chaplin" },
];

const handler = async (m) => {
  const quote = randomElement(localQuotes);
  const quoteText = quote.text;
  const author = quote.author;

  await m.reply(
    `✦━【 *FRASE MOTIVACIONAL* 】━✦\n\n\n✨ "${quoteText}"\n\n— *${author}*\n╰────────`
  );
};

handler.command = /^(frase|quote|motivacion|motivación)$/i;
handler.description = "Obtener una frase motivacional del banco local";
handler.category = "daily";

export default handler;

