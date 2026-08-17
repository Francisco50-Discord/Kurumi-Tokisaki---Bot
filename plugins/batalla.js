// ============================================================
//   Kurumi Tokisaki - Batalla PvP Command
// ============================================================

import { getUser, addCoins, addExp, updateUser } from "../lib/database.js";
import { randomInt, sleep, areJidsEqual, resolveTargetJid, getGroupMetadata } from "../lib/utils.js";

const activeBattles = global.activeBattles = global.activeBattles || new Map();

const handler = async (m, { args, conn, sender, chatId, isGroup, usedPrefix }) => {
  let targetJid = await resolveTargetJid(m, args, conn);

  // Si está en chat privado y no etiquetó a nadie, la rival es Kurumi Tokisaki (el Bot)
  const isVsBot = !isGroup && !targetJid;
  if (isVsBot) {
    targetJid = conn.user?.id ? (conn.user.id.split(":")[0] + "@s.whatsapp.net") : "bot@s.whatsapp.net";
  }

  if (!isVsBot && !targetJid) {
    return m.reply(`✦━【 ⚔️ *BATALLA* 】━✦\n\n⚔️ Uso: *${usedPrefix}batalla @usuario*\n💡 En chat privado puedes usar simplemente *${usedPrefix}batalla* para luchar contra Kurumi.`);
  }

  if (areJidsEqual(targetJid, sender)) {
    return m.reply("❌ No puedes batallar contra ti mismo.");
  }

  if (activeBattles.has(chatId)) {
    return m.reply("⚠️ Ya hay una batalla en curso en este chat.");
  }

  // Si es batalla vs Bot en chat privado, se ejecuta de inmediato sin esperar !aceptar
  if (isVsBot) {
    const battle = {
      challenger: sender,
      opponent: targetJid,
      status: "active",
      isBotOpponent: true
    };
    activeBattles.set(chatId, battle);
    await runBattle(conn, chatId, targetJid, battle);
    return;
  }

  const challenger = getUser(sender);
  const opponent = getUser(targetJid);

  activeBattles.set(chatId, {
    challenger: sender,
    opponent: targetJid,
    status: "pending",
    timeout: setTimeout(() => {
      activeBattles.delete(chatId);
      conn.sendMessage(chatId, {
        text: `✦━【 ⚔️ *BATALLA* 】━✦\n\n⏰ Batalla expiró por falta de respuesta.`,
        mentions: [sender, targetJid],
      });
    }, 120000),
  });

  await conn.sendMessage(
    chatId,
    {
      text: `✦━【 ⚔️ *DESAFÍO DE BATALLA* 】━✦\n\n⚔️ @${sender.split("@")[0]} desafía a @${targetJid.split("@")[0]}\nResponde con *!aceptar* o envía *aceptar* / *rechazar*`,
      mentions: [sender, targetJid],
    },
    { quoted: m }
  );
};

// Hook .before para capturar respuestas 'aceptar' / 'rechazar' sin prefijo
handler.before = async (m, { conn, chatId, sender }) => {
  const battle = activeBattles.get(chatId);
  if (!battle || battle.status !== "pending") return false;

  const rawText = (m.text || "").trim().toLowerCase();
  if (!rawText) return false;

  const isAccept = /(^|\s)(aceptar|acepto|sí|si|sii+|acepto el desafio|aceptar batalla|claro|obvio)(\s|!|\.|$)/i.test(rawText);
  const isReject = /(^|\s)(rechazar|rechazo|no|cancelar|rechazar batalla|declinar)(\s|!|\.|$)/i.test(rawText);

  if (!isAccept && !isReject) return false;

  let participants = [];
  if (chatId.endsWith("@g.us")) {
    try {
      const meta = await getGroupMetadata(conn, chatId);
      participants = meta?.participants || [];
    } catch (e) {}
  }

  if (battle.challenger && areJidsEqual(sender, battle.challenger, participants)) return false;

  if (battle.opponent) {
    const isOpponent = areJidsEqual(sender, battle.opponent, participants);
    const quotedText = m.quoted?.text || (
      m.quoted?.message?.conversation ||
      m.quoted?.message?.extendedTextMessage?.text ||
      ""
    );
    const isQuoted = m.quoted && (
      areJidsEqual(m.quoted.sender, conn?.user?.id, participants) ||
      quotedText.includes("DESAFÍO DE BATALLA")
    );
    if (!isOpponent && !isQuoted && !areJidsEqual(sender, battle.challenger, participants)) {
      // Si no es el retador y responde a la batalla activa
      return false;
    }
  }

  if (isAccept) {
    await runBattle(conn, chatId, sender, battle);
    return true;
  } else if (isReject) {
    clearTimeout(battle.timeout);
    activeBattles.delete(chatId);
    await conn.sendMessage(chatId, {
      text: `✦━【 🚫 *BATALLA RECHAZADA* 】━✦\n\n@${sender.split("@")[0]} rechazó el desafío de batalla.`,
      mentions: [sender, battle.challenger],
    });
    return true;
  }

  return false;
};

