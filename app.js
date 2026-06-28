// --- Theme Management ---
function initTheme() {
  const savedTheme = localStorage.getItem('theme') || 'dark'; // default to dark
  setTheme(savedTheme);
  
  const toggleBtn = document.getElementById('theme-toggle-btn');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      const currentTheme = document.body.getAttribute('data-theme');
      const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
      setTheme(newTheme);
    });
  }
}

function setTheme(theme) {
  document.body.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
  const themeIcon = document.querySelector('#theme-toggle-btn .theme-icon');
  if (themeIcon) {
    themeIcon.textContent = theme === 'dark' ? '☀️' : '🌙';
  }
}

initTheme();

// --- State Management ---
let state = {
  settings: null,
  currentInningsIndex: 0,
  innings: [],
  history: []
};

// --- Local Storage Helpers ---
const STORAGE_KEY = 'cricket_scorer_match_state';

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    settings: state.settings,
    currentInningsIndex: state.currentInningsIndex,
    innings: state.innings,
    history: state.history
  }));
}

function loadState() {
  const data = localStorage.getItem(STORAGE_KEY);
  if (data) {
    try {
      const parsed = JSON.parse(data);
      if (parsed && parsed.settings && parsed.innings) {
        state.settings = parsed.settings;
        state.currentInningsIndex = parsed.currentInningsIndex;
        state.innings = parsed.innings;
        state.history = parsed.history || [];
        return true;
      }
    } catch (e) {
      console.error("Failed to load match state:", e);
    }
  }
  return false;
}

function clearState() {
  localStorage.removeItem(STORAGE_KEY);
  state = {
    settings: null,
    currentInningsIndex: 0,
    innings: [],
    history: []
  };
  
  playerPool = [];
  poolSquadA = [];
  poolSquadB = [];
  poolJoker = null;
  tossWinner = null;
  tossLoser = null;
  
  const poolInput = document.getElementById('pool-player-input');
  if (poolInput) poolInput.value = '';
  
  const poolAdded = document.getElementById('pool-added-players');
  if (poolAdded) poolAdded.innerHTML = '';
  
  renderSavedPlayerSuggestions();
  
  const splitResults = document.getElementById('split-results');
  if (splitResults) {
    splitResults.style.display = 'none';
    splitResults.innerHTML = '';
  }
  
  const tossResults = document.getElementById('toss-results');
  if (tossResults) {
    tossResults.style.display = 'none';
    tossResults.innerHTML = '';
  }
  
  const datalistA = document.getElementById('squad-a-list');
  if (datalistA) datalistA.innerHTML = '';
  const datalistB = document.getElementById('squad-b-list');
  if (datalistB) datalistB.innerHTML = '';
  
  const details = document.getElementById('splitter-details');
  if (details) details.open = false;
}

// --- Snapshot Engine (Undo System) ---
function pushHistory() {
  const snapshot = {
    currentInningsIndex: state.currentInningsIndex,
    innings: JSON.parse(JSON.stringify(state.innings))
  };
  state.history.push(snapshot);
  if (state.history.length > 50) {
    state.history.shift(); // Keep history size small
  }
}

function undo() {
  if (!state.history || state.history.length === 0) {
    alert("Nothing to undo!");
    return;
  }
  const snapshot = state.history.pop();
  state.currentInningsIndex = snapshot.currentInningsIndex;
  state.innings = snapshot.innings;
  saveState();
  render();
}

// --- Utility Helpers ---
function formatOvers(balls) {
  const completedOvers = Math.floor(balls / 6);
  const remainingBalls = balls % 6;
  return `${completedOvers}.${remainingBalls}`;
}

function calculateEconomy(runs, balls) {
  if (balls === 0) return "0.00";
  const overs = balls / 6;
  return (runs / overs).toFixed(2);
}

function calculateStrikeRate(runs, ballsFaced) {
  if (ballsFaced === 0) return "0.00";
  return ((runs / ballsFaced) * 100).toFixed(2);
}

// --- Views Navigation ---
function showView(viewId) {
  document.querySelectorAll('.view-section').forEach(view => {
    view.classList.remove('active');
  });
  const targetView = document.getElementById(viewId);
  if (targetView) {
    targetView.classList.add('active');
  }
}

// --- Quick Team Splitter & Toss Simulator State ---
let playerPool = [];
let poolSquadA = [];
let poolSquadB = [];
let originalSquadA = [];
let originalSquadB = [];
let poolJoker = null;
let tossWinner = null;
let tossLoser = null;

// --- Saved Players Cache (so you don't have to retype names every match) ---
const SAVED_PLAYERS_KEY = 'cricket_scorer_saved_players';

function loadSavedPlayerNames() {
  try {
    const data = localStorage.getItem(SAVED_PLAYERS_KEY);
    const parsed = data ? JSON.parse(data) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error("Failed to load saved players:", e);
    return [];
  }
}

function saveSavedPlayerNames(names) {
  try {
    localStorage.setItem(SAVED_PLAYERS_KEY, JSON.stringify(names));
  } catch (e) {
    console.error("Failed to save players:", e);
  }
}

// Add a name to the saved cache (deduped, case-insensitive)
function cachePlayerName(name) {
  const saved = loadSavedPlayerNames();
  if (!saved.some(n => n.toLowerCase() === name.toLowerCase())) {
    saved.push(name);
    saveSavedPlayerNames(saved);
  }
}

// Permanently remove a name from the saved cache (does not touch the active pool)
function removeSavedPlayerName(name) {
  const saved = loadSavedPlayerNames().filter(n => n.toLowerCase() !== name.toLowerCase());
  saveSavedPlayerNames(saved);
  renderSavedPlayerSuggestions();
}

// Render "tap to add" chips for previously-used players not already in the pool
function renderSavedPlayerSuggestions() {
  const container = document.getElementById('saved-players-suggestions');
  if (!container) return;

  const saved = loadSavedPlayerNames();
  const poolLower = playerPool.map(n => n.toLowerCase());
  const suggestions = saved.filter(n => !poolLower.includes(n.toLowerCase()));

  if (suggestions.length === 0) {
    container.innerHTML = '';
    container.style.display = 'none';
    return;
  }

  container.style.display = 'flex';
  container.innerHTML = `<div style="width:100%; font-size:0.7rem; color:var(--color-text-muted); margin-bottom:2px;">Saved players (tap to add):</div>`;

  suggestions.forEach(name => {
    const chip = document.createElement('span');
    chip.className = 'bowler-select-chip';
    chip.style.padding = '6px 10px';
    chip.style.fontSize = '0.75rem';
    chip.style.display = 'inline-flex';
    chip.style.alignItems = 'center';
    chip.style.gap = '6px';

    chip.innerHTML = `
      <span class="saved-player-add">${name}</span>
      <span style="font-weight:bold; color:var(--color-danger); cursor:pointer; font-size:0.85rem;" title="Remove from saved list">&times;</span>
    `;

    chip.querySelector('.saved-player-add').addEventListener('click', () => {
      addPlayerToPool(name);
    });
    chip.querySelector('span[title]').addEventListener('click', (e) => {
      e.stopPropagation();
      if (confirm(`Remove "${name}" from your saved players list?`)) {
        removeSavedPlayerName(name);
      }
    });

    container.appendChild(chip);
  });
}

// Add player to pool list
// Accepts an optional `presetName` (used by saved-player chips); otherwise reads the input field.
function addPlayerToPool(presetName) {
  const inputEl = document.getElementById('pool-player-input');
  const safePreset = (typeof presetName === 'string') ? presetName : '';
  const name = (safePreset || inputEl.value).trim();
  if (!name) return;
  
  if (playerPool.some(n => n.toLowerCase() === name.toLowerCase())) {
    alert("Player is already added to the pool.");
    return;
  }
  
  playerPool.push(name);
  cachePlayerName(name); // remember this name for next time
  inputEl.value = '';
  renderPlayerPoolChips();
  renderSavedPlayerSuggestions();
  inputEl.focus();
}

function removePlayerFromPool(idx) {
  playerPool.splice(idx, 1);
  renderPlayerPoolChips();
  renderSavedPlayerSuggestions();
}

function renderPlayerPoolChips() {
  const container = document.getElementById('pool-added-players');
  if (!container) return;
  container.innerHTML = '';
  
  playerPool.forEach((name, idx) => {
    const chip = document.createElement('span');
    chip.className = 'dot-mini';
    chip.style.display = 'inline-flex';
    chip.style.alignItems = 'center';
    chip.style.gap = '6px';
    chip.style.padding = '4px 8px';
    chip.style.fontSize = '0.75rem';
    chip.style.borderRadius = '50px';
    chip.style.cursor = 'default';
    
    chip.innerHTML = `
      <span>${name}</span>
      <span style="font-weight:bold; color:var(--color-danger); cursor:pointer; font-size:0.9rem;" onclick="removePlayerFromPool(${idx})">&times;</span>
    `;
    container.appendChild(chip);
  });
}

// Bind Enter key to player pool input
document.getElementById('pool-player-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    addPlayerToPool();
  }
});

// Bind Add button
document.getElementById('btn-add-pool-player').addEventListener('click', () => addPlayerToPool());

