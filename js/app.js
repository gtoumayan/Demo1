const app = document.getElementById("app");
const scoreboardModal = document.getElementById("scoreboardModal");
const scoreboardContent = document.getElementById("scoreboardContent");
const rulesModal = document.getElementById("rulesModal");

let state = {
  screen: "home",
  mode: null,
  players: [],
  teams: null,
  settings: {
    performanceSeconds: 180,
    teamGuessSeconds: 120,
    stealMode: "oneAttemptEachRemaining",
    stealSeconds: 30,
    guessStyleFFA: "oneCategory",
    teamChallengeEnabled: true,
    endCondition: "decksDepleted",
    fixedRounds: 10,
    timeLimitMinutes: 30,
    trophyTeamSingleRule: "performingTeamIfAnyGuessed",
    soundEnabled: true
  },
  decks: cloneDecks(DEFAULT_DECKS),
  deckDefaults: cloneDecks(DEFAULT_DECKS),
  startedAt: null,
  roundNumber: 0,
  rotationIndex: 0,
  currentRound: null,
  history: [],
  timer: null
};

function saveGame() {
  localStorage.setItem("roleplay-rumble-save", JSON.stringify(state));
  alert("Game saved locally.");
}

function loadGame() {
  const raw = localStorage.getItem("roleplay-rumble-save");
  if (!raw) return alert("No saved game found.");
  state = JSON.parse(raw);
  state.timer = null;
  render();
}

function defaultTeams() {
  return {
    A: { name: "Team A", players: [], score: 0, cardsWon: { scene: 0, character: 0, emotion: 0, challenge: 0, trophy: 0 } },
    B: { name: "Team B", players: [], score: 0, cardsWon: { scene: 0, character: 0, emotion: 0, challenge: 0, trophy: 0 } }
  };
}

function startGameFromSetup() {
  if (state.mode === "FFA" && state.players.length < 2) return alert("Add at least 2 players.");
  if (state.mode !== "FFA") {
    if (!state.teams.A.players.length || !state.teams.B.players.length) return alert("Each team needs at least 1 player.");
  }
  state.decks.scene = shuffle(state.decks.scene);
  state.decks.character = shuffle(state.decks.character);
  state.decks.emotion = shuffle(state.decks.emotion);
  state.decks.challenge = shuffle(state.decks.challenge);
  state.startedAt = Date.now();
  state.roundNumber = 0;
  state.rotationIndex = Math.floor(Math.random() * (state.mode === "FFA" ? state.players.length : 2));
  state.history = [];
  state.screen = "roundStart";
  render();
}

function newRound() {
  if (!canStartRound(state)) {
    state.screen = "end";
    return render();
  }
  if (state.settings.endCondition === "fixedRounds" && state.roundNumber >= state.settings.fixedRounds) {
    state.screen = "end";
    return render();
  }
  if (state.settings.endCondition === "timeLimit") {
    const elapsed = (Date.now() - state.startedAt) / 1000 / 60;
    if (elapsed >= state.settings.timeLimitMinutes) {
      state.screen = "end";
      return render();
    }
  }

  state.roundNumber += 1;
  const stageCards = {
    scene: drawFromDeck(state, "scene"),
    character: drawFromDeck(state, "character"),
    emotion: drawFromDeck(state, "emotion")
  };

  const round = {
    performerId: null,
    performerTeam: null,
    challengeIssuerId: null,
    challengeIssuerTeam: null,
    challengeCard: null,
    stageCards,
    guessed: { scene: false, character: false, emotion: false, challenge: false },
    winners: { scene: null, character: null, emotion: null, challenge: null, trophy: null },
    guessTurnIndex: 0,
    phase: "private",
    summary: []
  };

  if (state.mode === "FFA") {
    round.performerId = state.players[state.rotationIndex % state.players.length].id;
    round.guessTurnIndex = (state.rotationIndex + 1) % state.players.length;
    state.rotationIndex = (state.rotationIndex + 1) % state.players.length;
  } else {
    round.performerTeam = state.rotationIndex % 2 === 0 ? "A" : "B";
    state.rotationIndex += 1;
  }

  state.currentRound = round;
  assignChallengeIfEligible();
  state.screen = "roundStart";
  render();
}

function assignChallengeIfEligible() {
  const round = state.currentRound;
  if (state.mode === "FFA") {
    const eligible = lowestEligiblePlayer(state);
    round.challengeEligible = eligible;
  } else {
    round.challengeEligibleTeam = state.settings.teamChallengeEnabled ? trailingTeamEligible(state) : null;
  }
}

function setChallengeFromChoice(choiceCard, issuer) {
  const round = state.currentRound;
  round.challengeCard = choiceCard;
  if (state.mode === "FFA") round.challengeIssuerId = issuer;
  else round.challengeIssuerTeam = issuer;
}

