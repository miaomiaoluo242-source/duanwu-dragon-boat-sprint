const RACE_DISTANCE = 260;
const TIME_LIMIT = 30;
const START_LEFT = 4;
const FINISH_LEFT = 91;
const FORWARD_STEP = 6;
const BACK_STEP = 4;
const VERTICAL_STEP = 9;
const REWARD_SCORE = 8;
const REWARD_BOOST = 5;
const OBSTACLE_PENALTY = 12;
const OBSTACLE_SCORE_PENALTY = 3;

const timeLeftEl = document.getElementById("timeLeft");
const raceStateEl = document.getElementById("raceState");
const distanceEl = document.getElementById("distance");
const scoreEl = document.getElementById("score");
const messageEl = document.getElementById("message");
const countdownEl = document.getElementById("countdown");
const trackItemsEl = document.getElementById("trackItems");
const riverEl = document.getElementById("river");
const boatEl = document.getElementById("boat");
const startBtn = document.getElementById("startBtn");
const resetBtn = document.getElementById("resetBtn");
const directionButtons = Array.from(document.querySelectorAll(".direction-btn"));

const player = {
  progress: 0,
  y: 50,
  score: 0,
  stunnedUntil: 0
};

let phase = "waiting";
let countdownTimerId = null;
let raceTimerId = null;
let holdTimerId = null;
let raceStartedAt = 0;
let trackItems = [];

