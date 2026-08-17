// ============================================================
//   Kurumi Tokisaki - Trivia Command (100% en Español)
//   Juego interactivo + Validador de respuestas sin prefijo
// ============================================================

import { addCoins, addExp } from "../lib/database.js";
import { randomElement } from "../lib/utils.js";
import { generateTextWithAI } from "../lib/aiGenerator.js";

const triviaGames = global.triviaGames = global.triviaGames || new Map();

// Banco masivo de preguntas de trivia en español
const spanishTriviaBank = [
  // CULTURA GENERAL
  {
    category: "Cultura General",
    difficulty: "Fácil",
    question: "¿Cuál es el río más largo del mundo?",
    correct: "Amazonas",
    incorrect: ["Nilo", "Misisipi", "Yangtsé"]
  },
  {
    category: "Cultura General",
    difficulty: "Fácil",
    question: "¿Cuál es el país más extenso del mundo por superficie?",
    correct: "Rusia",
    incorrect: ["Canadá", "China", "Estados Unidos"]
  },
  {
    category: "Cultura General",
    difficulty: "Media",
    question: "¿Cuál es el océano más grande de la Tierra?",
    correct: "Océano Pacífico",
    incorrect: ["Océano Atlántico", "Océano Índico", "Océano Ártico"]
  },
  {
    category: "Cultura General",
    difficulty: "Fácil",
    question: "¿En qué continente se encuentra el desierto del Sahara?",
    correct: "África",
    incorrect: ["Asia", "América", "Oceanía"]
  },
  {
    category: "Cultura General",
    difficulty: "Fácil",
    question: "¿Cuál es la capital de Francia?",
    correct: "París",
    incorrect: ["Londres", "Madrid", "Roma"]
  },
  {
    category: "Cultura General",
    difficulty: "Media",
    question: "¿Cuál es el idioma más hablado en el mundo por hablantes nativos?",
    correct: "Chino Mandarín",
    incorrect: ["Inglés", "Español", "Hindi"]
  },
  {
    category: "Cultura General",
    difficulty: "Fácil",
    question: "¿Cuántos días tiene un año bisiesto?",
    correct: "366",
    incorrect: ["365", "364", "367"]
  },
  {
    category: "Cultura General",
    difficulty: "Media",
    question: "¿En qué país se encuentran las famosas Pirámides de Guiza?",
    correct: "Egipto",
    incorrect: ["México", "Grecia", "Perú"]
  },
  {
    category: "Cultura General",
    difficulty: "Fácil",
    question: "¿Cuál es el metal más precioso y maleable utilizado ampliamente en joyería?",
    correct: "Oro",
    incorrect: ["Plata", "Cobre", "Bronce"]
  },

  // CIENCIA Y TECNOLOGÍA
  {
    category: "Ciencia y Tecnología",
    difficulty: "Fácil",
    question: "¿Cuál es la fórmula química del agua?",
    correct: "H2O",
    incorrect: ["CO2", "O2", "NaCl"]
  },
  {
    category: "Ciencia y Tecnología",
    difficulty: "Media",
    question: "¿Cuál es el planeta más cercano al Sol?",
    correct: "Mercurio",
    incorrect: ["Venus", "Tierra", "Marte"]
  },
  {
    category: "Ciencia y Tecnología",
    difficulty: "Fácil",
    question: "¿Cuál es el animal terrestre más rápido del mundo?",
    correct: "Guepardo",
    incorrect: ["León", "Gazela", "Leopardo"]
  },
  {
    category: "Ciencia y Tecnología",
    difficulty: "Difícil",
    question: "¿Cuál es el elemento químico más abundante en el universo?",
    correct: "Hidrógeno",
    incorrect: ["Helio", "Oxígeno", "Carbono"]
  },
  {
    category: "Ciencia y Tecnología",
    difficulty: "Media",
    question: "¿Quién formuló la Teoría de la Relatividad General?",
    correct: "Albert Einstein",
    incorrect: ["Isaac Newton", "Nikola Tesla", "Stephen Hawking"]
  },
  {
    category: "Ciencia y Tecnología",
    difficulty: "Fácil",
    question: "¿Qué órgano del cuerpo humano bombea la sangre a todo el organismo?",
    correct: "El corazón",
    incorrect: ["Los pulmones", "El cerebro", "El hígado"]
  },
  {
    category: "Ciencia y Tecnología",
    difficulty: "Media",
    question: "¿Cuál es el planeta más grande de nuestro sistema solar?",
    correct: "Júpiter",
    incorrect: ["Saturno", "Neptuno", "Urano"]
  },
  {
    category: "Ciencia y Tecnología",
    difficulty: "Difícil",
    question: "¿A qué velocidad viaja la luz en el vacío aproximadamente?",
    correct: "300,000 km/s",
    incorrect: ["150,000 km/s", "500,000 km/s", "1,000,000 km/s"]
  },

  // ANIME Y MANGA
  {
    category: "Anime y Manga",
    difficulty: "Fácil",
    question: "¿Quién es el protagonista de 'One Piece' que sueña con ser el Rey de los Piratas?",
    correct: "Monkey D. Luffy",
    incorrect: ["Roronoa Zoro", "Vinsmoke Sanji", "Portgas D. Ace"]
  },
  {
    category: "Anime y Manga",
    difficulty: "Fácil",
    question: "¿Cuál es el nombre del zorro de nueve colas sellado en Naruto?",
    correct: "Kurama",
    incorrect: ["Shukaku", "Gyuki", "Matatabi"]
  },
  {
    category: "Anime y Manga",
    difficulty: "Fácil",
    question: "En 'Dragon Ball Z', ¿de qué planeta proviene originalmente Goku?",
    correct: "Planeta Vegeta",
    incorrect: ["Planeta Namek", "Tierra", "Planeta Kaiosama"]
  },
  {
    category: "Anime y Manga",
    difficulty: "Media",
    question: "¿Quién es el espíritu del tiempo con vestido astral rojo y negro en 'Date A Live'?",
    correct: "Kurumi Tokisaki",
    incorrect: ["Tohka Yatogami", "Kotori Itsuka", "Origami Tobiichi"]
  },
  {
    category: "Anime y Manga",
    difficulty: "Media",
    question: "¿Cómo se llama la libreta que causa la muerte de cualquier persona cuyo nombre sea escrito en ella?",
    correct: "Death Note",
    incorrect: ["Future Diary", "Book of Circus", "Grimoire"]
  },
  {
    category: "Anime y Manga",
    difficulty: "Media",
    question: "En 'Demon Slayer' (Kimetsu no Yaiba), ¿cuál es el nombre de la hermana de Tanjiro?",
    correct: "Nezuko Kamado",
    incorrect: ["Kanao Tsuyuri", "Shinobu Kocho", "Mitsuri Kanroji"]
  },
  {
    category: "Anime y Manga",
    difficulty: "Difícil",
    question: "¿Cómo se llama el Titán principal que posee Eren Jaeger en 'Attack on Titan'?",
    correct: "Titán de Ataque",
    incorrect: ["Titán Colosal", "Titán Acorazado", "Titán Bestia"]
  },

  // VIDEOJUEGOS
  {
    category: "Videojuegos",
    difficulty: "Fácil",
    question: "¿Cómo se llama el hermano menor de Mario en la saga de Nintendo?",
    correct: "Luigi",
    incorrect: ["Wario", "Yoshi", "Toad"]
  },
  {
    category: "Videojuegos",
    difficulty: "Fácil",
    question: "¿Cuál es el videojuego tipo sandbox más vendido de todos los tiempos?",
    correct: "Minecraft",
    incorrect: ["Tetris", "GTA V", "Wii Sports"]
  },
  {
    category: "Videojuegos",
    difficulty: "Media",
    question: "¿Quién es el héroe hyliano protagonista de la saga 'The Legend of Zelda'?",
    correct: "Link",
    incorrect: ["Zelda", "Ganon", "Navi"]
  },
  {
    category: "Videojuegos",
    difficulty: "Media",
    question: "¿Cuál es la mascota azul oficial de SEGA conocida por su supervelocidad?",
    correct: "Sonic the Hedgehog",
    incorrect: ["Tails", "Knuckles", "Shadow"]
  },
  {
    category: "Videojuegos",
    difficulty: "Difícil",
    question: "¿Qué estudio desarrolló el aclamado juego 'God of War' de 2018?",
    correct: "Santa Monica Studio",
    incorrect: ["Naughty Dog", "Capcom", "FromSoftware"]
  },

  // HISTORIA Y GEOGRAFÍA
  {
    category: "Historia",
    difficulty: "Fácil",
    question: "¿En qué año comenzó la Segunda Guerra Mundial?",
    correct: "1939",
    incorrect: ["1914", "1945", "1936"]
  },
  {
    category: "Historia",
    difficulty: "Media",
    question: "¿Quién fue el primer presidente de los Estados Unidos?",
    correct: "George Washington",
    incorrect: ["Abraham Lincoln", "Thomas Jefferson", "Benjamin Franklin"]
  },
  {
    category: "Geografía",
    difficulty: "Fácil",
    question: "¿Cuál es la capital de Japón?",
    correct: "Tokio",
    incorrect: ["Kioto", "Osaka", "Yokohama"]
  },
  {
    category: "Geografía",
    difficulty: "Media",
    question: "¿En qué país de Sudamérica se encuentra la antigua fortaleza inca de Machu Picchu?",
    correct: "Perú",
    incorrect: ["Bolivia", "Colombia", "Chile"]
  },

  // CINE Y TV
  {
    category: "Cine y TV",
    difficulty: "Fácil",
    question: "¿Cómo se llama el ogro verde protagonista de las películas de animación de DreamWorks?",
    correct: "Shrek",
    incorrect: ["Fiona", "Burro", "Gato con Botas"]
  },
  {
    category: "Cine y TV",
    difficulty: "Media",
    question: "¿Qué superhéroe de DC Comics es conocido como 'El Caballero de la Noche'?",
    correct: "Batman",
    incorrect: ["Superman", "Spider-Man", "Flash"]
  },

  // DEPORTES
  {
    category: "Deportes",
    difficulty: "Fácil",
    question: "¿Cuántos jugadores por equipo están en la cancha durante un partido de fútbol?",
    correct: "11",
    incorrect: ["10", "12", "9"]
  },
  {
    category: "Deportes",
    difficulty: "Media",
    question: "¿Qué país ha ganado la mayor cantidad de Copas Mundiales de Fútbol de la FIFA?",
    correct: "Brasil",
    incorrect: ["Alemania", "Argentina", "Italia"]
  },

  // LITERATURA Y ARTE
  {
    category: "Literatura",
    difficulty: "Fácil",
    question: "¿Quién es el autor del clásico libro 'Don Quijote de la Mancha'?",
    correct: "Miguel de Cervantes",
    incorrect: ["Gabriel García Márquez", "William Shakespeare", "Federico García Lorca"]
  },
  {
    category: "Arte",
    difficulty: "Fácil",
    question: "¿Quién pintó la famosa obra renacentista de la 'Mona Lisa'?",
    correct: "Leonardo da Vinci",
    incorrect: ["Pablo Picasso", "Vincent van Gogh", "Michelangelo"]
  }
];

