// ============================================================
//   Kurumi Tokisaki - GitHub Search Command (Precision v6.1)
// ============================================================

import axios from "axios";
import { truncate } from "../lib/utils.js";
import { translateToSpanish } from "../lib/translator.js";

const handler = async (m, { args, conn, usedPrefix }) => {
  if (!args || args.length === 0) {
    return m.reply(
      `✦━【 🐙 *GITHUB* 】━✦\n\n` +
      `📝 Busca información exacta de usuarios o repositorios.\n` +
      `💡 Sintaxis: \`${usedPrefix}github <usuario, repositorio o término>\`\n` +
      `📌 Ejemplos:\n` +
      `  \`${usedPrefix}github torvalds\`\n` +
      `  \`${usedPrefix}github facebook/react\`\n` +
      `  \`${usedPrefix}github kurumi bot\``
    );
  }

  const query = args.join(" ").trim();
  const headers = {
    "User-Agent": "KurumiBot/1.0.9 (Node.js)",
    "Accept": "application/vnd.github.v3+json"
  };

  try {
    let resultType = null;
    let data = null;
    let extraRepos = [];

    const isExplicitUser = query.startsWith("@") || /^(user|usuario)\s+/i.test(query);
    const cleanQuery = query.replace(/^@|^(user|usuario)\s+/i, "").trim();

    // 1. Intento directo 1: Nombre de repositorio 'owner/repo' exacto
    if (cleanQuery.includes("/") && !cleanQuery.includes(" ")) {
      try {
        const repoRes = await axios.get(`https://api.github.com/repos/${cleanQuery}`, { headers, timeout: 8000 });
        if (repoRes.data?.id) {
          resultType = "repo";
          data = repoRes.data;
        }
      } catch (e) {}
    }

    // 2. Intento directo 2: Usuario directo
    if (!data && (isExplicitUser || (!cleanQuery.includes(" ") && !cleanQuery.includes("/")))) {
      try {
        const userRes = await axios.get(`https://api.github.com/users/${encodeURIComponent(cleanQuery)}`, { headers, timeout: 8000 });
        if (userRes.data?.id) {
          resultType = "user";
          data = userRes.data;
        }
      } catch (e) {}
    }

    // 3. Búsqueda inteligente por relevancia
    if (!data) {
      const queryWords = cleanQuery.toLowerCase().split(/\s+/).filter(Boolean);
      const normalizedSlug = cleanQuery.toLowerCase().replace(/[\s_]+/g, "-");

      const [repoSearchRes, userSearchRes] = await Promise.allSettled([
        axios.get(`https://api.github.com/search/repositories?q=${encodeURIComponent(cleanQuery)}&per_page=10`, { headers, timeout: 8000 }),
        axios.get(`https://api.github.com/search/users?q=${encodeURIComponent(cleanQuery)}&per_page=5`, { headers, timeout: 8000 })
      ]);

      const repoItems = repoSearchRes.status === "fulfilled" ? (repoSearchRes.value.data?.items || []) : [];
      const userItems = userSearchRes.status === "fulfilled" ? (userSearchRes.value.data?.items || []) : [];

      // Si hay un usuario que coincide exactamente con el término buscado
      const exactUserMatch = userItems.find(u => u.login.toLowerCase() === cleanQuery.toLowerCase());
      if (exactUserMatch && isExplicitUser) {
        try {
          const fullUser = await axios.get(exactUserMatch.url, { headers, timeout: 8000 });
          if (fullUser.data?.id) {
            resultType = "user";
            data = fullUser.data;
          }
        } catch (e) {}
      }

      if (!data && repoItems.length > 0) {
        // Calcular puntuación de relevancia para cada repositorio encontrado
        const scored = repoItems.map(item => {
          let score = 0;
          const nameLower = item.name.toLowerCase();
          const fullNameLower = item.full_name.toLowerCase();
          const descLower = (item.description || "").toLowerCase();

          // Coincidencia exacta de nombre o slug
          if (nameLower === cleanQuery.toLowerCase() || nameLower === normalizedSlug) score += 500;
          if (fullNameLower.endsWith("/" + normalizedSlug) || fullNameLower.endsWith("/" + cleanQuery.toLowerCase())) score += 400;

          // Palabras clave coincidentes en título
          for (const word of queryWords) {
            if (nameLower.includes(word)) score += 100;
            if (fullNameLower.includes(word)) score += 80;
            if (descLower.includes(word)) score += 30;
          }

          // Bonus por estrellas (suavizado)
          score += Math.min(item.stargazers_count || 0, 150);

          return { item, score };
        });

        scored.sort((a, b) => b.score - a.score);

        data = scored[0].item;
        resultType = "repo";

        // Guardar otros repositorios relevantes para mostrar como lista recomendada
        extraRepos = scored.slice(1, 4).map(s => s.item);
      }

      // Si no se halló repo pero hay usuario en la búsqueda
      if (!data && userItems.length > 0) {
        try {
          const fullUser = await axios.get(userItems[0].url, { headers, timeout: 8000 });
          if (fullUser.data?.id) {
            resultType = "user";
            data = fullUser.data;
          }
        } catch (e) {}
      }
    }

    if (!data) {
      return m.reply(`❌ No se encontró ningún resultado preciso para "${cleanQuery}" en GitHub.`);
    }

    let responseText = "";
    let avatarUrl = "";

    if (resultType === "repo") {
      avatarUrl = data.owner?.avatar_url || "";
      const rawDesc = data.description || "Sin descripción disponible.";
      const descEs = await translateToSpanish(rawDesc);

      responseText =
        `✦━【 🐙 *${data.full_name.toUpperCase()}* 】━✦\n\n` +
        `📝 ${truncate(descEs, 300)}\n\n` +
        `◈ *Creador:* 👤 ${data.owner?.login || "N/A"}\n` +
        `◈ *Estrellas:* ⭐ ${data.stargazers_count?.toLocaleString() || 0}\n` +
        `◈ *Forks:* 🍴 ${data.forks_count?.toLocaleString() || 0}\n` +
        `◈ *Issues Abiertos:* 🐛 ${data.open_issues_count?.toLocaleString() || 0}\n` +
        `◈ *Lenguaje:* 💻 ${data.language || "N/A"}\n` +
        `◈ *Licencia:* 📜 ${data.license?.spdx_id || data.license?.name || "Sin licencia"}\n` +
        `◈ *Última Actividad:* 📅 ${data.updated_at ? new Date(data.updated_at).toLocaleDateString("es-MX") : "N/A"}\n\n` +
        `🔗 ${data.html_url}`;

      if (extraRepos.length > 0) {
        responseText += `\n\n📌 *Otros resultados coincidentes:*\n`;
        for (const er of extraRepos) {
          responseText += `• *${er.full_name}* (⭐ ${er.stargazers_count || 0})\n  🔗 ${er.html_url}\n`;
        }
      }
    } else {
      avatarUrl = data.avatar_url || "";
      const rawBio = data.bio || "Sin biografía disponible.";
      const bioEs = await translateToSpanish(rawBio);

      responseText =
        `✦━【 👤 *${(`${data.name || data.login}`).toUpperCase()}* 】━✦\n\n` +
        `📝 ${truncate(bioEs, 300)}\n\n` +
        `◈ *Usuario:* 💻 @${data.login}\n` +
        `◈ *Seguidores:* 👥 ${data.followers?.toLocaleString() || 0}\n` +
        `◈ *Siguiendo:* 👤 ${data.following?.toLocaleString() || 0}\n` +
        `◈ *Repositorios Públicos:* 📦 ${data.public_repos || 0}\n` +
        `◈ *Ubicación:* 📍 ${data.location || "N/A"}\n` +
        `◈ *Compañía:* 🏢 ${data.company || "N/A"}\n` +
        (data.blog ? `◈ *Sitio Web:* 🌐 ${data.blog}\n` : "") +
        `\n🔗 ${data.html_url}`;
    }

    // Intentar descargar imagen de avatar
    let imageBuffer = null;
    if (avatarUrl) {
      try {
        const imgRes = await axios.get(avatarUrl, { responseType: "arraybuffer", timeout: 8000 });
        if (imgRes.data && imgRes.data.length > 500) {
          imageBuffer = Buffer.from(imgRes.data);
        }
      } catch (e) {}
    }

    if (imageBuffer) {
      await conn.sendMessage(m.chatId, { image: imageBuffer, caption: responseText }, { quoted: m });
      return;
    }

    await m.reply(responseText);
  } catch (err) {
    await m.reply(`❌ *Error al buscar en GitHub.* Ocurrió un fallo en la consulta.`);
  }
};

handler.command = /^(github|gh)$/i;
handler.description = "Buscar información de usuarios o repositorios en GitHub";
handler.category = "busqueda";
handler.cooldown = 5;

export default handler;
