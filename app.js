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

// --- Setup Form Submission ---
document.getElementById('match-setup-form').addEventListener('submit', (e) => {
  e.preventDefault();
  
  const teamA = document.getElementById('setup-team-a').value.trim();
  const teamB = document.getElementById('setup-team-b').value.trim();
  const overs = parseInt(document.getElementById('setup-overs').value);
  const striker = document.getElementById('setup-striker').value.trim();
  const nonStriker = document.getElementById('setup-non-striker').value.trim();
  const bowler = document.getElementById('setup-bowler').value.trim();

  if (!teamA || !teamB || !overs || !striker || !nonStriker || !bowler) {
    return alert("Please fill in all match setup fields.");
  }

  // Initialize Match State
  state.settings = {
    teamA,
    teamB,
    maxOvers: overs
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
let wicketStrikerOut = true; // Striker is selected by default

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
  const newBatsmanName = newBatsmanNameInput.value.trim();

  if (!newBatsmanName) {
    return alert("Please enter the new batsman's name.");
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
  // Preset player names inside the toggle
  document.getElementById('wicket-striker-btn').textContent = `Striker: ${inn.batters[inn.strikerIndex].name}`;
  document.getElementById('wicket-nonstriker-btn').textContent = `Non-Striker: ${inn.batters[inn.nonStrikerIndex].name}`;
  
  // Reset form inputs
  newBatsmanNameInput.value = '';
  wicketStrikerOut = true;
  document.getElementById('wicket-striker-btn').classList.add('active');
  document.getElementById('wicket-nonstriker-btn').classList.remove('active');
  wicketForm.querySelector('input[value="Bowled"]').checked = true;
  runoutCrossGroup.style.display = 'none';

  wicketDialog.showModal();
});

// --- Bowler Dialog Modal Setup ---
const bowlerDialog = document.getElementById('bowler-dialog');
const bowlerForm = document.getElementById('bowler-form');
const newBowlerNameInput = document.getElementById('new-bowler-name');

function showBowlerDialog() {
  const inn = state.innings[state.currentInningsIndex];
  const activeBowler = inn.bowlers[inn.currentBowlerIndex];
  
  const listEl = document.getElementById('existing-bowlers-list');
  const groupEl = document.getElementById('existing-bowlers-group');
  
  listEl.innerHTML = '';
  
  // Filter out the bowler who just finished their over
  const otherBowlers = inn.bowlers.filter(b => b.name.toLowerCase() !== activeBowler.name.toLowerCase());
  
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
  
  newBowlerNameInput.value = '';
  bowlerDialog.showModal();
}

document.getElementById('bowler-undo-btn').addEventListener('click', () => {
  bowlerDialog.close();
  undo();
});

bowlerForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const nextBowler = newBowlerNameInput.value.trim();
  
  if (!nextBowler) {
    return alert("Please enter next bowler's name.");
  }

  const inn = state.innings[state.currentInningsIndex];
  const activeBowler = inn.bowlers[inn.currentBowlerIndex];
  if (activeBowler && nextBowler.toLowerCase() === activeBowler.name.toLowerCase()) {
    return alert("In cricket, a bowler cannot bowl consecutive overs. Please select or enter a different bowler.");
  }

  bowlerDialog.close();
  executeNextOver(nextBowler);
});

// --- Innings Break Dialog Modal Setup ---
const inningsDialog = document.getElementById('innings-dialog');
const inningsForm = document.getElementById('innings-form');

inningsForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const chaseStriker = document.getElementById('chase-striker').value.trim();
  const chaseNonStriker = document.getElementById('chase-non-striker').value.trim();
  const chaseBowler = document.getElementById('chase-bowler').value.trim();

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
    nonStriker: inn.batters[inn.nonStrikerIndex].name,
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
      nonStriker: inn.batters[inn.nonStrikerIndex].name,
      bowler: bowler.name,
      runs: 1,
      extraType: 'wide',
      wicket: null
    });

    postBallCheck();
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
      nonStriker: inn.batters[inn.nonStrikerIndex].name,
      bowler: bowler.name,
      runs: totalRuns,
      extraType: 'noball',
      wicket: null
    });

    if (runsOffBat === 1 || runsOffBat === 3) {
      swapStriker(inn);
    }
    
    postBallCheck();
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
      nonStriker: inn.batters[inn.nonStrikerIndex].name,
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
    nonStriker: nonStriker.name,
    bowler: bowler.name,
    runs: 0,
    extraType: null,
    wicket: details
  });

  // Handle swaps and position of new batter
  const oldStrikerIdx = inn.strikerIndex;
  const oldNonStrikerIdx = inn.nonStrikerIndex;

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
      // old non-striker becomes striker, new batter goes to non-striker
      inn.strikerIndex = oldNonStrikerIdx;
      inn.nonStrikerIndex = newBatterIndex;
    } else {
      // new batter becomes striker
      inn.strikerIndex = newBatterIndex;
    }
  } else {
    // Non-striker got out
    if (details.crossed) {
      // old striker becomes non-striker, new batter goes to striker
      inn.nonStrikerIndex = oldStrikerIdx;
      inn.strikerIndex = newBatterIndex;
    } else {
      // new batter becomes non-striker
      inn.nonStrikerIndex = newBatterIndex;
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
function postBallCheck() {
  const inn = state.innings[state.currentInningsIndex];
  
  // Check Innings End
  const limitBalls = state.settings.maxOvers * 6;
  let isFinished = false;

  if (state.currentInningsIndex === 0) {
    // Innings 1 Ends if 10 wickets are down or overs complete
    if (inn.wickets === 10 || inn.balls === limitBalls) {
      isFinished = true;
      saveState();
      
      // Setup Innings 2 dialog parameters
      const target = inn.runs + 1;
      document.getElementById('innings-dialog-desc').textContent = `${inn.battingTeam} scored ${inn.runs}/${inn.wickets} in ${formatOvers(inn.balls)} overs.`;
      document.getElementById('innings-dialog-target').textContent = `${inn.bowlingTeam} needs ${target} runs from ${state.settings.maxOvers} overs.`;
      
      // Pre-fill fields for chasing team
      document.getElementById('chase-striker').value = '';
      document.getElementById('chase-non-striker').value = '';
      document.getElementById('chase-bowler').value = inn.bowlers[0].name; // pre-fill bowler with innings 1 opening bowler or first bowler

      inningsDialog.showModal();
    }
  } else {
    // Innings 2 (Run Chase) Ends if:
    // 1. Chasing team passes target score
    // 2. Chasing team loses all wickets or overs run out
    const target = state.innings[0].runs + 1;
    if (inn.runs >= target) {
      // Batsmen win
      isFinished = true;
      showMatchSummary();
    } else if (inn.wickets === 10 || inn.balls === limitBalls) {
      isFinished = true;
      showMatchSummary();
    }
  }

  // Handle standard over completion transitions (when NOT finished)
  if (!isFinished && inn.balls % 6 === 0 && inn.balls > 0) {
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
  const nonStriker = inn.batters[inn.nonStrikerIndex];
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
        <div>
          <div class="batsman-name">${b.name}</div>
          <div class="ball-history-dots">${historyDotsHTML || '<span style="font-size:0.75rem;color:var(--color-text-muted);">No balls faced</span>'}</div>
        </div>
        <div class="stats-values">
          <div class="stats-primary">${b.runs}${isStriker ? '*' : ''}</div>
          <div class="stats-secondary">${b.ballsFaced} balls (SR: ${calculateStrikeRate(b.runs, b.ballsFaced)})</div>
        </div>
      `;
      batsmenList.appendChild(card);
    }
  });

  // Bowler stats card
  const bowlerNameEl = document.getElementById('bowler-name');
  const bowlerWicketsEl = document.getElementById('bowler-wickets');
  const bowlerRunsEl = document.getElementById('bowler-runs');
  const bowlerOversEl = document.getElementById('bowler-overs');
  const bowlerEconEl = document.getElementById('bowler-econ');
  const bowlerSpellContainer = document.getElementById('bowler-spell-details');

  bowlerNameEl.textContent = bowler.name;
  bowlerWicketsEl.textContent = bowler.wicketsTotal;
  bowlerRunsEl.textContent = bowler.runsConcededTotal;
  bowlerOversEl.textContent = formatOvers(bowler.ballsBowledTotal);
  bowlerEconEl.textContent = calculateEconomy(bowler.runsConcededTotal, bowler.ballsBowledTotal);

  // Bowler spell detail over-by-over log
  bowlerSpellContainer.innerHTML = '';
  bowler.overs.forEach(o => {
    const item = document.createElement('div');
    item.className = 'over-detail-item';
    
    const dotsMarkup = o.balls.map(b => {
      let char = b.runs;
      let labelClass = '';
      if (b.wicket) { char = 'W'; labelClass = 'style="color:var(--color-danger);font-weight:800;"'; }
      else if (b.extraType === 'wide') { char = 'Wd'; labelClass = 'style="color:var(--color-accent);"'; }
      else if (b.extraType === 'noball') { char = 'Nb'; labelClass = 'style="color:var(--color-accent);"'; }
      else if (b.extraType === 'bye') { char = 'By'; }
      else if (b.extraType === 'legbye') { char = 'Lb'; }
      return `<span ${labelClass}>${char}</span>`;
    }).join(', ');

    item.innerHTML = `
      <span>Over ${o.overNumber}: [ ${dotsMarkup} ]</span>
      <span>${o.runsConceded} runs, ${o.wickets} Wkts</span>
    `;
    bowlerSpellContainer.appendChild(item);
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