function moveToPerformance() {
  state.currentRound.phase = "performance";
  state.screen = "performance";
  render();
}

function moveToGuessing() {
  state.currentRound.phase = "guessing";
  state.currentRound.steal = false;
  state.currentRound.stealAttemptsLeft = 0;
  state.screen = "guessing";
  render();
}

function makeBeep() {
  if (!state.settings.soundEnabled) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    osc.type = "square";
    osc.frequency.setValueAtTime(440, ctx.currentTime);
    osc.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.25);
  } catch (e) {
    console.log("beep unavailable", e);
  }
}

function startTimer(seconds, onComplete) {
  clearInterval(state.timer);
  let left = seconds;
  const tick = () => {
    const el = document.getElementById("timerValue");
    if (!el) return;
    const mm = String(Math.floor(left / 60)).padStart(2, "0");
    const ss = String(left % 60).padStart(2, "0");
    el.textContent = `${mm}:${ss}`;
    el.classList.toggle("end", left <= 0);
    if (left <= 0) {
      clearInterval(state.timer);
      makeBeep();
      onComplete();
    }
    left -= 1;
  };
  tick();
  state.timer = setInterval(tick, 1000);
}

function getNameById(id) {
  const p = state.players.find((x) => x.id === id);
  return p ? p.name : "Unknown";
}

function handleGuessSubmit(formData) {
  const round = state.currentRound;
  const category = formData.get("category");
  const guess = (formData.get("guess") || "").trim();
  const guess2 = (formData.get("guess2") || "").trim();
  const guess3 = (formData.get("guess3") || "").trim();

  if (!guess && category !== "all") return alert("Type a guess first.");

  if (category === "all") {
    round.pendingBatch = [
      { category: "scene", guess },
      { category: "character", guess: guess2 },
      { category: "emotion", guess: guess3 }
    ].filter((g) => !round.guessed[g.category]);
    round.pendingGuess = round.pendingBatch.shift();
  } else {
    round.pendingGuess = { category, guess };
  }
  state.screen = "confirmGuess";
  render();
}

function resolveGuess(correct) {
  const round = state.currentRound;
  const pending = round.pendingGuess;
  if (correct) {
    round.guessed[pending.category] = true;
    if (state.mode === "FFA") {
      const currentGuesser = state.players[round.guessTurnIndex].id;
      applyCardWin(state, currentGuesser, pending.category);
      round.winners[pending.category] = currentGuesser;
      round.summary.push(`${getNameById(currentGuesser)} won ${pending.category}.`);
    } else {
      const winnerTeam = round.steal ? (round.performerTeam === "A" ? "B" : "A") : round.performerTeam;
      applyTeamWin(state, winnerTeam, pending.category);
      round.winners[pending.category] = winnerTeam;
      round.summary.push(`${state.teams[winnerTeam].name} won ${pending.category}.`);
    }
  }

  if (round.pendingBatch && round.pendingBatch.length) {
    round.pendingGuess = round.pendingBatch.shift();
    state.screen = "confirmGuess";
    return render();
  }

  round.pendingGuess = null;
  round.pendingBatch = null;

  const allStages = round.guessed.scene && round.guessed.character && round.guessed.emotion;
  if (allStages && round.challengeCard && !round.guessed.challenge) {
    round.phase = "challengeGuess";
    state.screen = "challengeGuess";
    return render();
  }

  if (state.mode === "FFA") {
    round.guessTurnIndex = (round.guessTurnIndex + 1) % state.players.length;
    if (state.players[round.guessTurnIndex].id === round.performerId) {
      round.guessTurnIndex = (round.guessTurnIndex + 1) % state.players.length;
    }
  }

  if (allStages && (!round.challengeCard || round.guessed.challenge)) {
    awardTrophyIfNeeded();
    state.screen = "summary";
  } else {
    state.screen = "guessing";
  }
  render();
}

function resolveChallenge(correct) {
  const round = state.currentRound;
  if (correct) {
    round.guessed.challenge = true;
    if (state.mode === "FFA") {
      const winner = state.players[round.guessTurnIndex].id;
      applyCardWin(state, winner, "challenge");
      round.winners.challenge = winner;
      round.summary.push(`${getNameById(winner)} guessed the challenge!`);
    } else {
      const winnerTeam = round.steal ? (round.performerTeam === "A" ? "B" : "A") : round.performerTeam;
      applyTeamWin(state, winnerTeam, "challenge");
      round.winners.challenge = winnerTeam;
      round.summary.push(`${state.teams[winnerTeam].name} won challenge card.`);
    }
  } else {
    if (state.mode === "FFA") {
      if (round.challengeIssuerId) {
        applyCardWin(state, round.challengeIssuerId, "challenge");
        round.winners.challenge = round.challengeIssuerId;
      }
    } else if (round.challengeIssuerTeam) {
      applyTeamWin(state, round.challengeIssuerTeam, "challenge");
      round.winners.challenge = round.challengeIssuerTeam;
    }
  }

  awardTrophyIfNeeded();
  state.screen = "summary";
  render();
}