// Expose remove handler globally
window.removePlayerFromPool = removePlayerFromPool;

// Show any previously-saved player names as quick-add suggestions on load
renderSavedPlayerSuggestions();

// Split players function
function splitPlayersPool() {
  if (playerPool.length < 2) {
    alert("Please add at least 2 player names to split teams.");
    return;
  }

  // Shuffle player list
  const shuffled = [...playerPool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  // Check for odd/even count (Joker logic)
  if (shuffled.length % 2 !== 0) {
    poolJoker = shuffled.pop(); // last player becomes Joker
  } else {
    poolJoker = null;
  }

  // Split equally
  const half = Math.floor(shuffled.length / 2);
  poolSquadA = shuffled.slice(0, half);
  poolSquadB = shuffled.slice(half);

  // If Joker, add to both lists
  if (poolJoker) {
    poolSquadA.push(poolJoker);
    poolSquadB.push(poolJoker);
  }

  // Backup original squads
  originalSquadA = [...poolSquadA];
  originalSquadB = [...poolSquadB];

  // Render results
  const resultsDiv = document.getElementById('split-results');
  resultsDiv.style.display = 'block';
  resultsDiv.innerHTML = `
    <strong>Team A Squad (${poolSquadA.length - (poolJoker ? 1 : 0)} players):</strong><br>
    ${poolSquadA.filter(n => n !== poolJoker).join(', ') || 'None'}<br><br>
    <strong>Team B Squad (${poolSquadB.length - (poolJoker ? 1 : 0)} players):</strong><br>
    ${poolSquadB.filter(n => n !== poolJoker).join(', ') || 'None'}<br>
    ${poolJoker ? `<br><strong>🃏 Joker Player:</strong> <span style="color:var(--color-accent); font-weight:800;">${poolJoker}</span> (plays for both teams!)` : ''}
  `;

  // Update datalists
  updateSetupDatalists();
}

function updateSetupDatalists() {
  const listA = document.getElementById('squad-a-list');
  const listB = document.getElementById('squad-b-list');
  
  listA.innerHTML = poolSquadA.map(n => `<option value="${n}">${n === poolJoker ? `${n} (Joker)` : n}</option>`).join('');
  listB.innerHTML = poolSquadB.map(n => `<option value="${n}">${n === poolJoker ? `${n} (Joker)` : n}</option>`).join('');
  
  const strikerInput = document.getElementById('setup-striker');
  const strikerSelect = document.getElementById('setup-striker-select');
  const nonStrikerInput = document.getElementById('setup-non-striker');
  const nonStrikerSelect = document.getElementById('setup-non-striker-select');
  const bowlerInput = document.getElementById('setup-bowler');
  const bowlerSelect = document.getElementById('setup-bowler-select');

  if (poolSquadA.length > 0 && poolSquadB.length > 0) {
    // Show select dropdowns, hide text inputs
    strikerInput.style.display = 'none';
    strikerInput.removeAttribute('required');
    strikerSelect.style.display = 'block';
    strikerSelect.setAttribute('required', 'true');
    
    nonStrikerInput.style.display = 'none';
    nonStrikerInput.removeAttribute('required');
    nonStrikerSelect.style.display = 'block';
    nonStrikerSelect.setAttribute('required', 'true');
    
    bowlerInput.style.display = 'none';
    bowlerInput.removeAttribute('required');
    bowlerSelect.style.display = 'block';
    bowlerSelect.setAttribute('required', 'true');

    // Populate dropdown options
    const makeOptions = (squad) => squad.map(n => `<option value="${n}">${n === poolJoker ? `${n} (Joker)` : n}</option>`).join('');
    strikerSelect.innerHTML = makeOptions(poolSquadA);
    nonStrikerSelect.innerHTML = makeOptions(poolSquadA);
    bowlerSelect.innerHTML = makeOptions(poolSquadB);

    // Pre-fill values
    if (poolSquadA.length >= 2) {
      strikerSelect.value = poolSquadA[0];
      nonStrikerSelect.value = poolSquadA[1];
    } else if (poolSquadA.length === 1) {
      strikerSelect.value = poolSquadA[0];
      nonStrikerSelect.value = poolSquadA[0];
    }
    if (poolSquadB.length >= 1) {
      bowlerSelect.value = poolSquadB[0];
    }
  } else {
    // Restore text inputs, hide select dropdowns
    strikerInput.style.display = 'block';
    strikerInput.setAttribute('required', 'true');
    strikerSelect.style.display = 'none';
    strikerSelect.removeAttribute('required');
    strikerSelect.innerHTML = '';
    
    nonStrikerInput.style.display = 'block';
    nonStrikerInput.setAttribute('required', 'true');
    nonStrikerSelect.style.display = 'none';
    nonStrikerSelect.removeAttribute('required');
    nonStrikerSelect.innerHTML = '';
    
    bowlerInput.style.display = 'block';
    bowlerInput.setAttribute('required', 'true');
    bowlerSelect.style.display = 'none';
    bowlerSelect.removeAttribute('required');
    bowlerSelect.innerHTML = '';
  }
}

// Toss Coin function
function tossCoin() {
  const nameA = "Team A";
  const nameB = "Team B";
  
  const isTeamAWinner = Math.random() < 0.5;
  tossWinner = isTeamAWinner ? nameA : nameB;
  tossLoser = isTeamAWinner ? nameB : nameA;

  const resultsDiv = document.getElementById('toss-results');
  resultsDiv.style.display = 'block';
  resultsDiv.innerHTML = `
    <strong>🪙 Coin Toss Result:</strong><br>
    <span style="font-size:1.1rem; color:var(--color-accent); font-weight:800;">${tossWinner} Won the Toss!</span><br><br>
    <div class="form-row" style="margin-top: 4px;">
      <button type="button" class="btn btn-secondary btn-toss-choice" onclick="selectTossChoice('bat')" style="padding:8px; font-size:0.8rem; height:auto; width:auto; flex:1;">Elect to Bat</button>
      <button type="button" class="btn btn-secondary btn-toss-choice" onclick="selectTossChoice('bowl')" style="padding:8px; font-size:0.8rem; height:auto; width:auto; flex:1;">Elect to Bowl</button>
    </div>
  `;
}

// Choice callback
window.selectTossChoice = function(choice) {
  const isWinnerBatting = choice === 'bat';
  
  const teamAVal = isWinnerBatting ? tossWinner : tossLoser;
  const teamBVal = isWinnerBatting ? tossLoser : tossWinner;
  
  document.getElementById('setup-team-a').value = teamAVal;
  document.getElementById('setup-team-b').value = teamBVal;
  
  // Link original squads based on who is batting first
  if (originalSquadA.length > 0) {
    if (teamAVal === "Team A") {
      poolSquadA = [...originalSquadA];
      poolSquadB = [...originalSquadB];
    } else {
      poolSquadA = [...originalSquadB];
      poolSquadB = [...originalSquadA];
    }
    updateSetupDatalists();
  }

  const resultsDiv = document.getElementById('toss-results');
  resultsDiv.innerHTML = `
    <strong>🪙 Coin Toss:</strong> <span style="font-weight:700;">${tossWinner}</span> won and elected to <strong>${choice.toUpperCase()}</strong> first!
  `;
};

// Bind elements
document.getElementById('btn-split-players').addEventListener('click', splitPlayersPool);
document.getElementById('btn-toss-coin').addEventListener('click', tossCoin);
document.getElementById('btn-swap-setup-teams').addEventListener('click', () => {
  const teamAInput = document.getElementById('setup-team-a');
  const teamBInput = document.getElementById('setup-team-b');
  
  const tempName = teamAInput.value;
  teamAInput.value = teamBInput.value;
  teamBInput.value = tempName;
  
  if (poolSquadA.length > 0 || poolSquadB.length > 0) {
    const tempSquad = [...poolSquadA];
    poolSquadA = [...poolSquadB];
    poolSquadB = tempSquad;
    updateSetupDatalists();
  }
});

// --- Setup Form Submission ---
document.getElementById('match-setup-form').addEventListener('submit', (e) => {
  e.preventDefault();
  
  const teamA = document.getElementById('setup-team-a').value.trim();
  const teamB = document.getElementById('setup-team-b').value.trim();
  const overs = parseInt(document.getElementById('setup-overs').value);

  const isDropdownActive = (poolSquadA.length > 0 && poolSquadB.length > 0);
  const striker = isDropdownActive
    ? document.getElementById('setup-striker-select').value.trim()
    : document.getElementById('setup-striker').value.trim();
  const nonStriker = isDropdownActive
    ? document.getElementById('setup-non-striker-select').value.trim()
    : document.getElementById('setup-non-striker').value.trim();
  const bowler = isDropdownActive
    ? document.getElementById('setup-bowler-select').value.trim()
    : document.getElementById('setup-bowler').value.trim();

  if (!teamA || !teamB || !overs || !striker || !nonStriker || !bowler) {
    return alert("Please fill in all match setup fields.");
  }

  if (striker.toLowerCase() === nonStriker.toLowerCase()) {
    return alert("Striker and Non-Striker batsman must be different players!");
  }

  if (bowler.toLowerCase() === striker.toLowerCase() || bowler.toLowerCase() === nonStriker.toLowerCase()) {
    return alert("The Opening Bowler cannot be the same player as the Striker or Non-Striker batsman!");
  }

  // Initialize Match State
  state.settings = {
    teamA,
    teamB,
    maxOvers: overs,
    squadA: poolSquadA.length > 0 ? [...poolSquadA] : null,
    squadB: poolSquadB.length > 0 ? [...poolSquadB] : null,
    joker: poolJoker
  };
  state.currentInningsIndex = 0;
  state.history = [];

  state.innings = [
    {
      battingTeam: teamA,
      bowlingTeam: teamB,
      runs: 0,
      wickets: 0,
      balls: 0,
      extras: { wide: 0, noball: 0, bye: 0, legbye: 0 },
      batters: [
        { name: striker, runs: 0, ballsFaced: 0, fours: 0, sixes: 0, status: 'batting_striker', ballsHistory: [], howOut: '' },
        { name: nonStriker, runs: 0, ballsFaced: 0, fours: 0, sixes: 0, status: 'batting_non_striker', ballsHistory: [], howOut: '' }
      ],
      bowlers: [
        { name: bowler, overs: [], runsConcededTotal: 0, wicketsTotal: 0, ballsBowledTotal: 0 }
      ],
      deliveries: [],
      strikerIndex: 0,
      nonStrikerIndex: 1,
      currentBowlerIndex: 0
    },
    {
      battingTeam: teamB,
      bowlingTeam: teamA,
      runs: 0,
      wickets: 0,
      balls: 0,
      extras: { wide: 0, noball: 0, bye: 0, legbye: 0 },
      batters: [],
      bowlers: [],
      deliveries: [],
      strikerIndex: -1,
      nonStrikerIndex: -1,
      currentBowlerIndex: -1
    }
  ];

  saveState();
  render();
  showView('dashboard-view');
});

// --- Active Over Finder ---
function getOrCreateActiveOver(inn) {
  const bowler = inn.bowlers[inn.currentBowlerIndex];
  const currentOverNum = Math.floor(inn.balls / 6) + 1;
  let overObj = bowler.overs.find(o => o.overNumber === currentOverNum);
  
  if (!overObj) {
    overObj = {
      overNumber: currentOverNum,
      balls: [],
      runsConceded: 0,
      wickets: 0
    };
    bowler.overs.push(overObj);
  }
  return overObj;
}

// --- Striker Swapper ---
function swapStriker(inn) {
  if (inn.nonStrikerIndex === -1) return; // Single batsman batting alone
  const temp = inn.strikerIndex;
  inn.strikerIndex = inn.nonStrikerIndex;
  inn.nonStrikerIndex = temp;

  // Update statuses
  inn.batters.forEach((b, idx) => {
    if (b.status === 'batting_striker' || b.status === 'batting_non_striker') {
      b.status = (idx === inn.strikerIndex) ? 'batting_striker' : 'batting_non_striker';
    }
  });
}

// --- Wicket Modal Setup ---
const wicketDialog = document.getElementById('wicket-dialog');
const wicketForm = document.getElementById('wicket-form');
const runoutCrossGroup = document.getElementById('runout-cross-group');
const newBatsmanNameInput = document.getElementById('new-batsman-name');
const newBatsmanSelect = document.getElementById('new-batsman-select');
const wicketLastManCheckbox = document.getElementById('wicket-last-man');
const newBatsmanGroup = document.getElementById('new-batsman-group');
let wicketStrikerOut = true; // Striker is selected by default

// Last Man Standing checkbox change handler
wicketLastManCheckbox.addEventListener('change', () => {
  const isChecked = wicketLastManCheckbox.checked;
  const inn = state.innings[state.currentInningsIndex];
  const squad = inn.battingTeam === state.settings.teamA ? state.settings.squadA : state.settings.squadB;

  if (isChecked) {
    newBatsmanGroup.style.display = 'none';
    newBatsmanNameInput.removeAttribute('required');
    newBatsmanSelect.removeAttribute('required');
  } else {
    newBatsmanGroup.style.display = 'block';
    if (squad) {
      newBatsmanSelect.setAttribute('required', 'true');
    } else {
      newBatsmanNameInput.setAttribute('required', 'true');
    }
  }
});

// Set up event listeners for Wicket Modal players toggle
document.getElementById('wicket-striker-btn').addEventListener('click', () => {
  wicketStrikerOut = true;
  document.getElementById('wicket-striker-btn').classList.add('active');
  document.getElementById('wicket-nonstriker-btn').classList.remove('active');
});

document.getElementById('wicket-nonstriker-btn').addEventListener('click', () => {
  wicketStrikerOut = false;
  document.getElementById('wicket-nonstriker-btn').classList.add('active');
  document.getElementById('wicket-striker-btn').classList.remove('active');
});

// Show/Hide runout cross options based on selected wicket type
wicketForm.addEventListener('change', (e) => {
  if (e.target.name === 'wicket-type') {
    if (e.target.value === 'Run Out') {
      runoutCrossGroup.style.display = 'block';
    } else {
      runoutCrossGroup.style.display = 'none';
    }
  }
});

// Runout Cross toggle controls
let runoutCrossed = true;
document.getElementById('runout-cross-yes-btn').addEventListener('click', () => {
  runoutCrossed = true;
  document.getElementById('runout-cross-yes-btn').classList.add('active');
  document.getElementById('runout-cross-no-btn').classList.remove('active');
});
document.getElementById('runout-cross-no-btn').addEventListener('click', () => {
  runoutCrossed = false;
  document.getElementById('runout-cross-no-btn').classList.add('active');
  document.getElementById('runout-cross-yes-btn').classList.remove('active');
});

// Backdrop click fallback listener for wicket dialog dismiss
if (!('closedBy' in HTMLDialogElement.prototype)) {
  wicketDialog.addEventListener('click', (event) => {
    if (event.target !== wicketDialog) return;
    const rect = wicketDialog.getBoundingClientRect();
    const isDialogContent = (
      rect.top <= event.clientY &&
      event.clientY <= rect.top + rect.height &&
      rect.left <= event.clientX &&
      event.clientX <= rect.left + rect.width
    );
    if (!isDialogContent) {
      wicketDialog.close();
    }
  });
}

document.getElementById('wicket-cancel-btn').addEventListener('click', () => {
  wicketDialog.close();
});

// Submit Wicket Event
wicketForm.addEventListener('submit', (e) => {
  e.preventDefault();
  
  const dismissalType = wicketForm.querySelector('input[name="wicket-type"]:checked').value;
  const isLastMan = wicketLastManCheckbox.checked;
  const inn = state.innings[state.currentInningsIndex];
  const squad = inn.battingTeam === state.settings.teamA ? state.settings.squadA : state.settings.squadB;

  let newBatsmanName = null;
  if (!isLastMan) {
    newBatsmanName = squad ? newBatsmanSelect.value.trim() : newBatsmanNameInput.value.trim();
    if (!newBatsmanName) {
      return alert("Please enter the new batsman's name.");
    }
    
    // Joker cannot bat if they are currently bowling!
    const activeBowler = inn.bowlers[inn.currentBowlerIndex];
    if (activeBowler && newBatsmanName.toLowerCase() === activeBowler.name.toLowerCase()) {
      return alert("The current bowler cannot be selected as the new batsman!");
    }
  }

  wicketDialog.close();
  executeWicket({
    whoOut: wicketStrikerOut ? 'striker' : 'non-striker',
    dismissalType,
    newBatsmanName,
    crossed: dismissalType === 'Run Out' ? runoutCrossed : false
  });
});

document.getElementById('wicket-btn').addEventListener('click', () => {
  const inn = state.innings[state.currentInningsIndex];
  
  const strikerBtn = document.getElementById('wicket-striker-btn');
  const nonStrikerBtn = document.getElementById('wicket-nonstriker-btn');
  
  strikerBtn.textContent = `Striker: ${inn.batters[inn.strikerIndex].name}`;
  if (inn.nonStrikerIndex === -1) {
    nonStrikerBtn.style.display = 'none';
  } else {
    nonStrikerBtn.style.display = 'inline-block';
    nonStrikerBtn.textContent = `Non-Striker: ${inn.batters[inn.nonStrikerIndex].name}`;
  }
  
  // Reset form inputs
  newBatsmanNameInput.value = '';
  wicketLastManCheckbox.checked = false;
  wicketLastManCheckbox.disabled = false;
  newBatsmanGroup.style.display = 'block';
  
  wicketStrikerOut = true;
  strikerBtn.classList.add('active');
  nonStrikerBtn.classList.remove('active');
  wicketForm.querySelector('input[value="Bowled"]').checked = true;
  runoutCrossGroup.style.display = 'none';

  // Dynamic Datalist or Select for Remaining Batters
  const squad = inn.battingTeam === state.settings.teamA ? state.settings.squadA : state.settings.squadB;
  
  if (squad) {
    newBatsmanNameInput.style.display = 'none';
    newBatsmanNameInput.removeAttribute('required');
    newBatsmanSelect.style.display = 'block';
    newBatsmanSelect.setAttribute('required', 'true');
    newBatsmanSelect.disabled = false;

    const dismissedBatterNames = inn.batters.filter(b => b.status === 'out').map(b => b.name.toLowerCase());
    const currentBatters = [
      inn.batters[inn.strikerIndex]?.name.toLowerCase()
    ];
    if (inn.nonStrikerIndex !== -1) {
      currentBatters.push(inn.batters[inn.nonStrikerIndex].name.toLowerCase());
    }
    
    // Joker cannot bat if they are currently bowling!
    const activeBowler = inn.bowlers[inn.currentBowlerIndex];
    if (activeBowler) {
      currentBatters.push(activeBowler.name.toLowerCase());
    }
    
    const eligible = squad.filter(name => {
      const lowerName = name.toLowerCase();
      return !currentBatters.includes(lowerName) && !dismissedBatterNames.includes(lowerName);
    });
    
    newBatsmanSelect.innerHTML = eligible.map(n => `<option value="${n}">${state.settings.joker === n ? `${n} (Joker)` : n}</option>`).join('');
    
    if (eligible.length === 0) {
      newBatsmanSelect.disabled = true;
      wicketLastManCheckbox.checked = true;
      wicketLastManCheckbox.disabled = true; // force single batsman mode
      newBatsmanGroup.style.display = 'none';
      newBatsmanSelect.removeAttribute('required');
    }
  } else {
    newBatsmanSelect.style.display = 'none';
    newBatsmanSelect.removeAttribute('required');
    newBatsmanNameInput.style.display = 'block';
    newBatsmanNameInput.setAttribute('required', 'true');
    newBatsmanNameInput.disabled = false;
  }

  if (inn.nonStrikerIndex === -1) {
    wicketLastManCheckbox.checked = true;
    wicketLastManCheckbox.disabled = true;
    newBatsmanGroup.style.display = 'none';
    newBatsmanNameInput.removeAttribute('required');
    newBatsmanSelect.removeAttribute('required');
  }

  wicketDialog.showModal();
});

// --- Bowler Dialog Modal Setup ---
const bowlerDialog = document.getElementById('bowler-dialog');
const bowlerForm = document.getElementById('bowler-form');
const newBowlerNameInput = document.getElementById('new-bowler-name');

function showBowlerDialog() {
  const inn = state.innings[state.currentInningsIndex];
  const activeBowler = inn.bowlers[inn.currentBowlerIndex];
  
  const strikerName = inn.batters[inn.strikerIndex]?.name.toLowerCase();
  const nonStrikerName = inn.nonStrikerIndex !== -1 ? inn.batters[inn.nonStrikerIndex]?.name.toLowerCase() : '';
  const activeBowlerName = activeBowler ? activeBowler.name.toLowerCase() : '';

  const listEl = document.getElementById('existing-bowlers-list');
  const groupEl = document.getElementById('existing-bowlers-group');
  
  listEl.innerHTML = '';
  
  // Filter out the bowler who just finished their over AND any players who are currently batting!
  const otherBowlers = inn.bowlers.filter(b => {
    const lowerName = b.name.toLowerCase();
    return lowerName !== activeBowlerName && lowerName !== strikerName && lowerName !== nonStrikerName;
  });
  
  if (otherBowlers.length > 0) {
    groupEl.style.display = 'block';
    otherBowlers.forEach(b => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'bowler-select-chip';
      chip.textContent = b.name;
      chip.addEventListener('click', () => {
        newBowlerNameInput.value = b.name;
        bowlerDialog.close();
        executeNextOver(b.name);
      });
      listEl.appendChild(chip);
    });
  } else {
    groupEl.style.display = 'none';
  }

  // Populate remaining squad bowler chips
  const squad = inn.bowlingTeam === state.settings.teamA ? state.settings.squadA : state.settings.squadB;
  const squadGroupEl = document.getElementById('squad-bowlers-group');
  const squadListEl = document.getElementById('squad-bowlers-list');
  squadListEl.innerHTML = '';
  
  if (squad) {
    const alreadyBowled = inn.bowlers.map(b => b.name.toLowerCase());
    
    const unbowledSquad = squad.filter(name => {
      const lowerName = name.toLowerCase();
      return lowerName !== activeBowlerName && lowerName !== strikerName && lowerName !== nonStrikerName && !alreadyBowled.includes(lowerName);
    });

    if (unbowledSquad.length > 0) {
      squadGroupEl.style.display = 'block';
      unbowledSquad.forEach(name => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'bowler-select-chip';
        chip.textContent = state.settings.joker === name ? `${name} (Joker)` : name;
        chip.addEventListener('click', () => {
          newBowlerNameInput.value = name;
          bowlerDialog.close();
          executeNextOver(name);
        });
        squadListEl.appendChild(chip);
      });
    } else {
      squadGroupEl.style.display = 'none';
    }
  } else {
    squadGroupEl.style.display = 'none';
  }
  
  newBowlerNameInput.value = '';
  bowlerDialog.showModal();
}

