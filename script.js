"use strict";

const STAGE_QUESTION_COUNT = 5;
const SCORE_STORAGE_KEY = "skyMathHighScoresV2";
const POINTS_LOSS_PER_WRONG = 3;
const MAX_SCORE_ROWS = 20;

const ROUTE = [
  { id: "sun", name: "שמש", short: "שמש", css: "sun", difficulty: null },
  { id: "mercury", name: "חמה", short: "חמה", css: "mercury", difficulty: 1 },
  { id: "venus", name: "נוגה", short: "נוגה", css: "venus", difficulty: 1 },
  { id: "earth", name: "כדור הארץ", short: "ארץ", css: "earth", difficulty: 2 },
  { id: "mars", name: "מאדים", short: "מאדים", css: "mars", difficulty: 2 },
  { id: "jupiter", name: "צדק", short: "צדק", css: "jupiter", difficulty: 3 },
  { id: "saturn", name: "שבתאי", short: "שבתאי", css: "saturn", difficulty: 3 },
  { id: "uranus", name: "אורנוס", short: "אורנוס", css: "uranus", difficulty: 4 },
  { id: "neptune", name: "נפטון", short: "נפטון", css: "neptune", difficulty: 5 },
  { id: "pluto", name: "פלוטו", short: "פלוטו", css: "pluto", difficulty: 5 },
  { id: "aliens", name: "חייזרים", short: "חייזרים", css: "aliens", difficulty: null }
];

const STAGES = ROUTE
  .map((node, routeIndex) => ({ ...node, routeIndex }))
  .filter((node) => typeof node.difficulty === "number");

const PLANET_CSS_CLASSES = ROUTE.map((node) => `node-${node.css}`);

const DIFFICULTY_CONFIGS = [
  {
    level: 1,
    termCounts: [2],
    patterns: ["+"],
    numMin: 0,
    numMax: 10,
    resultMin: 0,
    resultMax: 10
  },
  {
    level: 2,
    termCounts: [2],
    patterns: ["+", "-"],
    numMin: 0,
    numMax: 13,
    resultMin: 0,
    resultMax: 13
  },
  {
    level: 3,
    termCounts: [3],
    patterns: ["++", "+-"],
    numMin: 0,
    numMax: 11,
    resultMin: 0,
    resultMax: 15
  },
  {
    level: 4,
    termCounts: [3],
    patterns: ["++", "+-", "-+"],
    numMin: 0,
    numMax: 15,
    resultMin: 0,
    resultMax: 18
  },
  {
    level: 5,
    termCounts: [2, 3],
    patterns: ["+", "-", "++", "+-", "-+", "--"],
    numMin: 0,
    numMax: 20,
    resultMin: 0,
    resultMax: 20
  }
];

const startScreen = document.getElementById("startScreen");
const gameScreen = document.getElementById("gameScreen");
const finishScreen = document.getElementById("finishScreen");

const playerNameInput = document.getElementById("playerName");
const startButton = document.getElementById("startButton");
const restartButton = document.getElementById("restartButton");

const hudPlayer = document.getElementById("hudPlayer");
const hudStage = document.getElementById("hudStage");
const hudScore = document.getElementById("hudScore");

const progressNodes = document.getElementById("progressNodes");
const progressShip = document.getElementById("progressShip");

const stagePlanet = document.getElementById("stagePlanet");
const landedShip = document.getElementById("landedShip");
const prevPlanetWrap = document.getElementById("prevPlanetWrap");
const nextPlanetWrap = document.getElementById("nextPlanetWrap");
const prevPlanet = document.getElementById("prevPlanet");
const nextPlanet = document.getElementById("nextPlanet");
const prevPlanetLabel = document.getElementById("prevPlanetLabel");
const nextPlanetLabel = document.getElementById("nextPlanetLabel");

const stageNameEl = document.getElementById("stageName");
const questionCounterEl = document.getElementById("questionCounter");
const questionTextEl = document.getElementById("questionText");
const answersGrid = document.getElementById("answersGrid");
const feedbackText = document.getElementById("feedbackText");