function awardTrophyIfNeeded() {
  const round = state.currentRound;
  const allStage = round.guessed.scene && round.guessed.character && round.guessed.emotion;
  const challengeOk = !round.challengeCard || round.guessed.challenge;
  if (!allStage || !challengeOk) return;

  if (state.mode === "FFA") {
    applyCardWin(state, round.performerId, "trophy");
    round.winners.trophy = round.performerId;
    round.summary.push(`${getNameById(round.performerId)} earned ${DEFAULT_DECKS.trophyLabel} trophy.`);
  } else if (state.mode === "TEAM_SINGLE") {
    let teamKey = round.performerTeam;
    if (state.settings.trophyTeamSingleRule === "onlyPerformingTeamGuessedAll") {
      if (round.winners.scene !== round.performerTeam || round.winners.character !== round.performerTeam || round.winners.emotion !== round.performerTeam) {
        return;
      }
    }
    applyTeamWin(state, teamKey, "trophy");
    round.winners.trophy = teamKey;
    round.summary.push(`${state.teams[teamKey].name} earned ${DEFAULT_DECKS.trophyLabel} trophy.`);
  } else {
    applyTeamWin(state, round.performerTeam, "trophy");
    round.winners.trophy = round.performerTeam;
    round.summary.push(`${state.teams[round.performerTeam].name} earned ${DEFAULT_DECKS.trophyLabel} trophy.`);
  }
}

function renderHome() {
  app.innerHTML = `
    <div class="card">
      <p class="big-text">A pass-the-device party game for local play.</p>
      <p>Big timer, private reveal cards, guided rounds, and challenge twists.</p>
      <div class="footer-actions">
        <button class="primary" id="startBtn">Start Game</button>
        <button class="secondary" id="rulesBtn">Rules</button>
        <button class="secondary" id="loadBtn">Load Saved Game</button>
      </div>
    </div>`;
  document.getElementById("startBtn").onclick = () => { state.screen = "mode"; render(); };
  document.getElementById("rulesBtn").onclick = () => rulesModal.classList.remove("hidden");
  document.getElementById("loadBtn").onclick = loadGame;
}

function renderMode() {
  app.innerHTML = `
    <div class="card"><h2>Select Mode</h2>
      <button class="primary" data-mode="FFA">Individual Performer (FFA)</button>
      <button class="primary" data-mode="TEAM_SINGLE">2 Teams – 1 Performer</button>
      <button class="primary" data-mode="TEAM_GROUP">2 Teams – Group Performance</button>
    </div>`;
  app.querySelectorAll("[data-mode]").forEach((btn) => {
    btn.onclick = () => {
      state.mode = btn.dataset.mode;
      state.players = [];
      state.teams = defaultTeams();
      state.screen = "setup";
      render();
    };
  });
}

