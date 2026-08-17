// ============================================================
//   Kurumi Tokisaki - 8ball Command (Dinámico)
// ============================================================

import { randomElement } from "../lib/utils.js";

const localResponses = [
  "🟢 Sí, definitivamente.",
  "🟢 Es cierto y los astros lo confirman.",
  "🟢 Puedes contar con ello.",
  "🟢 Sin duda, el camino está despejado.",
  "🟢 Las señales apuntan a un sí rotundo.",
  "🟢 Todo indica que ocurrirá antes de lo que imaginas.",
  "🟢 La suerte está de tu lado esta vez.",
  "🟢 Sí, pero tendrás que dar el primer paso.",
  "🟢 Los dados del destino acaban de sonreírte.",
  "🟡 Respuesta confusa, la energía no está clara.",
  "🟡 Pregunta de nuevo cuando el universo esté menos ocupado.",
  "🟡 Hay posibilidades, pero nada está escrito todavía.",
  "🟡 Las señales están divididas; observa un poco más.",
  "🟡 Tal vez, si corriges el rumbo a tiempo.",
  "🟡 El oráculo necesita más contexto y una buena merienda.",
  "🟡 No es el momento de decidir: espera una señal más.",
  "🔴 Mis fuentes dicen que no.",
  "🔴 Las perspectivas no son buenas.",
  "🔴 El destino recomienda no hacerlo.",
  "🔴 Definitivamente no; ni Kurumi puede maquillarlo.",
  "🔴 La respuesta es no por ahora.",
  "🔴 Ese camino parece llevar directo al caos.",
  "🔴 El universo cerró esa puerta con llave.",
  "🔴 No cuentes con ello, busca un plan alternativo.",
  "🔴 Las estrellas dicen que necesitas pensarlo mejor.",
];

const handler = async (m, { args, body, usedPrefix }) => {
  if (!body) {
    return m.reply(
      `✦━【 *BOLA MÁGICA 8* 】━✦\n\n` +
      `📝 Pregunta algo a la bola mágica.\n` +
      `💡 Sintaxis:\n` +
      `   \`${usedPrefix}8ball <pregunta>\`\n` +
      `📌 Ejemplo:\n` +
      `   \`${usedPrefix}8ball ¿Voy a tener suerte hoy?\``
    );
  }

  const answer = randomElement(localResponses);

  await m.reply(
    `✦━【 *BOLA MÁGICA 8* 】━✦\n\n` +
    `❓ *Pregunta:* ${body}\n\n` +
    `🔮 *Respuesta:* ${answer}\n\n✨ *Kurumi Tokisaki*`
  );
};

handler.command = /^(8ball|bola8|magia|oraculo|oráculo)$/i;
handler.description = "Pregúntale a la bola mágica (respuesta mística local)";
handler.category = "juegos";

export default handler;

