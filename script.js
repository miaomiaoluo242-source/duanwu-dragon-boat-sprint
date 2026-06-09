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
const createRoomBtn = document.getElementById("createRoomBtn");
const joinRoomBtn = document.getElementById("joinRoomBtn");
const localModeBtn = document.getElementById("localModeBtn");
const leaveRoomBtn = document.getElementById("leaveRoomBtn");
const roomInput = document.getElementById("roomInput");
const roomCodeDisplay = document.getElementById("roomCodeDisplay");
const connectionStatusEl = document.getElementById("connectionStatus");

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

const network = {
  mode: "local",
  peer: null,
  conn: null,
  roomCode: "",
  connected: false,
  localRacerId: null
};

let phase = "waiting";
let countdownTimerId = null;
let raceTimerId = null;
let raceStartedAt = 0;
let remoteRaceElapsed = 0;
let countdownValue = "";
let trackItems = [];
let currentMessage = "";
let currentMessageType = "";
let suppressBroadcast = false;

function distanceToLeft(distance) {
  const ratio = Math.min(distance / RACE_DISTANCE, 1);
  return START_LEFT + ratio * (FINISH_LEFT - START_LEFT);
}

function setMessage(text, type = "") {
  currentMessage = text;
  currentMessageType = type;
  messageEl.textContent = text;
  messageEl.className = `message-area ${type}`.trim();
}

function clearTimers() {
  clearInterval(countdownTimerId);
  clearInterval(raceTimerId);
  countdownTimerId = null;
  raceTimerId = null;
}

function canControl(racer) {
  if (network.mode === "local") {
    return true;
  }

  return network.localRacerId === racer.id && (network.mode === "host" || network.connected);
}

function isHostAuthority() {
  return network.mode === "local" || network.mode === "host";
}

function updateDisplay() {
  racers.forEach((racer) => {
    racer.distanceEl.textContent = Math.floor(Math.min(racer.progress, RACE_DISTANCE));
    racer.scoreEl.textContent = racer.score;
    racer.boatEl.style.left = `${distanceToLeft(racer.progress)}%`;

    if (!canControl(racer) && network.mode !== "local") {
      racer.statusEl.textContent = racer.ready ? "对方已准备" : "对方待准备";
    } else {
      racer.statusEl.textContent = racer.ready ? "已准备" : "待准备";
    }
  });

  if (phase === "racing") {
    const elapsed = network.mode === "guest" ? remoteRaceElapsed : (Date.now() - raceStartedAt) / 1000;
    raceTimeEl.textContent = elapsed.toFixed(1);
  }

  updateControlAvailability();
}

function updateControlAvailability() {
  racers.forEach((racer) => {
    const localPlayerCanAct = canControl(racer);
    racer.readyBtn.disabled = phase !== "waiting" || racer.ready || !localPlayerCanAct;
    racer.paddleBtn.disabled = phase !== "racing" || !localPlayerCanAct;
  });

  resetBtn.disabled = false;
}

function updateNetworkUI() {
  const peerAvailable = Boolean(getPeerConstructor());
  const roomText = network.roomCode || "未创建";
  roomCodeDisplay.textContent = roomText;
  roomCodeDisplay.disabled = !network.roomCode;

  createRoomBtn.disabled = !peerAvailable || network.mode !== "local";
  joinRoomBtn.disabled = !peerAvailable || network.mode !== "local";
  roomInput.disabled = !peerAvailable || network.mode !== "local";
  localModeBtn.disabled = network.mode === "local";
  leaveRoomBtn.disabled = network.mode === "local";

  if (!peerAvailable) {
    connectionStatusEl.textContent = "联机脚本加载失败";
    return;
  }

  if (network.mode === "local") {
    connectionStatusEl.textContent = "同屏模式";
  } else if (network.mode === "host" && network.connected) {
    connectionStatusEl.textContent = "房主已连接";
  } else if (network.mode === "host") {
    connectionStatusEl.textContent = "等待青队加入";
  } else if (network.connected) {
    connectionStatusEl.textContent = "青队已连接";
  } else {
    connectionStatusEl.textContent = "正在连接";
  }
}