document.getElementById('bowler-undo-btn').addEventListener('click', () => {
  bowlerDialog.close();
  undo();
});

let isChangingBowlerMidOver = false;

bowlerForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const nextBowler = newBowlerNameInput.value.trim();
  
  if (!nextBowler) {
    return alert("Please enter next bowler's name.");
  }

  const inn = state.innings[state.currentInningsIndex];
  const activeBowler = inn.bowlers[inn.currentBowlerIndex];
  
  if (isChangingBowlerMidOver) {
    isChangingBowlerMidOver = false;
    bowlerDialog.close();
    changeBowlerMidOver(nextBowler);
    return;
  }

  if (activeBowler && nextBowler.toLowerCase() === activeBowler.name.toLowerCase()) {
    return alert("In cricket, a bowler cannot bowl consecutive overs. Please select or enter a different bowler.");
  }

  bowlerDialog.close();
  executeNextOver(nextBowler);
});
// --- Mid-Match Bowler & Batsman Change Helpers ---
const substituteDialog = document.getElementById('substitute-dialog');
const substituteForm = document.getElementById('substitute-form');
const substituteSelect = document.getElementById('substitute-select');
const substituteInput = document.getElementById('substitute-input');
let substituteTargetIndex = -1;

function changeBowlerMidOver(newBowlerName) {
  pushHistory();
  const inn = state.innings[state.currentInningsIndex];
  const oldBowler = inn.bowlers[inn.currentBowlerIndex];
  
  if (oldBowler.name.toLowerCase() === newBowlerName.toLowerCase()) return;

  // Find or create the new bowler
  let newBowlerIdx = inn.bowlers.findIndex(b => b.name.toLowerCase() === newBowlerName.toLowerCase());
  if (newBowlerIdx === -1) {
    inn.bowlers.push({ name: newBowlerName, overs: [], runsConcededTotal: 0, wicketsTotal: 0, ballsBowledTotal: 0 });
    newBowlerIdx = inn.bowlers.length - 1;
  }
  
  const newBowler = inn.bowlers[newBowlerIdx];
  const currentOverNum = Math.floor(inn.balls / 6) + 1;

  // Find active over in old bowler's logs
  const oldOverIdx = oldBowler.overs.findIndex(o => o.overNumber === currentOverNum);
  
  if (oldOverIdx !== -1) {
    const activeOver = oldBowler.overs[oldOverIdx];
    
    // Concede active stats to new bowler
    newBowler.runsConcededTotal += activeOver.runsConceded;
    newBowler.wicketsTotal += activeOver.wickets;
    
    // Deduct active stats from old bowler
    oldBowler.runsConcededTotal -= activeOver.runsConceded;
    oldBowler.wicketsTotal -= activeOver.wickets;
    
    // Count legal balls bowled in active over
    const legalBalls = activeOver.balls.filter(b => !b.extraType || (b.extraType !== 'wide' && b.extraType !== 'noball')).length;
    newBowler.ballsBowledTotal += legalBalls;
    oldBowler.ballsBowledTotal -= legalBalls;
    
    // Move the over log
    newBowler.overs.push(activeOver);
    oldBowler.overs.splice(oldOverIdx, 1);

    // Update bowler names in deliveries for the current over
    const overBallsCount = activeOver.balls.length;
    if (overBallsCount > 0) {
      for (let i = 1; i <= overBallsCount; i++) {
        const idx = inn.deliveries.length - i;
        if (idx >= 0 && inn.deliveries[idx].bowler.toLowerCase() === oldBowler.name.toLowerCase()) {
          inn.deliveries[idx].bowler = newBowler.name;
        }
      }
    }
  }

  // Update active index
  inn.currentBowlerIndex = newBowlerIdx;
  
  saveState();
  render();
}

