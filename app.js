const state = {
  transfermarktPlayers: [],
  binPlayers: [],
  events: [],
  issues: [],
  clubPages: [],
  selectedPlayerKeys: [],
  mappings: [],
};

const elements = {
  binFile: document.querySelector("#binFile"),
  htmlFile: document.querySelector("#htmlFile"),
  sourceType: document.querySelector("#sourceType"),
  urlInput: document.querySelector("#urlInput"),
  loadUrlButton: document.querySelector("#loadUrlButton"),
  clearButton: document.querySelector("#clearButton"),
  status: document.querySelector("#status"),
  clubCount: document.querySelector("#clubCount"),
  playerCount: document.querySelector("#playerCount"),
  binPlayerCount: document.querySelector("#binPlayerCount"),
  issueCount: document.querySelector("#issueCount"),
  clubInfo: document.querySelector("#clubInfo"),
  playersBody: document.querySelector("#playersBody"),
  selectionBody: document.querySelector("#selectionBody"),
  mappingBody: document.querySelector("#mappingBody"),
  binBody: document.querySelector("#binBody"),
  eventsBody: document.querySelector("#eventsBody"),
  issuesBody: document.querySelector("#issuesBody"),
  enrichButton: document.querySelector("#enrichButton"),
  enrichStatus: document.querySelector("#enrichStatus"),
  selectFirst25Button: document.querySelector("#selectFirst25Button"),
  clearSelectionButton: document.querySelector("#clearSelectionButton"),
  selectionStatus: document.querySelector("#selectionStatus"),
  mapByOrderButton: document.querySelector("#mapByOrderButton"),
  mappingStatus: document.querySelector("#mappingStatus"),
};

const PES_PLAYER_START = 0x850;
const PES_PLAYER_SIZE = 0xbc;
const PES_PLAYER_COUNT = 25;
const TRANSFERMARKT_BASE_URL = "https://www.transfermarkt.com.br";

function setStatus(message, isError = false) {
  elements.status.textContent = message;
  elements.status.classList.toggle("error", isError);
}

function decodeHtmlText(value) {
  const textarea = document.createElement("textarea");
  textarea.innerHTML = value || "";
  return textarea.value.replace(/\s+/g, " ").trim();
}

function cleanText(value) {
  return decodeHtmlText(value || "").replace(/\u00a0/g, " ").trim();
}

function stripTags(value) {
  return cleanText((value || "").replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<[^>]+>/g, " "));
}

function getPlayerIdFromLink(link) {
  const match = (link || "").match(/\/spieler\/(\d+)/);
  return match ? match[1] : "";
}

function getPlayerKey(player) {
  return player.transfermarktId || player.profileUrl || player.name;
}

function absoluteTransfermarktUrl(link) {
  if (!link) {
    return "";
  }
  if (/^https?:\/\//i.test(link)) {
    return link;
  }
  if (link.startsWith("/")) {
    return `${TRANSFERMARKT_BASE_URL}${link}`;
  }
  return `${TRANSFERMARKT_BASE_URL}/${link}`;
}

function getClubIdFromUrl(url) {
  const match = (url || "").match(/\/verein\/(\d+)/);
  return match ? match[1] : "";
}

function normalizeSourceType(html, selectedType) {
  if (selectedType !== "auto") {
    return selectedType;
  }
  if (/spielbericht\/index|Onze inicial|Sistema t.tico|bench-table/i.test(html)) {
    return "match";
  }
  if (/Plantel|rueckennummer|Nasc\.\/Idade|Valor de mercado/i.test(html)) {
    return "squad";
  }
  if (/Nome no pa.s de origem|Posi..o detalhada|info-table|data-header__headline-wrapper/i.test(html)) {
    return "player";
  }
  return "unknown";
}

function addIssue(field, reason, source) {
  state.issues.push({ field, reason, source });
}