const finalSummary = document.getElementById("finalSummary");
const certificateName = document.getElementById("certificateName");
const certificateScore = document.getElementById("certificateScore");
const speakCertificateBtn = document.getElementById("speakCertificateBtn");

const scoresBody = document.getElementById("scoresBody");
const scoresBodyFinish = document.getElementById("scoresBodyFinish");

const state = {
  playerName: "",
  shipClass: "ship-a",
  currentRouteIndex: 0,
  currentStageIndex: 0,
  currentQuestionIndex: 0,
  currentStageQuestions: [],
  currentQuestion: null,
  currentChoices: [],
  wrongAttempts: 0,
  score: 0,
  usedQuestionIds: new Set(),
  locked: false
};

const questionPools = buildQuestionPools();
let highScores = loadHighScores();
let audioContext = null;
const canUseSpeech = "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;

initialize();

function initialize() {
  buildProgressNodes();
  renderHighScores();
  attachEvents();
  setupSpeechUi();
  updateProgressState(0);
  placeProgressShip(0, true);
  updatePlanetNeighbors(1);
  setFeedback("", "");
}

function attachEvents() {
  startButton.addEventListener("click", () => {
    initAudio();
    void startGame();
  });

  restartButton.addEventListener("click", () => {
    resetToStartScreen();
  });

  if (speakCertificateBtn) {
    speakCertificateBtn.addEventListener("click", () => {
      speakCertificateText();
    });
  }

  window.addEventListener("resize", () => {
    placeProgressShip(state.currentRouteIndex, true);
  });
}

async function startGame() {
  stopSpeech();
  const name = playerNameInput.value.trim();
  if (!name) {
    alert("כדי להתחיל, צריך לכתוב שם.");
    playerNameInput.focus();
    return;
  }

  const selectedShip = document.querySelector('input[name="shipChoice"]:checked');

  state.playerName = name;
  state.shipClass = selectedShip ? selectedShip.value : "ship-a";
  state.currentRouteIndex = 0;
  state.currentStageIndex = 0;
  state.currentQuestionIndex = 0;
  state.currentStageQuestions = [];
  state.currentQuestion = null;
  state.currentChoices = [];
  state.wrongAttempts = 0;
  state.score = 0;
  state.usedQuestionIds = new Set();
  state.locked = true;

  applyShipClass();

  hudPlayer.textContent = state.playerName;
  hudScore.textContent = "0";
  hudStage.textContent = `שלב 1/${STAGES.length}`;

  switchScreen(gameScreen);
  await waitForFrame();
  placeProgressShip(0, true);
  updateProgressState(0);
  await goToStage(0);
}

function resetToStartScreen() {
  stopSpeech();
  switchScreen(startScreen);
  playerNameInput.focus();
}

function applyShipClass() {
  [progressShip, landedShip].forEach((el) => {
    el.classList.remove("ship-a", "ship-b", "ship-c");
    el.classList.add(state.shipClass);
  });
}

async function goToStage(stageIndex) {
  if (stageIndex >= STAGES.length) {
    await finishGame();
    return;
  }

  state.locked = true;
  state.currentStageIndex = stageIndex;
  state.currentQuestionIndex = 0;

  const stage = STAGES[stageIndex];
  let stageQuestions;
  try {
    stageQuestions = drawQuestionsForStage(stage.difficulty, STAGE_QUESTION_COUNT, state.usedQuestionIds);
  } catch (error) {
    alert("אין כרגע מספיק תרגילים חדשים. מתחילים משחק חדש.");
    resetToStartScreen();
    return;
  }

  state.currentStageQuestions = stageQuestions;
  hudStage.textContent = `שלב ${stageIndex + 1}/${STAGES.length}`;

  setFeedback(`טסים אל ${stage.name}...`, "warn");
  await animateTravel(stage.routeIndex);

  updateProgressState(stage.routeIndex);
  updatePlanetForStage(stage);
  updatePlanetNeighbors(stage.routeIndex);

  state.locked = false;
  setFeedback("", "");
  renderCurrentQuestion();
}

