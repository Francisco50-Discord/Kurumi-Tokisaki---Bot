// ============================================================
//   Kurumi Tokisaki - Teléfono Command
// ============================================================

const countryCodes = {
  "52": "🇲🇽 México",
  "1": "🇺🇸 Estados Unidos/Canadá",
  "55": "🇧🇷 Brasil",
  "54": "🇦🇷 Argentina",
  "57": "🇨🇴 Colombia",
  "34": "🇪🇸 España",
  "44": "🇬🇧 Reino Unido",
  "81": "🇯🇵 Japón",
  "82": "🇰🇷 Corea del Sur",
  "86": "🇨🇳 China",
  "49": "🇩🇪 Alemania",
  "33": "🇫🇷 Francia",
};

const handler = async (m, { args, usedPrefix }) => {
  if (!args[0]) {
    return m.reply(
      `✦━【 📞 *TELÉFONO* 】━✦\n\n` +
      `📝 Detecta el país de un número de teléfono.\n` +
      `💡 Sintaxis: \`${usedPrefix}telefono <número>\`\n` +
      `📌 Ejemplo: \`${usedPrefix}telefono +521234567890\``
    );
  }

  const number = args[0].replace(/[^0-9+]/g, "");

  let country = "Desconocido";
  const cleanNumber = number.replace("+", "");

  for (const [code, name] of Object.entries(countryCodes)) {
    if (cleanNumber.startsWith(code)) {
      country = name;
      break;
    }
  }

  await m.reply(
    `✦━【 📞 *INFORMACIÓN DE NÚMERO* 】━✦\n\n` +
    `◈ *Número:* ${number}\n` +
    `◈ *País:* ${country}\n` +
    `◈ *Longitud:* ${cleanNumber.length} dígitos`
  );
};

handler.command = /^(telefono|teléfono|phone|numinfo)$/i;
handler.description = "Información de un número de teléfono";
handler.category = "misc";

export default handler;