function upsertPlayer(player) {
  if (player.profileUrl) {
    player.profileUrl = absoluteTransfermarktUrl(player.profileUrl);
  }

  const key = getPlayerKey(player);
  const existing = state.transfermarktPlayers.find((item) => getPlayerKey(item) === key);

  if (existing) {
    Object.entries(player).forEach(([field, value]) => {
      if (value !== undefined && value !== null && value !== "" && (!Array.isArray(value) || value.length)) {
        existing[field] = value;
      }
    });
    existing.sources = Array.from(new Set([...(existing.sources || []), ...(player.sources || [])]));
    return;
  }

  state.transfermarktPlayers.push(player);
}

function parseDocument(html) {
  return new DOMParser().parseFromString(html, "text/html");
}

function parseSquadPage(html, sourceLabel) {
  const doc = parseDocument(html);
  const title = cleanText(doc.querySelector("meta[property='og:title']")?.content || doc.title);
  const clubName = title.replace(/\s+-\s+Perfil do clube.*$/i, "");
  const clubId = getClubIdFromUrl(doc.querySelector("meta[property='og:url']")?.content || "");
  const season = cleanText(doc.querySelector("h2.content-box-headline")?.textContent || "").match(/Temporada\s+(\d{4})/)?.[1] || "";

  state.clubPages.push({ type: "Plantel", name: clubName, clubId, season, source: sourceLabel });

  const rows = [...doc.querySelectorAll("table.items tbody tr")];
  if (!rows.length) {
    addIssue("Plantel", "Nao encontrei a tabela de jogadores no HTML.", sourceLabel);
    return;
  }

  rows.forEach((row) => {
    const shirtNumber = cleanText(row.querySelector(".rn_nummer")?.textContent);
    const shirtTitle = cleanText(row.querySelector(".rueckennummer")?.getAttribute("title"));
    const playerLink = row.querySelector("td.hauptlink a[href*='/profil/spieler/']");
    const name = cleanText(playerLink?.textContent);
    const profileUrl = playerLink?.getAttribute("href") || "";
    const transfermarktId = getPlayerIdFromLink(profileUrl);
    const position = cleanText(row.querySelector(".inline-table tr:nth-child(2) td")?.textContent) || shirtTitle;
    const cells = [...row.children];
    const birthAge = cleanText(cells[2]?.textContent);
    const birthDate = birthAge.match(/\d{2}\/\d{2}\/\d{4}/)?.[0] || "";
    const age = birthAge.match(/\((\d+)\)/)?.[1] || "";
    const nationalities = [...(cells[3]?.querySelectorAll("img[title]") || [])].map((img) => cleanText(img.getAttribute("title"))).filter(Boolean);
    const currentClub = cleanText(cells[4]?.querySelector("img[title]")?.getAttribute("title") || cells[4]?.textContent);
    const marketValue = cleanText(cells[5]?.textContent);

    if (!name) {
      addIssue("Nome do jogador", "Linha do plantel sem link/nome de jogador.", sourceLabel);
      return;
    }

    upsertPlayer({
      shirtNumber,
      name,
      position,
      birthDate,
      age,
      nationalities,
      currentClub,
      marketValue,
      transfermarktId,
      profileUrl,
      sources: ["Plantel"],
    });

    if (!shirtNumber || shirtNumber === "-") {
      addIssue(`Camisa de ${name}`, "Jogador sem numero de camisa na tabela do plantel.", sourceLabel);
    }
  });
}