function openSubstituteBatsmanDialog(targetIdx) {
  const inn = state.innings[state.currentInningsIndex];
  substituteTargetIndex = targetIdx;
  
  const squad = inn.battingTeam === state.settings.teamA ? state.settings.squadA : state.settings.squadB;
  
  if (squad) {
    substituteInput.style.display = 'none';
    substituteInput.removeAttribute('required');
    substituteSelect.style.display = 'block';
    substituteSelect.setAttribute('required', 'true');
    
    const dismissedBatterNames = inn.batters.filter(b => b.status === 'out').map(b => b.name.toLowerCase());
    
    const otherBatterIndex = targetIdx === inn.strikerIndex ? inn.nonStrikerIndex : inn.strikerIndex;
    const otherBatterName = otherBatterIndex !== -1 ? inn.batters[otherBatterIndex]?.name.toLowerCase() : '';
    
    const currentBatters = [otherBatterName];
    const activeBowler = inn.bowlers[inn.currentBowlerIndex];
    if (activeBowler) {
      currentBatters.push(activeBowler.name.toLowerCase());
    }
    
    const eligible = squad.filter(name => {
      const lowerName = name.toLowerCase();
      return !currentBatters.includes(lowerName) && !dismissedBatterNames.includes(lowerName);
    });
    
    substituteSelect.innerHTML = eligible.map(n => `<option value="${n}">${state.settings.joker === n ? `${n} (Joker)` : n}</option>`).join('');
  } else {
    substituteSelect.style.display = 'none';
    substituteSelect.removeAttribute('required');
    substituteInput.style.display = 'block';
    substituteInput.setAttribute('required', 'true');
    substituteInput.value = '';
  }
  
  substituteDialog.showModal();
}