async function animateTravel(targetRouteIndex) {
  const fromIndex = state.currentRouteIndex;
  if (fromIndex === targetRouteIndex) {
    return;
  }

  landedShip.classList.remove("landing");
  landedShip.classList.add("launching");

  await delay(220);
  placeProgressShip(targetRouteIndex, false);

  await delay(1150);
  state.currentRouteIndex = targetRouteIndex;

  landedShip.classList.remove("launching");
  landedShip.classList.add("landing");
  await delay(460);
  landedShip.classList.remove("landing");
}

function updatePlanetForStage(stage) {
  stagePlanet.classList.remove("planet-enter", ...PLANET_CSS_CLASSES);
  stagePlanet.classList.add(`node-${stage.css}`);
  void stagePlanet.offsetHeight;
  stagePlanet.classList.add("planet-enter");

  stageNameEl.textContent = `שלב ${state.currentStageIndex + 1}: ${stage.name}`;
  questionCounterEl.textContent = `תרגיל 1 מתוך ${STAGE_QUESTION_COUNT}`;
}

function updatePlanetNeighbors(currentRouteIndex) {
  setSidePlanet(prevPlanetWrap, prevPlanet, prevPlanetLabel, ROUTE[currentRouteIndex - 1]);
  setSidePlanet(nextPlanetWrap, nextPlanet, nextPlanetLabel, ROUTE[currentRouteIndex + 1]);
}

function setSidePlanet(wrapper, element, label, routeNode) {
  element.classList.remove(...PLANET_CSS_CLASSES);
  if (!routeNode) {
    wrapper.style.visibility = "hidden";
    label.textContent = "";
    return;
  }

  wrapper.style.visibility = "visible";
  element.classList.add(`node-${routeNode.css}`);
  label.textContent = routeNode.name;
}

function renderCurrentQuestion() {
  const stage = STAGES[state.currentStageIndex];
  const question = state.currentStageQuestions[state.currentQuestionIndex];
  if (!stage || !question) {
    return;
  }

  state.currentQuestion = question;
  state.wrongAttempts = 0;
  questionCounterEl.textContent = `תרגיל ${state.currentQuestionIndex + 1} מתוך ${STAGE_QUESTION_COUNT}`;
  questionTextEl.textContent = `${question.text} = ?`;

  state.currentChoices = buildChoices(question.answer, stage.difficulty);
  answersGrid.innerHTML = "";

  state.currentChoices.forEach((choice) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "answer-btn";
    button.textContent = String(choice);
    button.disabled = state.locked;
    button.addEventListener("click", () => handleAnswer(choice));
    answersGrid.append(button);
  });
}

function handleAnswer(choice) {
  if (state.locked || !state.currentQuestion) {
    return;
  }

  const stage = STAGES[state.currentStageIndex];
  const isCorrect = choice === state.currentQuestion.answer;

  if (!isCorrect) {
    playFailureSound();
    state.wrongAttempts += 1;
    const potentialLoss = state.wrongAttempts * POINTS_LOSS_PER_WRONG;
    if (state.wrongAttempts >= 2) {
      setFeedback(
        `כמעט! ${state.currentQuestion.hint} שימי לב: הטעות מפחיתה ${potentialLoss} נקודות מהשאלה.`,
        "warn"
      );
    } else {
      setFeedback("לא מדויק, נסי שוב.", "bad");
    }
    return;
  }

  playSuccessSound();
  const points = calculatePoints(stage.difficulty, state.wrongAttempts);
  state.score += points;
  hudScore.textContent = String(state.score);

  state.locked = true;
  setAnswerButtonsDisabled(true);
  setFeedback(`נכון מאוד! +${points} נקודות`, "ok");

  window.setTimeout(() => {
    state.currentQuestionIndex += 1;
    if (state.currentQuestionIndex >= STAGE_QUESTION_COUNT) {
      setFeedback(`מעולה! סיימת את ${stage.name}.`, "ok");
      window.setTimeout(() => {
        void goToStage(state.currentStageIndex + 1);
      }, 760);
      return;
    }

    state.locked = false;
    setFeedback("", "");
    renderCurrentQuestion();
  }, 620);
}

