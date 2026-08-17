// ============================================================
//   Kurumi Tokisaki - Ahorcado Command
//   Juego interactivo de ahorcado con .before hook
// ============================================================

import { randomElement } from "../lib/utils.js";
import { addCoins, addExp } from "../lib/database.js";
import { generateTextWithAI } from "../lib/aiGenerator.js";

const hangmanGames = global.hangmanGames = global.hangmanGames || new Map();

const fallbackWordList = [
  "javascript", "programacion", "computadora", "internet", "tecnologia",
  "musica", "pelicula", "animacion", "aventura", "fantasia",
  "dragon", "castillo", "princesa", "guerrero", "magia",
  "chocolate", "helado", "pizza", "hamburguesa", "tacos",
  "mexico", "japon", "corea", "brasil", "argentina",
  "futbol", "baloncesto", "tenis", "natacion", "atletismo",
  "espanol", "inteligencia", "universo", "galaxia", "estrella"
];

const hangmanStages = [
  "```\n  +---+\n  |   |\n      |\n      |\n      |\n      |\n=========```",
  "```\n  +---+\n  |   |\n  O   |\n      |\n      |\n      |\n=========```",
  "```\n  +---+\n  |   |\n  O   |\n  |   |\n      |\n      |\n=========```",
  "```\n  +---+\n  |   |\n  O   |\n /|   |\n      |\n      |\n=========```",
  "```\n  +---+\n  |   |\n  O   |\n /|\\  |\n      |\n      |\n=========```",
  "```\n  +---+\n  |   |\n  O   |\n /|\\  |\n /    |\n      |\n=========```",
  "```\n  +---+\n  |   |\n  O   |\n /|\\  |\n / \\  |\n      |\n=========```",
];

const handler = async (m, { chatId, sender, usedPrefix }) => {
  if (hangmanGames.has(chatId)) {
    const game = hangmanGames.get(chatId);
    const display = game.word
      .split("")
      .map((l) => (game.guessed.includes(l) ? l : "_"))
      .join(" ");

    return m.reply(
      `✦━【 *AHORCADO EN CURSO* 】━✦\n` +
      `\n` +
      `${hangmanStages[game.errors]}\n` +
      `\n` +
      `📝 Palabra: ${display.toUpperCase()}\n` +
      `❌ Errores: ${game.errors}/6\n` +
      `🔤 Usadas: ${game.guessed.join(", ").toUpperCase() || "ninguna"}\n` +
      `💡 Envía una letra\n` +
      ``
    );
  }

  // Generar palabra de forma dinámica con IA
  let word = "";
  try {
    const categories = ["animales", "tecnología", "comida", "geografía", "anime", "deportes", "mitología", "objetos", "naturaleza"];
    const cat = randomElement(categories);
    const aiWord = await generateTextWithAI(
      `Dame una sola palabra común y divertida en español sobre el tema '${cat}', de entre 5 y 10 letras, sin tildes ni caracteres especiales, todo en minúsculas. Responde ÚNICAMENTE con la palabra.`,
      ""
    );

    const cleanAiWord = (aiWord || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z]/g, "");
    if (cleanAiWord && cleanAiWord.length >= 4 && cleanAiWord.length <= 12) {
      word = cleanAiWord;
    }
  } catch (e) {}

  if (!word) {
    word = randomElement(fallbackWordList);
  }

  hangmanGames.set(chatId, {
    word,
    guessed: [],
    errors: 0,
    starter: sender,
    timeout: setTimeout(() => {
      hangmanGames.delete(chatId);
    }, 300000),
  });

  const display = "_ ".repeat(word.length).trim();
  await m.reply(
    `✦━【 *¡AHORCADO!* 】━✦\n` +
    `\n` +
    `${hangmanStages[0]}\n` +
    `\n` +
    `📝 Palabra: ${display}\n` +
    `📏 Longitud: ${word.length} letras\n` +
    `💡 Envía 1 letra (ej: *a*)\n` +
    ``
  );
};