document.getElementById('substitute-cancel-btn').addEventListener('click', () => {
  substituteDialog.close();
});

substituteForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const inn = state.innings[state.currentInningsIndex];
  const squad = inn.battingTeam === state.settings.teamA ? state.settings.squadA : state.settings.squadB;
  
  const newName = squad ? substituteSelect.value.trim() : substituteInput.value.trim();
  if (!newName) {
    return alert("Please enter the name of the substitute player.");
  }
  
  const otherBatterIndex = substituteTargetIndex === inn.strikerIndex ? inn.nonStrikerIndex : inn.strikerIndex;
  const otherBatterName = otherBatterIndex !== -1 ? inn.batters[otherBatterIndex]?.name.toLowerCase() : '';
  
  if (newName.toLowerCase() === otherBatterName) {
    return alert("The substitute batsman is already active on the pitch!");
  }
  
  const activeBowler = inn.bowlers[inn.currentBowlerIndex];
  if (activeBowler && newName.toLowerCase() === activeBowler.name.toLowerCase()) {
    return alert("The current bowler cannot be selected as the substitute batsman!");
  }
  
  pushHistory();
  
  const oldName = inn.batters[substituteTargetIndex].name;
  inn.batters[substituteTargetIndex].name = newName;
  
  inn.deliveries.forEach(d => {
    if (d.striker === oldName) d.striker = newName;
    if (d.nonStriker === oldName) d.nonStriker = newName;
  });
  
  substituteDialog.close();
  saveState();
  render();
});

window.openSubstituteBatsmanDialog = openSubstituteBatsmanDialog;
// --- Innings Break Dialog Modal Setup ---
const inningsDialog = document.getElementById('innings-dialog');
const inningsForm = document.getElementById('innings-form');

inningsForm.addEventListener('submit', (e) => {
  e.preventDefault();
  
  const squad = state.settings.squadA && state.settings.squadB;
  const strikerSelect = document.getElementById('chase-striker-select');
  const nonStrikerSelect = document.getElementById('chase-non-striker-select');
  const bowlerSelect = document.getElementById('chase-bowler-select');
  const strikerInput = document.getElementById('chase-striker');
  const nonStrikerInput = document.getElementById('chase-non-striker');
  const bowlerInput = document.getElementById('chase-bowler');

  const chaseStriker = squad ? strikerSelect.value.trim() : strikerInput.value.trim();
  const chaseNonStriker = squad ? nonStrikerSelect.value.trim() : nonStrikerInput.value.trim();
  const chaseBowler = squad ? bowlerSelect.value.trim() : bowlerInput.value.trim();

  if (!chaseStriker || !chaseNonStriker || !chaseBowler) {
    return alert("Please fill in all details for 2nd innings.");
  }

  inningsDialog.close();
  executeStartSecondInnings({
    striker: chaseStriker,
    nonStriker: chaseNonStriker,
    bowler: chaseBowler
  });
});

// --- SCORING CORE FUNCTIONS ---

// 1. Legal Runs scored off the bat
function executeAddRuns(runs) {
  pushHistory();
  const inn = state.innings[state.currentInningsIndex];
  const striker = inn.batters[inn.strikerIndex];
  const bowler = inn.bowlers[inn.currentBowlerIndex];
  const overObj = getOrCreateActiveOver(inn);

  // Update batter
  striker.runs += runs;
  striker.ballsFaced += 1;
  striker.ballsHistory.push(runs);
  if (runs === 4) striker.fours += 1;
  if (runs === 6) striker.sixes += 1;

  // Update bowler
  overObj.runsConceded += runs;
  overObj.balls.push({ runs: runs, extraType: null, wicket: null, batsmanRuns: runs });
  bowler.runsConcededTotal += runs;
  bowler.ballsBowledTotal += 1;

  // Update Innings total
  inn.runs += runs;
  inn.balls += 1;
  
  // Track delivery log
  inn.deliveries.push({
    striker: striker.name,
    nonStriker: inn.nonStrikerIndex !== -1 ? inn.batters[inn.nonStrikerIndex].name : '',
    bowler: bowler.name,
    runs: runs,
    extraType: null,
    wicket: null
  });

  // Switch strikers on odd runs
  if (runs === 1 || runs === 3) {
    swapStriker(inn);
  }

  postBallCheck();
}

// 2. Extras (Wide, No Ball, Byes, Leg Byes)
function executeAddExtra(type) {
  const inn = state.innings[state.currentInningsIndex];
  const striker = inn.batters[inn.strikerIndex];
  const bowler = inn.bowlers[inn.currentBowlerIndex];
  const overObj = getOrCreateActiveOver(inn);

  if (type === 'wide') {
    pushHistory();
    // Wide adds 1 run to extra, 1 to total, bowler concedes 1. No legal ball is counted.
    inn.runs += 1;
    inn.extras.wide += 1;
    bowler.runsConcededTotal += 1;
    overObj.runsConceded += 1;
    overObj.balls.push({ runs: 1, extraType: 'wide', wicket: null, batsmanRuns: 0 });

    inn.deliveries.push({
      striker: striker.name,
      nonStriker: inn.nonStrikerIndex !== -1 ? inn.batters[inn.nonStrikerIndex].name : '',
      bowler: bowler.name,
      runs: 1,
      extraType: 'wide',
      wicket: null
    });

    postBallCheck(false);
  }
  else if (type === 'noball') {
    // Prompt for run scored off the bat on No Ball
    const runsOffBatStr = prompt("Enter runs scored off the bat on this No-Ball:\n(0, 1, 2, 3, 4, 6)", "0");
    if (runsOffBatStr === null) return; // User cancelled prompt
    const runsOffBat = parseInt(runsOffBatStr) || 0;

    pushHistory();
    // No ball adds 1 run to extras, plus runs scored by batsman. Conceded by bowler.
    const totalRuns = 1 + runsOffBat;
    
    striker.runs += runsOffBat;
    striker.ballsFaced += 1; // batter faces the ball
    striker.ballsHistory.push(runsOffBat + 'nb');
    if (runsOffBat === 4) striker.fours += 1;
    if (runsOffBat === 6) striker.sixes += 1;

    inn.runs += totalRuns;
    inn.extras.noball += 1;
    bowler.runsConcededTotal += totalRuns;
    overObj.runsConceded += totalRuns;
    overObj.balls.push({ runs: totalRuns, extraType: 'noball', wicket: null, batsmanRuns: runsOffBat });

    inn.deliveries.push({
      striker: striker.name,
      nonStriker: inn.nonStrikerIndex !== -1 ? inn.batters[inn.nonStrikerIndex].name : '',
      bowler: bowler.name,
      runs: totalRuns,
      extraType: 'noball',
      wicket: null
    });

    if (runsOffBat === 1 || runsOffBat === 3) {
      swapStriker(inn);
    }
    
    postBallCheck(false);
  }
  else if (type === 'bye' || type === 'legbye') {
    const extraRunsStr = prompt(`Enter number of ${type}s run:\n(1, 2, 3, 4)`, "1");
    if (extraRunsStr === null) return;
    const extraRuns = parseInt(extraRunsStr) || 1;

    pushHistory();
    // Byes count as legal delivery, do NOT add to bowler's runs conceded, but add to team extras.
    inn.runs += extraRuns;
    inn.extras[type] += extraRuns;
    inn.balls += 1;

    striker.ballsFaced += 1;
    striker.ballsHistory.push(0); // batsman scores 0 off bat

    overObj.balls.push({ runs: 0, extraType: type, wicket: null, batsmanRuns: 0 }); // bowler conceded 0
    bowler.ballsBowledTotal += 1;

    inn.deliveries.push({
      striker: striker.name,
      nonStriker: inn.nonStrikerIndex !== -1 ? inn.batters[inn.nonStrikerIndex].name : '',
      bowler: bowler.name,
      runs: extraRuns,
      extraType: type,
      wicket: null
    });

    if (extraRuns === 1 || extraRuns === 3) {
      swapStriker(inn);
    }

    postBallCheck();
  }
}

