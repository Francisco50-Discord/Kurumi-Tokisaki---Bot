// ============================================================
//   Kurumi Tokisaki - Traducir Command
// ============================================================

import axios from "axios";

const supportedLangs = {
  es: "Español", en: "Inglés", ja: "Japonés", ko: "Coreano",
  fr: "Francés", de: "Alemán", pt: "Portugués", it: "Italiano",
  zh: "Chino", ru: "Ruso", ar: "Árabe",
};

const handler = async (m, { args, conn, usedPrefix }) => {
  let targetLang = "es";
  let text = "";

  if (args.length > 0 && supportedLangs[args[0].toLowerCase()]) {
    targetLang = args[0].toLowerCase();
    text = args.slice(1).join(" ");
  } else if (args.length > 0) {
    text = args.join(" ");
  }

  // Si el usuario cita un mensaje, tomar el texto del mensaje citado
  if (!text && m.quoted?.text) {
    text = m.quoted.text;
  }

  if (!text) {
    return m.reply(
      `✦━【 🌐 *TRADUCIR* 】━✦\n\n` +
      `📝 Traduce texto o mensajes a otro idioma sin límite de caracteres.\n\n` +
      `💡 Sintaxis:\n` +
      `  \`${usedPrefix}traducir <idioma> <texto>\`\n` +
      `  \`${usedPrefix}traducir <idioma>\` (respondiendo a un mensaje)\n\n` +
      `📌 Ejemplos:\n` +
      `  \`${usedPrefix}traducir en Hola mundo\`\n` +
      `  \`${usedPrefix}traducir ja Buenos días\`\n\n` +
      `🌐 Idiomas soportados:\n` +
      `  ${Object.keys(supportedLangs).join(", ")}`
    );
  }

  try {
    // Google Translate GTX endpoint (Soporta textos largos, saltos de línea y formato)
    const gUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
    const res = await axios.get(gUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      timeout: 20000,
    });

    let translatedText = "";
    if (Array.isArray(res.data?.[0])) {
      translatedText = res.data[0].map((item) => item?.[0] || "").join("");
    }

    if (!translatedText || !translatedText.trim()) {
      translatedText = text;
    }

    const responseText =
      `✦━【 🌐 *TRADUCCIÓN (${(supportedLangs[targetLang] || targetLang).toUpperCase()})* 】━✦\n\n` +
      `${translatedText.trim()}`;

    await m.reply(responseText);
  } catch (err) {
    await m.reply(`❌ *Error al traducir el texto. Intenta de nuevo.*`);
  }
};

handler.command = /^(traducir|translate|trans)$/i;
handler.description = "Traducir textos o mensajes respondiendo a ellos";
handler.category = "herramientas";

export default handler;

