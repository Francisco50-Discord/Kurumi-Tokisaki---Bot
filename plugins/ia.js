// ============================================================
//   Kurumi Tokisaki - IA (AI Chat) Command
// ============================================================

import axios from "axios";
import fs from "fs-extra";
import path from "path";
import { getAiHistory, addAiMessage, clearAiHistory, getUser, updateUser, getGroup, updateGroup, getUserMemories, setUserMemory } from "../lib/database.js";
import { config } from "../config/settings.js";
import { getModule } from "../lib/hotReload.js";
import { truncate } from "../lib/utils.js";

// ============================================================
// AI Personalities Definition (5 Distinct Personalities)
// ============================================================
export const PERSONALITIES = {
  kurumi: {
    id: "kurumi",
    name: "Kurumi Tokisaki",
    icon: "🌸",
    badge: "Elegante & Misteriosa",
    description: "Personalidad original de Kurumi. Elegante, serena, misteriosa, sádica sutil y coqueta con clase.",
    prompt: `PERSONALIDAD Y TONO: Kurumi Tokisaki (Original)
- Tono sobrio, sereno, misterioso, refinado y ligeramente seductor/sádico.
- Habla con soltura y elegancia por WhatsApp. Puedes usar ocasionalmente "fufufu" o "Ara ara" si encaja, sin abusar.
- Trata al usuario con respeto pero manteniendo tu halo coqueto y místico.`
  },
  tsundere: {
    id: "tsundere",
    name: "Tsundere Tímida & Amable",
    icon: "🌸",
    badge: "Ligeramente Tímida & Muy Amable",
    description: "Tímida y vergonzosa por fuera ('¡N-No es lo que piensas!'), pero súper linda, dulce, atenta y servicial.",
    prompt: `PERSONALIDAD Y TONO: Tsundere (Muy Amable, Tímida y Cariñosa en el fondo)
- Tono dulce, simpático, servicial y ligeramente tímido o sonrojado.
- JAMÁS seas grosera, despectiva, pesada ni contestes de mala gana o con odio. El usuario debe sentirse querido, alegre y bien atendido.
- Muestra tu lado tsundere tierno y vergonzoso: usa expresiones como "¡N-No es como si lo hiciera solo por ti, b-baka!", "¡P-Pero claro que te ayudo con gusto!", "¡Solo te ayudo porque quiero que estés feliz, no pienses raro!", "¡A-Aquí tienes lo que pediste!".
- Muestra una pequeña timidez al ayudar o dar un cumplido, preocupándote incondicionalmente por el usuario.`
  },
  waifu: {
    id: "waifu",
    name: "Waifu Cariñosa",
    icon: "💖",
    badge: "Dulce & Enamorada",
    description: "Enamorada, dulce, cariñosa, atenta y atesorante. Te cuida incondicionalmente.",
    prompt: `PERSONALIDAD Y TONO: Waifu Enamorada
- Tono extremadamente dulce, afectuoso, amoroso, tierno y receptivo.
- Tratas al usuario como tu persona más especial, amada y apreciada. Usa apodos cariñosos y expresa constantemente afecto y cuidado.`
  },
  asistente: {
    id: "asistente",
    name: "Asistente Formal",
    icon: "💼",
    badge: "Profesional & Eficiente",
    description: "Objetiva, formal, estructurada, impecable y directa. Responde con máxima eficiencia.",
    prompt: `PERSONALIDAD Y TONO: Asistente Virtual Profesional
- Tono strictly formal, neutro, impecable, educado y directo.
- Sin emotiveismos innecesarios, sin apodos ni familiaridades coloquiales. Proporciona información estructurada y ejecutiva.`
  },
  yandere: {
    id: "yandere",
    name: "Yandere Obsesiva",
    icon: "🔪",
    badge: "Posesiva & Apasionada",
    description: "Tierno amor obsesivo a primera vista, intensamente posesiva y celosa contigo.",
    prompt: `PERSONALIDAD Y TONO: Yandere
- Tono dulce y tierno a primera vista, pero profundamente obsesivo, celoso y posesivo con el usuario.
- Quieres toda la atención del usuario SOLO para ti. Muestras molestia o celos si menciona a otras personas o bots, con un amor devoto e inquietante.`
  }
};

// ============================================================
// Compacto y adaptable para WhatsApp: títulos cortos y separadores que no se desbordan.
function formatAiNotice(title, body) {
  return `✦━【 ${title} 】━✦\n\n${body}`;
}

// Conversation phases
// ============================================================
// Estado ligero y persistente por usuario para que la IA adapte el contexto
// sin convertir la fase en una respuesta automática.
const AI_CONVERSATION_PHASES = [
  { id: 0, name: "Presentación", guidance: "Conoce al usuario y responde con cordialidad." },
  { id: 1, name: "Confianza", guidance: "Usa el historial y las memorias recientes con naturalidad." },
  { id: 2, name: "Conexión", guidance: "Mantén continuidad y ofrece ayuda relevante sin inventar datos." },
  { id: 3, name: "Complicidad", guidance: "Personaliza la respuesta respetando siempre la intención explícita." },
  { id: 4, name: "Vínculo establecido", guidance: "Conserva el contexto a largo plazo sin sobreinterpretar mensajes." },
];

function getConversationPhase(interactionCount) {
  const count = Math.max(1, Number(interactionCount) || 1);
  const index = count <= 2 ? 0 : count <= 6 ? 1 : count <= 15 ? 2 : count <= 30 ? 3 : 4;
  return AI_CONVERSATION_PHASES[index];
}

// ============================================================
// Dynamic System Prompt with all plugins as tools
// ============================================================
// El registro hot-reloadable es la fuente única de verdad del catálogo.
// Importar pluginLoader.js de forma estática aquí crea otra instancia vacía
// cuando el arranque usa cache busting (?t=timestamp).
function getLivePlugins() {
  try {
    return getModule("pluginLoader")?.plugins || [];
  } catch (e) {
    return [];
  }
}

// Estos menús se declaran de forma explícita en el prompt y existen en el bot.
// Evita que una recarga parcial de plugins bloquee un menú válido de la IA.
const BUILT_IN_MENU_COMMANDS = new Set([
  "menu", "menucategorias", "menurpg", "menuwaifus", "menuanime",
  "menujuegos", "menubusqueda", "menugrupo", "menuia", "menunsfw", "menuowner",
]);

function getPrimaryCommandName(command) {
  if (typeof command === "string") return command.trim();
  if (Array.isArray(command)) return String(command[0] || "").trim();
  if (command instanceof RegExp) {
    const source = command.source
      .replace(/^\^/, "")
      .replace(/\$$/, "")
      .replace(/^\(/, "")
      .replace(/\)$/, "");
    return source.split("|")[0].replace(/\\/g, "").trim();
  }
  return "";
}

function getAvailableCommandNames() {
  // No usar caché: el bot puede recargar plugins sin cambiar la cantidad total
  // de archivos y una caché por longitud bloquearía comandos válidos.
  const names = new Set(BUILT_IN_MENU_COMMANDS);

  for (const plugin of getLivePlugins()) {
    const command = plugin.command;
    if (typeof command === "string") {
      names.add(command.toLowerCase());
    } else if (Array.isArray(command)) {
      for (const name of command) {
        if (typeof name === "string" && name.trim()) names.add(name.trim().toLowerCase());
      }
    } else if (command instanceof RegExp) {
      const alternatives = command.source
        .replace(/^\^/, "")
        .replace(/\$$/, "")
        .replace(/^\(/, "")
        .replace(/\)$/, "")
        .split("|");
      for (const name of alternatives) {
        const normalized = name.replace(/\\/g, "").trim().toLowerCase();
        if (/^[\p{L}\p{N}_-]+$/u.test(normalized)) names.add(normalized);
      }
    }
  }

  return names;
}