function parsePlayerPage(html, sourceLabel) {
  const doc = parseDocument(html);
  const titleName = cleanText(doc.querySelector("h1.data-header__headline-wrapper")?.textContent || doc.querySelector("meta[property='og:title']")?.content);
  const canonical = doc.querySelector("link[rel='canonical']")?.href || doc.querySelector("meta[property='og:url']")?.content || "";
  const transfermarktId = getPlayerIdFromLink(canonical);
  const header = doc.querySelector(".data-header");
  const headerText = header ? cleanText(header.textContent) : "";

  const fullName = getInfoTableValue(doc, "Nome no país de origem:");
  const birthAge = getInfoTableValue(doc, "Nasc./Idade:") || headerText.match(/\d{2}\/\d{2}\/\d{4}\s+\(\d+\)/)?.[0] || "";
  const birthDate = birthAge.match(/\d{2}\/\d{2}\/\d{4}/)?.[0] || "";
  const age = birthAge.match(/\((\d+)\)/)?.[1] || "";
  const birthPlace = getInfoTableValue(doc, "Local de nascimento:");
  const height = getInfoTableValue(doc, "Altura:");
  const nationality = getInfoTableValue(doc, "Nacionalidade:");
  const detailedPosition = getInfoTableValue(doc, "Posição:");
  const foot = getInfoTableValue(doc, "Pé:");
  const currentClub = getInfoTableValue(doc, "Clube atual:");
  const mainPosition = cleanText(doc.querySelector(".detail-position__position")?.textContent);

  if (!titleName) {
    addIssue("Nome do jogador", "Nao encontrei o nome principal na pagina individual.", sourceLabel);
  }

  upsertPlayer({
    name: titleName,
    fullName,
    position: mainPosition || detailedPosition,
    detailedPosition,
    birthDate,
    age,
    birthPlace,
    height,
    nationalities: nationality ? [nationality] : [],
    foot,
    currentClub,
    transfermarktId,
    profileUrl: canonical,
    sources: ["Jogador"],
  });

  ["Pé", "Altura", "Posição"].forEach((field) => {
    const value = { "Pé": foot, Altura: height, "Posição": mainPosition || detailedPosition }[field];
    if (!value) {
      addIssue(`${field} de ${titleName || transfermarktId || "jogador"}`, "Campo nao encontrado na pagina individual.", sourceLabel);
    }
  });
}

function getInfoTableValue(doc, label) {
  const cells = [...doc.querySelectorAll(".info-table__content")];
  const wanted = normalizeLabel(label);
  for (let index = 0; index < cells.length - 1; index += 1) {
    if (normalizeLabel(cells[index].textContent) === wanted) {
      return cleanText(cells[index + 1].textContent);
    }
  }
  return "";
}

function normalizeLabel(value) {
  return cleanText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9/]+/gi, "")
    .toLowerCase();
}

function parseMatchPage(html, sourceLabel) {
  const doc = parseDocument(html);
  const title = cleanText(doc.querySelector("meta[property='og:title']")?.content || doc.title);
  state.clubPages.push({ type: "Jogo", name: title, source: sourceLabel });

  const teamBlocks = [...doc.querySelectorAll(".aufstellung-box")];
  if (!teamBlocks.length) {
    addIssue("Escalação", "Nao encontrei os blocos de escalacao da partida.", sourceLabel);
  }

  const formationLabels = [...doc.querySelectorAll(".formation-subtitle")].map((node) => cleanText(node.textContent));
  formationLabels.forEach((label, index) => {
    state.events.push({ type: "Formacao", player: "", detail: label, team: index === 0 ? "Mandante" : "Visitante" });
  });

  [...doc.querySelectorAll(".formation-player-container")].forEach((node) => {
    const playerLink = node.querySelector("a[href*='/profil/spieler/']");
    const name = cleanText(playerLink?.textContent);
    const shirtNumber = cleanText(node.querySelector(".tm-shirt-number")?.textContent);
    const profileUrl = playerLink?.getAttribute("href") || "";

    if (name) {
      upsertPlayer({
        name,
        shirtNumber,
        transfermarktId: getPlayerIdFromLink(profileUrl),
        profileUrl,
        sources: ["Jogo - titular"],
      });
    }
  });

  [...doc.querySelectorAll(".bench-table__tr")].forEach((row) => {
    const playerLink = row.querySelector("a[href*='/profil/spieler/']");
    if (!playerLink) {
      return;
    }

    const cells = [...row.querySelectorAll("td")];
    const shirtNumber = cleanText(cells[0]?.textContent);
    const name = cleanText(playerLink.textContent);
    const profileUrl = playerLink.getAttribute("href") || "";
    const position = cleanText(cells[cells.length - 1]?.textContent);

    upsertPlayer({
      name,
      shirtNumber,
      position,
      transfermarktId: getPlayerIdFromLink(profileUrl),
      profileUrl,
      sources: ["Jogo - reserva"],
    });
  });

  [...doc.querySelectorAll(".sb-aktion")].forEach((eventNode) => {
    const text = stripTags(eventNode.innerHTML);
    const playerLink = eventNode.querySelector("a[href*='/spieler/']");
    const player = cleanText(playerLink?.textContent);
    const team = cleanText(eventNode.querySelector(".sb-aktion-wappen img[title]")?.getAttribute("title"));
    let type = "Evento";
    if (/Cart.o amarelo/i.test(text)) type = "Cartao";
    if (/gol|Chute|Cabeceio/i.test(text)) type = "Gol";
    if (/wechsel|Sem mais detalhes|sb-ein|sb-aus/i.test(eventNode.innerHTML)) type = "Substituicao";

    if (player || text) {
      state.events.push({ type, player, detail: text, team });
    }
  });
}

