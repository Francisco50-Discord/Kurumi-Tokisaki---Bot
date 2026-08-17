// ============================================================
//   Kurumi Tokisaki - Horóscopo Command
//   v21.0: API real (horoscope-app-api) + fallback aleatorio local.
// ============================================================

import axios from "axios";
import { randomInt, randomElement } from "../lib/utils.js";
import { translateToSpanish } from "../lib/translator.js";

const signs = {
  aries: { emoji: "♈", en: "Aries" },
  tauro: { emoji: "♉", en: "Taurus" },
  geminis: { emoji: "♊", en: "Gemini" },
  gemini: { emoji: "♊", en: "Gemini" },
  cancer: { emoji: "♋", en: "Cancer" },
  leo: { emoji: "♌", en: "Leo" },
  virgo: { emoji: "♍", en: "Virgo" },
  libra: { emoji: "♎", en: "Libra" },
  escorpio: { emoji: "♏", en: "Scorpio" },
  scorpio: { emoji: "♏", en: "Scorpio" },
  sagitario: { emoji: "♐", en: "Sagittarius" },
  capricornio: { emoji: "♑", en: "Capricorn" },
  acuario: { emoji: "♒", en: "Aquarius" },
  piscis: { emoji: "♓", en: "Pisces" },
};

const localFortunes = [
  "Los astros te favorecen hoy. Es un buen día para tomar decisiones importantes.",
  "Presta atención a las oportunidades que se presentan. El universo está de tu lado.",
  "Un día para reflexionar y planificar. La paciencia será tu mejor aliada.",
  "Las relaciones personales estarán en el centro de atención. Cuida a quienes amas.",
  "Un cambio inesperado podría traer grandes beneficios. Mantente abierto.",
  "Tu creatividad está en su punto máximo. Aprovéchala al máximo.",
  "La fortuna sonríe a los valientes. No temas dar el primer paso.",
  "Es momento de dejar atrás lo que ya no te sirve. Renuévate.",
  "Una conversación sincera puede despejar una duda que llevas tiempo guardando.",
  "Tu energía pide orden: termina una tarea pendiente antes de empezar tres nuevas.",
  "Una coincidencia aparentemente pequeña podría abrirte una puerta interesante.",
  "Hoy conviene escuchar con calma antes de sacar conclusiones apresuradas.",
  "Tu intuición está afinada, pero combinarla con datos hará tus decisiones más fuertes.",
  "Un gesto amable regresará a ti de una forma inesperada.",
  "La paciencia con alguien cercano evitará un malentendido innecesario.",
  "Es un buen momento para revisar tus metas y quedarte con las que realmente deseas.",
  "El descanso será más productivo que forzarte cuando tu energía ya está baja.",
  "Un plan sencillo y constante tendrá mejores resultados que una promesa espectacular.",
  "La suerte aparece cuando te permites probar un camino diferente.",
  "Una idea que anotaste hace tiempo merece una segunda oportunidad.",
  "Pon atención a tus gastos pequeños: ordenar lo cotidiano dará espacio a tus planes.",
  "Una nueva conexión puede convertirse en una amistad valiosa si muestras autenticidad.",
  "No necesitas resolverlo todo hoy; avanzar un paso también cuenta como progreso.",
  "Tu voz merece ser escuchada, especialmente cuando hablas con respeto y claridad.",
  "Cierra el día reconociendo algo que hiciste bien, aunque haya sido sencillo.",
];

const handler = async (m, { args, usedPrefix }) => {
  if (!args[0] || !signs[args[0].toLowerCase()]) {
    const signList = Object.entries(signs).map(([k, v]) => `${v.emoji} ${k}`).join(" | ");
    return m.reply(
      `✦━【 *HORÓSCOPO* 】━✦\n` +
      `\n\n` +
      `📝 Consulta tu horóscopo.\n` +
      `💡 Sintaxis:\n` +
      `   \`${usedPrefix}horoscopo <signo>\`\n` +
      `📌 Ejemplo:\n` +
      `   \`${usedPrefix}horoscopo aries\`\n` +
      `\n\n` +
      `Signos disponibles:\n` +
      `${signList}`
    );
  }

  const signKey = args[0].toLowerCase();
  const sign = signs[signKey];
  const enSign = sign.en;

  await m.reply(`⏳ *Consultando los astros para ${sign.emoji} ${signKey.toUpperCase()}...*`);

  // v21.0: API real (horoscope-app-api.vercel.app) — gratuita, sin API key
  try {
    const res = await axios.get(
      `https://horoscope-app-api.vercel.app/api/v1/get-horoscope/daily?sign=${enSign.toLowerCase()}&day=today`,
      { timeout: 12000, headers: { "User-Agent": "Mozilla/5.0" } }
    );

    const horoscopeTextRaw = res.data?.data?.horoscope;
    const date = res.data?.data?.date;

    if (horoscopeTextRaw) {
      const horoscopeText = await translateToSpanish(horoscopeTextRaw);
      let response = `✦━【 *HORÓSCOPO: ${signKey.toUpperCase()} ${sign.emoji}* 】━✦\n`;
      response += `\n\n`;
      response += `📅 ${date || new Date().toLocaleDateString("es-MX")}\n`;
      response += `🔮 ${horoscopeText}\n\n`;
      response += `💫 Número de la suerte: ${randomInt(1, 99)}\n`;
      response += `🎨 Color del día: ${randomElement(["Rojo", "Azul", "Verde", "Amarillo", "Morado", "Naranja"])}\n`;
      response += ``;
      return m.reply(response);
    }
  } catch (e) {}

  // Fallback local si la API externa no responde.
  const fortuneText = randomElement(localFortunes);

  const areas = ["Amor", "Trabajo", "Salud", "Dinero"];
  const ratings = ["⭐", "⭐⭐", "⭐⭐⭐", "⭐⭐⭐⭐", "⭐⭐⭐⭐⭐"];

  let response = `✦━【 *HORÓSCOPO: ${signKey.toUpperCase()} ${sign.emoji}* 】━✦\n`;
  response += `\n\n`;
  response += `🔮 ${fortuneText}\n\n`;

  for (const area of areas) {
    response += `${area}: ${randomElement(ratings)}\n`;
  }

  response += `\n💫 Número de la suerte: ${randomInt(1, 99)}\n`;
  response += `🎨 Color del día: ${randomElement(["Rojo", "Azul", "Verde", "Amarillo", "Morado", "Naranja"])}\n`;
  response += ``;

  await m.reply(response);
};

handler.command = /^(horoscopo|horóscopo|signo|astros)$/i;
handler.description = "Ver el horóscopo";
handler.category = "daily";

export default handler;