// 3. Wicket dismissals
function executeWicket(details) {
  pushHistory();
  const inn = state.innings[state.currentInningsIndex];
  const striker = inn.batters[inn.strikerIndex];
  const nonStriker = inn.batters[inn.nonStrikerIndex];
  const bowler = inn.bowlers[inn.currentBowlerIndex];
  const overObj = getOrCreateActiveOver(inn);

  const outIndex = details.whoOut === 'striker' ? inn.strikerIndex : inn.nonStrikerIndex;
  const outBatter = inn.batters[outIndex];

  // Update out batter details
  if (details.dismissalType !== 'Retired') {
    outBatter.ballsFaced += 1;
    outBatter.ballsHistory.push('W');
  }
  outBatter.status = 'out';
  
  let howOutStr = details.dismissalType;
  if (details.dismissalType !== 'Retired' && details.dismissalType !== 'Run Out') {
    howOutStr += ` b ${bowler.name}`;
  }
  outBatter.howOut = howOutStr;

  // Update bowler stats
  overObj.balls.push({ runs: 0, extraType: null, wicket: details, batsmanRuns: 0 });
  bowler.ballsBowledTotal += 1;
  if (details.dismissalType !== 'Retired' && details.dismissalType !== 'Run Out') {
    overObj.wickets += 1;
    bowler.wicketsTotal += 1;
  }

  // Innings update
  inn.wickets += 1;
  inn.balls += 1;

  inn.deliveries.push({
    striker: striker.name,
    nonStriker: nonStriker ? nonStriker.name : '',
    bowler: bowler.name,
    runs: 0,
    extraType: null,
    wicket: details
  });

  // Handle swaps and position of new batter
  const oldStrikerIdx = inn.strikerIndex;
  const oldNonStrikerIdx = inn.nonStrikerIndex;

  if (!details.newBatsmanName) {
    // Single batsman (Last Man Standing) mode
    if (details.whoOut === 'striker') {
      inn.strikerIndex = oldNonStrikerIdx;
      inn.nonStrikerIndex = -1;
    } else {
      inn.nonStrikerIndex = -1;
    }
  } else {
    // Insert the new batter to team list
    const newBatterIndex = inn.batters.length;
    inn.batters.push({
      name: details.newBatsmanName,
      runs: 0,
      ballsFaced: 0,
      fours: 0,
      sixes: 0,
      status: '',
      ballsHistory: [],
      howOut: ''
    });

    if (details.whoOut === 'striker') {
      if (details.crossed) {
        inn.strikerIndex = oldNonStrikerIdx;
        inn.nonStrikerIndex = newBatterIndex;
      } else {
        inn.strikerIndex = newBatterIndex;
      }
    } else {
      if (details.crossed) {
        inn.nonStrikerIndex = oldStrikerIdx;
        inn.strikerIndex = newBatterIndex;
      } else {
        inn.nonStrikerIndex = newBatterIndex;
      }
    }
  }

  // Update batting flags
  inn.batters.forEach((b, idx) => {
    if (idx === inn.strikerIndex) b.status = 'batting_striker';
    else if (idx === inn.nonStrikerIndex) b.status = 'batting_non_striker';
  });

  postBallCheck();
}

// 4. Bowler over transition setup
function executeNextOver(bowlerName) {
  pushHistory();
  const inn = state.innings[state.currentInningsIndex];
  
  // Find or create bowler
  let bowlerIdx = inn.bowlers.findIndex(b => b.name.toLowerCase() === bowlerName.toLowerCase());
  if (bowlerIdx === -1) {
    bowlerIdx = inn.bowlers.length;
    inn.bowlers.push({
      name: bowlerName,
      overs: [],
      runsConcededTotal: 0,
      wicketsTotal: 0,
      ballsBowledTotal: 0
    });
  }

  inn.currentBowlerIndex = bowlerIdx;
  saveState();
  render();
}

// 5. Start Innings 2 Chase
function executeStartSecondInnings(setup) {
  pushHistory();
  state.currentInningsIndex = 1;
  const inn = state.innings[1];

  inn.batters = [
    { name: setup.striker, runs: 0, ballsFaced: 0, fours: 0, sixes: 0, status: 'batting_striker', ballsHistory: [], howOut: '' },
    { name: setup.nonStriker, runs: 0, ballsFaced: 0, fours: 0, sixes: 0, status: 'batting_non_striker', ballsHistory: [], howOut: '' }
  ];
  inn.bowlers = [
    { name: setup.bowler, overs: [], runsConcededTotal: 0, wicketsTotal: 0, ballsBowledTotal: 0 }
  ];
  inn.strikerIndex = 0;
  inn.nonStrikerIndex = 1;
  inn.currentBowlerIndex = 0;

  saveState();
  render();
}

// --- POST BALL CHECK HANDLER ---
// isLegalDelivery: false for wide/no-ball, since they do NOT advance inn.balls
// and therefore can never complete an over on their own. Without this flag,
// the over-completion check below (inn.balls % 6 === 0) stays "true" for every
// wide/no-ball bowled immediately after an over has just ended (because balls
// hasn't moved yet), incorrectly re-opening the new-bowler prompt.
function postBallCheck(isLegalDelivery = true) {
  const inn = state.innings[state.currentInningsIndex];
  
  // Check Innings End
  const limitBalls = state.settings.maxOvers * 6;
  let isFinished = false;

  if (state.currentInningsIndex === 0) {
    // Innings 1 Ends if 10 wickets are down, all batsman out (strikerIndex is -1), or overs complete
    if (inn.wickets === 10 || inn.strikerIndex === -1 || inn.balls === limitBalls) {
      isFinished = true;
      saveState();
      
      // Setup Innings 2 dialog parameters
      const target = inn.runs + 1;
      document.getElementById('innings-dialog-desc').textContent = `${inn.battingTeam} scored ${inn.runs}/${inn.wickets} in ${formatOvers(inn.balls)} overs.`;
      document.getElementById('innings-dialog-target').textContent = `${inn.bowlingTeam} needs ${target} runs from ${state.settings.maxOvers} overs.`;
      
      const strikerInput = document.getElementById('chase-striker');
      const strikerSelect = document.getElementById('chase-striker-select');
      const nonStrikerInput = document.getElementById('chase-non-striker');
      const nonStrikerSelect = document.getElementById('chase-non-striker-select');
      const bowlerInput = document.getElementById('chase-bowler');
      const bowlerSelect = document.getElementById('chase-bowler-select');

      const squad = state.settings.squadA && state.settings.squadB;
      if (squad) {
        // Show selects, hide text inputs
        strikerInput.style.display = 'none';
        strikerInput.removeAttribute('required');
        strikerSelect.style.display = 'block';
        strikerSelect.setAttribute('required', 'true');

        nonStrikerInput.style.display = 'none';
        nonStrikerInput.removeAttribute('required');
        nonStrikerSelect.style.display = 'block';
        nonStrikerSelect.setAttribute('required', 'true');

        bowlerInput.style.display = 'none';
        bowlerInput.removeAttribute('required');
        bowlerSelect.style.display = 'block';
        bowlerSelect.setAttribute('required', 'true');

        const chaseBattingSquad = (inn.bowlingTeam === state.settings.teamA) ? originalSquadA : originalSquadB;
        const chaseBowlingSquad = (inn.battingTeam === state.settings.teamA) ? originalSquadA : originalSquadB;

        const makeOptions = (squad) => squad.map(n => `<option value="${n}">${state.settings.joker === n ? `${n} (Joker)` : n}</option>`).join('');
        strikerSelect.innerHTML = makeOptions(chaseBattingSquad);
        nonStrikerSelect.innerHTML = makeOptions(chaseBattingSquad);
        bowlerSelect.innerHTML = makeOptions(chaseBowlingSquad);

        if (chaseBattingSquad.length >= 2) {
          strikerSelect.value = chaseBattingSquad[0];
          nonStrikerSelect.value = chaseBattingSquad[1];
        } else if (chaseBattingSquad.length === 1) {
          strikerSelect.value = chaseBattingSquad[0];
          nonStrikerSelect.value = chaseBattingSquad[0];
        }
        if (chaseBowlingSquad.length >= 1) {
          bowlerSelect.value = chaseBowlingSquad[0];
        }
      } else {
        // Show text inputs, hide selects
        strikerSelect.style.display = 'none';
        strikerSelect.removeAttribute('required');
        strikerInput.style.display = 'block';
        strikerInput.setAttribute('required', 'true');
        strikerInput.value = '';

        nonStrikerSelect.style.display = 'none';
        nonStrikerSelect.removeAttribute('required');
        nonStrikerInput.style.display = 'block';
        nonStrikerInput.setAttribute('required', 'true');
        nonStrikerInput.value = '';

        bowlerSelect.style.display = 'none';
        bowlerSelect.removeAttribute('required');
        bowlerInput.style.display = 'block';
        bowlerInput.setAttribute('required', 'true');
        bowlerInput.value = inn.bowlers[0]?.name || '';
      }

      inningsDialog.showModal();
    }
  } else {
    // Innings 2 (Run Chase) Ends if:
    // 1. Chasing team passes target score
    // 2. Chasing team loses all wickets (or strikerIndex is -1) or overs run out
    const target = state.innings[0].runs + 1;
    if (inn.runs >= target) {
      isFinished = true;
      showMatchSummary();
    } else if (inn.wickets === 10 || inn.strikerIndex === -1 || inn.balls === limitBalls) {
      isFinished = true;
      showMatchSummary();
    }
  }

  // Handle standard over completion transitions (when NOT finished)
  if (!isFinished && isLegalDelivery && inn.balls % 6 === 0 && inn.balls > 0) {
    // Swap strikers at end of over
    swapStriker(inn);
    
    // Show select or input dialog for next bowler
    showBowlerDialog();
  }

  saveState();
  render();
}