// ============================================================
// Hangman letter / word handler via .before hook
// ============================================================
handler.before = async (m, { conn, chatId, sender }) => {
  const game = hangmanGames.get(chatId);
  if (!game) return false;

  const rawText = (m.text || "").trim().toLowerCase();
  if (!rawText) return false;

  // Si el mensaje es largo (> 25 caracteres), no es intento de ahorcado
  if (rawText.length > 25) return false;

  // 1. Un solo carácter: intento de letra
  if (/^[a-záéíóúñ]$/.test(rawText)) {
    const letter = rawText;

    if (game.guessed.includes(letter)) {
      await m.reply(`⚠️ *Atención*\n────────\nYa habías intentado la letra *${letter.toUpperCase()}*`);
      return true;
    }

    game.guessed.push(letter);

    if (game.word.includes(letter)) {
      const display = game.word
        .split("")
        .map((l) => (game.guessed.includes(l) ? l : "_"))
        .join(" ");

      if (!display.includes("_")) {
        clearTimeout(game.timeout);
        hangmanGames.delete(chatId);
        addCoins(sender, 100);
        addExp(sender, 50);

        await m.reply(
          `✦━【 *¡VICTORIA EN AHORCADO!* 】━✦\n` +
          `\n` +
          `🎉 @${sender.split("@")[0]} acertó!\n` +
          `📝 Palabra: *${game.word.toUpperCase()}*\n` +
          `🪙 +100 monedas | ⭐ +50 EXP\n` +
          ``,
          { mentions: [sender] }
        );
        return true;
      }

      await m.reply(
        `✦━【 *LETRA CORRECTA* 】━✦\n` +
        `\n` +
        `${hangmanStages[game.errors]}\n` +
        `\n` +
        `📝 Palabra: ${display.toUpperCase()}\n` +
        `❌ Errores: ${game.errors}/6\n` +
        `🔤 Usadas: ${game.guessed.join(", ").toUpperCase()}\n` +
        ``
      );
    } else {
      game.errors++;

      if (game.errors >= 6) {
        clearTimeout(game.timeout);
        hangmanGames.delete(chatId);
        await m.reply(
          `✦━【 *¡DERROTA EN AHORCADO!* 】━✦\n` +
          `\n` +
          `${hangmanStages[6]}\n` +
          `\n` +
          `❌ Se agotaron los intentos.\n` +
          `📝 Palabra: *${game.word.toUpperCase()}*\n` +
          ``
        );
        return true;
      }

      const display = game.word
        .split("")
        .map((l) => (game.guessed.includes(l) ? l : "_"))
        .join(" ");

      await m.reply(
        `✦━【 *LETRA INCORRECTA* 】━✦\n` +
        `\n` +
        `${hangmanStages[game.errors]}\n` +
        `\n` +
        `📝 Palabra: ${display.toUpperCase()}\n` +
        `❌ Errores: ${game.errors}/6\n` +
        `🔤 Usadas: ${game.guessed.join(", ").toUpperCase()}\n` +
        ``
      );
    }
    return true;
  }

  // 2. Intento de palabra completa
  if (rawText.length === game.word.length && /^[a-záéíóúñ]+$/.test(rawText)) {
    if (rawText === game.word) {
      clearTimeout(game.timeout);
      hangmanGames.delete(chatId);
      addCoins(sender, 150);
      addExp(sender, 75);

      await m.reply(
        `✦━【 *¡VICTORIA EXTRAORDINARIA!* 】━✦\n` +
        `\n` +
        `🎉 @${sender.split("@")[0]} adivinó la palabra!\n` +
        `📝 Palabra: *${game.word.toUpperCase()}*\n` +
        `🪙 +150 monedas | ⭐ +75 EXP\n` +
        ``,
        { mentions: [sender] }
      );
      return true;
    }
  }

  return false;
};

handler.command = /^(ahorcado|hangman|adivinalapalabra)$/i;
handler.description = "Jugar al ahorcado";
handler.category = "juegos";

export default handler;