function distanceToLeft(distance) {
  const ratio = Math.min(Math.max(distance / RACE_DISTANCE, 0), 1);
  return START_LEFT + ratio * (FINISH_LEFT - START_LEFT);
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function setMessage(text, type = "") {
  messageEl.textContent = text;
  messageEl.className = `message-area ${type}`.trim();
}

function clearTimers() {
  clearInterval(countdownTimerId);
  clearInterval(raceTimerId);
  clearInterval(holdTimerId);
  countdownTimerId = null;
  raceTimerId = null;
  holdTimerId = null;
}

function createTrackItems() {
  const lanes = [28, 40, 52, 64, 76];
  const obstacleDistances = [34, 52, 73, 92, 113, 134, 154, 174, 195, 214, 232, 248];
  const rewardDistances = [24, 63, 104, 145, 186, 224, 254];
  const items = [];

  obstacleDistances.forEach((distance, index) => {
    items.push({
      id: `obstacle-${index}`,
      type: "obstacle",
      distance,
      y: lanes[(index * 2 + Math.floor(Math.random() * lanes.length)) % lanes.length],
      cleared: false
    });
  });

  rewardDistances.forEach((distance, index) => {
    items.push({
      id: `reward-${index}`,
      type: "reward",
      distance,
      y: lanes[(index * 3 + 1 + Math.floor(Math.random() * 2)) % lanes.length],
      cleared: false
    });
  });

  return items.sort((a, b) => a.distance - b.distance);
}

function renderTrackItems() {
  trackItemsEl.innerHTML = "";

  trackItems.forEach((item) => {
    const itemEl = document.createElement("div");
    itemEl.className = `track-item ${item.type}${item.cleared ? " cleared" : ""}`;
    itemEl.dataset.id = item.id;
    itemEl.style.left = `${distanceToLeft(item.distance)}%`;
    itemEl.style.top = `${item.y}%`;
    itemEl.textContent = item.type === "reward" ? "粽" : "🌊";
    trackItemsEl.append(itemEl);
  });
}

function updateTrackItems() {
  trackItems.forEach((item) => {
    const itemEl = trackItemsEl.querySelector(`[data-id="${item.id}"]`);

    if (itemEl) {
      itemEl.classList.toggle("cleared", item.cleared);
    }
  });
}

function updateDisplay() {
  distanceEl.textContent = Math.floor(player.progress);
  scoreEl.textContent = player.score;
  boatEl.style.left = `${distanceToLeft(player.progress)}%`;
  boatEl.style.top = `${player.y}%`;
  directionButtons.forEach((button) => {
    button.disabled = phase !== "racing";
  });
  startBtn.disabled = phase === "countdown" || phase === "racing";
}

function resetGame() {
  clearTimers();
  phase = "waiting";
  player.progress = 0;
  player.y = 50;
  player.score = 0;
  player.stunnedUntil = 0;
  trackItems = createTrackItems();
  countdownEl.classList.add("hidden");
  countdownEl.textContent = "";
  timeLeftEl.textContent = TIME_LIMIT.toFixed(1);
  raceStateEl.textContent = "等待开始";
  startBtn.textContent = "开始游戏";
  boatEl.classList.remove("is-paddling", "is-hit", "is-winner");
  renderTrackItems();
  setMessage("准备好后开始冲刺，沿河道收集粽子、避开浪花。");
  updateDisplay();
}

function startGame() {
  if (phase !== "waiting") {
    return;
  }

  phase = "countdown";
  startBtn.disabled = true;
  raceStateEl.textContent = "准备";
  countdownEl.classList.remove("hidden");
  let value = 3;
  countdownEl.textContent = value;
  setMessage("稳住船头，准备开划。");

  countdownTimerId = setInterval(() => {
    value -= 1;

    if (value > 0) {
      countdownEl.textContent = value;
      return;
    }

    if (value === 0) {
      countdownEl.textContent = "开划";
      return;
    }

    clearInterval(countdownTimerId);
    countdownEl.classList.add("hidden");
    beginRace();
  }, 800);
}

function beginRace() {
  phase = "racing";
  raceStartedAt = Date.now();
  raceStateEl.textContent = "冲刺中";
  setMessage("冲刺开始！收集粽子，避开浪花障碍。");
  riverEl.focus();
  updateDisplay();
  raceTimerId = setInterval(tickRace, 100);
}

function tickRace() {
  if (phase !== "racing") {
    return;
  }

  const elapsed = (Date.now() - raceStartedAt) / 1000;
  const remaining = Math.max(TIME_LIMIT - elapsed, 0);
  timeLeftEl.textContent = remaining.toFixed(1);

  checkCollisions();

  if (player.progress >= RACE_DISTANCE) {
    finishRace(true);
    return;
  }

  if (remaining <= 0) {
    finishRace(false);
  }
}

function moveBoat(direction) {
  if (phase !== "racing") {
    return;
  }

  const now = Date.now();

  if (now < player.stunnedUntil && direction === "right") {
    animateBoat("is-hit");
    return;
  }

  if (direction === "up") {
    player.y = clamp(player.y - VERTICAL_STEP, 24, 78);
  }

  if (direction === "down") {
    player.y = clamp(player.y + VERTICAL_STEP, 24, 78);
  }

  if (direction === "left") {
    player.progress = clamp(player.progress - BACK_STEP, 0, RACE_DISTANCE);
  }

  if (direction === "right") {
    player.progress = clamp(player.progress + FORWARD_STEP, 0, RACE_DISTANCE);
    player.score += 1;
    animateBoat("is-paddling");
  }

  checkCollisions();
  updateDisplay();

  if (player.progress >= RACE_DISTANCE) {
    finishRace(true);
  }
}

function checkCollisions() {
  trackItems.forEach((item) => {
    if (item.cleared) {
      return;
    }

    const distanceGap = Math.abs(player.progress - item.distance);
    const laneGap = Math.abs(player.y - item.y);

    if (distanceGap > 6 || laneGap > 9) {
      return;
    }

    item.cleared = true;

    if (item.type === "reward") {
      player.score += REWARD_SCORE;
      player.progress = clamp(player.progress + REWARD_BOOST, 0, RACE_DISTANCE);
      setMessage(`收集到粽子！分数 +${REWARD_SCORE}，龙舟向前冲了一小段。`);
    } else {
      player.progress = clamp(player.progress - OBSTACLE_PENALTY, 0, RACE_DISTANCE);
      player.score = Math.max(0, player.score - OBSTACLE_SCORE_PENALTY);
      player.stunnedUntil = Date.now() + 520;
      animateBoat("is-hit");
      setMessage(`撞上浪花障碍，后退 ${OBSTACLE_PENALTY}m。`, "warn");
    }

    updateTrackItems();
  });
}

function finishRace(isWin) {
  if (phase === "finished") {
    return;
  }

  phase = "finished";
  clearTimers();
  startBtn.textContent = "再来一局";
  countdownEl.classList.add("hidden");

  if (isWin) {
    player.progress = RACE_DISTANCE;
    player.score += 20;
    raceStateEl.textContent = "成功冲线";
    boatEl.classList.add("is-winner");
    setMessage("恭喜你！龙舟成功冲线，端午安康！", "win");
  } else {
    raceStateEl.textContent = "时间结束";
    setMessage("差一点就到终点啦，再试一次！", "lose");
  }

  updateDisplay();
}

function animateBoat(className) {
  boatEl.classList.remove(className);
  void boatEl.offsetWidth;
  boatEl.classList.add(className);

  setTimeout(() => {
    boatEl.classList.remove(className);
  }, 420);
}

function startHolding(direction, button) {
  if (phase !== "racing") {
    return;
  }

  stopHolding();
  button.classList.add("is-pressed");
  moveBoat(direction);
  holdTimerId = setInterval(() => moveBoat(direction), 110);
}

function stopHolding() {
  clearInterval(holdTimerId);
  holdTimerId = null;
  directionButtons.forEach((button) => button.classList.remove("is-pressed"));
}

startBtn.addEventListener("click", () => {
  if (phase === "finished") {
    resetGame();
  }

  startGame();
});

resetBtn.addEventListener("click", resetGame);

directionButtons.forEach((button) => {
  const direction = button.dataset.direction;

  button.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    startHolding(direction, button);
  });

  button.addEventListener("pointerup", stopHolding);
  button.addEventListener("pointercancel", stopHolding);
  button.addEventListener("pointerleave", stopHolding);
});

window.addEventListener("keydown", (event) => {
  const directionMap = {
    ArrowUp: "up",
    ArrowDown: "down",
    ArrowLeft: "left",
    ArrowRight: "right"
  };
  const direction = directionMap[event.key];

  if (!direction) {
    return;
  }

  event.preventDefault();
  moveBoat(direction);
});

window.addEventListener("keyup", stopHolding);
window.addEventListener("blur", stopHolding);

resetGame();