function parseTransfermarktHtml(html, sourceLabel) {
  const type = normalizeSourceType(html, elements.sourceType.value);

  if (type === "squad") {
    parseSquadPage(html, sourceLabel);
  } else if (type === "player") {
    parsePlayerPage(html, sourceLabel);
  } else if (type === "match") {
    parseMatchPage(html, sourceLabel);
  } else {
    addIssue("Tipo de pagina", "Nao consegui detectar se o HTML e de jogo, plantel ou jogador.", sourceLabel);
  }

  render();
}

function parsePesBin(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);
  state.binPlayers = [];

  if (bytes.length < PES_PLAYER_START + PES_PLAYER_SIZE) {
    addIssue("Arquivo PES", "Arquivo menor que o esperado para conter registros de jogadores.", "Arquivo PES");
    render();
    return;
  }

  for (let index = 0; index < PES_PLAYER_COUNT; index += 1) {
    const base = PES_PLAYER_START + index * PES_PLAYER_SIZE;
    if (base + PES_PLAYER_SIZE > bytes.length) {
      break;
    }

    const name = readAscii(bytes, base + 0x17, 0x2e);
    const shirtName = readAscii(bytes, base + 0x45, 0x13);
    const internalId = readUint32(bytes, base + 0x58);

    if (name || shirtName || internalId) {
      state.binPlayers.push({
        slot: index + 1,
        name,
        shirtName,
        internalId,
        offset: `0x${base.toString(16).toUpperCase()}`,
      });
    }
  }

  render();
  setStatus(`Arquivo PES lido com ${state.binPlayers.length} jogadores encontrados.`);
}

function readAscii(bytes, start, length) {
  let end = start;
  const limit = Math.min(start + length, bytes.length);
  while (end < limit && bytes[end] !== 0) {
    end += 1;
  }
  return new TextDecoder("latin1").decode(bytes.slice(start, end)).trim();
}

function readUint32(bytes, offset) {
  return (bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)) >>> 0;
}

function getSelectedPlayers() {
  return state.selectedPlayerKeys
    .map((key) => state.transfermarktPlayers.find((player) => getPlayerKey(player) === key))
    .filter(Boolean);
}

function describeTransfermarktPlayer(player) {
  return [
    player.position || player.detailedPosition,
    player.age ? `${player.age} anos` : "",
    player.foot ? `pe ${player.foot}` : "",
    player.height,
    (player.nationalities || []).join(", "),
  ].filter(Boolean).join(" | ");
}