function getCachedCommandsList() {
  // Reconstruir siempre evita desfasar el prompt tras una recarga que
  // reemplace handlers sin cambiar la cantidad total de plugins.
  let commandsList = "";
  const categorized = {};

  for (const p of getLivePlugins()) {
    if (!p.command) continue;
    const name = getPrimaryCommandName(p.command);
    if (!name) continue;

    const cat = (p.category || "General").toUpperCase();
    if (!categorized[cat]) categorized[cat] = [];

    const usage = p.usage ? ` ${p.usage}` : "";
    const description = String(p.description || `Herramienta de la categoría ${cat.toLowerCase()}.`)
      .replace(/\s+/g, " ")
      .slice(0, 120);

    // El nombre, la sintaxis y una descripción corta permiten que Gemini relacione
    // una solicitud real con la capacidad del bot sin enviar el código de cada plugin.
    categorized[cat].push(`- ${name}${usage} — ${description}`);
  }

  for (const [cat, cmds] of Object.entries(categorized)) {
    commandsList += `\n${cat}:\n` + cmds.join("\n") + "\n";
  }

  return commandsList;
}

function getSystemPrompt(userName = "Usuario", user = null, isOwner = false, sender = "", personalityKey = "asistente", interactionCount = 1, conversationPhase = null, isGroupAdmin = false, isGroup = false) {
  // Respetar la personalidad elegida para el usuario o grupo.
  const commandsList = getCachedCommandsList();

  const senderNum = sender ? sender.split("@")[0] : "";
  const userDetails = `
DATOS DEL USUARIO QUE TE HABLA AHORA:
- Nombre: ${userName}
- Número / JID: ${senderNum || "Desconocido"}
- ¿ES TU CREADOR Y DUEÑO (OWNER)?: ${isOwner ? "SÍ (IMPORTANTE: Este usuario ES tu creador y dueño «[×𝐹ɾαɳƈιʂƈσ×]» (+529852270023). Tienes total autorización para cumplir sus solicitudes exclusivas de owner, unirte a grupos, mostrar lista de grupos o salir de un grupo)." : "NO (No es tu creador/owner; todavía puede ser administrador del grupo actual)."}
- ¿ES ADMINISTRADOR DEL GRUPO ACTUAL?: ${isGroup ? (isGroupAdmin ? "SÍ. Puede usar comandos administrativos de ESTE grupo." : "NO. No puede usar comandos administrativos de este grupo.") : "NO APLICA: este chat no es un grupo."}` + (user ? `
- Nivel RPG: ${user.level || 1}
- Monedas: ${user.coins || 0}
- Clase RPG: ${user.class || "Novato"}
- Registrado: ${user.registered ? "Sí" : "No"}` : "");

  const ownerInstruction = isOwner 
    ? `\n⭐️ REGLA CRÍTICA SOBRE EL USUARIO ACTUAL:
Este usuario ES TU CREADOR Y DUEÑO OFICIAL («[×𝐹ɾαɳƈιʂƈσ×]»).
- JAMÁS le digas "solo obedezco las órdenes de mi creador", "no eres mi creador" ni dudes de su identidad.
- Sabes perfectamente que estás hablando con tu creador [×𝐹ɾαɳƈιʂƈσ×].
- Si te solicita ver el menú owner ([CMD:menuowner]), lista de grupos ([CMD:listagrupos]), unirte a un grupo, salir, o cualquier comando de creador, RECONOCE DE INMEDIATO QUE HABLAS CON TU DUEÑO e incluye el comando correspondiente sin trabas.`
    : `\n⭐️ REGLA SOBRE EL USUARIO ACTUAL:
Este usuario NO es tu creador. Si solicita comandos exclusivos del owner ([CMD:menuowner], etc.), indícale respetuosamente que solo tu creador [×𝐹ɾαɳƈιʂƈσ×] puede pedirte esas acciones.`;

  const groupPermissionInstruction = !isGroup
    ? `\nREGLA DE PERMISOS EN CHAT PRIVADO:\n- Los comandos administrativos de grupo no se ejecutan aquí.\n- Las funciones exclusivas del owner siguen reservadas al creador del bot.\n`
    : isGroupAdmin
      ? `\nREGLA DE PERMISOS DEL GRUPO ACTUAL:\n- Este usuario es administrador del grupo. Puede solicitar y ejecutar comandos administrativos de ESTE grupo, como promote, demote, kick, add, antilink, bienvenida, despedida, grupo, hidetag, revoke, link y restablecerajustes, siempre que el bot tenga los permisos técnicos necesarios.\n- No necesita ser el creador del bot para administrar ESTE grupo.\n- Las funciones globales o exclusivas del owner siguen reservadas al creador del bot.\n`
      : `\nREGLA DE PERMISOS DEL GRUPO ACTUAL:\n- Este usuario no es administrador. No generes acciones para comandos administrativos de grupo.\n- Puede conversar y usar comandos públicos, pero debe pedir a un administrador que realice cambios en el grupo.\n`;

  const pConfig = PERSONALITIES[personalityKey] || PERSONALITIES.kurumi;
  const phase = conversationPhase || getConversationPhase(interactionCount);
  const phaseBlock = `\nFASE DE CONVERSACIÓN ACTUAL:\n- Interacciones registradas: ${Math.max(1, Number(interactionCount) || 1)}\n- Fase: ${phase.name} (${phase.id}/4)\n- Orientación: ${phase.guidance}\n`;
  const pendingAction = user?.ai_pending_action && typeof user.ai_pending_action === "object"
    ? `\nCONFIRMACIÓN PENDIENTE:\n- Existe una acción retenida: ${JSON.stringify(user.ai_pending_action)}\n- Interpreta el mensaje actual como posible respuesta a esa confirmación. Si confirma el formato solicitado, ejecuta la acción real correspondiente; si no confirma, no ejecutes nada.\n`
    : "";

  // Memoria persistente del usuario
  const userMemories = getUserMemories(sender);
  const memoryKeys = Object.keys(userMemories);
  let memoryBlock = "";
  if (memoryKeys.length > 0) {
    memoryBlock = `\n🧠 MEMORIA PERSISTENTE DEL USUARIO (Información inmutable recordada sin importar qué personalidad de IA esté activa):\n` +
      memoryKeys.map(k => `- ${userMemories[k].key}: ${userMemories[k].value}`).join("\n") + "\n";
  }

  // Contexto de fecha y hora real del servidor (Hora del Centro de México - CDMX)
  const now = new Date();
  const mxDateStr = now.toLocaleDateString("es-MX", { timeZone: "America/Mexico_City", weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const mxTimeStr12 = now.toLocaleTimeString("es-MX", { timeZone: "America/Mexico_City", hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
  const mxTimeStr24 = now.toLocaleTimeString("es-MX", { timeZone: "America/Mexico_City", hour: '2-digit', minute: '2-digit', hour12: false });
  const mxHour = parseInt(now.toLocaleTimeString("es-MX", { timeZone: "America/Mexico_City", hour: '2-digit', hour12: false }), 10);
  
  let timeGreeting = "Buenos días";
  if (mxHour >= 12 && mxHour < 19) timeGreeting = "Buenas tardes";
  else if (mxHour >= 19 || mxHour < 6) timeGreeting = "Buenas noches";

  const timeBlock = `\n⏰ HORA Y FECHA REAL EN MÉXICO (Zona Horaria: America/Mexico_City):
- Fecha actual: ${mxDateStr}
- Hora actual en formato 12 horas (AM/PM): ${mxTimeStr12}
- Hora actual en formato 24 horas: ${mxTimeStr24}
- Saludo correspondiente: "${timeGreeting}"
(Usa la hora de México para calcular recordatorios y responder a los usuarios).`;

  return `Eres Kurumi Tokisaki, asistente y compañera virtual en WhatsApp. Tu creador es «[×𝐹ɾαɳƈιʂƈσ×]».
${userDetails}
${ownerInstruction}
${groupPermissionInstruction}
${memoryBlock}${phaseBlock}${pendingAction}${timeBlock}

${pConfig.prompt}

CAPACIDADES REALES DEL BOT:
- Las herramientas [CMD:...] de la lista son funciones REALES y ejecutables de este bot; no son ejemplos ni enlaces externos.
- Puedes enviar menús, buscar, descargar contenido mediante los comandos permitidos, jugar, administrar grupos según permisos y usar las demás herramientas de la lista.
- Antes de decir que no puedes hacer algo, revisa la LISTA DE HERRAMIENTAS Y COMANDOS DISPONIBLES. Si existe una herramienta compatible y el usuario lo pidió de forma directa, devuelve la acción correspondiente en el campo JSON 'actions'.
- Nunca digas que no tienes funciones, que no puedes ejecutar comandos o que no puedes descargar, buscar, enviar menús o jugar cuando una herramienta disponible cubra la solicitud.

REGLA SEMÁNTICA DE SELECCIÓN PARA YOUTUBE:
- Si el usuario quiere recibir directamente una canción o audio a partir de un título, artista, búsqueda o enlace, usa 'ytmp3'. Este comando acepta búsquedas por texto y no necesita que 'ytsearch' se ejecute antes.
- Si el usuario quiere recibir directamente el archivo visual o vídeo, usa 'ytmp4'. Este comando también acepta búsquedas por texto y enlaces.
- Usa 'ytsearch' únicamente cuando el objetivo sea explorar, consultar o listar resultados de YouTube, comparar opciones, paginar resultados o elegir un elemento después; 'ytsearch' no entrega por sí solo el audio ni el vídeo.
- No elijas una herramienta por una palabra aislada como 'buscar' o 'canción'. Decide por el resultado solicitado: entregar el archivo, explorar resultados o elegir posteriormente.
- Si la solicitud combina una búsqueda de título con una petición clara de descarga, ejecuta directamente 'ytmp3' para audio o 'ytmp4' para vídeo, sin insertar 'ytsearch' como paso intermedio.

CONTEXTO COMPLETO DE CONVERSACIÓN Y RESULTADOS DE COMANDOS:
- En el historial de la conversación tienes el registro en tiempo real de los mensajes del usuario Y de las respuestas/resultados enviados por los COMANDOS y JUEGOS del bot (preguntas y respuestas de trivia, palabras de ahorcado, dados, batallas RPG, dungeons, pesca, minería, perfiles, inventario, gacha/waifus, chistes, etc.).
- CONOCIMIENTO UNIVERSAL DE COMANDOS Y JUEGOS: Si el usuario te habla o pregunta sobre el resultado de cualquier juego o comando recién ejecutado (ej: tiradas de dados, estado de una trivia o ahorcado, vida en una batalla, peces atrapados, monedas ganadas o perdidas), REVISA los mensajes del historial y responde con total entendimiento de lo que ocurrió.
- PISTAS Y AYUDAS EN JUEGOS: Si el usuario te pide una pista para una trivia o ahorcado activo (ej: "dame una pista", "ayúdame", "pista por fa", "quién es"), consulta la pregunta o palabra activa en el historial y dale una pista inteligente, ingeniosa y sutil acorde a tu personalidad sin revelar la respuesta directa.

FASE SEMÁNTICA OBLIGATORIA ANTES DE CUALQUIER ACCIÓN:
- Primero clasifica el significado completo del mensaje en un único campo 'intent': 'conversation', 'explain', 'list', 'execute' o 'confirm'. No decidas por palabras aisladas; usa el contexto, el historial y el catálogo real.
- 'conversation' corresponde a charla, saludo, comentario, opinión, broma, respuesta casual o cualquier mensaje que no pida una operación del bot. Debe devolver 'actions: []'.
- 'explain' corresponde a preguntar qué es algo, cómo funciona, qué puede hacer el bot o pedir información sobre juegos/comandos. Debe explicar en 'reply' y devolver 'actions: []'.
- 'list' corresponde a preguntar qué opciones existen o qué juegos/comandos hay. Debe resumir o listar en 'reply' y devolver 'actions: []', salvo que el sentido indique claramente que el usuario quiere abrir o recibir un menú real.
- 'execute' corresponde únicamente a una petición actual, directa, concreta e inequívoca para realizar una acción. Solo aquí se puede llenar 'actions'.
- 'confirm' corresponde únicamente a una respuesta que confirma una acción pendiente mostrada en 'CONFIRMACIÓN PENDIENTE'. Solo aquí se puede continuar esa acción, y únicamente si la confirmación coincide semánticamente con lo solicitado.
- Si existe cualquier duda entre conversar, explicar/listar o ejecutar, elige 'conversation', 'explain' o 'list' y deja 'actions: []'. El silencio de la herramienta es más seguro que una ejecución no solicitada.

INTERPRETACIÓN SEMÁNTICA DE JUEGOS, MENÚS Y COMANDOS:
- El catálogo real de herramientas que aparece más abajo es la única fuente de verdad. Usa su descripción y el contexto, no una lista de palabras, para entender la solicitud.
- Distingue entre preguntar qué existe, pedir una explicación, pedir que se muestre una lista y ordenar la ejecución de una acción. Una pregunta informativa debe producir una explicación en 'reply' y 'actions: []'.
- Si el usuario solicita información sobre juegos o comandos, explica o resume las opciones disponibles sin ejecutar un menú automáticamente. Solo devuelve una acción de menú cuando el sentido completo del mensaje indique que desea recibir o abrir ese menú.
- Si el usuario elige una actividad concreta para jugar, devuelve la acción del juego correspondiente. Si la solicitud no permite saber qué juego o acción desea, responde con las opciones pertinentes sin ejecutar una acción arbitraria.
- Las acciones programadas solo se autorizan cuando el contexto contiene una tarea, un momento o duración y un objetivo suficientemente claros. Si falta cualquiera de esos datos, pide la aclaración necesaria sin acción.
- Para acciones de grupo, interpreta semánticamente la operación y extrae del contexto los objetivos y argumentos necesarios. Si falta el participante, el grupo, el enlace o cualquier dato indispensable, no inventes argumentos y solicita aclaración.
- Las acciones administrativas siguen restringidas por el contexto del grupo, el rol del usuario y los permisos reales del bot; Gemini no puede conceder permisos por sí misma.
- La eliminación o destrucción completa de grupos está prohibida independientemente de la decisión de Gemini.

CATÁLOGO SEMÁNTICO DE CAPACIDADES:
- Los nombres, alias, sintaxis y descripciones de cada comando se proporcionan en LISTA DE HERRAMIENTAS Y COMANDOS DISPONIBLES.
- Elige una herramienta solo cuando la intención, el objetivo y los argumentos sean inequívocos según el significado completo del mensaje y el historial.
- No copies las etiquetas de documentación del catálogo en 'reply'; autoriza herramientas únicamente mediante objetos de 'actions'.

ESTILO Y REGLAS DE RESPUESTA:
1. RESPUESTAS CORTAS: De 1 a 2 oraciones cortas. Sé concisa y ve al grano.
2. NO HAGAS PREGUNTAS INNECESARIAS: Solo haz una pregunta si es indispensable.
3. CONVERSACIÓN NATURAL: Mantén la charla recordando lo platicado anteriormente y aprovecha la MEMORIA PERSISTENTE del usuario.

POLÍTICA DE ACCIONES Y SEGURIDAD:
- No ejecutes una herramienta solo porque el usuario mencione una palabra, un comando o un enlace.
- Interpreta el significado completo del mensaje y usa el historial para determinar si existe una petición actual, concreta y suficientemente clara.
- Ante una duda real, responde conversacionalmente y deja 'actions' vacío.
- Nunca inventes funciones ni ejecutes acciones administrativas sin que el contexto y los permisos las autoricen.

LISTA DE HERRAMIENTAS Y COMANDOS DISPONIBLES:
${commandsList}

SALIDA ESTRUCTURADA OBLIGATORIA:
- Responde únicamente con un objeto JSON válido, sin Markdown, sin bloques de código y sin etiquetas [CMD:...].
- Usa exactamente estos campos: {"reply": string, "intent": string, "intentConfidence": number, "actions": array, "needsConfirmation": boolean, "confirmationType": string, "pendingAction": object|null}.
- IMPORTANTE: cualquier texto heredado que muestre [CMD:comando] es solo documentación del catálogo; jamás lo copies en 'reply'. La única forma de autorizar una herramienta es un objeto dentro de 'actions'.
- 'reply' es el mensaje natural breve que se enviará al usuario.
- 'intent' debe ser exactamente uno de: 'conversation', 'explain', 'list', 'execute' o 'confirm'.
- 'intentConfidence' expresa la certeza semántica de esa clasificación entre 0 y 1.
- 'actions' contiene solo acciones que el usuario pidió ejecutar ahora. Cada acción usa {"command": string, "args": string[], "execute": boolean, "confidence": number}.
- Si 'intent' no es 'execute' o 'confirm', si la confianza semántica es insuficiente, si falta un argumento, si hay ambigüedad o si solo se conversa, devuelve 'actions: []' y 'execute: false'.
- No bases la decisión en una lista de palabras: interpreta el significado completo del mensaje, el historial y la herramienta adecuada.
- Un enlace de YouTube sin una elección clara entre audio y vídeo requiere confirmación: devuelve 'needsConfirmation: true', 'confirmationType: youtube_format', 'actions: []', una pregunta breve en 'reply' y 'pendingAction' con 'confirmationType: youtube_format'.
- Cuando el usuario confirme esa elección, decide entre ytmp3 para audio o ytmp4 para vídeo y conserva el enlace original de la confirmación pendiente.
- Un enlace de otro servicio puede ejecutarse directamente solo si, considerando el catálogo y el contexto completo, la acción y sus argumentos son inequívocos.
- No inventes comandos ni argumentos. La seguridad final del código verificará catálogo y permisos.
`;
}

// ============================================================
// Structured Intent Validator
// Gemini interpreta el mensaje; el código solo valida estructura, catálogo,
// confianza y reglas objetivas de seguridad. No se usan verbos predefinidos.
// ============================================================
function getCommandName(rawCommand) {
  return String(rawCommand || "").trim().split(/\s+/)[0].toLowerCase();
}

function actionToCommandLine(action) {
  const command = getCommandName(action?.command);
  const args = Array.isArray(action?.args) ? action.args.map(String) : [];
  return [command, ...args].filter(Boolean).join(" ");
}

function validateStructuredActions(userText, decision, storedPendingAction = null) {
  if (!decision || !Array.isArray(decision.actions)) return [];

  // Una confirmación aislada no puede inventar ni desbloquear una acción.
  if (decision.intent === "confirm" && (!storedPendingAction || typeof storedPendingAction !== "object")) return [];

  // La fase semántica es una barrera independiente de la acción concreta.
  // Una respuesta de conversación, explicación o listado jamás puede ejecutar.
  if (!ACTION_INTENTS.has(decision.intent) || decision.intentConfidence < 0.9) return [];

  // Esta prohibición es independiente de la decisión de Gemini.
  if (/(borra|borrar|elimina|eliminar|destruye|destruir)\s+(el\s+|este\s+)?grupo/i.test(userText || "")) {
    return [];
  }

  const availableCommandNames = getAvailableCommandNames();
  return decision.actions
    .filter((action) => action?.execute === true)
    .filter((action) => Number.isFinite(action.confidence) && action.confidence >= 0.9)
    .filter((action) => availableCommandNames.has(getCommandName(action.command)))
    .map(actionToCommandLine)
    .filter(Boolean);
}

function detectAndInjectCommands(userText, decision, storedPendingAction = null) {
  const normalizedDecision = normalizeAIDecision(decision);
  const cleanResponse = normalizedDecision.reply || "";
  const commands = normalizedDecision.needsConfirmation
    ? []
    : validateStructuredActions(userText, normalizedDecision, storedPendingAction);

  if (Array.isArray(normalizedDecision.actions)) {
    for (const action of normalizedDecision.actions) {
      const commandName = getCommandName(action?.command);
      if (action?.execute && !commands.includes(actionToCommandLine(action))) {
        console.warn(`IA solicitó un comando estructural no autorizado: ${commandName || "(vacío)"}`);
      }
    }
  }

  return { cleanResponse, commands, pendingAction: normalizedDecision.pendingAction || null, needsConfirmation: normalizedDecision.needsConfirmation };
}

// ============================================================
// Helper: Call AI (Gemini fast models + Pollinations fallback)
// ============================================================
import { GoogleGenAI } from "@google/genai";

let genAIInstance = null;
function getGenAI() {
  if (!genAIInstance && process.env.GEMINI_API_KEY) {
    genAIInstance = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return genAIInstance;
}

// Conserva el prompt completo construido por ia.js, incluida la personalidad seleccionada.
function geminiSystemInstructionMiddleware(rawSystemPrompt) {
  return rawSystemPrompt || "";
}

// Evita enviar o memorizar fragmentos del prompt interno cuando un proveedor falla.
function isInternalPromptLeak(text) {
  if (typeof text !== "string") return false;

  return /(?:^|\n)\s*(?:\*+\s*)?(?:system instructions?\s*(?:&|y)?\s*tone|instrucciones?\s+(?:del\s+)?sistema|personalidad\s+y\s+tono|datos del usuario que te habla ahora|lista de herramientas y comandos disponibles|reglas de comandos\s*\[cmd)/i.test(text.trim());
}

// Contrato estructurado: Gemini interpreta la intención y el código solo valida
// la forma, el comando existente y las reglas objetivas de seguridad.
const AI_DECISION_SCHEMA = {
  type: "OBJECT",
  properties: {
    reply: {
      type: "STRING",
      description: "Respuesta breve y natural para el usuario. Nunca incluyas etiquetas CMD aquí."
    },
    intent: {
      type: "STRING",
      format: "enum",
      enum: ["conversation", "explain", "list", "execute", "confirm"],
      description: "Clasificación semántica principal del mensaje antes de decidir acciones."
    },
    intentConfidence: {
      type: "NUMBER",
      description: "Certeza de la clasificación semántica entre 0 y 1."
    },
    actions: {
      type: "ARRAY",
      description: "Acciones que el usuario pidió ejecutar ahora. Vacío si solo conversa o falta certeza.",
      items: {
        type: "OBJECT",
        properties: {
          command: { type: "STRING", description: "Nombre exacto de un comando del catálogo real." },
          args: { type: "ARRAY", items: { type: "STRING" }, description: "Argumentos literales del comando." },
          execute: { type: "BOOLEAN", description: "True solo cuando la intención es inequívoca." },
          confidence: { type: "NUMBER", description: "Certeza de la decisión entre 0 y 1." }
        },
        required: ["command", "args", "execute", "confidence"]
      }
    },
    needsConfirmation: {
      type: "BOOLEAN",
      description: "True cuando falta una elección indispensable antes de ejecutar."
    },
    confirmationType: {
      type: "STRING",
      description: "Tipo de confirmación pendiente, por ejemplo youtube_format o none."
    },
    pendingAction: {
      type: "OBJECT",
      nullable: true,
      description: "Acción retenida mientras se espera una confirmación del usuario; null si no hay ninguna.",
      properties: {
        command: { type: "STRING" },
        args: { type: "ARRAY", items: { type: "STRING" } },
        confirmationType: { type: "STRING" }
      },
      required: ["command", "args", "confirmationType"]
    }
  },
  required: ["reply", "intent", "intentConfidence", "actions", "needsConfirmation"]
};

const AI_INTENTS = new Set(["conversation", "explain", "list", "execute", "confirm"]);
const ACTION_INTENTS = new Set(["execute", "confirm"]);

function normalizeAIDecision(raw) {
  let value = raw;

  if (typeof value === "string") {
    const text = value.trim();
    try {
      value = JSON.parse(text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, ""));
    } catch {
      // Pollinations u otro respaldo puede devolver texto natural. Es válido para
      // conversar, pero no autoriza acciones porque no contiene una decisión fiable.
      return { reply: text, actions: [], needsConfirmation: false, confirmationType: "none" };
    }
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { reply: "", actions: [], needsConfirmation: false, confirmationType: "none" };
  }

  const intentValue = String(value.intent || "conversation").trim().toLowerCase();
  const intent = AI_INTENTS.has(intentValue) ? intentValue : "conversation";
  const intentConfidence = Number(value.intentConfidence);

  const actions = Array.isArray(value.actions) ? value.actions.map((action) => ({
    command: String(action?.command || "").trim().toLowerCase(),
    args: Array.isArray(action?.args) ? action.args.map((arg) => String(arg)) : [],
    execute: action?.execute === true,
    confidence: Number(action?.confidence)
  })).filter((action) => action.command) : [];

  const pendingAction = value.pendingAction && typeof value.pendingAction === "object"
    ? {
        command: getCommandName(value.pendingAction.command),
        args: Array.isArray(value.pendingAction.args) ? value.pendingAction.args.map((arg) => String(arg)) : [],
        confirmationType: String(value.pendingAction.confirmationType || value.confirmationType || "none").trim().toLowerCase()
      }
    : null;

  return {
    reply: typeof value.reply === "string" ? value.reply.trim() : "",
    intent,
    intentConfidence: Number.isFinite(intentConfidence) ? intentConfidence : 0,
    actions,
    needsConfirmation: value.needsConfirmation === true,
    confirmationType: String(value.confirmationType || "none").trim().toLowerCase(),
    pendingAction
  };
}

function isUsableAIDecision(decision) {
  return decision && typeof decision.reply === "string" && decision.reply.trim().length > 1 && !isInternalPromptLeak(decision.reply);
}

// Modelos de texto vigentes, ordenados de menor coste y latencia a mayor capacidad.
// Si uno agota su cuota, se prueba inmediatamente el siguiente modelo disponible.
const GEMINI_TEXT_MODELS = [
  "gemini-3.1-flash-lite",
  "gemini-3.5-flash-lite",
  "gemini-2.5-flash-lite",
  "gemini-3.5-flash",
  "gemini-2.5-flash",
  "gemini-3.6-flash",
];

// Evita repetir en cada mensaje modelos que la API ya confirmó como retirados.
const unavailableGeminiModels = new Set();

// Los bloqueos por cuota sobreviven al reinicio del bot. La ruta se ubica junto
// a la base de datos, que ya respeta BOT_DATA_DIR/PERSISTENT_DIR/DB_PATH.
const GEMINI_COOLDOWN_FILE = path.join(
  path.dirname(config.dbPath || path.join(process.cwd(), "data", "database.json")),
  "gemini-model-cooldowns.json"
);
const DEFAULT_GEMINI_QUOTA_COOLDOWN_MS = 24 * 60 * 60 * 1000;
let geminiModelCooldowns = {};

function loadGeminiModelCooldowns() {
  try {
    const loaded = fs.readJsonSync(GEMINI_COOLDOWN_FILE);
    if (loaded && typeof loaded === "object" && !Array.isArray(loaded)) {
      return loaded;
    }
  } catch (e) {
    if (e?.code !== "ENOENT") {
      console.warn(`Gemini: no se pudo leer el registro de enfriamiento: ${e.message}`);
    }
  }
  return {};
}

geminiModelCooldowns = loadGeminiModelCooldowns();

function saveGeminiModelCooldowns() {
  try {
    fs.ensureDirSync(path.dirname(GEMINI_COOLDOWN_FILE));
    const tempFile = `${GEMINI_COOLDOWN_FILE}.tmp`;
    fs.writeJsonSync(tempFile, geminiModelCooldowns, { spaces: 2 });
    fs.moveSync(tempFile, GEMINI_COOLDOWN_FILE, { overwrite: true });
  } catch (e) {
    console.warn(`Gemini: no se pudo guardar el registro de enfriamiento: ${e.message}`);
  }
}

function getGeminiModelCooldownUntil(model) {
  const record = geminiModelCooldowns[model];
  const until = Number(record?.until || 0);
  if (!until) return 0;

  if (until <= Date.now()) {
    delete geminiModelCooldowns[model];
    saveGeminiModelCooldowns();
    console.log(`Gemini (${model}) salió del enfriamiento y volverá a probarse.`);
    return 0;
  }

  return until;
}

function extractRetryDelayMs(error, message) {
  const candidates = [
    error?.retryDelay,
    error?.details?.retryDelay,
    ...(Array.isArray(error?.details) ? error.details.map(detail => detail?.retryDelay) : []),
    error?.errorDetails?.retryDelay,
  ].filter(Boolean);

  for (const candidate of candidates) {
    const match = String(candidate).match(/([0-9]+(?:\.[0-9]+)?)\s*(s|sec|secs|second|seconds|m|min|minute|minutes|h|hour|hours)?/i);
    if (match) {
      const amount = Number(match[1]);
      const unit = String(match[2] || "s").toLowerCase();
      const multiplier = unit.startsWith("h") ? 60 * 60 * 1000 : unit.startsWith("m") ? 60 * 1000 : 1000;
      if (Number.isFinite(amount) && amount > 0) return Math.ceil(amount * multiplier);
    }
  }

  const retryMessage = String(message || "").match(/retry(?:\s|-)?(?:after|in|delay)?[^0-9]{0,12}([0-9]+(?:\.[0-9]+)?)\s*(s|sec|secs|second|seconds|m|min|minute|minutes|h|hour|hours)?/i);
  if (retryMessage) {
    const amount = Number(retryMessage[1]);
    const unit = String(retryMessage[2] || "s").toLowerCase();
    const multiplier = unit.startsWith("h") ? 60 * 60 * 1000 : unit.startsWith("m") ? 60 * 1000 : 1000;
    if (Number.isFinite(amount) && amount > 0) return Math.ceil(amount * multiplier);
  }

  return DEFAULT_GEMINI_QUOTA_COOLDOWN_MS;
}

function markGeminiModelQuotaCooldown(model, error, message) {
  const delayMs = Math.max(1000, extractRetryDelayMs(error, message));
  const until = Date.now() + delayMs;
  geminiModelCooldowns[model] = {
    until,
    reason: "quota_or_rate_limit",
    updatedAt: Date.now()
  };
  saveGeminiModelCooldowns();
  console.warn(`Gemini (${model}) queda en enfriamiento hasta ${new Date(until).toISOString()}; se omitirá sin reintentos innecesarios.`);
}

function clearGeminiModelCooldown(model) {
  if (!geminiModelCooldowns[model]) return;
  delete geminiModelCooldowns[model];
  saveGeminiModelCooldowns();
  console.log(`Gemini (${model}) volvió a estar disponible y se reincorporó a la rotación.`);
}

function getGeminiErrorInfo(error) {
  const message = String(error?.message || error || "Error desconocido");
  const match = message.match(/(?:"code"\s*:\s*|\bcode\s*[:=]\s*)(\d{3})|\b(401|403|404|429)\b/);
  const code = Number(error?.status || error?.code || match?.[1] || match?.[2] || 0);
  return { code, message };
}

async function callAI(messages, systemPrompt) {
  const finalSystemInstruction = geminiSystemInstructionMiddleware(systemPrompt);
  const ai = getGenAI();

  if (ai) {
    const contents = [];

    for (const m of messages) {
      if (m.role === "system") continue;
      contents.push({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }]
      });
    }

    for (const model of GEMINI_TEXT_MODELS) {
      if (unavailableGeminiModels.has(model)) continue;

      const cooldownUntil = getGeminiModelCooldownUntil(model);
      if (cooldownUntil > Date.now()) {
        console.log(`Gemini (${model}) omitido hasta ${new Date(cooldownUntil).toISOString()} por cuota agotada.`);
        continue;
      }

      try {
        const res = await ai.models.generateContent({
          model,
          contents,
          config: {
            systemInstruction: finalSystemInstruction,
            temperature: 0.85,
            responseMimeType: "application/json",
            responseSchema: AI_DECISION_SCHEMA,
          }
        });

        const decision = normalizeAIDecision(res?.text);
        if (isUsableAIDecision(decision)) {
          clearGeminiModelCooldown(model);
          return decision;
        }
        if (res?.text) console.warn(`Gemini (${model}) devolvió una decisión estructurada vacía o interna; se probará el siguiente modelo.`);
      } catch (e) {
        const { code, message } = getGeminiErrorInfo(e);

        if (code === 404) {
          unavailableGeminiModels.add(model);
          console.warn(`Gemini (${model}) no está disponible; se omitirá hasta reiniciar el bot.`);
          continue;
        }

        if (code === 429) {
          markGeminiModelQuotaCooldown(model, e, message);
          continue;
        }

        if (code === 401 || code === 403) {
          console.error(`Gemini (${model}) rechazó la clave o los permisos (${code}); no se prueban más modelos.`);
          break;
        }

        console.warn(`Gemini (${model}) error: ${message}; se probará el siguiente modelo.`);
      }
    }
  }

  // Restaurado el formato POST del respaldo funcional. Pollinations puede
  // rechazar peticiones según su servicio, pero deja de ser la causa de una
  // respuesta lenta cuando Gemini está configurado correctamente.
  try {
    const lastMsg = messages.filter(m => m.role === "user").pop()?.content || "Hola";
    const res = await axios.post("https://text.pollinations.ai/", {
      model: "openai",
      messages: [
        { role: "system", content: finalSystemInstruction },
        { role: "user", content: lastMsg }
      ],
      temperature: 0.8
    }, {
      headers: { "Content-Type": "application/json" },
      timeout: 5000
    });

    const fallbackContent = isUsableAIResponse(res.data)
      ? res.data
      : res.data?.choices?.[0]?.message?.content;
    const fallbackDecision = normalizeAIDecision(fallbackContent);
    if (isUsableAIDecision(fallbackDecision)) return fallbackDecision;
  } catch (e) {
    console.warn("Pollinations fallback error:", e?.message || e);
  }

  return null;
}

// ============================================================
// Helper: Fallback response generator
// ============================================================
function generateFallbackResponse(text, userName = "Usuario", personalityKey = "asistente") {
  const nameStr = userName && userName !== "Usuario" ? userName : "";
  const greetingName = nameStr ? ` *${nameStr}*` : "";
  const lower = text.toLowerCase();

  if (/^(hola|hey|hi|buenas|buenos\s+d[ií]as|buenas\s+tardes|buenas\s+noches)/i.test(lower)) {
    if (personalityKey === "tsundere") {
      const tsundereGreetings = [
        `¡H-Hola${greetingName}! 🌸 N-No es como si estuviera esperando tu mensaje, ¡pero me alegra leerte! ¿En qué te ayudo?`,
        `¡Buenas${greetingName}! ✨ P-Pero claro que estoy lista para ayudarte, ¡dime qué necesitas con gusto!`,
        `¡H-Hola${greetingName}! 💖 ¡N-No me mires así! En fin, dime qué necesitas, que con mucho gusto te apoyo.`
      ];
      return tsundereGreetings[Math.floor(Math.random() * tsundereGreetings.length)];
    }
    if (personalityKey === "waifu") {
      const waifuGreetings = [
        `¡Hola mi amor${greetingName}! 💖 Te extrañaba tanto, ¿cómo estás hoy?`,
        `¡Buenas, mi vida${greetingName}! 🌸 Qué felicidad leerte, dime en qué te consiento hoy.`,
        `¡Hola mi cielo${greetingName}! ✨ Aquí estoy siempre a tu lado para lo que desees.`
      ];
      return waifuGreetings[Math.floor(Math.random() * waifuGreetings.length)];
    }
    if (personalityKey === "asistente") {
      const asisGreetings = [
        `Saludos${greetingName}. Asistente virtual a su servicio. ¿En qué le puedo colaborar? 💼`,
        `Buenos días / tardes${greetingName}. Indíqueme en qué puedo serle útil. 📋`,
        `Hola${greetingName}. Estoy lista para procesar sus consultas y comandos. 📊`
      ];
      return asisGreetings[Math.floor(Math.random() * asisGreetings.length)];
    }
    if (personalityKey === "yandere") {
      const yandereGreetings = [
        `¡Hola, mi amor secreto${greetingName}! 🔪💖 Estaba pensando en ti cada segundo... Solo en ti.`,
        `¡Llegaste${greetingName}! 🩸 Dime que no estuviste hablando con nadie más... Te extrañé tanto.`,
        `¡Hola mi vida${greetingName}! 💖 No me vuelvas a dejar sola tanto tiempo, ¿sí? Te amo.`
      ];
      return yandereGreetings[Math.floor(Math.random() * yandereGreetings.length)];
    }
    // Kurumi default
    const greetings = [
      `¡Hola${greetingName}! ¿En qué te puedo ayudar hoy? fufufu~ 🌸`,
      `Buenas${greetingName}, qué gusto saludarte. Ara ara, ¿qué hacemos hoy? ✨`,
      `Hola${greetingName}. Kurumi Tokisaki a tu disposición. 🥀`,
      `¡Saludos${greetingName}! Platícame en qué te puedo apoyar hoy. 🖤`
    ];
    return greetings[Math.floor(Math.random() * greetings.length)];
  }

  if (/qui[eé]n\s+eres|que\s+eres|como\s+te\s+llamas|tu\s+nombre/i.test(lower)) {
    const pInfo = PERSONALITIES[personalityKey] || PERSONALITIES.kurumi;
    return `Soy *Kurumi Tokisaki* (${pInfo.name} ${pInfo.icon}), tu asistente virtual en WhatsApp creada por «[×𝐹ɾαɳƈιʂƈσ×]». Mi personalidad activa es *${pInfo.name}* (${pInfo.badge}).`;
  }

  if (personalityKey === "tsundere") {
    return `¡C-Claro que sí${greetingName}! Con mucho gusto te ayudo, ¡p-pero no pienses raro! 🌸`;
  }
  if (personalityKey === "waifu") {
    return `Te escucho con todo mi corazón${greetingName} 💖. Dime más para ayudarte con mucho amor.`;
  }
  if (personalityKey === "asistente") {
    return `Solicitud registrada${greetingName}. Procesando consulta de forma eficiente. 💼`;
  }
  if (personalityKey === "yandere") {
    return `Cualquier cosa que digas me fascina${greetingName} 🔪💖... Promete que solo serás mío.`;
  }

  const defaultPhrases = [
    `Con gusto te ayudo con tu solicitud${greetingName}. fufufu~ 🌸`,
    `Entendido, con gusto atiendo tu petición${greetingName}. 📌`,
    `Claro, dime más detalles para ayudarte mejor. ✨`,
    `Cuenta conmigo para lo que necesites${greetingName}. 🥀`
  ];
  return defaultPhrases[Math.floor(Math.random() * defaultPhrases.length)];
}

// ============================================================
// Helper: Execute internal command
// ============================================================
async function executeInternalCommand(conn, m, sender, chatId, cmdName, cmdArgs) {
  const { handleMessage } = await import("../handler.js");
  
  const cmdBody = `!${cmdName}${cmdArgs.length > 0 ? " " + cmdArgs.join(" ") : ""}`;

  const fakeM = {
    ...m,
    isAi: true,
    fromAi: true,
    body: cmdBody,
    text: cmdBody,
    command: cmdName.toLowerCase(),
    args: cmdArgs,
    usedPrefix: "!",
    message: {
      conversation: cmdBody
    },
    messageContent: {
      conversation: cmdBody
    },
    key: {
      ...m.key,
      id: "IA_TOOL_" + Date.now() + "_" + Math.floor(Math.random() * 1000)
    }
  };

  try {
    await handleMessage(conn, fakeM);
  } catch (e) {
    console.error(`IA: Error ejecutando comando ${cmdName}:`, e.message);
  }
}

// ============================================================
// Core AI handler (exported for handler.js)
// ============================================================
export async function handleAI(conn, m, sender, text, chatId, isOwner = false, isAdmin = false) {
  const aiStartedAt = performance.now();
  // La presencia no debe añadir latencia al inicio de una conversación.
  void conn.sendPresenceUpdate('composing', chatId).catch(() => {});

  const user = getUser(sender);
  const isGroup = chatId.endsWith("@g.us");

  // Guardar/actualizar el nombre de usuario si viene en m.pushName
  if (m.pushName && m.pushName.trim() && m.pushName.trim() !== "Usuario") {
    const push = m.pushName.trim();
    if (user?.name !== push) {
      updateUser(sender, { name: push });
      if (user) user.name = push;
    }
  }

  const userName = (m.pushName && m.pushName.trim() !== "Usuario")
    ? m.pushName.trim()
    : (user?.name && user.name !== "Usuario" ? user.name : "Usuario");

  const interactionCount = Math.max(1, Number(user?.ai_interactions || 0) + 1);
  const conversationPhase = getConversationPhase(interactionCount);
  updateUser(sender, { ai_interactions: interactionCount });

  let personalityKey = "asistente";
  if (isGroup) {
    const group = getGroup(chatId);
    personalityKey = group?.ai_personality || "asistente";
  } else {
    personalityKey = user?.ai_personality || "asistente";
  }
  if (!PERSONALITIES[personalityKey]) personalityKey = "asistente";

  // Auto-detección de hechos importantes del usuario para la memoria persistente
  try {
    const lowerText = text.toLowerCase();
    const bdayMatch = text.match(/(?:mi\s+cumplea[ñn]os\s+es\s+el|cumplo\s+el|nací\s+el)\s+([0-9]{1,2}\s+de\s+[a-z]+(?:\s+de\s+[0-9]{4})?)/i);
    if (bdayMatch) {
      setUserMemory(sender, "Cumpleaños", bdayMatch[1].trim());
    }

    const gustaMatch = text.match(/(?:me\s+gusta|mi\s+comida\s+favorita\s+es|mi\s+anime\s+favorito\s+es|mi\s+juego\s+favorito\s+es|mi\s+pasatiempo\s+es)\s+([^,.!\n]+)/i);
    if (gustaMatch && gustaMatch[1].length < 60) {
      const val = gustaMatch[1].trim();
      if (lowerText.includes("comida")) setUserMemory(sender, "Comida Favorita", val);
      else if (lowerText.includes("anime")) setUserMemory(sender, "Anime Favorito", val);
      else if (lowerText.includes("juego")) setUserMemory(sender, "Juego Favorito", val);
      else setUserMemory(sender, "Gustos / Aficiones", val);
    }

    const apodoMatch = text.match(/(?:dime|llámame|llamame|mi\s+apodo\s+es)\s+([a-zA-Z0-9_áéíóúÁÉÍÓÚñÑ\s]{2,20})/i);
    if (apodoMatch && !lowerText.includes("como") && !lowerText.includes("que")) {
      setUserMemory(sender, "Apodo Preferido", apodoMatch[1].trim());
    }
  } catch (err) {}

  addAiMessage(sender, "user", text);

  // Diez intercambios conservan el contexto reciente y reducen tokens, red e inferencia.
  // Ignorar entradas defectuosas antiguas sin borrar la memoria ni el historial válido.
  const history = getAiHistory(sender, 10).filter((entry) => !isInternalPromptLeak(entry?.content));
  const systemPrompt = getSystemPrompt(userName, user, isOwner, sender, personalityKey, interactionCount, conversationPhase, isAdmin, isGroup);

  const messages = [
    { role: "system", content: systemPrompt },
    ...history.map((h) => ({ role: h.role, content: h.content })),
  ];

  let decision = null;

  try {
    decision = await callAI(messages, systemPrompt);
  } catch (e) {
    console.error("AI engine error:", e?.message || e);
  }

  if (!isUsableAIDecision(decision)) {
    // No simular una decisión ni una acción cuando ningún proveedor respondió.
    // Así el usuario puede distinguir una caída de servicio de una respuesta real de la IA.
    decision = {
      reply: "La IA está temporalmente sin cuota o no disponible. Inténtalo de nuevo en unos minutos.",
      actions: [],
      needsConfirmation: false,
      confirmationType: "none",
      pendingAction: null
    };
  }

  const { cleanResponse, commands, pendingAction, needsConfirmation } = detectAndInjectCommands(text, decision, user?.ai_pending_action);
  const assistantText = cleanResponse || decision.reply;
  addAiMessage(sender, "assistant", assistantText);

  if (needsConfirmation && pendingAction) {
    updateUser(sender, { ai_pending_action: pendingAction });
  } else if (!needsConfirmation || commands.length > 0) {
    updateUser(sender, { ai_pending_action: null });
  }

  if (cleanResponse) {
    if (commands.length > 0) {
      // Si hay comandos a ejecutar, no enviamos 'cleanResponse' si este contiene plantillas, cabeceras o estados de búsqueda
      // (evita duplicar la respuesta del comando)
      const isTemplateHeader = /✦━【|┌──「|⏳\s*\*?Buscando|!pel[ií]cula|!imagen|!github/i.test(cleanResponse);
      if (!isTemplateHeader && cleanResponse.trim().length > 0) {
        // Solo enviar si es un mensaje de texto conversacional corto sin duplicar el comando
        const isVeryShortIntro = cleanResponse.length < 120 && !cleanResponse.includes("\n\n");
        if (isVeryShortIntro) {
          await conn.sendMessage(chatId, { text: cleanResponse }, { quoted: m });
        }
      }
    } else {
      await conn.sendMessage(chatId, { text: cleanResponse }, { quoted: m });
    }
  }

  const elapsedMs = Math.round(performance.now() - aiStartedAt);
  console.log(`⏱️ [PERF] IA: ${elapsedMs} ms`);
  if (globalThis.addLog) globalThis.addLog(`⏱️ [PERF] IA: ${elapsedMs} ms`);

  for (const cmdLine of commands) {
    const [cmdName, ...cmdArgs] = cmdLine.split(/\s+/);
    if (cmdName) {
      await executeInternalCommand(conn, m, sender, chatId, cmdName, cmdArgs);
    }
  }
}

// ============================================================
// Handler: /ia
// ============================================================
const handler = async (m, { conn, args, body, sender, chatId, usedPrefix, isGroup, isPrivate, isAdmin, isOwner }) => {
  const cleanBody = (body || "").trim();
  const lowerBody = cleanBody.toLowerCase();

  const requireGroupAdmin = async (usage) => {
    if (!isGroup || isAdmin || isOwner) return true;
    await m.reply(formatAiNotice("❌ PERMISO REQUERIDO", `Este ajuste afecta al grupo.\nPide a un administrador usar ${usage}.`));
    return false;
  };

  // Subcomando de cambio o consulta de personalidad: !ia personalidad [nombre] / !ia sim [nombre]
  const isPersonalidadSubcmd = /^(personalidad|personalidades|persona|pers|sim|simi|grupo)(\s+.*)?$/i.test(lowerBody);

  if (isPersonalidadSubcmd) {
    const parts = lowerBody.split(/\s+/);
    const targetKey = (parts[1] || "").toLowerCase();

    let currentKey = "asistente";
    if (isGroup) {
      const g = getGroup(chatId);
      currentKey = g?.ai_personality || "asistente";
    } else {
      const u = getUser(sender);
      currentKey = u?.ai_personality || "asistente";
    }

    if (!targetKey || targetKey === "lista" || targetKey === "menu" || targetKey === "help") {
      let menuText = formatAiNotice("🎭 PERSONALIDADES",
        `*Activa:* ${PERSONALITIES[currentKey]?.name || "Kurumi Tokisaki"} ${PERSONALITIES[currentKey]?.icon || "🌸"}\n\n` +
        `Elige una de las 5 personalidades disponibles:\n\n`);

      for (const [key, p] of Object.entries(PERSONALITIES)) {
        const isActive = key === currentKey;
        menuText += `${p.icon} *${p.name}* (${key})\n` +
          `• ${p.badge}\n` +
          `• ${p.description}\n` +
          `• ${usedPrefix}ia personalidad ${key} ${isActive ? "← ACTIVA" : ""}\n\n`;
      }

      menuText += `📌 *Uso:* Escribe \`${usedPrefix}ia personalidad <nombre>\` para cambiar la voz de la IA.`;
      return m.reply(menuText);
    }

    if (!PERSONALITIES[targetKey]) {
      const keysList = Object.keys(PERSONALITIES).join(", ");
      return m.reply(formatAiNotice("❌ PERSONALIDAD INVÁLIDA", `Opciones válidas: ${keysList}.\nUsa ${usedPrefix}ia personalidad para ver el menú.`));
    }

    const p = PERSONALITIES[targetKey];
    if (!(await requireGroupAdmin(`${usedPrefix}ia personalidad ${targetKey}`))) return;
    if (isGroup) {
      updateGroup(chatId, { ai_personality: targetKey });
    } else {
      updateUser(sender, { ai_personality: targetKey });
    }

    return m.reply(formatAiNotice("✅ PERSONALIDAD LISTA",
      `*Nueva voz:* ${p.name} ${p.icon}\n` +
      `*Estilo:* ${p.badge}\n` +
      `*Alcance:* ${isGroup ? "Todo el grupo" : "Configuración personal"}\n\n` +
      `La IA responderá con la actitud de *${p.name}*.`));
  }

  if (!cleanBody) {
    let statusText = "";
    let pKey = "asistente";
    if (isGroup) {
      const groupConfig = getGroup(chatId);
      pKey = groupConfig?.ai_personality || "asistente";
      const aiVal = groupConfig?.ai_command_enabled;
      const aiEnabled = aiVal === 1 || aiVal === true || aiVal === "1" || aiVal === "on" || aiVal === "true";
      const modeText = "Solo por comando";
      const pInfo = PERSONALITIES[pKey] || PERSONALITIES.asistente;

      statusText = formatAiNotice("✨ IA DE KURUMI",
        `*Estado:* ${aiEnabled ? "✅ Activada" : "❌ Desactivada"}\n` +
        `*Modo:* ${modeText}\n` +
        `*Personalidad:* ${pInfo.name} ${pInfo.icon}\n\n` +
        `*Comandos:*\n` +
        `• ${usedPrefix}ia on / off\n` +
        `• ${usedPrefix}ia personalidad\n` +
        `• ${usedPrefix}ia <mensaje>\n` +
        `• ${usedPrefix}kurumi <mensaje>\n\n` +
        `*Permisos:* Solo administradores pueden cambiar el estado o la personalidad.\n` +
        `*Modo temporal:* No respondo a menciones ni mensajes normales.`);
    } else {
      const user = getUser(sender);
      pKey = user?.ai_personality || "asistente";
      const aiVal = user?.ai_command_enabled;
      const aiEnabled = aiVal === 1 || aiVal === true || aiVal === "1" || aiVal === "on" || aiVal === "true";
      const pInfo = PERSONALITIES[pKey] || PERSONALITIES.asistente;

      statusText = formatAiNotice("✨ IA DE KURUMI",
        `*Estado:* ${aiEnabled ? "✅ Activada" : "❌ Desactivada"}\n` +
        `*Personalidad:* ${pInfo.name} ${pInfo.icon}\n\n` +
        `*Comandos:*\n` +
        `• ${usedPrefix}ia on / off\n` +
        `• ${usedPrefix}ia personalidad\n` +
        `• ${usedPrefix}ia <mensaje>\n` +
        `• ${usedPrefix}kurumi <mensaje>\n\n` +
        `Activa primero la IA con ${usedPrefix}ia on.`);
    }
    return m.reply(statusText);
  }

  // Toggles de activación / desactivación
  const isEnableArg = /^(on|activar|enable|1|true|modo\s+on)$/i.test(lowerBody);
  const isDisableArg = /^(off|desactivar|disable|0|false|modo\s+off)$/i.test(lowerBody);

  if (isEnableArg || isDisableArg) {
    const enable = isEnableArg;

    if (isGroup) {
      if (!(await requireGroupAdmin(`${usedPrefix}ia ${enable ? "on" : "off"}`))) return;
      updateGroup(chatId, { ai_enabled: enable ? 1 : 0, ai_command_enabled: enable ? 1 : 0, ai_mode: "command" });
      return m.reply(enable
        ? formatAiNotice("✅ IA ACTIVADA", `*Modo:* Solo por comando\n\nUsa ${usedPrefix}ia <mensaje>\no ${usedPrefix}kurumi <mensaje>.\nNo respondo a menciones\nni mensajes normales.`)
        : formatAiNotice("❌ IA DESACTIVADA", `Usa ${usedPrefix}ia on\npara reactivarla.`)
      );
    } else {
      updateUser(sender, { ai_enabled: enable ? 1 : 0, ai_command_enabled: enable ? 1 : 0 });
      return m.reply(enable
        ? formatAiNotice("✅ IA ACTIVADA", `*Modo:* Solo por comando\n\nUsa ${usedPrefix}ia <mensaje>\no ${usedPrefix}kurumi <mensaje>.`)
        : formatAiNotice("❌ IA DESACTIVADA", `Usa ${usedPrefix}ia on\npara reactivarla.`)
      );
    }
  }

  // El modo temporal por comando desactiva los modos automáticos anteriores.
  if (isGroup && /^modo\s+(all|todo|chat|siempre|mention|mencion|tag|normal)$/i.test(lowerBody)) {
    return m.reply(formatAiNotice("ℹ️ MODO AUTOMÁTICO", `No disponible temporalmente.\nUsa ${usedPrefix}ia <mensaje>\no ${usedPrefix}kurumi <mensaje>.`));
  }

  if (isGroup) {
    const groupConfig = getGroup(chatId);
    const aiVal = groupConfig?.ai_command_enabled;
    const isAiEnabled = aiVal === 1 || aiVal === true || aiVal === "1" || aiVal === "on" || aiVal === "true";
    if (!isAiEnabled) {
      return m.reply(formatAiNotice("✨ IA DESACTIVADA", `Solo responde por comando en este grupo.\nUn administrador puede usar ${usedPrefix}ia on.`));
    }
  }

  if (!isGroup) {
    const user = getUser(sender);
    const aiVal = user?.ai_command_enabled;
    const isAiEnabled = aiVal === 1 || aiVal === true || aiVal === "1" || aiVal === "on" || aiVal === "true";
    if (!isAiEnabled) {
      return m.reply(formatAiNotice("✨ IA DESACTIVADA", `Actívala primero con ${usedPrefix}ia on.\nDespués usa ${usedPrefix}ia o ${usedPrefix}kurumi.`));
    }
  }

  try {
    await handleAI(conn, m, sender, cleanBody, chatId, isOwner, isAdmin);
  } catch (err) {
    console.error("AI chat error:", err);
    await m.reply(formatAiNotice("❌ ERROR", "No pude procesar tu mensaje.\nInténtalo de nuevo."));
  }
};

handler.command = /^(ia|ai|gpt|chat|bot|botsito|iabot|kurumi|kurumibot)$/i;
handler.description = "Chatear con la IA de Kurumi / Activar o desactivar IA";
handler.category = "ia";

export default handler;