// --- RENDER SCREEN RENDERING ENGINE ---
function render() {
  if (!state.settings) {
    showView('setup-view');
    return;
  }

  const inn = state.innings[state.currentInningsIndex];
  const striker = inn.batters[inn.strikerIndex];
  const nonStriker = inn.nonStrikerIndex !== -1 ? inn.batters[inn.nonStrikerIndex] : null;
  const bowler = inn.bowlers[inn.currentBowlerIndex];

  // Headings
  document.getElementById('live-match-teams').textContent = `${state.settings.teamA} vs ${state.settings.teamB}`;
  document.getElementById('live-match-innings-title').textContent = `${state.currentInningsIndex === 0 ? '1st' : '2nd'} Innings - ${inn.battingTeam} Batting`;

  // Score stats
  document.getElementById('live-score').textContent = inn.runs;
  document.getElementById('live-wickets').textContent = inn.wickets;
  document.getElementById('live-overs').textContent = formatOvers(inn.balls);
  document.getElementById('live-max-overs').textContent = state.settings.maxOvers;
  document.getElementById('live-crr').textContent = calculateEconomy(inn.runs, inn.balls);

  // Chase target container (2nd innings only)
  const chaseTargetBox = document.getElementById('chase-target-container');
  if (state.currentInningsIndex === 1) {
    chaseTargetBox.style.display = 'block';
    const target = state.innings[0].runs + 1;
    const runsNeeded = target - inn.runs;
    const totalChaseBalls = state.settings.maxOvers * 6;
    const ballsRemaining = totalChaseBalls - inn.balls;
    
    document.getElementById('chase-target-val').textContent = target;
    document.getElementById('chase-runs-needed').textContent = runsNeeded;
    document.getElementById('chase-balls-remaining').textContent = Math.max(0, ballsRemaining);
    document.getElementById('live-rrr').textContent = calculateEconomy(runsNeeded, Math.max(0, ballsRemaining));
  } else {
    chaseTargetBox.style.display = 'none';
  }

  // Active Batsmen
  const batsmenList = document.getElementById('dashboard-batsmen-list');
  batsmenList.innerHTML = '';

  inn.batters.forEach((b, idx) => {
    if (b.status === 'batting_striker' || b.status === 'batting_non_striker') {
      const isStriker = idx === inn.strikerIndex;
      const card = document.createElement('div');
      card.className = `stats-row ${isStriker ? 'striker' : ''}`;
      
      let historyDotsHTML = b.ballsHistory.map(ball => {
        let cls = 'dot-mini';
        if (ball === 'W') cls += ' wicket';
        else if (ball === 4) cls += ' four';
        else if (ball === 6) cls += ' six';
        return `<span class="${cls}">${ball}</span>`;
      }).join('');

      card.innerHTML = `
        <div style="flex: 1; min-width: 0;">
          <div style="display: flex; align-items: center; justify-content: space-between; width: 100%;">
            <div class="batsman-name" style="display: flex; align-items: center; gap: 6px;">
              <span>${b.name}</span>
              ${state.settings.joker === b.name ? ' <span style="font-size:0.7rem; color:var(--color-accent); font-weight:800;">(Joker)</span>' : ''}
            </div>
            <button type="button" class="btn btn-secondary btn-edit-batsman-mid" data-index="${idx}" style="padding: 2px 6px; font-size: 0.65rem; width: auto; height: auto; font-weight: 700; box-shadow: none; border: 1px solid var(--border-color);">Change</button>
          </div>
          <div class="ball-history-dots" style="margin-top: 4px;">${historyDotsHTML || '<span style="font-size:0.75rem;color:var(--color-text-muted);">No balls faced</span>'}</div>
        </div>
        <div class="stats-values" style="text-align: right; min-width: 80px; flex-shrink: 0;">
          <div class="stats-primary">${b.runs}${isStriker ? '*' : ''}</div>
          <div class="stats-secondary">${b.ballsFaced} balls (SR: ${calculateStrikeRate(b.runs, b.ballsFaced)})</div>
        </div>
      `;
      batsmenList.appendChild(card);
    }
  });

  // Bowler stats card (appended dynamically to batsmenList)
  if (bowler) {
    const bowlerCard = document.createElement('div');
    bowlerCard.className = 'stats-row bowler-row-compact';
    bowlerCard.style.marginTop = '8px';
    bowlerCard.style.borderTop = '1px dashed var(--border-color)';
    bowlerCard.style.paddingTop = '12px';
    
    const overDetailsHTML = bowler.overs.map(o => {
      const ballsStr = o.balls.map(b => {
        if (b.wicket) return 'W';
        if (b.extraType === 'wide') return 'Wd';
        if (b.extraType === 'noball') return 'Nb';
        if (b.extraType === 'bye') return 'By';
        if (b.extraType === 'legbye') return 'Lb';
        return b.runs;
      }).join(', ');
      return `Over ${o.overNumber}: [ ${ballsStr} ] &rarr; ${o.runsConceded} runs, ${o.wickets} Wkts`;
    }).join('<br>');

    bowlerCard.innerHTML = `
      <div style="flex: 1; min-width: 0;">
        <div class="bowler-name" style="font-weight: 700; font-size: 1.05rem; display: flex; align-items: center; gap: 6px; justify-content: space-between; width: 100%;">
          <div style="display: flex; align-items: center; gap: 6px;">
            <span>🥎 ${bowler.name}</span>
            ${state.settings.joker === bowler.name ? '<span style="font-size:0.7rem; color:var(--color-accent); font-weight:800;">(Joker)</span>' : ''}
          </div>
          <button type="button" id="btn-change-bowler-mid" class="btn btn-secondary" style="padding: 2px 6px; font-size: 0.65rem; width: auto; height: auto; font-weight: 700; box-shadow: none; border: 1px solid var(--border-color);">Change</button>
        </div>
        <div style="margin-top: 4px; display: flex; gap: 8px;">
          <span class="dot-mini">Overs: ${formatOvers(bowler.ballsBowledTotal)}</span>
          <span class="dot-mini">Econ: ${calculateEconomy(bowler.runsConcededTotal, bowler.ballsBowledTotal)}</span>
        </div>
        ${bowler.overs.length > 0 ? `
          <details style="margin-top: 6px; width: 100%;">
            <summary style="font-size: 0.75rem; color: var(--color-primary); cursor: pointer; user-select: none; outline: none; font-weight: 600;">View Spell Details (${bowler.overs.length} overs)</summary>
            <div class="details-sub-overs" style="margin-left: 0; margin-top: 4px; padding: 6px 10px; font-size: 0.72rem; line-height: 1.4; border-radius: var(--border-radius-sm); border: 1px solid var(--border-color); background: var(--color-btn-inactive);">${overDetailsHTML}</div>
          </details>
        ` : ''}
      </div>
      <div class="stats-values" style="text-align: right; min-width: 80px; flex-shrink: 0;">
        <div class="stats-primary">${bowler.wicketsTotal} - ${bowler.runsConcededTotal}</div>
        <div class="stats-secondary">Wkts - Runs</div>
      </div>
    `;
    batsmenList.appendChild(bowlerCard);

    // Wire change bowler click mid over
    const midBowlerBtn = bowlerCard.querySelector('#btn-change-bowler-mid');
    if (midBowlerBtn) {
      midBowlerBtn.addEventListener('click', () => {
        isChangingBowlerMidOver = true;
        showBowlerDialog();
      });
    }
  }

  // Wire batsman substitute click mid match
  const subBatsmanBtns = batsmenList.querySelectorAll('.btn-edit-batsman-mid');
  subBatsmanBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.getAttribute('data-index'));
      openSubstituteBatsmanDialog(idx);
    });
  });

  // Over Timeline circles
  const timeline = document.getElementById('current-over-timeline');
  timeline.innerHTML = '';
  
  // Find current over balls
  const currentOverNum = Math.floor(inn.balls / 6) + 1;
  // Combine all bowler over logs for this over index
  const overBalls = [];
  inn.bowlers.forEach(b => {
    const o = b.overs.find(ov => ov.overNumber === currentOverNum);
    if (o) {
      overBalls.push(...o.balls);
    }
  });

  // Render timeline slots (min 6 slots, show all extras too)
  const totalSlots = Math.max(6, overBalls.length);
  for (let i = 0; i < totalSlots; i++) {
    const circle = document.createElement('div');
    circle.className = 'over-ball-circle';
    
    // Highlight next ball slot if it matches current index
    if (i === overBalls.length) {
      circle.classList.add('active');
    }

    if (i < overBalls.length) {
      const b = overBalls[i];
      let val = b.runs;
      if (b.wicket) {
        circle.classList.add('val-wicket');
        val = 'W';
      } else if (b.extraType === 'wide') {
        circle.classList.add('val-extra');
        val = 'Wd';
      } else if (b.extraType === 'noball') {
        circle.classList.add('val-extra');
        val = 'Nb';
      } else if (b.extraType === 'bye') {
        circle.classList.add('val-extra');
        val = 'B';
      } else if (b.extraType === 'legbye') {
        circle.classList.add('val-extra');
        val = 'LB';
      } else {
        if (b.runs === 4) circle.classList.add('val-boundary');
        else if (b.runs === 6) circle.classList.add('val-six');
        else if (b.runs === 0) circle.classList.add('val-0');
      }
      circle.textContent = val;
    }
    timeline.appendChild(circle);
  }
}