function bindDynamicControls() {
  document.querySelectorAll("[data-select-player]").forEach((checkbox) => {
    checkbox.addEventListener("change", () => {
      const key = checkbox.dataset.selectPlayer;

      if (checkbox.checked) {
        if (state.selectedPlayerKeys.length >= PES_PLAYER_COUNT) {
          checkbox.checked = false;
          setStatus("Selecao limitada a 25 jogadores.", true);
          return;
        }
        state.selectedPlayerKeys.push(key);
      } else {
        state.selectedPlayerKeys = state.selectedPlayerKeys.filter((item) => item !== key);
        state.mappings = state.mappings.map((mapping) => mapping.playerKey === key ? { ...mapping, playerKey: "" } : mapping);
      }

      render();
    });
  });

  document.querySelectorAll("[data-map-slot]").forEach((select) => {
    select.addEventListener("change", () => {
      const slot = Number(select.dataset.mapSlot);
      setMapping(slot, select.value);
      render();
    });
  });
}

function setMapping(slot, playerKey) {
  const existing = state.mappings.find((mapping) => mapping.slot === slot);
  if (existing) {
    existing.playerKey = playerKey;
    return;
  }
  state.mappings.push({ slot, playerKey });
}

function selectFirst25Players() {
  state.selectedPlayerKeys = state.transfermarktPlayers.slice(0, PES_PLAYER_COUNT).map(getPlayerKey);
  mapByOrder();
  render();
  setStatus(`${state.selectedPlayerKeys.length} jogadores selecionados.`);
}

function clearSelection() {
  state.selectedPlayerKeys = [];
  state.mappings = [];
  render();
  setStatus("Selecao de jogadores limpa.");
}

function mapByOrder() {
  const selectedPlayers = getSelectedPlayers();
  state.mappings = state.binPlayers.slice(0, PES_PLAYER_COUNT).map((binPlayer, index) => ({
    slot: binPlayer.slot,
    playerKey: getPlayerKey(selectedPlayers[index] || {}),
  }));
}