function renderSetup() {
  if (state.mode === "FFA") {
    app.innerHTML = `
      <div class="card"><h2>Player Setup (FFA)</h2>
      <input id="playerName" placeholder="Player name" />
      <button class="secondary" id="addPlayer">Add Player</button>
      <div id="playerList"></div>
      <label><input type="checkbox" id="manualOrder" /> Manual turn reorder</label>
      <div class="footer-actions">
        <button class="primary" id="toDeck">Next: Deck Setup</button>
      </div></div>`;
    document.getElementById("addPlayer").onclick = () => {
      const name = document.getElementById("playerName").value.trim();
      if (!name) return;
      state.players.push(newPlayer(name));
      document.getElementById("playerName").value = "";
      renderSetup();
    };
    const list = document.getElementById("playerList");
    state.players.forEach((p, i) => {
      const row = document.createElement("div");
      row.className = "list-item";
      row.innerHTML = `<span>${i + 1}. ${p.name}</span><div><button data-up="${i}">↑</button><button data-del="${p.id}" class="danger">Delete</button></div>`;
      list.appendChild(row);
    });
    list.querySelectorAll("[data-del]").forEach((b) => b.onclick = () => {
      state.players = state.players.filter((p) => p.id !== b.dataset.del);
      renderSetup();
    });
    list.querySelectorAll("[data-up]").forEach((b) => b.onclick = () => {
      const i = Number(b.dataset.up);
      if (i <= 0) return;
      [state.players[i - 1], state.players[i]] = [state.players[i], state.players[i - 1]];
      renderSetup();
    });
  } else {
    app.innerHTML = `
      <div class="card"><h2>Team Setup</h2>
      <div class="grid">
        <div>
          <label>Team A Name</label><input id="teamAName" value="${state.teams.A.name}" />
          <input id="teamAPlayer" placeholder="Add Team A player" />
          <button class="secondary" id="addA">Add to Team A</button>
          <div id="teamAList"></div>
        </div>
        <div>
          <label>Team B Name</label><input id="teamBName" value="${state.teams.B.name}" />
          <input id="teamBPlayer" placeholder="Add Team B player" />
          <button class="secondary" id="addB">Add to Team B</button>
          <div id="teamBList"></div>
        </div>
      </div>
      <button class="secondary" id="coinFlip">Coin Flip for Starting Team</button>
      <p id="coinResult" class="small"></p>
      <div class="footer-actions"><button class="primary" id="toDeck">Next: Deck Setup</button></div>
      </div>`;
    const refreshTeams = () => {
      state.teams.A.name = document.getElementById("teamAName").value || "Team A";
      state.teams.B.name = document.getElementById("teamBName").value || "Team B";
      renderSetup();
    };
    document.getElementById("teamAName").onchange = refreshTeams;
    document.getElementById("teamBName").onchange = refreshTeams;
    document.getElementById("addA").onclick = () => {
      const n = document.getElementById("teamAPlayer").value.trim();
      if (!n) return;
      state.teams.A.players.push(newPlayer(n));
      state.players.push(state.teams.A.players[state.teams.A.players.length - 1]);
      renderSetup();
    };
    document.getElementById("addB").onclick = () => {
      const n = document.getElementById("teamBPlayer").value.trim();
      if (!n) return;
      state.teams.B.players.push(newPlayer(n));
      state.players.push(state.teams.B.players[state.teams.B.players.length - 1]);
      renderSetup();
    };
    const fill = (id, teamKey) => {
      const el = document.getElementById(id);
      state.teams[teamKey].players.forEach((p) => {
        const row = document.createElement("div");
        row.className = "list-item";
        row.innerHTML = `<span>${p.name}</span>`;
        el.appendChild(row);
      });
    };
    fill("teamAList", "A");
    fill("teamBList", "B");
    document.getElementById("coinFlip").onclick = () => {
      state.rotationIndex = Math.random() > 0.5 ? 0 : 1;
      document.getElementById("coinResult").textContent = `Starting team: ${state.rotationIndex === 0 ? state.teams.A.name : state.teams.B.name}`;
    };
  }
  document.getElementById("toDeck").onclick = () => { state.screen = "deck"; render(); };
}

function renderDeckEditor() {
  const renderDeck = (name) => state.decks[name].map((c, i) => `<div class="list-item"><span>${c}</span><button class="danger" data-del="${name}:${i}">X</button></div>`).join("");
  app.innerHTML = `
    <div class="card">
      <h2>Deck Setup</h2>
      <p class="small">Edit cards, then continue. Decks are shuffled at game start.</p>
      <div class="grid">
        <div class="panel"><h3>Scene (${state.decks.scene.length})</h3>${renderDeck("scene")}<input id="addScene" placeholder="New scene"/><button data-add="scene" class="secondary">Add Scene</button></div>
        <div class="panel"><h3>Character (${state.decks.character.length})</h3>${renderDeck("character")}<input id="addCharacter" placeholder="New character"/><button data-add="character" class="secondary">Add Character</button></div>
        <div class="panel"><h3>Emotion (${state.decks.emotion.length})</h3>${renderDeck("emotion")}<input id="addEmotion" placeholder="New emotion"/><button data-add="emotion" class="secondary">Add Emotion</button></div>
        <div class="panel"><h3>Challenge (${state.decks.challenge.length})</h3>${renderDeck("challenge")}<input id="addChallenge" placeholder="New challenge"/><button data-add="challenge" class="secondary">Add Challenge</button></div>
      </div>
      <div class="footer-actions">
        <button id="resetDecks" class="danger">Reset Defaults</button>
        <button id="toSettings" class="primary">Next: Settings</button>
      </div>
    </div>`;
  app.querySelectorAll("[data-del]").forEach((b) => b.onclick = () => {
    const [deck, idx] = b.dataset.del.split(":");
    state.decks[deck].splice(Number(idx), 1);
    renderDeckEditor();
  });
  app.querySelectorAll("[data-add]").forEach((b) => b.onclick = () => {
    const deck = b.dataset.add;
    const input = document.getElementById(`add${deck.charAt(0).toUpperCase() + deck.slice(1)}`);
    const val = input.value.trim();
    if (!val) return;
    state.decks[deck].push(val);
    renderDeckEditor();
  });
  document.getElementById("resetDecks").onclick = () => { state.decks = cloneDecks(state.deckDefaults); renderDeckEditor(); };
  document.getElementById("toSettings").onclick = () => { state.screen = "settings"; render(); };
}

