// ============================================================
//   Kurumi Tokisaki - Piedra, Papel o Tijera (PPT) Command
// ============================================================

import { randomElement, randomInt, areJidsEqual, resolveGroupParticipantJid, getGroupMetadata } from "../lib/utils.js";
import { addCoins, addExp } from "../lib/database.js";

const pptGames = global.pptGames = global.pptGames || new Map();

const choices = ["piedra", "papel", "tijera"];
const emojis = { piedra: "🪨", papel: "📄", tijera: "✂️" };

const handler = async (m, { args, conn, sender, chatId, usedPrefix }) => {
  const input = (args[0] || "").toLowerCase().trim();

  // Caso 1: Jugar contra un usuario mencionado (!ppt @usuario)
  const rawTarget = m.mentionedJid?.[0] || m.quoted?.sender;
  if (rawTarget) {
    const targetJid = await resolveGroupParticipantJid(conn, chatId, rawTarget);
    if (areJidsEqual(targetJid, sender)) return m.reply("❌ No puedes jugar contra ti mismo.");

    if (pptGames.has(chatId)) {
      return m.reply("⚠️ Ya hay una partida de Piedra, Papel o Tijeras en curso en este chat.");
    }

    pptGames.set(chatId, {
      player1: sender,
      player2: targetJid,
      choice1: null,
      choice2: null,
      timeout: setTimeout(() => {
        pptGames.delete(chatId);
        conn.sendMessage(chatId, {
          text: `⏰ El juego de Piedra, Papel o Tijera ha expirado por inactividad.`,
        });
      }, 60000),
    });

    return conn.sendMessage(chatId, {
      text: `✦━【 ✂️ *PIEDRA, PAPEL O TIJERA* 】━✦\n\n👤 @${sender.split("@")[0]} vs 👤 @${targetJid.split("@")[0]}\n\n💡 Ambos respondan en el chat con:\n*piedra*, *papel* o *tijera*\n╰──────`,
      mentions: [sender, targetJid],
    });
  }

  // Caso 2: Jugar contra el Bot (!ppt piedra / papel / tijera)
  if (!choices.includes(input)) {
    return m.reply(
      `✦━【 ✂️ *PIEDRA, PAPEL O TIJERA* 】━✦\n\n💡 Uso contra la IA:\n\`${usedPrefix}ppt piedra\`\n\`${usedPrefix}ppt papel\`\n\`${usedPrefix}ppt tijera\`\n\n💡 O contra un amigo:\n\`${usedPrefix}ppt @usuario\`\n╰──────`
    );
  }

  const userChoice = input;
  const botChoice = randomElement(choices);

  let result = "";
  let reward = 0;

  if (userChoice === botChoice) {
    result = "🤝 *¡EMPATE!*";
    reward = 10;
  } else if (
    (userChoice === "piedra" && botChoice === "tijera") ||
    (userChoice === "papel" && botChoice === "piedra") ||
    (userChoice === "tijera" && botChoice === "papel")
  ) {
    result = "🎉 *¡GANASTE!*";
    reward = 50;
  } else {
    result = "💥 *¡PERDISTE!*";
    reward = 0;
  }

  if (reward > 0) {
    addCoins(sender, reward);
    addExp(sender, 15);
  }

  await m.reply(
    `✦━【 ✂️ *RESULTADO* 】━✦\n\n👤 Tú: ${emojis[userChoice]} *${userChoice.toUpperCase()}*\n🤖 Kurumi: ${emojis[botChoice]} *${botChoice.toUpperCase()}*\n\n${result}\n${reward > 0 ? `🪙 +${reward} monedas | ⭐ +15 EXP\n` : ""}╰──────`
  );
};

// Hook .before para capturar respuestas en duelo PvP
handler.before = async (m, { conn, chatId, sender }) => {
  const game = pptGames.get(chatId);
  if (!game) return false;

  const rawText = (m.text || "").trim().toLowerCase();
  if (!choices.includes(rawText)) return false;

  let participants = [];
  if (chatId.endsWith("@g.us")) {
    try {
      const meta = await getGroupMetadata(conn, chatId);
      participants = meta?.participants || [];
    } catch (e) {}
  }

  const isP1 = areJidsEqual(sender, game.player1, participants);
  const isP2 = areJidsEqual(sender, game.player2, participants);

  if (!isP1 && !isP2) return false;

  if (isP1) {
    if (game.choice1) {
      await m.reply(`⚠️ Ya elegiste tu opción. Esperando al otro jugador...`);
      return true;
    }
    game.choice1 = rawText;
  } else if (isP2) {
    if (game.choice2) {
      await m.reply(`⚠️ Ya elegiste tu opción. Esperando al otro jugador...`);
      return true;
    }
    game.choice2 = rawText;
  }

  if (game.choice1 && game.choice2) {
    clearTimeout(game.timeout);
    pptGames.delete(chatId);

    const c1 = game.choice1;
    const c2 = game.choice2;

    let resultText = "";
    if (c1 === c2) {
      resultText = "🤝 *¡EMPATE PERFECTO!*";
    } else if (
      (c1 === "piedra" && c2 === "tijera") ||
      (c1 === "papel" && c2 === "piedra") ||
      (c1 === "tijera" && c2 === "papel")
    ) {
      resultText = `🎉 *¡GANADOR:* @${game.player1.split("@")[0]}!`;
      addCoins(game.player1, 60);
      addExp(game.player1, 30);
    } else {
      resultText = `🎉 *¡GANADOR:* @${game.player2.split("@")[0]}!`;
      addCoins(game.player2, 60);
      addExp(game.player2, 30);
    }

    await conn.sendMessage(chatId, {
      text: `✦━【 ✂️ *RESULTADO DUELO* 】━✦\n\n👤 @${game.player1.split("@")[0]}: ${emojis[c1]} *${c1.toUpperCase()}*\n👤 @${game.player2.split("@")[0]}: ${emojis[c2]} *${c2.toUpperCase()}*\n\n${resultText}\n╰──────`,
      mentions: [game.player1, game.player2],
    });
  } else {
    await m.reply(`✅ Opción guardada en secreto. Esperando a tu oponente...`);
  }

  return true;
};

handler.command = /^(ppt|pptijeras|piedrapapeltijera)$/i;
handler.description = "Jugar a Piedra, Papel o Tijera";
handler.category = "juegos";

export default handler;
