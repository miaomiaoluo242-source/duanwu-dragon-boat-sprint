const TOTAL_TIME = 20;
const FINISH_PROGRESS = 100;
const PADDLE_SCORE = 1;
const ZONGZI_SCORE = 5;
const FINISH_BONUS = 20;

const scoreEl = document.getElementById("score");
const timeEl = document.getElementById("time");
const progressEl = document.getElementById("progress");
const messageEl = document.getElementById("message");
const startBtn = document.getElementById("startBtn");
const paddleBtn = document.getElementById("paddleBtn");
const boatEl = document.getElementById("boat");
const zongziEl = document.getElementById("zongzi");

let timerId = null;
let rewardTimerId = null;

const state = {
  running: false,
  score: 0,
  timeLeft: TOTAL_TIME,
  progress: 0,
  reward: null
};

function updateDisplay() {
  scoreEl.textContent = state.score;
  timeEl.textContent = state.timeLeft;
  progressEl.textContent = Math.min(Math.round(state.progress), FINISH_PROGRESS);
  boatEl.style.left = `${Math.min(state.progress, 86)}%`;
}

function setMessage(text, type = "") {
  messageEl.textContent = text;
  messageEl.className = `message-area ${type}`.trim();
}

function clearTimers() {
  clearInterval(timerId);
  clearTimeout(rewardTimerId);
  timerId = null;
  rewardTimerId = null;
}

function resetGame() {
  clearTimers();
  state.running = false;
  state.score = 0;
  state.timeLeft = TOTAL_TIME;
  state.progress = 0;
  state.reward = null;
  zongziEl.classList.add("hidden");
  startBtn.textContent = "开始游戏";
  paddleBtn.disabled = true;
  setMessage("准备好了吗？按下开始，和龙舟一起出发！");
  updateDisplay();
}

function startGame() {
  clearTimers();
  state.running = true;
  state.score = 0;
  state.timeLeft = TOTAL_TIME;
  state.progress = 0;
  state.reward = null;

  startBtn.textContent = "重新开始";
  paddleBtn.disabled = false;
  zongziEl.classList.add("hidden");
  setMessage("比赛开始！快划桨，盯住河面上的粽子奖励。");
  updateDisplay();

  timerId = setInterval(() => {
    state.timeLeft -= 1;
    updateDisplay();

    if (state.timeLeft <= 0) {
      endGame(false);
    }
  }, 1000);

  scheduleReward();
}

function endGame(isWin) {
  if (!state.running) {
    return;
  }

  state.running = false;
  clearTimers();
  paddleBtn.disabled = true;
  zongziEl.classList.add("hidden");

  if (isWin) {
    state.score += FINISH_BONUS;
    state.progress = FINISH_PROGRESS;
    setMessage("恭喜你！龙舟成功冲线，端午安康！", "win");
  } else {
    setMessage("差一点就到终点啦，再试一次！", "fail");
  }

  updateDisplay();
}

function paddle() {
  if (!state.running) {
    return;
  }

  const step = 4 + Math.random() * 3.4;
  state.progress += step;
  state.score += PADDLE_SCORE;

  boatEl.classList.remove("is-paddling");
  void boatEl.offsetWidth;
  boatEl.classList.add("is-paddling");

  collectRewardIfTouched();
  updateDisplay();

  if (state.progress >= FINISH_PROGRESS) {
    endGame(true);
  }
}

function scheduleReward() {
  if (!state.running) {
    return;
  }

  const delay = 1300 + Math.random() * 1800;
  rewardTimerId = setTimeout(() => {
    showReward();
    scheduleReward();
  }, delay);
}

function showReward() {
  if (!state.running) {
    return;
  }

  const minPosition = Math.min(state.progress + 10, 78);
  const maxPosition = 88;
  const position = Math.max(minPosition, 24 + Math.random() * (maxPosition - 24));
  const laneTop = 36 + Math.random() * 26;

  state.reward = {
    position,
    collected: false
  };

  zongziEl.style.left = `${position}%`;
  zongziEl.style.top = `${laneTop}%`;
  zongziEl.classList.remove("hidden");
}

function collectReward() {
  if (!state.running || !state.reward || state.reward.collected) {
    return;
  }

  state.reward.collected = true;
  state.score += ZONGZI_SCORE;
  zongziEl.classList.add("hidden");
  setMessage("收集到粽子奖励，分数 +5！");
  updateDisplay();
}

function collectRewardIfTouched() {
  if (!state.reward || state.reward.collected) {
    return;
  }

  if (state.progress + 7 >= state.reward.position) {
    collectReward();
  }
}

startBtn.addEventListener("click", () => {
  startGame();
});

paddleBtn.addEventListener("click", paddle);
zongziEl.addEventListener("click", collectReward);

resetGame();