function render() {
  elements.clubCount.textContent = state.clubPages.length;
  elements.playerCount.textContent = state.transfermarktPlayers.length;
  elements.binPlayerCount.textContent = state.binPlayers.length;
  elements.issueCount.textContent = state.issues.length;

  elements.clubInfo.innerHTML = state.clubPages.length
    ? state.clubPages.map((item) => `<span class="pill">${escapeHtml(item.type)}</span> ${escapeHtml([item.name, item.season && `Temporada ${item.season}`, item.clubId && `ID ${item.clubId}`].filter(Boolean).join(" - "))}`).join("<br>")
    : "Nenhuma informação carregada.";

  elements.playersBody.innerHTML = state.transfermarktPlayers.map((player) => `
    <tr>
      <td>${escapeHtml(player.shirtNumber || "")}</td>
      <td>${escapeHtml(player.name || "")}${player.fullName ? `<br><span class="muted">${escapeHtml(player.fullName)}</span>` : ""}</td>
      <td>${escapeHtml(player.position || player.detailedPosition || "")}</td>
      <td>${escapeHtml(player.age || "")}${player.birthDate ? `<br><span class="muted">${escapeHtml(player.birthDate)}</span>` : ""}</td>
      <td>${escapeHtml((player.nationalities || []).join(", "))}</td>
      <td>${escapeHtml(player.foot || "")}</td>
      <td>${escapeHtml(player.height || "")}</td>
      <td>${escapeHtml(player.transfermarktId || "")}${player.profileUrl ? `<br><span class="muted">${escapeHtml(player.profileUrl)}</span>` : ""}</td>
      <td>${escapeHtml((player.sources || []).join(", "))}</td>
    </tr>
  `).join("") || `<tr><td colspan="9" class="muted">Nenhum jogador do Transfermarkt carregado.</td></tr>`;

  const selectedPlayers = getSelectedPlayers();
  elements.selectionStatus.textContent = `${selectedPlayers.length}/25 selecionados`;
  elements.selectionBody.innerHTML = state.transfermarktPlayers.map((player) => {
    const key = getPlayerKey(player);
    const checked = state.selectedPlayerKeys.includes(key) ? "checked" : "";
    return `
      <tr>
        <td class="check-cell"><input type="checkbox" data-select-player="${escapeHtml(key)}" ${checked}></td>
        <td>${escapeHtml(player.shirtNumber || "")}</td>
        <td>${escapeHtml(player.name || "")}${player.fullName ? `<br><span class="muted">${escapeHtml(player.fullName)}</span>` : ""}</td>
        <td>${escapeHtml(player.position || player.detailedPosition || "")}</td>
        <td>${escapeHtml(player.age || "")}</td>
        <td>${escapeHtml(player.foot || "")}</td>
        <td>${escapeHtml(player.height || "")}</td>
        <td>${escapeHtml((player.sources || []).join(", "))}</td>
      </tr>
    `;
  }).join("") || `<tr><td colspan="8" class="muted">Carregue jogadores do Transfermarkt para selecionar os 25.</td></tr>`;

  const mappedCount = state.mappings.filter((mapping) => mapping.playerKey).length;
  elements.mappingStatus.textContent = `${mappedCount}/25 slots mapeados`;
  elements.mappingBody.innerHTML = state.binPlayers.map((binPlayer, index) => {
    const mapping = state.mappings.find((item) => item.slot === binPlayer.slot);
    const selectedOptions = selectedPlayers.map((player) => {
      const key = getPlayerKey(player);
      const selected = mapping?.playerKey === key ? "selected" : "";
      return `<option value="${escapeHtml(key)}" ${selected}>${escapeHtml(player.shirtNumber ? `${player.shirtNumber} - ${player.name}` : player.name)}</option>`;
    }).join("");
    const mappedPlayer = selectedPlayers.find((player) => getPlayerKey(player) === mapping?.playerKey);

    return `
      <tr>
        <td>${binPlayer.slot}</td>
        <td>${escapeHtml(binPlayer.name)}<br><span class="muted">${escapeHtml(binPlayer.shirtName)} | ID ${binPlayer.internalId}</span></td>
        <td>
          <select class="slot-select" data-map-slot="${binPlayer.slot}">
            <option value="">Sem jogador selecionado</option>
            ${selectedOptions}
          </select>
        </td>
        <td class="compact">${mappedPlayer ? escapeHtml(describeTransfermarktPlayer(mappedPlayer)) : ""}</td>
      </tr>
    `;
  }).join("") || `<tr><td colspan="4" class="muted">Carregue o arquivo PES para ver os 25 slots.</td></tr>`;

  elements.binBody.innerHTML = state.binPlayers.map((player) => `
    <tr>
      <td>${player.slot}</td>
      <td>${escapeHtml(player.name)}</td>
      <td>${escapeHtml(player.shirtName)}</td>
      <td>${player.internalId}</td>
      <td>${player.offset}</td>
    </tr>
  `).join("") || `<tr><td colspan="5" class="muted">Nenhum arquivo PES carregado.</td></tr>`;

  elements.eventsBody.innerHTML = state.events.map((event) => `
    <tr>
      <td>${escapeHtml(event.type)}</td>
      <td>${escapeHtml(event.player)}</td>
      <td>${escapeHtml(event.detail)}</td>
      <td>${escapeHtml(event.team)}</td>
    </tr>
  `).join("") || `<tr><td colspan="4" class="muted">Nenhum evento de jogo carregado.</td></tr>`;

  elements.issuesBody.innerHTML = state.issues.map((issue) => `
    <tr>
      <td>${escapeHtml(issue.field)}</td>
      <td>${escapeHtml(issue.reason)}</td>
      <td>${escapeHtml(issue.source)}</td>
    </tr>
  `).join("") || `<tr><td colspan="3" class="muted">Nenhum alerta no momento.</td></tr>`;

  bindDynamicControls();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function loadTransfermarktUrl() {
  const url = elements.urlInput.value.trim();
  if (!url) {
    setStatus("Informe uma URL do Transfermarkt.", true);
    return;
  }

  elements.loadUrlButton.disabled = true;
  setStatus("Lendo URL do Transfermarkt...");

  try {
    const response = await fetch(`/fetch?url=${encodeURIComponent(url)}`);
    const payload = await response.json();

    if (!response.ok || !payload.ok) {
      throw new Error(payload.error || "Falha ao buscar a URL.");
    }

    parseTransfermarktHtml(payload.html, url);
    setStatus("URL lida com sucesso.");
  } catch (error) {
    addIssue("URL do Transfermarkt", error.message, url);
    render();
    setStatus(`Nao consegui ler a URL.\nMotivo provavel: ${error.message}\nSugestao: salve a pagina como HTML e carregue no campo de HTML salvo.`, true);
  } finally {
    elements.loadUrlButton.disabled = false;
  }
}

async function fetchTransfermarktHtml(url) {
  const response = await fetch(`/fetch?url=${encodeURIComponent(url)}`);
  const payload = await response.json();

  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || "Falha ao buscar a URL.");
  }

  return payload.html;
}