async function finishGame() {
  state.locked = true;
  setFeedback("עוד קפיצה קטנה אל החייזרים...", "ok");
  await animateTravel(ROUTE.length - 1);
  updateProgressState(ROUTE.length - 1);
  updatePlanetNeighbors(ROUTE.length - 1);

  saveCurrentScore();

  certificateName.textContent = state.playerName;
  certificateScore.textContent = `${state.score} נקודות`;
  finalSummary.textContent = `${state.playerName}, סיימת מסע מרשים מהשמש ועד פלוטו ופגשת את החייזרים.`;

  renderHighScores();
  switchScreen(finishScreen);
  speakCertificateText();
}

function buildProgressNodes() {
  progressNodes.innerHTML = "";
  ROUTE.forEach((node) => {
    const li = document.createElement("li");
    li.className = `progress-node node-${node.css}`;
    li.dataset.short = node.short;
    progressNodes.append(li);
  });
}

function updateProgressState(activeRouteIndex) {
  const nodes = Array.from(progressNodes.children);
  nodes.forEach((nodeEl, index) => {
    nodeEl.classList.toggle("completed", index > 0 && index < activeRouteIndex);
    nodeEl.classList.toggle("active", index === activeRouteIndex);
  });
}

function placeProgressShip(routeIndex, instant) {
  const targetNode = progressNodes.children[routeIndex];
  if (!targetNode) {
    return;
  }

  const x = targetNode.offsetLeft + targetNode.offsetWidth / 2 - progressShip.offsetWidth / 2;
  const y = targetNode.offsetTop - 22;

  if (instant) {
    const oldTransition = progressShip.style.transition;
    progressShip.style.transition = "none";
    progressShip.style.transform = `translate(${x}px, ${y}px)`;
    void progressShip.offsetHeight;
    progressShip.style.transition = oldTransition || "";
    return;
  }

  progressShip.style.transform = `translate(${x}px, ${y}px)`;
}

function setAnswerButtonsDisabled(disabled) {
  const buttons = answersGrid.querySelectorAll(".answer-btn");
  buttons.forEach((button) => {
    button.disabled = disabled;
  });
}

function setFeedback(message, style) {
  feedbackText.textContent = message;
  feedbackText.classList.remove("ok", "warn", "bad");
  if (style) {
    feedbackText.classList.add(style);
  }
}

function switchScreen(target) {
  [startScreen, gameScreen, finishScreen].forEach((screen) => {
    screen.classList.remove("active");
  });
  target.classList.add("active");
}

function calculatePoints(difficulty, wrongAttempts) {
  const base = 10 + difficulty * 5;
  return Math.max(3, base - wrongAttempts * POINTS_LOSS_PER_WRONG);
}

function drawQuestionsForStage(difficulty, count, usedIds) {
  const levelOrder = uniqueNumbers([
    difficulty,
    difficulty + 1,
    difficulty - 1,
    difficulty + 2,
    difficulty - 2
  ]).filter((level) => level >= 1 && level <= 5);

  const selected = [];
  const selectedIds = new Set();

  for (const level of levelOrder) {
    const available = shuffle(questionPools[level]).filter(
      (question) => !usedIds.has(question.id) && !selectedIds.has(question.id)
    );

    for (const question of available) {
      selected.push(question);
      selectedIds.add(question.id);
      if (selected.length === count) {
        break;
      }
    }

    if (selected.length === count) {
      break;
    }
  }

  if (selected.length < count) {
    throw new Error("insufficient questions");
  }

  selected.forEach((q) => usedIds.add(q.id));
  return selected.map((q) => ({ ...q }));
}

function buildQuestionPools() {
  const pools = { 1: [], 2: [], 3: [], 4: [], 5: [] };
  DIFFICULTY_CONFIGS.forEach((config) => {
    pools[config.level] = generatePoolForConfig(config);
  });
  return pools;
}

