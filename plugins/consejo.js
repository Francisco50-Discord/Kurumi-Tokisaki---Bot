// ============================================================
//   Kurumi Tokisaki - Consejo Command (Dinámico)
// ============================================================

import { randomElement } from "../lib/utils.js";

const localAdvice = [
  "No te compares con los demás, compárate con quien eras ayer.",
  "La perseverancia es la clave del éxito.",
  "El tiempo es el recurso más valioso que tienes.",
  "Haz hoy una tarea pequeña que tu yo del futuro agradecerá.",
  "No confundas descansar con rendirte; recuperarte también es avanzar.",
  "Pon límites claros: cuidar tu paz también es una responsabilidad.",
  "Celebra tus avances, incluso cuando todavía no hayas llegado a la meta.",
  "Si algo te preocupa, escríbelo; ordenar tus pensamientos reduce su peso.",
  "Aprende a decir no sin sentir que debes dar una explicación interminable.",
  "Compara tu progreso con el de ayer, no con el escaparate de los demás.",
  "Un error analizado puede convertirse en una guía para la próxima decisión.",
  "Cuida tu sueño: muchas decisiones se ven distintas después de descansar.",
  "Rodéate de personas que respeten tus límites y celebren tu crecimiento.",
  "Divide los problemas grandes en pasos que puedas completar en menos de una hora.",
  "Antes de responder con enojo, date unos segundos para elegir tus palabras.",
  "Aprender algo nuevo es más importante que aparentar saberlo todo.",
  "Ahorra un poco cuando puedas; la tranquilidad también se construye con hábitos.",
  "No esperes motivación perfecta: empieza con cinco minutos y deja que el impulso aparezca.",
  "Cuida la forma en que te hablas; tu diálogo interno también necesita respeto.",
  "Cuando una puerta se cierre, revisa si realmente querías entrar por ella.",
  "Pide claridad en lugar de adivinar lo que otras personas piensan.",
  "Haz espacio para jugar y disfrutar; la productividad no es toda tu identidad.",
  "Si una decisión es reversible, no la conviertas en una fuente eterna de ansiedad.",
  "Agradece algo concreto cada día para entrenar tu atención hacia lo que sí funciona.",
  "Tu valor no depende de la velocidad con la que alcances los objetivos de alguien más.",
];

const handler = async (m) => {
  const advice = randomElement(localAdvice);

  await m.reply(
    `✦━【 *CONSEJO DEL DÍA* 】━✦\n\n\n💡 "${advice.replace(/^["'«]+|["'»]+$/g, "")}"\n╰────────`
  );
};

handler.command = /^(consejo|advice|tip)$/i;
handler.description = "Obtener un consejo del banco local";
handler.category = "daily";

export default handler;