async function enrichIndividualPlayers() {
  const playersWithProfiles = state.transfermarktPlayers.filter((player) => player.profileUrl);

  if (!playersWithProfiles.length) {
    setStatus("Nenhum link individual de jogador encontrado para buscar.", true);
    return;
  }

  elements.enrichButton.disabled = true;
  let successCount = 0;
  let failCount = 0;

  for (let index = 0; index < playersWithProfiles.length; index += 1) {
    const player = playersWithProfiles[index];
    elements.enrichStatus.textContent = `${index + 1}/${playersWithProfiles.length}: ${player.name}`;

    try {
      const html = await fetchTransfermarktHtml(player.profileUrl);
      parsePlayerPage(html, player.profileUrl);
      successCount += 1;
    } catch (error) {
      failCount += 1;
      addIssue(`Perfil individual de ${player.name}`, error.message, player.profileUrl);
      render();
    }
  }

  elements.enrichButton.disabled = false;
  elements.enrichStatus.textContent = `${successCount} perfis lidos, ${failCount} falhas.`;
  setStatus(`Busca individual concluida.\nPerfis lidos: ${successCount}\nFalhas: ${failCount}${failCount ? "\nVeja a aba Alertas para detalhes." : ""}`, failCount > 0);
  render();
}

elements.binFile.addEventListener("change", async () => {
  const [file] = elements.binFile.files;
  if (!file) return;
  parsePesBin(await file.arrayBuffer());
});

elements.htmlFile.addEventListener("change", async () => {
  const [file] = elements.htmlFile.files;
  if (!file) return;
  const html = await file.text();
  parseTransfermarktHtml(html, file.name);
  setStatus(`HTML lido: ${file.name}`);
});

elements.loadUrlButton.addEventListener("click", loadTransfermarktUrl);
elements.enrichButton.addEventListener("click", enrichIndividualPlayers);
elements.selectFirst25Button.addEventListener("click", selectFirst25Players);
elements.clearSelectionButton.addEventListener("click", clearSelection);
elements.mapByOrderButton.addEventListener("click", () => {
  mapByOrder();
  render();
  setStatus("Correspondencia por ordem atualizada.");
});

elements.clearButton.addEventListener("click", () => {
  state.transfermarktPlayers = [];
  state.binPlayers = [];
  state.events = [];
  state.issues = [];
  state.clubPages = [];
  state.selectedPlayerKeys = [];
  state.mappings = [];
  elements.binFile.value = "";
  elements.htmlFile.value = "";
  elements.urlInput.value = "";
  elements.enrichStatus.textContent = "Use depois de carregar uma pagina de jogo ou plantel.";
  render();
  setStatus("Dados limpos.");
});

document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((item) => item.classList.remove("active"));
    document.querySelectorAll(".panel").forEach((item) => item.classList.remove("active"));
    tab.classList.add("active");
    document.querySelector(`#${tab.dataset.panel}`).classList.add("active");
  });
});

render();