function renderSettings() {
  app.innerHTML = `
    <div class="card">
      <h2>Settings</h2>
      <label>Performance Timer Seconds <input id="performanceSeconds" type="number" value="${state.settings.performanceSeconds}" /></label>
      <label>Team Guessing Timer Seconds <input id="teamGuessSeconds" type="number" value="${state.settings.teamGuessSeconds}" /></label>
      <label>FFA Guess Style
        <select id="guessStyleFFA">
          <option value="oneCategory" ${state.settings.guessStyleFFA === "oneCategory" ? "selected" : ""}>One category per turn</option>
          <option value="allThree" ${state.settings.guessStyleFFA === "allThree" ? "selected" : ""}>All three at once</option>
        </select>
      </label>
      <label>Steal Mode (Team Single)
        <select id="stealMode">
          <option value="oneAttemptEachRemaining" ${state.settings.stealMode === "oneAttemptEachRemaining" ? "selected" : ""}>One attempt each remaining</option>
          <option value="timed" ${state.settings.stealMode === "timed" ? "selected" : ""}>Timed steal</option>
        </select>
      </label>
      <label>Trophy rule (Team Single)
        <select id="trophyRule">
          <option value="performingTeamIfAnyGuessed" ${state.settings.trophyTeamSingleRule === "performingTeamIfAnyGuessed" ? "selected" : ""}>Trophy to performing team if all guessed in round</option>
          <option value="onlyPerformingTeamGuessedAll" ${state.settings.trophyTeamSingleRule === "onlyPerformingTeamGuessedAll" ? "selected" : ""}>Only if performing team guessed all 3</option>
        </select>
      </label>
      <label>End Condition
        <select id="endCondition">
          <option value="decksDepleted" ${state.settings.endCondition === "decksDepleted" ? "selected" : ""}>Decks depleted</option>
          <option value="fixedRounds" ${state.settings.endCondition === "fixedRounds" ? "selected" : ""}>Fixed rounds</option>
          <option value="timeLimit" ${state.settings.endCondition === "timeLimit" ? "selected" : ""}>Time limit</option>
        </select>
      </label>
      <label>Fixed rounds <input id="fixedRounds" type="number" value="${state.settings.fixedRounds}" /></label>
      <label>Time limit minutes <input id="timeLimitMinutes" type="number" value="${state.settings.timeLimitMinutes}" /></label>
      <label><input id="teamChallengeEnabled" type="checkbox" ${state.settings.teamChallengeEnabled ? "checked" : ""}/> Team challenge enabled</label>
      <label><input id="soundEnabled" type="checkbox" ${state.settings.soundEnabled ? "checked" : ""}/> Sound effects enabled</label>
      <div class="footer-actions">
        <button class="primary" id="startGameNow">Start Game</button>
      </div>
    </div>`;
  document.getElementById("startGameNow").onclick = () => {
    state.settings.performanceSeconds = Number(document.getElementById("performanceSeconds").value) || 180;
    state.settings.teamGuessSeconds = Number(document.getElementById("teamGuessSeconds").value) || 120;
    state.settings.guessStyleFFA = document.getElementById("guessStyleFFA").value;
    state.settings.stealMode = document.getElementById("stealMode").value;
    state.settings.endCondition = document.getElementById("endCondition").value;
    state.settings.fixedRounds = Number(document.getElementById("fixedRounds").value) || 10;
    state.settings.timeLimitMinutes = Number(document.getElementById("timeLimitMinutes").value) || 30;
    state.settings.teamChallengeEnabled = document.getElementById("teamChallengeEnabled").checked;
    state.settings.soundEnabled = document.getElementById("soundEnabled").checked;
    state.settings.trophyTeamSingleRule = document.getElementById("trophyRule").value;
    startGameFromSetup();
  };
}