function generatePoolForConfig(config) {
  const pool = [];
  const seen = new Set();

  config.termCounts.forEach((termCount) => {
    const patterns = config.patterns.filter((pattern) => pattern.length === termCount - 1);

    patterns.forEach((pattern) => {
      enumerateNumbers(termCount, config.numMin, config.numMax, (numbers) => {
        const ops = pattern.split("");
        if (!isExpressionValidForConfig(numbers, ops, config)) {
          return;
        }

        const text = buildExpressionText(numbers, ops);
        const id = `L${config.level}:${text}`;
        if (seen.has(id)) {
          return;
        }

        seen.add(id);
        pool.push({
          id,
          text,
          numbers: numbers.slice(),
          ops: ops.slice(),
          answer: evaluateExpression(numbers, ops),
          hint: buildHint(numbers, ops)
        });
      });
    });
  });

  return shuffle(pool);
}

function enumerateNumbers(length, min, max, callback) {
  const current = new Array(length).fill(min);

  function step(index) {
    if (index === length) {
      callback(current.slice());
      return;
    }

    for (let value = min; value <= max; value += 1) {
      current[index] = value;
      step(index + 1);
    }
  }

  step(0);
}

function isExpressionValidForConfig(numbers, ops, config) {
  if (numbers.every((num) => num === 0)) {
    return false;
  }

  let running = numbers[0];
  if (running < 0 || running > 20) {
    return false;
  }

  for (let i = 0; i < ops.length; i += 1) {
    const op = ops[i];
    const next = numbers[i + 1];

    if (op === "-") {
      if (!isNoBorrowSubtraction(running, next)) {
        return false;
      }
      running -= next;
    } else {
      running += next;
    }

    if (running < 0 || running > 20) {
      return false;
    }
  }

  return running >= config.resultMin && running <= config.resultMax;
}

function isNoBorrowSubtraction(minuend, subtrahend) {
  return minuend >= subtrahend && (minuend % 10) >= (subtrahend % 10);
}

function evaluateExpression(numbers, ops) {
  let result = numbers[0];
  for (let i = 0; i < ops.length; i += 1) {
    result = ops[i] === "+" ? result + numbers[i + 1] : result - numbers[i + 1];
  }
  return result;
}

function buildExpressionText(numbers, ops) {
  let text = String(numbers[0]);
  for (let i = 0; i < ops.length; i += 1) {
    text += ` ${ops[i]} ${numbers[i + 1]}`;
  }
  return text;
}

function buildHint(numbers, ops) {
  if (ops.length === 1) {
    if (ops[0] === "+") {
      return `רמז: חברי את ${numbers[0]} ו-${numbers[1]}.`;
    }
    return `רמז: חשבי כמה נשאר כשמורידים ${numbers[1]} מ-${numbers[0]}.`;
  }

  const firstStep = ops[0] === "+" ? numbers[0] + numbers[1] : numbers[0] - numbers[1];
  return `רמז: חשבי קודם ${numbers[0]} ${ops[0]} ${numbers[1]} = ${firstStep}, ואז ${firstStep} ${ops[1]} ${numbers[2]}.`;
}

