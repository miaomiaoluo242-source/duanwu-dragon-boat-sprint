const RACE_DISTANCE = 180;
const START_LEFT = 3;
const FINISH_LEFT = 86;
const PADDLE_SCORE = 1;
const REWARD_SCORE = 5;
const WIN_BONUS = 20;
const OBSTACLE_PENALTY = 9;
const OBSTACLE_SCORE_PENALTY = 2;

const raceTimeEl = document.getElementById("raceTime");
const raceStateEl = document.getElementById("raceState");
const messageEl = document.getElementById("message");
const countdownEl = document.getElementById("countdown");
const trackItemsEl = document.getElementById("trackItems");
const resetBtn = document.getElementById("resetBtn");

const racers = [
  {
    id: "p1",
    name: "红队",
    lane: 0,
    laneTop: 33,
    ready: false,
    progress: 0,
    score: 0,
    blockedUntil: 0,
    readyBtn: document.getElementById("p1ReadyBtn"),
    paddleBtn: document.getElementById("p1PaddleBtn"),
    boatEl: document.getElementById("p1Boat"),
    distanceEl: document.getElementById("p1Distance"),
    scoreEl: document.getElementById("p1Score"),
    statusEl: document.getElementById("p1Status")
  },
  {
    id: "p2",
    name: "青队",
    lane: 1,
    laneTop: 67,
    ready: false,
    progress: 0,
    score: 0,
    blockedUntil: 0,
    readyBtn: document.getElementById("p2ReadyBtn"),
    paddleBtn: document.getElementById("p2PaddleBtn"),
    boatEl: document.getElementById("p2Boat"),
    distanceEl: document.getElementById("p2Distance"),
    scoreEl: document.getElementById("p2Score"),
    statusEl: document.getElementById("p2Status")
  }
];

let phase = "waiting";
let countdownTimerId = null;
let raceTimerId = null;
let raceStartedAt = 0;
let trackItems = [];

function distanceToLeft(distance) {
  const ratio = Math.min(distance / RACE_DISTANCE, 1);
  return START_LEFT + ratio * (FINISH_LEFT - START_LEFT);
}

function setMessage(text, type = "") {
  messageEl.textContent = text;
  messageEl.className = `message-area ${type}`.trim();
}

function clearTimers() {
  clearInterval(countdownTimerId);
  clearInterval(raceTimerId);
  countdownTimerId = null;
  raceTimerId = null;
}

function updateDisplay() {
  racers.forEach((racer) => {
    racer.distanceEl.textContent = Math.floor(Math.min(racer.progress, RACE_DISTANCE));
    racer.scoreEl.textContent = racer.score;
    racer.boatEl.style.left = `${distanceToLeft(racer.progress)}%`;
    racer.statusEl.textContent = racer.ready ? "已准备" : "待准备";
  });

  if (phase === "racing") {
    const elapsed = (Date.now() - raceStartedAt) / 1000;
    raceTimeEl.textContent = elapsed.toFixed(1);
  }
}

function setPaddleButtons(enabled) {
  racers.forEach((racer) => {
    racer.paddleBtn.disabled = !enabled;
  });
}

function setReadyButtons(enabled) {
  racers.forEach((racer) => {
    racer.readyBtn.disabled = !enabled || racer.ready;
  });
}

function resetGame() {
  clearTimers();
  phase = "waiting";
  trackItems = createTrackItems();
  countdownEl.classList.add("hidden");
  countdownEl.textContent = "";
  raceTimeEl.textContent = "0.0";
  raceStateEl.textContent = "等待准备";

  racers.forEach((racer) => {
    racer.ready = false;
    racer.progress = 0;
    racer.score = 0;
    racer.blockedUntil = 0;
    racer.readyBtn.disabled = false;
    racer.readyBtn.textContent = `${racer.name}准备`;
    racer.paddleBtn.disabled = true;
    racer.boatEl.classList.remove("is-paddling", "is-hit", "is-winner");
  });

  renderTrackItems();
  setMessage("两位选手都准备好后，龙舟赛自动倒计时开跑。");
  updateDisplay();
}

function markReady(racer) {
  if (phase !== "waiting" || racer.ready) {
    return;
  }

  racer.ready = true;
  racer.readyBtn.textContent = `${racer.name}已准备`;
  racer.readyBtn.disabled = true;
  updateDisplay();

  if (racers.every((item) => item.ready)) {
    startCountdown();
  } else {
    setMessage(`${racer.name}已就位，等待另一位选手确认准备。`);
  }
}

function startCountdown() {
  phase = "countdown";
  raceStateEl.textContent = "倒计时";
  setReadyButtons(false);
  setPaddleButtons(false);
  setMessage("两队就位，龙舟即将出发！");

  let count = 3;
  countdownEl.textContent = count;
  countdownEl.classList.remove("hidden");

  countdownTimerId = setInterval(() => {
    count -= 1;

    if (count > 0) {
      countdownEl.textContent = count;
      return;
    }

    countdownEl.textContent = "划！";
    clearInterval(countdownTimerId);
    countdownTimerId = null;
    setTimeout(startRace, 620);
  }, 1000);
}