function resetGame(options = {}) {
  clearTimers();
  phase = "waiting";
  countdownValue = "";
  remoteRaceElapsed = 0;
  trackItems = isHostAuthority() ? createTrackItems() : trackItems;
  countdownEl.classList.add("hidden");
  countdownEl.textContent = "";
  raceTimeEl.textContent = "0.0";
  raceStateEl.textContent = "等待准备";

  racers.forEach((racer) => {
    racer.ready = false;
    racer.progress = 0;
    racer.score = 0;
    racer.blockedUntil = 0;
    racer.readyBtn.textContent = `${racer.name}准备`;
    racer.paddleBtn.disabled = true;
    racer.boatEl.classList.remove("is-paddling", "is-hit", "is-winner");
  });

  renderTrackItems();
  setMessage("两位选手都准备好后，龙舟赛自动倒计时开跑。");
  updateDisplay();
  updateNetworkUI();

  if (options.broadcast) {
    broadcastState();
  }
}

function requestReset() {
  if (network.mode === "guest") {
    sendNetworkMessage({ type: "reset" });
    setMessage("已向房主请求重新开局。");
    return;
  }

  resetGame({ broadcast: network.mode === "host" });
}

function markReady(racer, options = {}) {
  if (phase !== "waiting" || racer.ready) {
    return;
  }

  if (!options.fromNetwork && network.mode === "guest") {
    sendNetworkMessage({ type: "ready", racerId: racer.id });
    racer.readyBtn.disabled = true;
    setMessage("已发送准备，等待房主同步。");
    return;
  }

  racer.ready = true;
  racer.readyBtn.textContent = `${racer.name}已准备`;
  updateDisplay();

  if (racers.every((item) => item.ready)) {
    startCountdown();
  } else {
    setMessage(`${racer.name}已就位，等待另一位选手确认准备。`);
    broadcastState();
  }
}

function startCountdown() {
  if (!isHostAuthority()) {
    return;
  }

  phase = "countdown";
  raceStateEl.textContent = "倒计时";
  setMessage("两队就位，龙舟即将出发！");

  let count = 3;
  countdownValue = String(count);
  countdownEl.textContent = countdownValue;
  countdownEl.classList.remove("hidden");
  updateDisplay();
  broadcastState();

  countdownTimerId = setInterval(() => {
    count -= 1;

    if (count > 0) {
      countdownValue = String(count);
      countdownEl.textContent = countdownValue;
      broadcastState();
      return;
    }

    countdownValue = "划！";
    countdownEl.textContent = countdownValue;
    broadcastState();
    clearInterval(countdownTimerId);
    countdownTimerId = null;
    setTimeout(startRace, 620);
  }, 1000);
}