function renderRoundStart() {
  if (!state.currentRound) newRound();
  const r = state.currentRound;
  let performerLabel = "";
  if (state.mode === "FFA") performerLabel = `Performer: ${getNameById(r.performerId)}`;
  if (state.mode === "TEAM_SINGLE") performerLabel = `Performing Team: ${state.teams[r.performerTeam].name}`;
  if (state.mode === "TEAM_GROUP") performerLabel = `Group Performance by ${state.teams[r.performerTeam].name}`;

  let chooser = "";
  if (state.mode === "TEAM_SINGLE") {
    const roster = state.teams[r.performerTeam].players;
    chooser = `<label>Select performer from ${state.teams[r.performerTeam].name}
      <select id="teamPerformerSel">${roster.map((p) => `<option value="${p.id}">${p.name}</option>`).join("")}</select></label>`;
  }

  let challengeInfo = "<p class='small'>No challenge this round.</p>";
  if (state.mode === "FFA" && r.challengeEligible?.length) {
    challengeInfo = `<div class='panel'><span class='badge challenge'>Challenge Available</span>
      <p>Eligible: ${r.challengeEligible.map((p) => p.name).join(", ")}</p>
      <button id='dealChallenge' class='secondary'>Draw 3 Challenge Cards</button>
      <div id='challengeChoice'></div></div>`;
  }
  if (state.mode !== "FFA" && r.challengeEligibleTeam) {
    challengeInfo = `<div class='panel'><span class='badge challenge'>Challenge Available</span>
      <p>${state.teams[r.challengeEligibleTeam].name} may issue challenge this round.</p>
      <button id='dealChallenge' class='secondary'>Draw 3 Challenge Cards</button>
      <div id='challengeChoice'></div></div>`;
  }

  app.innerHTML = `
    <div class="card">
      <h2>Round ${state.roundNumber}</h2>
      <p class="big-text">${performerLabel}</p>
      ${chooser}
      ${challengeInfo}
      ${r.challengeCard ? `<p><span class='badge challenge'>Challenge Active</span> Private to performer until reveal.</p>` : ""}
      <div class="footer-actions">
        <button class="primary" id="privateView">Open Performer Private View</button>
        <button class="secondary" id="saveBtn">Save Game</button>
      </div>
    </div>`;

  if (state.mode === "TEAM_SINGLE") {
    document.getElementById("teamPerformerSel").onchange = (e) => { r.performerId = e.target.value; };
    if (!r.performerId) r.performerId = state.teams[r.performerTeam].players[0]?.id;
  }

  const deal = document.getElementById("dealChallenge");
  if (deal) {
    deal.onclick = () => {
      const three = [drawFromDeck(state, "challenge"), drawFromDeck(state, "challenge"), drawFromDeck(state, "challenge")].filter(Boolean);
      const box = document.getElementById("challengeChoice");
      box.innerHTML = three.map((c, i) => `<button class='primary' data-idx='${i}'>${c}</button>`).join("");
      box.querySelectorAll("button").forEach((b) => b.onclick = () => {
        const idx = Number(b.dataset.idx);
        const chosen = three[idx];
        if (state.mode === "FFA") setChallengeFromChoice(chosen, r.challengeEligible[0].id);
        else setChallengeFromChoice(chosen, r.challengeEligibleTeam);
        three.forEach((c, i) => { if (i !== idx) state.decks.challenge.push(c); });
        state.decks.challenge = shuffle(state.decks.challenge);
        renderRoundStart();
      });
    };
  }
  document.getElementById("privateView").onclick = () => { state.screen = "private"; render(); };
  document.getElementById("saveBtn").onclick = saveGame;
}

function renderPrivateView() {
  const r = state.currentRound;
  app.innerHTML = `
    <div class="card">
      <h2>Performer Private View</h2>
      <p class="big-text">Everyone look away 👀</p>
      <div class="reveal-box" id="holdReveal">
        <p>Hold this area to reveal cards.</p>
        <div id="privateCards"></div>
      </div>
      <button class="secondary" id="hideCards">Hide Cards</button>
      <div class="footer-actions">
        <button class="primary" id="toPerformance">Start Performance Phase</button>
      </div>
    </div>`;
  const privateCards = document.getElementById("privateCards");
  const content = `<p><strong>Scene:</strong> ${r.stageCards.scene}</p>
    <p><strong>Character:</strong> ${r.stageCards.character}</p>
    <p><strong>Emotion:</strong> ${r.stageCards.emotion}</p>
    ${r.challengeCard ? `<p><strong>Challenge:</strong> ${r.challengeCard}</p>` : ""}`;
  const hold = document.getElementById("holdReveal");
  hold.onmousedown = hold.ontouchstart = () => privateCards.innerHTML = content;
  hold.onmouseup = hold.onmouseleave = hold.ontouchend = () => privateCards.innerHTML = "";
  document.getElementById("hideCards").onclick = () => privateCards.innerHTML = "";
  document.getElementById("toPerformance").onclick = moveToPerformance;
}