const handler = async (m, { conn, chatId, sender, args }) => {
  if (triviaGames.has(chatId)) {
    const game = triviaGames.get(chatId);

    const sub = (args[0] || "").toLowerCase().trim();
    if (sub === "cancelar" || sub === "cancel" || sub === "stop") {
      clearTimeout(game.timeout);
      triviaGames.delete(chatId);
      return m.reply(
        `✦━【 🔄 *TRIVIA CANCELADA* 】━✦\n` +
        `» La trivia activa ha sido cancelada.`
      );
    }

    // Para reset, nuevo o cualquier llamada a !trivia sin args: reinicia inmediatamente
    clearTimeout(game.timeout);
    triviaGames.delete(chatId);
  }

  // Intentar generar pregunta dinámica con IA
  let q = null;
  try {
    const categories = ["Cultura General", "Ciencia y Tecnología", "Anime y Manga", "Geografía e Historia", "Cine y Entretenimiento", "Videojuegos", "Música"];
    const cat = randomElement(categories);
    const aiJson = await generateTextWithAI(
      `Genera una pregunta de trivia sobre '${cat}' en español. Responde ÚNICAMENTE en JSON con el formato: {"category":"${cat}","difficulty":"Media","question":"¿Pregunta?","correct":"Respuesta Correcta","incorrect":["Opción 1","Opción 2","Opción 3"]}`,
      ""
    );
    if (aiJson) {
      const match = aiJson.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        if (parsed.question && parsed.correct && Array.isArray(parsed.incorrect) && parsed.incorrect.length >= 3) {
          q = parsed;
        }
      }
    }
  } catch (e) {}

  if (!q) {
    q = randomElement(spanishTriviaBank);
  }

  const question = q.question;
  const correct = q.correct;
  const incorrect = q.incorrect;
  const allAnswers = [...incorrect, correct].sort(() => Math.random() - 0.5);

  const letters = ["A", "B", "C", "D"];
  const correctLetter = letters[allAnswers.indexOf(correct)];

  const optionsMap = {
    A: allAnswers[0],
    B: allAnswers[1],
    C: allAnswers[2],
    D: allAnswers[3],
  };

  let questionText = `✦━【 ❓ *TRIVIA EN ESPAÑOL* 】━✦\n`;
  questionText += `◈ *Cat:* ${q.category} | ⚡ *Dif:* ${q.difficulty}\n\n`;
  questionText += `❓ *${question}*\n\n`;
  allAnswers.forEach((a, i) => {
    questionText += `» *${letters[i]}*. ${a}\n`;
  });
  questionText += `\n⏱️ Tiempo: 45s | 💡 Responde: *A, B, C o D*`;

  await m.reply(questionText);

  triviaGames.set(chatId, {
    category: q.category,
    difficulty: q.difficulty,
    question,
    correctLetter,
    correctAnswer: correct,
    options: optionsMap,
    starter: sender,
    timeout: setTimeout(() => {
      if (triviaGames.has(chatId)) {
        triviaGames.delete(chatId);
        conn.sendMessage(chatId, {
          text: `✦━【 ⏰ *TRIVIA AGOTADA* 】━✦\n» Tiempo agotado.\n» 💡 Correcta: *${correctLetter}. ${correct}*`,
        });
      }
    }, 45000),
  });
};