function startRace() {
  if (!isHostAuthority()) {
    return;
  }

  phase = "racing";
  raceStartedAt = Date.now();
  countdownValue = "";
  countdownEl.classList.add("hidden");
  raceStateEl.textContent = "冲刺中";
  setMessage("比赛开始！穿过长赛道，避开浪花，抢先冲线。");

  raceTimerId = setInterval(() => {
    updateDisplay();
    if (network.mode === "host") {
      broadcastState();
    }
  }, 250);

  updateDisplay();
  broadcastState();
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

    if (item.used) {
      element.classList.add(item.type === "reward" ? "collected" : "hit");
    }

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

function paddle(racer, options = {}) {
  if (phase !== "racing") {
    return;
  }

  if (!options.fromNetwork && network.mode === "guest") {
    sendNetworkMessage({ type: "paddle", racerId: racer.id });
    return;
  }

  if (!isHostAuthority()) {
    return;
  }

  const now = Date.now();

  if (now < racer.blockedUntil) {
    setMessage(`${racer.name}刚撞上浪花，稍微缓一下。`, "warn");
    broadcastState();
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
    return;
  }

  broadcastState();
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
  setMessage(`${winner.name}率先冲线，赢得龙舟 PK，端午安康！`, "win");
  updateDisplay();
  broadcastState();
}

function createRoomCode() {
  return `duanwu-${Math.random().toString(36).slice(2, 7)}`;
}

function closeNetwork() {
  const currentConn = network.conn;
  const currentPeer = network.peer;

  network.mode = "local";
  network.peer = null;
  network.conn = null;
  network.roomCode = "";
  network.connected = false;
  network.localRacerId = null;

  if (currentConn) {
    currentConn.close();
  }

  if (currentPeer) {
    currentPeer.destroy();
  }

  updateNetworkUI();
}

function getNetworkErrorText(error, fallbackText) {
  const type = error?.type || "";

  if (type === "unavailable-id") {
    return "这个房间码被占用了，请重新创建房间。";
  }

  if (type === "peer-unavailable") {
    return "没有找到这个房间码，请确认房主页面还开着。";
  }

  if (["network", "server-error", "socket-error", "socket-closed"].includes(type)) {
    return "联机服务暂时连接不上，请检查网络后重试。";
  }

  return `${fallbackText}：${type || "连接错误"}`;
}

function recoverFromNetworkError(message) {
  closeNetwork();
  resetGame();
  setMessage(message, "warn");
}

function createOnlineRoom() {
  const PeerConstructor = getPeerConstructor();

  if (!PeerConstructor) {
    setMessage("联机脚本还没加载成功，请刷新页面再试。", "warn");
    updateNetworkUI();
    return;
  }

  closeNetwork();
  network.mode = "host";
  network.localRacerId = "p1";
  network.roomCode = createRoomCode();
  resetGame();
  updateNetworkUI();
  setMessage("正在创建房间，请稍等。");

  network.peer = new PeerConstructor(network.roomCode);

  network.peer.on("open", (id) => {
    network.roomCode = id;
    updateNetworkUI();
    setMessage(`房间已创建。把房间码 ${id} 发给另一位玩家。`);
  });

  network.peer.on("connection", (conn) => {
    if (network.conn && network.conn.open) {
      conn.close();
      return;
    }

    network.conn = conn;
    setupConnection(conn);
  });

  network.peer.on("error", (error) => {
    recoverFromNetworkError(getNetworkErrorText(error, "联机失败"));
  });
}

function joinOnlineRoom() {
  const PeerConstructor = getPeerConstructor();

  if (!PeerConstructor) {
    setMessage("联机脚本还没加载成功，请刷新页面再试。", "warn");
    updateNetworkUI();
    return;
  }

  const roomCode = roomInput.value.trim();

  if (!roomCode) {
    setMessage("请输入房间码。", "warn");
    return;
  }

  closeNetwork();
  network.mode = "guest";
  network.localRacerId = "p2";
  network.roomCode = roomCode;
  resetGame();
  updateNetworkUI();
  setMessage("正在加入房间，请稍等。");

  network.peer = new PeerConstructor();

  network.peer.on("open", () => {
    network.conn = network.peer.connect(roomCode, { reliable: true });
    setupConnection(network.conn);
  });

  network.peer.on("error", (error) => {
    recoverFromNetworkError(getNetworkErrorText(error, "联机失败"));
  });
}

function setupConnection(conn) {
  conn.on("open", () => {
    network.connected = true;
    updateNetworkUI();

    if (network.mode === "host") {
      setMessage("青队已加入房间，双方准备后开赛。");
      broadcastState();
    } else {
      setMessage("已加入房间，你控制青队。");
      sendNetworkMessage({ type: "hello" });
    }
  });

  conn.on("data", (data) => {
    handleNetworkData(data);
  });

  conn.on("close", () => {
    if (conn !== network.conn) {
      return;
    }

    network.conn = null;
    network.connected = false;
    updateNetworkUI();
    updateDisplay();
    setMessage("联机已断开，可重新创建或加入房间。", "warn");
  });

  conn.on("error", () => {
    if (conn !== network.conn) {
      return;
    }

    network.conn = null;
    network.connected = false;
    updateNetworkUI();
    updateDisplay();
    setMessage("联机连接出现错误。", "warn");
  });
}

function getPeerConstructor() {
  return window.Peer || window.peerjs?.Peer || globalThis.Peer || null;
}

function sendNetworkMessage(message) {
  if (network.conn && network.conn.open) {
    network.conn.send(message);
  }
}

function broadcastState() {
  if (suppressBroadcast || network.mode !== "host") {
    return;
  }

  sendNetworkMessage({
    type: "state",
    payload: serializeState()
  });
}

function serializeState() {
  return {
    phase,
    countdownValue,
    raceElapsed: phase === "racing" ? (Date.now() - raceStartedAt) / 1000 : Number(raceTimeEl.textContent) || 0,
    raceState: raceStateEl.textContent,
    message: currentMessage,
    messageType: currentMessageType,
    trackItems,
    racers: racers.map((racer) => ({
      id: racer.id,
      ready: racer.ready,
      progress: racer.progress,
      score: racer.score
    })),
    winnerId: racers.find((racer) => racer.boatEl.classList.contains("is-winner"))?.id || ""
  };
}

function applyRemoteState(state) {
  suppressBroadcast = true;
  phase = state.phase;
  countdownValue = state.countdownValue || "";
  remoteRaceElapsed = state.raceElapsed || 0;
  trackItems = state.trackItems || [];
  raceStateEl.textContent = state.raceState || "等待准备";

  racers.forEach((racer) => {
    const incoming = state.racers.find((item) => item.id === racer.id);

    if (incoming) {
      racer.ready = incoming.ready;
      racer.progress = incoming.progress;
      racer.score = incoming.score;
      racer.readyBtn.textContent = racer.ready ? `${racer.name}已准备` : `${racer.name}准备`;
      racer.boatEl.classList.toggle("is-winner", state.winnerId === racer.id);
    }
  });

  if (phase === "countdown" && countdownValue) {
    countdownEl.textContent = countdownValue;
    countdownEl.classList.remove("hidden");
  } else {
    countdownEl.classList.add("hidden");
  }

  setMessage(state.message || "联机同步中。", state.messageType || "");
  renderTrackItems();
  updateDisplay();
  suppressBroadcast = false;
}

function handleNetworkData(data) {
  if (!data || typeof data !== "object") {
    return;
  }

  if (network.mode === "host") {
    const racer = racers.find((item) => item.id === data.racerId);

    if (data.type === "ready" && racer) {
      markReady(racer, { fromNetwork: true });
    }

    if (data.type === "paddle" && racer) {
      paddle(racer, { fromNetwork: true });
    }

    if (data.type === "reset") {
      resetGame({ broadcast: true });
    }

    if (data.type === "hello") {
      broadcastState();
    }

    return;
  }

  if (data.type === "state") {
    applyRemoteState(data.payload);
  }
}

function copyRoomCode() {
  if (!network.roomCode) {
    return;
  }

  navigator.clipboard?.writeText(network.roomCode);
  setMessage(`房间码 ${network.roomCode} 已复制。`);
}

racers.forEach((racer) => {
  racer.readyBtn.addEventListener("click", () => markReady(racer));
  racer.paddleBtn.addEventListener("click", () => paddle(racer));
});

createRoomBtn.addEventListener("click", createOnlineRoom);
joinRoomBtn.addEventListener("click", joinOnlineRoom);
localModeBtn.addEventListener("click", () => {
  closeNetwork();
  resetGame();
});
leaveRoomBtn.addEventListener("click", () => {
  closeNetwork();
  resetGame();
});
resetBtn.addEventListener("click", requestReset);
roomCodeDisplay.addEventListener("click", copyRoomCode);
roomInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    joinOnlineRoom();
  }
});

resetGame();
window.addEventListener("load", updateNetworkUI);
setTimeout(updateNetworkUI, 1800);