function renderPerformance() {
  app.innerHTML = `
    <div class="card">
      <h2>Performance Timer</h2>
      ${state.currentRound.challengeCard ? `<span class='badge challenge'>Challenge Active</span>` : ""}
      <div id="timerValue" class="timer">--:--</div>
      <div class="footer-actions">
        <button class="primary" id="startTimerBtn">Start</button>
        <button class="secondary" id="pauseTimerBtn">Pause</button>
        <button class="secondary" id="resetTimerBtn">Reset</button>
        <button class="success" id="donePerformance">Done → Guessing</button>
      </div>
    </div>`;
  let paused = true;
  let remain = state.settings.performanceSeconds;
  const onDone = () => {
    alert("Performance time ended. Move to guessing.");
  };
  const drawRemain = () => {
    const el = document.getElementById("timerValue");
    const mm = String(Math.floor(remain / 60)).padStart(2, "0");
    const ss = String(remain % 60).padStart(2, "0");
    el.textContent = `${mm}:${ss}`;
  };
  drawRemain();
  document.getElementById("startTimerBtn").onclick = () => {
    if (!paused) return;
    paused = false;
    clearInterval(state.timer);
    state.timer = setInterval(() => {
      remain -= 1;
      drawRemain();
      if (remain <= 0) {
        clearInterval(state.timer);
        paused = true;
        makeBeep();
        onDone();
      }
    }, 1000);
  };
  document.getElementById("pauseTimerBtn").onclick = () => { paused = true; clearInterval(state.timer); };
  document.getElementById("resetTimerBtn").onclick = () => { paused = true; clearInterval(state.timer); remain = state.settings.performanceSeconds; drawRemain(); };
  document.getElementById("donePerformance").onclick = moveToGuessing;
}

function renderGuessing() {
  const r = state.currentRound;
  const remaining = ["scene", "character", "emotion"].filter((k) => !r.guessed[k]);
  const options = remaining.map((k) => `<option value="${k}">${k}</option>`).join("");

  let guesserLabel = "";
  if (state.mode === "FFA") guesserLabel = `Current Guesser: ${state.players[r.guessTurnIndex].name}`;
  else guesserLabel = `Guessing Team: ${state.teams[r.performerTeam].name}${r.steal ? " (Steal by Opponent)" : ""}`;

  app.innerHTML = `
    <div class="card">
      <h2>Guessing Phase</h2>
      <p class="big-text">${guesserLabel}</p>
      <p>Use Reveal & Confirm so spelling doesn't block the game.</p>
      <form id="guessForm">
        ${state.mode === "FFA" && state.settings.guessStyleFFA === "allThree" ? `
          <input name="guess" placeholder="Guess Scene" />
          <input name="guess2" placeholder="Guess Character" />
          <input name="guess3" placeholder="Guess Emotion" />
          <input type="hidden" name="category" value="all" />
        ` : `
          <label>Category</label>
          <select name="category">${options}</select>
          <input name="guess" placeholder="Type guess..." />
        `}
        <button class="primary" type="submit">Reveal & Confirm</button>
      </form>
      <div class="footer-actions">
        ${state.mode !== "FFA" ? `<button id="teamTimer" class="secondary">Start Team Guess Timer</button>` : ""}
        ${state.mode === "TEAM_SINGLE" ? `<button id="startSteal" class="secondary">Start Steal</button>` : ""}
        <button id="endRoundEarly" class="danger">End Round</button>
      </div>
    </div>`;

  document.getElementById("guessForm").onsubmit = (e) => {
    e.preventDefault();
    handleGuessSubmit(new FormData(e.target));
  };

  const teamTimer = document.getElementById("teamTimer");
  if (teamTimer) teamTimer.onclick = () => {
    startTimer(state.settings.teamGuessSeconds, () => alert("Guessing time ended."));
  };

  const stealBtn = document.getElementById("startSteal");
  if (stealBtn) stealBtn.onclick = () => {
    r.steal = true;
    if (state.settings.stealMode === "oneAttemptEachRemaining") {
      r.stealAttemptsLeft = ["scene", "character", "emotion"].filter((k) => !r.guessed[k]).length;
      alert(`Steal mode: ${r.stealAttemptsLeft} attempts.`);
    } else {
      startTimer(state.settings.stealSeconds, () => alert("Steal time ended."));
    }
    renderGuessing();
  };

  document.getElementById("endRoundEarly").onclick = () => {
    if (r.challengeCard && r.guessed.scene && r.guessed.character && r.guessed.emotion && !r.guessed.challenge) {
      state.screen = "challengeGuess";
    } else {
      awardTrophyIfNeeded();
      state.screen = "summary";
    }
    render();
  };
}

function renderConfirmGuess() {
  const r = state.currentRound;
  const c = r.pendingGuess.category;
  const actual = c === "challenge" ? r.challengeCard : r.stageCards[c];
  app.innerHTML = `
    <div class="card">
      <h2>Reveal & Confirm</h2>
      <p><strong>Guessed:</strong> ${r.pendingGuess.guess || "(blank)"}</p>
      <p><strong>Actual ${c} card:</strong> ${actual}</p>
      <p>Group decides honesty.</p>
      <div class="footer-actions">
        <button class="success" id="correctBtn">Accept as correct</button>
        <button class="danger" id="wrongBtn">Not correct</button>
      </div>
    </div>`;
  document.getElementById("correctBtn").onclick = () => resolveGuess(true);
  document.getElementById("wrongBtn").onclick = () => resolveGuess(false);
}