async function runBattle(conn, chatId, sender, battle) {
  if (battle.timeout) clearTimeout(battle.timeout);
  battle.status = "active";

  const challenger = getUser(battle.challenger);
  const opponent = getUser(sender);

  const challengerName = challenger.name || battle.challenger.split("@")[0];
  const opponentName = battle.isBotOpponent ? "Kurumi Tokisaki (Bot)" : (opponent.name || sender.split("@")[0]);
  const opponentLevel = battle.isBotOpponent ? 15 : (opponent.level || 1);

  await conn.sendMessage(chatId, {
    text: `✦━【 ⚔️ *BATALLA INICIADA* 】━✦\n\n🔴 ${challengerName} (Nv.${challenger.level || 1})\nvs\n🔵 ${opponentName} (Nv.${opponentLevel})`,
    mentions: battle.isBotOpponent ? [battle.challenger] : [battle.challenger, sender],
  });

  await sleep(2000);

  let cHP = challenger.health || 100;
  let oHP = battle.isBotOpponent ? 150 : (opponent.health || 100);
  let oAtkBase = battle.isBotOpponent ? 18 : (opponent.attack || 10);
  let oDefBase = battle.isBotOpponent ? 8 : (opponent.defense || 5);
  let turn = 0;
  let battleLog = "";

  while (cHP > 0 && oHP > 0 && turn < 10) {
    turn++;
    const cAtk = randomInt((challenger.attack || 10) - 3, (challenger.attack || 10) + 5);
    const oDmg = Math.max(1, cAtk - randomInt(0, oDefBase));
    oHP -= oDmg;

    const oAtk = randomInt(oAtkBase - 3, oAtkBase + 5);
    const cDmg = Math.max(1, oAtk - randomInt(0, challenger.defense || 5));
    cHP -= cDmg;

    battleLog += `» Turno ${turn}: ⚔️${oDmg} daño a 🔵 | ⚔️${cDmg} daño a 🔴\n`;
  }

  activeBattles.delete(chatId);

  const winner = cHP > oHP ? battle.challenger : sender;
  const loser = winner === battle.challenger ? sender : battle.challenger;
  const reward = randomInt(50, 200);

  addCoins(winner, reward);
  addExp(winner, 50);
  const winnerUser = getUser(winner);
  updateUser(winner, { wins: (winnerUser.wins || 0) + 1 });

  if (!battle.isBotOpponent) {
    const loserUser = getUser(loser);
    updateUser(loser, { losses: (loserUser.losses || 0) + 1 });
  }

  const winnerTag = winner === battle.challenger ? `@${winner.split("@")[0]}` : (battle.isBotOpponent ? "Kurumi Tokisaki 🌸" : `@${winner.split("@")[0]}`);

  await conn.sendMessage(chatId, {
    text: `✦━【 🏆 *RESULTADO DE LA BATALLA* 】━✦\n\n${battleLog}\n🏆 *Ganador:* ${winnerTag}\n🪙 +${reward} monedas | ⭐ +50 EXP`,
    mentions: battle.isBotOpponent ? [battle.challenger] : [winner, loser],
  });
}

handler.command = /^(batalla|battle|pelea|fight|vs)$/i;
handler.description = "Desafiar a alguien a una batalla";
handler.category = "rpg";
handler.register = true;

const acceptBattleHandler = async (m, { conn, sender, chatId }) => {
  const battle = activeBattles.get(chatId);
  if (!battle || (battle.opponent && !areJidsEqual(sender, battle.opponent)) || battle.status !== "pending") return;
  await runBattle(conn, chatId, sender, battle);
};
acceptBattleHandler.command = /^(aceptar|accept)$/i;

const rejectBattleHandler = async (m, { conn, sender, chatId }) => {
  const battle = activeBattles.get(chatId);
  if (!battle || (battle.opponent && !areJidsEqual(sender, battle.opponent)) || battle.status !== "pending") return;

  clearTimeout(battle.timeout);
  activeBattles.delete(chatId);

  await conn.sendMessage(chatId, {
    text: `✦━【 🚫 *BATALLA RECHAZADA* 】━✦\n\n@${sender.split("@")[0]} rechazó la batalla.\n\n✨ *Kurumi Tokisaki*`,
    mentions: [sender, battle.challenger],
  });
};
rejectBattleHandler.command = /^(rechazar|reject|declinar)$/i;

export default handler;
export { acceptBattleHandler, rejectBattleHandler };