// ============================================================
// Interactive answer handler via .before hook
// ============================================================
handler.before = async (m, { conn, chatId, sender }) => {
  const game = triviaGames.get(chatId);
  if (!game) return false;

  const rawText = (m.text || "").trim();
  if (!rawText) return false;

  // Si el mensaje es una conversación muy larga (> 50 caracteres) y no es una cita del bot, ignorar
  const isQuoted = m.messageContent?.extendedTextMessage?.contextInfo?.quotedMessage;
  if (rawText.length > 50 && !isQuoted) return false;

  const cleanText = rawText.toLowerCase().replace(/[^a-z0-9áéíóúñ\s]/gi, "").trim();

  let chosenLetter = null;

  // 1. Coincidencia exacta de letra: A, B, C, D
  if (/^[abcd]$/i.test(rawText.trim())) {
    chosenLetter = rawText.trim().toUpperCase();
  }
  // 2. Formato con puntos u oraciones: "A.", "B)", "la A", "es la B", "opcion C", "respuesta D"
  else {
    const letterMatch = rawText.match(/\b(es\s+la|opci[oó]n|respuesta|la)?\s*([a-d])[\.\)]?\b/i);
    if (letterMatch) {
      chosenLetter = letterMatch[2].toUpperCase();
    }
  }

  // 3. Coincidencia por texto de la opción
  if (!chosenLetter && game.options) {
    for (const [letter, optionText] of Object.entries(game.options)) {
      const cleanOption = optionText.toLowerCase().replace(/[^a-z0-9áéíóúñ\s]/gi, "").trim();
      if (cleanOption && (cleanText === cleanOption || cleanText.includes(cleanOption))) {
        chosenLetter = letter;
        break;
      }
    }
  }

  if (!chosenLetter || !["A", "B", "C", "D"].includes(chosenLetter)) {
    return false;
  }

  // Se detectó una respuesta para la trivia activa
  clearTimeout(game.timeout);
  triviaGames.delete(chatId);

  const isCorrect = chosenLetter === game.correctLetter;

  if (isCorrect) {
    addCoins(sender, 50);
    addExp(sender, 25);

    await m.reply(
      `✦━【 🎉 *¡RESPUESTA CORRECTA!* 】━✦\n\n` +
      `🎉 @${sender.split("@")[0]} acertó!\n` +
      `📌 Correcta: *${chosenLetter}. ${game.correctAnswer}*\n` +
      `🪙 +50 monedas | ⭐ +25 EXP`,
      { mentions: [sender] }
    );
  } else {
    await m.reply(
      `✦━【 ❌ *¡RESPUESTA INCORRECTA!* 】━✦\n\n` +
      `❌ @${sender.split("@")[0]} eligió *${chosenLetter}*\n` +
      `💡 Correcta: *${game.correctLetter}. ${game.correctAnswer}*`,
      { mentions: [sender] }
    );
  }

  return true; // Mensaje procesado, detiene la propagación a IA u otros comandos
};

handler.command = /^(trivia|pregunta|quiz)$/i;
handler.description = "Jugar a la trivia en español";
handler.category = "juegos";
handler.cooldown = 5;

export default handler;