function renderChallengeGuess() {
  app.innerHTML = `
    <div class="card">
      <h2>Challenge Guess</h2>
      <span class='badge challenge'>Challenge Active</span>
      <form id="challengeForm">
        <input name="guess" placeholder="Guess challenge requirement" />
        <button class="primary" type="submit">Reveal & Confirm Challenge</button>
      </form>
      <button class="danger" id="nobodyGotIt">Nobody guessed challenge</button>
    </div>`;

  document.getElementById("challengeForm").onsubmit = (e) => {
    e.preventDefault();
    const guess = new FormData(e.target).get("guess");
    state.currentRound.pendingGuess = { category: "challenge", guess };
    state.screen = "confirmChallenge";
    render();
  };
  document.getElementById("nobodyGotIt").onclick = () => resolveChallenge(false);
}

function renderConfirmChallenge() {
  const r = state.currentRound;
  app.innerHTML = `
    <div class="card">
      <h2>Reveal Challenge</h2>
      <p><strong>Guessed:</strong> ${r.pendingGuess.guess}</p>
      <p><strong>Actual challenge:</strong> ${r.challengeCard}</p>
      <div class="footer-actions">
        <button class="success" id="correctChallenge">Accept as correct</button>
        <button class="danger" id="wrongChallenge">Not correct</button>
      </div>
    </div>`;
  document.getElementById("correctChallenge").onclick = () => resolveChallenge(true);
  document.getElementById("wrongChallenge").onclick = () => resolveChallenge(false);
}

function renderSummary() {
  const r = state.currentRound;
  app.innerHTML = `
    <div class="card">
      <h2>Round Summary</h2>
      <ul>${r.summary.map((x) => `<li>${x}</li>`).join("") || "<li>No cards awarded.</li>"}</ul>
      <div class="footer-actions">
        <button class="primary" id="nextRoundBtn">Next Round</button>
      </div>
    </div>`;
  document.getElementById("nextRoundBtn").onclick = () => {
    state.currentRound = null;
    newRound();
  };
}

function renderEnd() {
  const winner = computeWinner(state);
  app.innerHTML = `
    <div class="card">
      <h2>Game Over</h2>
      <div class="confetti">🎉 🎊 🎉 🎊 🎉</div>
      <p class="big-text">Winner: ${winner}</p>
      <p>If tied, run a Final Bonus Round manually from Round Start with one extra set.</p>
      <button class="primary" id="backHome">Back to Home</button>
    </div>`;
  document.getElementById("backHome").onclick = () => {
    state.screen = "home";
    state.currentRound = null;
    render();
  };
}

function renderScoreboard() {
  if (state.mode === "FFA") {
    scoreboardContent.innerHTML = `
      <div class='panel'>
        ${state.players.map((p) => `<div class='list-item'><strong>${p.name}</strong><span>${p.score} pts (S:${p.cardsWon.scene}, C:${p.cardsWon.character}, E:${p.cardsWon.emotion}, Ch:${p.cardsWon.challenge}, T:${p.cardsWon.trophy})</span></div>`).join("")}
      </div>`;
  } else if (state.teams) {
    scoreboardContent.innerHTML = `
      <div class='panel'>
        <div class='list-item'><strong>${state.teams.A.name}</strong><span>${state.teams.A.score} pts</span></div>
        <div class='list-item'><strong>${state.teams.B.name}</strong><span>${state.teams.B.score} pts</span></div>
      </div>`;
  } else {
    scoreboardContent.innerHTML = "<p>No game started yet.</p>";
  }
}

function render() {
  clearInterval(state.timer);
  if (state.screen === "home") renderHome();
  else if (state.screen === "mode") renderMode();
  else if (state.screen === "setup") renderSetup();
  else if (state.screen === "deck") renderDeckEditor();
  else if (state.screen === "settings") renderSettings();
  else if (state.screen === "roundStart") renderRoundStart();
  else if (state.screen === "private") renderPrivateView();
  else if (state.screen === "performance") renderPerformance();
  else if (state.screen === "guessing") renderGuessing();
  else if (state.screen === "confirmGuess") renderConfirmGuess();
  else if (state.screen === "challengeGuess") renderChallengeGuess();
  else if (state.screen === "confirmChallenge") renderConfirmChallenge();
  else if (state.screen === "summary") renderSummary();
  else if (state.screen === "end") renderEnd();

  renderScoreboard();
}

document.getElementById("scoreboardBtn").onclick = () => scoreboardModal.classList.remove("hidden");
document.getElementById("closeScoreboard").onclick = () => scoreboardModal.classList.add("hidden");
document.getElementById("closeRules").onclick = () => rulesModal.classList.add("hidden");

render();
