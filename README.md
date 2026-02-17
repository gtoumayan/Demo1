# Roleplay Rumble

Roleplay Rumble is a **local pass-the-device party game** with private reveal cards, timers, round rotation, scoreboard tracking, challenge cards, and three play modes.

## Run Locally

No build tools needed.

```bash
cd /workspace/Demo1
python3 -m http.server 4173
```

Then open: `http://localhost:4173`

## Game Modes

- **Individual Performer (FFA)**
- **2 Teams – 1 Performer**
- **2 Teams – Group Performance**

## Included Features

- Setup flow: Home → Mode → Player/Team setup → Deck editor → Settings
- Deck editor (add/remove cards, reset defaults)
- Default decks:
  - 40 Scene cards
  - 40 Character cards
  - 40 Emotion cards
  - 30 Challenge cards
  - Trophy label: **Stand Up Anovation**
- Pass-device private reveal screen with hold-to-reveal + hide button
- Performance timer with Start / Pause / Reset
- Team guessing timer and configurable steal mode
- Reveal & Confirm guess validation (instead of exact text matching)
- FFA challenge eligibility logic (10+ points behind leader)
- Team challenge toggle and trailing-team challenge eligibility
- Scoreboard modal available from any screen
- Save/Load current game in `localStorage`
- End conditions:
  - Decks depleted (default)
  - Fixed rounds
  - Time limit

## Settings Toggles Implemented

- Guessing time (team modes)
- FFA guess style:
  - One category per turn (default)
  - All three at once
- Steal mode (Team Single):
  - One attempt per remaining category (default)
  - Timed steal
- Trophy awarding in Team Single when opponent completes set:
  - Trophy to performing team if all guessed in round (default)
  - Trophy only if performing team guessed all 3
- Team challenge enable/disable (default enabled)
- End condition (deck depletion / fixed rounds / time limit)

## Where to Edit Decks

1. **In-app deck editor** screen before starting game.
2. Source defaults in:

- `js/decks.js`

## Rule Assumptions Implemented

Because some rules were ambiguous, these are configurable where possible:

- **Team Single trophy assignment** when steals complete missing categories is a setting.
- **Steal behavior** is a setting (`oneAttemptEachRemaining` or `timed`).
- **Challenge in team modes** is enabled by default but can be turned off.
- **Final bonus round** tie-breaker is prompted as a manual final round flow.

## Project Structure

- `index.html` – app shell + modal containers
- `styles.css` – high-contrast, large-button party-friendly UI
- `js/decks.js` – starter cards and trophy label
- `js/logic.js` – reusable game logic helpers
- `js/app.js` – screen flow + state machine + gameplay interactions