// --- DISPLAY FINAL MATCH SUMMARY ---
function showMatchSummary() {
  const inn1 = state.innings[0];
  const inn2 = state.innings[1];
  
  // Result Message
  let resultMsg = "";
  const target = inn1.runs + 1;

  if (state.currentInningsIndex === 1) {
    if (inn2.runs >= target) {
      resultMsg = `${inn2.battingTeam} won by ${10 - inn2.wickets} wickets!`;
    } else if (inn2.wickets === 10 || inn2.balls === state.settings.maxOvers * 6) {
      if (inn2.runs < inn1.runs) {
        resultMsg = `${inn1.battingTeam} won by ${inn1.runs - inn2.runs} runs!`;
      } else {
        resultMsg = "Match Tied!";
      }
    }
  } else {
    // If innings 1 was never finished but we ended early manually
    resultMsg = "Match ended during first innings.";
  }

  document.getElementById('summary-result-msg').textContent = resultMsg;

  // Innings 1 tables
  document.getElementById('summary-innings1-title').textContent = `${inn1.battingTeam} Innings`;
  document.getElementById('summary-innings1-runs').textContent = `${inn1.runs}/${inn1.wickets}`;
  document.getElementById('summary-innings1-overs').textContent = formatOvers(inn1.balls);
  
  populateSummaryTables(inn1, 'summary-innings1-batting', 'summary-innings1-bowling');

  // Innings 2 tables
  const inn2Panel = document.getElementById('summary-innings2-panel');
  if (state.currentInningsIndex === 1 && inn2.batters.length > 0) {
    inn2Panel.style.display = 'block';
    document.getElementById('summary-innings2-title').textContent = `${inn2.battingTeam} Innings`;
    document.getElementById('summary-innings2-runs').textContent = `${inn2.runs}/${inn2.wickets}`;
    document.getElementById('summary-innings2-overs').textContent = formatOvers(inn2.balls);
    populateSummaryTables(inn2, 'summary-innings2-batting', 'summary-innings2-bowling');
  } else {
    inn2Panel.style.display = 'none';
  }

  showView('summary-view');
}

function populateSummaryTables(inn, battingTableId, bowlingTableId) {
  const batBody = document.querySelector(`#${battingTableId} tbody`);
  const bowlBody = document.querySelector(`#${bowlingTableId} tbody`);
  
  batBody.innerHTML = '';
  bowlBody.innerHTML = '';

  // Batting stats
  inn.batters.forEach(b => {
    const row = document.createElement('tr');
    
    let statusText = b.howOut || "not out";
    if (b.status === 'batting_striker' || b.status === 'batting_non_striker') {
      statusText = "not out *";
    }

    row.innerHTML = `
      <td>
        <div style="font-weight:600;">${b.name}</div>
        <div style="font-size:0.7rem;color:var(--color-text-muted);">${statusText}</div>
      </td>
      <td class="num-col" style="font-weight:700;">${b.runs}</td>
      <td class="num-col">${b.ballsFaced}</td>
      <td class="num-col">${b.fours}</td>
      <td class="num-col">${b.sixes}</td>
      <td class="num-col" style="color:var(--color-text-muted);">${calculateStrikeRate(b.runs, b.ballsFaced)}</td>
    `;
    batBody.appendChild(row);
  });

  // Bowling stats with detailed overs inside details rows
  inn.bowlers.forEach((bowler, bIdx) => {
    // Core summary row
    const row = document.createElement('tr');
    row.innerHTML = `
      <td style="font-weight:600;">${bowler.name}</td>
      <td class="num-col">${formatOvers(bowler.ballsBowledTotal)}</td>
      <td class="num-col">${bowler.runsConcededTotal}</td>
      <td class="num-col" style="font-weight:700;">${bowler.wicketsTotal}</td>
      <td class="num-col" style="color:var(--color-text-muted);">${calculateEconomy(bowler.runsConcededTotal, bowler.ballsBowledTotal)}</td>
    `;
    bowlBody.appendChild(row);

    // Over-by-over detail dropdown row
    if (bowler.overs.length > 0) {
      const detailRow = document.createElement('tr');
      detailRow.className = 'details-row';
      
      const overDetailsHTML = bowler.overs.map(o => {
        const ballsStr = o.balls.map(b => {
          if (b.wicket) return 'W';
          if (b.extraType === 'wide') return 'Wd';
          if (b.extraType === 'noball') return 'Nb';
          if (b.extraType === 'bye') return 'By';
          if (b.extraType === 'legbye') return 'Lb';
          return b.runs;
        }).join(', ');
        return `Over ${o.overNumber}: [ ${ballsStr} ] &rarr; ${o.runsConceded} runs, ${o.wickets} Wkts`;
      }).join('<br>');

      detailRow.innerHTML = `
        <td colspan="5" style="padding:4px 8px;">
          <details style="margin-left: 8px;">
            <summary style="font-size:0.75rem;color:var(--color-primary);cursor:pointer;user-select:none;">View Spell Details (${bowler.overs.length} overs)</summary>
            <div class="details-sub-overs">${overDetailsHTML}</div>
          </details>
        </td>
      `;
      bowlBody.appendChild(detailRow);
    }
  });
}

// --- BUTTONS EVENT LISTENERS ---

// Standard Runs buttons
document.querySelectorAll('.scoring-grid button[data-val]').forEach(btn => {
  btn.addEventListener('click', () => {
    const val = parseInt(btn.getAttribute('data-val'));
    executeAddRuns(val);
  });
});

// Extras buttons
document.querySelectorAll('.scoring-grid button[data-type]').forEach(btn => {
  btn.addEventListener('click', () => {
    const type = btn.getAttribute('data-type');
    executeAddExtra(type);
  });
});

// Undo button
document.getElementById('undo-btn').addEventListener('click', () => {
  if (confirm("Are you sure you want to undo the last delivery?")) {
    undo();
  }
});

// Swap strike button listener
document.getElementById('btn-swap-strike').addEventListener('click', () => {
  const inn = state.innings[state.currentInningsIndex];
  if (inn && inn.strikerIndex !== -1 && inn.nonStrikerIndex !== -1) {
    pushHistory();
    const temp = inn.strikerIndex;
    inn.strikerIndex = inn.nonStrikerIndex;
    inn.nonStrikerIndex = temp;
    
    // Update batters status flags
    inn.batters.forEach((b, idx) => {
      if (idx === inn.strikerIndex) b.status = 'batting_striker';
      else if (idx === inn.nonStrikerIndex) b.status = 'batting_non_striker';
    });
    
    saveState();
    render();
  }
});

// Reset match navigations
document.getElementById('nav-setup-btn').addEventListener('click', () => {
  if (confirm("Reset current match? This will wipe the active scorecard.")) {
    clearState();
    showView('setup-view');
  }
});

document.getElementById('summary-restart-btn').addEventListener('click', () => {
  clearState();
  showView('setup-view');
});

// Download PDF / Print Scorecard
document.getElementById('summary-print-btn').addEventListener('click', () => {
  window.print();
});

// Auto-expand all <details> panels for printing so they display on the PDF
window.addEventListener('beforeprint', () => {
  document.querySelectorAll('details').forEach(el => {
    el.setAttribute('data-was-open', el.open ? 'true' : 'false');
    el.open = true;
  });
});

window.addEventListener('afterprint', () => {
  document.querySelectorAll('details').forEach(el => {
    const wasOpen = el.getAttribute('data-was-open');
    el.open = (wasOpen === 'true');
    el.removeAttribute('data-was-open');
  });
});

// --- INIT APP LOAD ---
window.addEventListener('DOMContentLoaded', () => {
  if (loadState()) {
    // If a completed match is stored, show summary. Else show live dashboard.
    const inn2 = state.innings[1];
    const inn1 = state.innings[0];
    const limitBalls = state.settings.maxOvers * 6;
    const target = inn1.runs + 1;
    
    let isMatchComplete = false;
    if (state.currentInningsIndex === 1) {
      if (inn2.runs >= target || inn2.wickets === 10 || inn2.balls === limitBalls) {
        isMatchComplete = true;
      }
    }

    if (isMatchComplete) {
      showMatchSummary();
    } else {
      render();
      showView('dashboard-view');
    }
  } else {
    showView('setup-view');
  }
});