function startRace() {
  phase = "racing";
  raceStartedAt = Date.now();
  countdownEl.classList.add("hidden");
  raceStateEl.textContent = "冲刺中";
  setPaddleButtons(true);
  setMessage("比赛开始！穿过长赛道，避开浪花，抢先冲线。");

  raceTimerId = setInterval(updateDisplay, 100);
  updateDisplay();
}

function createTrackItems() {
  const items = [];
  const laneConfigs = [
    { lane: 0, top: 33 },
    { lane: 1, top: 67 }
  ];

  laneConfigs.forEach(({ lane, top }) => {
    for (let i = 0; i < 4; i += 1) {
      const segmentStart = 26 + i * 35;
      const distance = segmentStart + Math.random() * 18;
      items.push({
        id: `obstacle-${lane}-${i}`,
        type: "obstacle",
        lane,
        top: top + (Math.random() * 8 - 4),
        distance,
        used: false
      });
    }

    for (let i = 0; i < 3; i += 1) {
      const segmentStart = 42 + i * 44;
      const distance = segmentStart + Math.random() * 20;
      items.push({
        id: `reward-${lane}-${i}`,
        type: "reward",
        lane,
        top: top + (Math.random() * 8 - 4),
        distance,
        used: false
      });
    }
  });

  return items;
}

function renderTrackItems() {
  trackItemsEl.innerHTML = "";

  trackItems.forEach((item) => {
    const element = document.createElement("div");
    element.className = `track-item ${item.type}`;
    element.dataset.id = item.id;
    element.style.left = `${distanceToLeft(item.distance)}%`;
    element.style.top = `${item.top}%`;

    if (item.type === "obstacle") {
      element.textContent = "🌊";
    } else {
      const zongzi = document.createElement("span");
      zongzi.className = "zongzi-shape";
      element.appendChild(zongzi);
    }

    trackItemsEl.appendChild(element);
  });
}

function markTrackItem(item, className) {
  const element = trackItemsEl.querySelector(`[data-id="${item.id}"]`);

  if (element) {
    element.classList.add(className);
  }
}

function paddle(racer) {
  if (phase !== "racing") {
    return;
  }

  const now = Date.now();

  if (now < racer.blockedUntil) {
    setMessage(`${racer.name}刚撞上浪花，稍微缓一下。`, "warn");
    return;
  }

  const previousProgress = racer.progress;
  const step = 4.8 + Math.random() * 2.4;
  racer.progress = Math.min(RACE_DISTANCE, racer.progress + step);
  racer.score += PADDLE_SCORE;

  animateBoat(racer.boatEl, "is-paddling");
  checkTrackItems(racer, previousProgress);
  updateDisplay();

  if (racer.progress >= RACE_DISTANCE) {
    endRace(racer);
  }
}

function animateBoat(boat, className) {
  boat.classList.remove(className);
  void boat.offsetWidth;
  boat.classList.add(className);
}

function checkTrackItems(racer, previousProgress) {
  trackItems.forEach((item) => {
    if (item.used || item.lane !== racer.lane) {
      return;
    }

    const crossed = previousProgress < item.distance && racer.progress >= item.distance;

    if (!crossed) {
      return;
    }

    item.used = true;

    if (item.type === "reward") {
      racer.score += REWARD_SCORE;
      racer.progress = Math.min(RACE_DISTANCE, racer.progress + 3);
      markTrackItem(item, "collected");
      setMessage(`${racer.name}收集到粽子，分数 +5！`);
      return;
    }

    racer.progress = Math.max(0, racer.progress - OBSTACLE_PENALTY);
    racer.score = Math.max(0, racer.score - OBSTACLE_SCORE_PENALTY);
    racer.blockedUntil = Date.now() + 520;
    markTrackItem(item, "hit");
    animateBoat(racer.boatEl, "is-hit");
    setMessage(`${racer.name}撞上浪花障碍，距离后退 ${OBSTACLE_PENALTY}m。`, "warn");
  });
}

function endRace(winner) {
  if (phase !== "racing") {
    return;
  }

  phase = "finished";
  clearTimers();
  winner.progress = RACE_DISTANCE;
  winner.score += WIN_BONUS;
  winner.boatEl.classList.add("is-winner");
  raceStateEl.textContent = "比赛结束";
  setPaddleButtons(false);
  setReadyButtons(false);
  setMessage(`${winner.name}率先冲线，赢得龙舟 PK，端午安康！`, "win");
  updateDisplay();
}

racers.forEach((racer) => {
  racer.readyBtn.addEventListener("click", () => markReady(racer));
  racer.paddleBtn.addEventListener("click", () => paddle(racer));
});

resetBtn.addEventListener("click", resetGame);

resetGame();