function buildChoices(answer, difficulty) {
  const choices = new Set([answer]);
  const spread = 3 + difficulty * 2;
  let guard = 0;

  while (choices.size < 3 && guard < 80) {
    guard += 1;
    const candidate = clamp(answer + randomInt(-spread, spread), 0, 20);
    if (candidate !== answer) {
      choices.add(candidate);
    }
  }

  if (choices.size < 3) {
    for (let value = 0; value <= 20 && choices.size < 3; value += 1) {
      if (value !== answer) {
        choices.add(value);
      }
    }
  }

  return shuffle(Array.from(choices));
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function shuffle(input) {
  const arr = input.slice();
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function uniqueNumbers(values) {
  return Array.from(new Set(values));
}

function initAudio() {
  if (!("AudioContext" in window || "webkitAudioContext" in window)) {
    return;
  }

  if (!audioContext) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    audioContext = new Ctx();
  }

  if (audioContext.state === "suspended") {
    void audioContext.resume();
  }
}

function playSuccessSound() {
  if (!audioContext) {
    return;
  }

  playTone(660, 0.08, 0.06, "sine");
  window.setTimeout(() => playTone(880, 0.09, 0.06, "sine"), 75);
}

function playFailureSound() {
  if (!audioContext) {
    return;
  }

  playTone(230, 0.14, 0.08, "triangle");
  window.setTimeout(() => playTone(180, 0.14, 0.08, "triangle"), 90);
}

function playTone(frequency, duration, volume, type) {
  const now = audioContext.currentTime;
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, now);

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(volume, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.start(now);
  oscillator.stop(now + duration + 0.02);
}

function loadHighScores() {
  try {
    const raw = localStorage.getItem(SCORE_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return sanitizeScores(parsed);
  } catch (error) {
    return [];
  }
}

function sanitizeScores(entries) {
  const safe = [];
  entries.forEach((entry) => {
    if (!entry || typeof entry !== "object") {
      return;
    }

    const name = String(entry.name || "").trim().slice(0, 20);
    const score = Number(entry.score);
    const timestamp = Number(entry.timestamp);
    if (!name || !Number.isFinite(score)) {
      return;
    }

    safe.push({
      name,
      score: Math.max(0, Math.round(score)),
      timestamp: Number.isFinite(timestamp) ? timestamp : Date.now()
    });
  });

  safe.sort((a, b) => b.score - a.score || b.timestamp - a.timestamp);
  return safe.slice(0, MAX_SCORE_ROWS);
}

function saveCurrentScore() {
  highScores.push({
    name: state.playerName,
    score: state.score,
    timestamp: Date.now()
  });

  highScores = sanitizeScores(highScores);
  localStorage.setItem(SCORE_STORAGE_KEY, JSON.stringify(highScores));
  renderHighScores();
}

function renderHighScores() {
  renderScoreBody(scoresBody, highScores);
  renderScoreBody(scoresBodyFinish, highScores);
}

function renderScoreBody(tbody, list) {
  tbody.innerHTML = "";
  if (list.length === 0) {
    const row = document.createElement("tr");
    row.innerHTML = '<td colspan="4">עדיין אין שיאים</td>';
    tbody.append(row);
    return;
  }

  list.forEach((entry, index) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${index + 1}</td>
      <td>${escapeHtml(entry.name)}</td>
      <td>${entry.score}</td>
      <td>${formatDate(entry.timestamp)}</td>
    `;
    tbody.append(row);
  });
}

function formatDate(timestamp) {
  return new Intl.DateTimeFormat("he-IL", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit"
  }).format(new Date(timestamp));
}

function escapeHtml(text) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function setupSpeechUi() {
  if (!speakCertificateBtn) {
    return;
  }
  if (canUseSpeech) {
    speakCertificateBtn.hidden = false;
    return;
  }
  speakCertificateBtn.hidden = true;
}

function speakCertificateText() {
  if (!canUseSpeech) {
    return;
  }

  const text = `שלום ${state.playerName}. תעודת מסע בין כוכבית. כל הכבוד! סיימת את המשחק חלל המשחקים עם ${state.score} נקודות.`;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "he-IL";
  utterance.rate = 0.95;
  utterance.pitch = 1.05;
  utterance.voice = getHebrewVoice();

  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}

function getHebrewVoice() {
  const voices = window.speechSynthesis.getVoices();
  if (!voices || voices.length === 0) {
    return null;
  }
  return (
    voices.find((voice) => voice.lang && voice.lang.toLowerCase().startsWith("he")) ||
    voices.find((voice) => voice.lang && voice.lang.toLowerCase().startsWith("en")) ||
    null
  );
}

function stopSpeech() {
  if (!canUseSpeech) {
    return;
  }
  window.speechSynthesis.cancel();
}

function delay(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function waitForFrame() {
  return new Promise((resolve) => requestAnimationFrame(resolve));
}
