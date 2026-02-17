// Core game logic helpers. UI calls these functions.
function createId() {
  return Math.random().toString(36).slice(2, 10);
}

function cloneDecks(decks) {
  return {
    scene: [...decks.scene],
    character: [...decks.character],
    emotion: [...decks.emotion],
    challenge: [...decks.challenge],
    trophyLabel: decks.trophyLabel
  };
}

function shuffle(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function scoreForType(type) {
  if (type === "challenge") return 3;
  if (type === "trophy") return 4;
  return 1;
}

function newPlayer(name) {
  return {
    id: createId(),
    name,
    score: 0,
    cardsWon: { scene: 0, character: 0, emotion: 0, challenge: 0, trophy: 0 }
  };
}

function applyCardWin(state, winnerId, type) {
  const player = state.players.find((p) => p.id === winnerId);
  if (!player) return;
  player.cardsWon[type] += 1;
  player.score += scoreForType(type);
}

function applyTeamWin(state, teamKey, type) {
  const team = state.teams[teamKey];
  if (!team) return;
  team.cardsWon[type] += 1;
  team.score += scoreForType(type);
}

function drawFromDeck(state, type) {
  if (!state.decks[type].length) return null;
  return state.decks[type].shift();
}

function canStartRound(state) {
  return state.decks.scene.length > 0 && state.decks.character.length > 0 && state.decks.emotion.length > 0;
}

function lowestEligiblePlayer(state) {
  const high = Math.max(...state.players.map((p) => p.score));
  const eligible = state.players.filter((p) => high - p.score >= 10);
  if (!eligible.length) return [];
  const low = Math.min(...eligible.map((p) => p.score));
  return eligible.filter((p) => p.score === low);
}

function trailingTeamEligible(state) {
  if (!state.teams) return null;
  const diff = Math.abs(state.teams.A.score - state.teams.B.score);
  if (diff < 10) return null;
  return state.teams.A.score < state.teams.B.score ? "A" : "B";
}

function computeWinner(state) {
  if (state.mode === "FFA") {
    const high = Math.max(...state.players.map((p) => p.score));
    return state.players.filter((p) => p.score === high).map((p) => p.name).join(", ");
  }
  const a = state.teams.A.score;
  const b = state.teams.B.score;
  if (a === b) return "Tie";
  return a > b ? state.teams.A.name : state.teams.B.name;
}
