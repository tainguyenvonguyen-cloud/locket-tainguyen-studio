// Locket AI & Photobooth Studio - Complete Logic

const FILTERS = [
  { id: "normal", name: "✨ Gốc", css: "none" },
  { id: "locketglow", name: "💛 Locket Glow", css: "brightness(1.07) contrast(1.04) saturate(1.18)" },
  { id: "softpastel", name: "🌸 Pastel Mịn", css: "brightness(1.1) contrast(0.94) saturate(1.08) hue-rotate(-4deg)" },
  { id: "film90s", name: "🎞️ Film 90s", css: "contrast(1.12) saturate(0.88) sepia(0.22) brightness(1.03)" },
  { id: "warmsunset", name: "🌅 Hoàng Hôn", css: "brightness(1.05) contrast(1.08) saturate(1.3) sepia(0.15)" },
  { id: "coolnight", name: "🌙 Đêm Chill", css: "brightness(0.98) contrast(1.16) saturate(1.12) hue-rotate(8deg)" },
  { id: "bwclassic", name: "🖤 Trắng Đen", css: "grayscale(1) contrast(1.2) brightness(1.04)" }
];

const FALLBACK_CAPTIONS = {
  genz: [
    "Giao diện tỉnh táo nhưng hệ điều hành đang treo 🫠",
    "Báo cáo: Hôm nay vẫn đẹp trai/xinh gái bình thường ✨",
    "Photobooth 4 tấm nhưng tấm nào cũng 10 điểm 😎",
    "Tình trạng tài chính: Chỉ đủ tiền up Locket 💸"
  ],
  cute: [
    "Gửi chút vitamin đáng yêu cho ngày của cậu nè 💛",
    "Nhìn ảnh thôi đừng nhìn lâu kẻo thích đấy 🥰",
    "Trời hôm nay nhiều mây, còn tớ thì nhớ cậu ☁️✨",
    "Order một cốc trà sữa, tiện thể order luôn nụ cười của cậu 🧋"
  ],
  chill: [
    "Một chút bình yên giữa ngày dài vội vã 🌿",
    "Gió chiều thổi nhẹ, tâm trạng cũng dịu theo 🌙",
    "Lưu lại khoảnh khắc nhỏ trước khi ngày trôi qua ✨",
    "Không cần ồn ào, chỉ cần đúng tần số 🎧"
  ],
  roast: [
    "Filter râu này nhìn uy tín hơn hẳn ngoài đời 🧔😂",
    "Ai đang xem ảnh này người đó nợ mình chầu nước nhé 🧋",
    "Góc mặt này xứng đáng được lên trang nhất Locket 🔥",
    "Đừng zoom kỹ, chỉ là AI đang gánh còng lưng thôi 😂"
  ]
};

const state = {
  stream: null,
  facingMode: "user",
  isMirrored: true,
  flashEnabled: false,
  selectedFilter: FILTERS[0],
  cameraMode: "normal", // 'normal' | 'aistyle' | 'sticker' | 'photobooth' | 'cinema'
  selectedSticker: "beard", // 'beard' | 'mustache' | 'glasses' | 'crown' | 'cat'
  selectedVibe: "genz",
  badgeStyle: "classic",
  capturedImageSource: null,
  aiMoodTag: "✨ AI Vibe: 99% Cuốn hút",
  geminiApiKey: localStorage.getItem("LOCKET_AI_GEMINI_KEY") || "",
  isCapturingPhotobooth: false
};

// DOM Elements
const cameraStream = document.getElementById("cameraStream");
const liveOverlayCanvas = document.getElementById("liveOverlayCanvas");
const liveOverlayCtx = liveOverlayCanvas.getContext("2d");
const photoCanvas = document.getElementById("photoCanvas");
const ctx = photoCanvas.getContext("2d");

const countdownOverlay = document.getElementById("countdownOverlay");
const countdownNumber = document.getElementById("countdownNumber");
const photoboothStepText = document.getElementById("photoboothStepText");

const flashOverlay = document.getElementById("flashOverlay");
const aiScanOverlay = document.getElementById("aiScanOverlay");
const frameBottomDock = document.getElementById("frameBottomDock");
const stickerPickerBar = document.getElementById("stickerPickerBar");
const activeModeText = document.getElementById("activeModeText");
const aiStatusText = document.getElementById("aiStatusText");

const cameraControlsSection = document.getElementById("cameraControlsSection");
const editorControlsSection = document.getElementById("editorControlsSection");
const liveFilterStrip = document.getElementById("liveFilterStrip");
const editorFilterStrip = document.getElementById("editorFilterStrip");

const btnShutter = document.getElementById("btnShutter");
const btnSwitchCamera = document.getElementById("btnSwitchCamera");
const btnToggleFlash = document.getElementById("btnToggleFlash");
const btnToggleMirror = document.getElementById("btnToggleMirror");
const fileUploadInput = document.getElementById("fileUploadInput");

const captionInput = document.getElementById("captionInput");
const btnGenerateCaption = document.getElementById("btnGenerateCaption");
const btnAutoEnhanceAI = document.getElementById("btnAutoEnhanceAI");
const aiSuggestionsContainer = document.getElementById("aiSuggestionsContainer");

const btnRetake = document.getElementById("btnRetake");
const btnOpenLocketApp = document.getElementById("btnOpenLocketApp");
const btnShareOrSave = document.getElementById("btnShareOrSave");

const settingsModal = document.getElementById("settingsModal");
const btnOpenAIModal = document.getElementById("btnOpenAIModal");
const btnCloseSettings = document.getElementById("btnCloseSettings");
const geminiApiKeyInput = document.getElementById("geminiApiKeyInput");
const btnSaveApiKey = document.getElementById("btnSaveApiKey");
const btnClearApiKey = document.getElementById("btnClearApiKey");

const shortcutModal = document.getElementById("shortcutModal");
const btnOpenShortcutGuide = document.getElementById("btnOpenShortcutGuide");
const btnCloseShortcutModal = document.getElementById("btnCloseShortcutModal");
const btnGotItShortcut = document.getElementById("btnGotItShortcut");

const toastEl = document.getElementById("toast");

function init() {
  renderFilterStrips();
  updateStatusHeader();
  startCamera();
  bindEvents();
  drawLiveModeOverlay();
}

function updateStatusHeader() {
  if (state.geminiApiKey) {
    aiStatusText.textContent = "🟢 Đã kết nối Gemini Vision AI ⌄";
  } else {
    aiStatusText.textContent = "Lịch sử & Trợ lý AI ⌄";
  }
}

function renderFilterStrips() {
  [liveFilterStrip, editorFilterStrip].forEach((container) => {
    container.innerHTML = "";
    FILTERS.forEach((f) => {
      const btn = document.createElement("button");
      btn.className = `filter-pill ${f.id === state.selectedFilter.id ? "active" : ""}`;
      btn.textContent = f.name;
      btn.addEventListener("click", () => selectFilter(f));
      container.appendChild(btn);
    });
  });
}

function selectFilter(filterObj) {
  state.selectedFilter = filterObj;
  cameraStream.style.filter = filterObj.css;
  renderFilterStrips();
  if (state.capturedImageSource) {
    renderCanvasOutput();
  }
}

async function startCamera() {
  if (state.stream) {
    state.stream.getTracks().forEach((t) => t.stop());
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: state.facingMode,
        width: { ideal: 1080 },
        height: { ideal: 1080 }
      }
    });
    state.stream = stream;
    cameraStream.srcObject = stream;
    cameraStream.classList.toggle("mirrored", state.isMirrored);
  } catch (err) {
    console.warn("Chế độ không có camera vật lý, dùng khung Demo:", err);
  }
}

// Switch between the 4 dock modes (👑👕, 🧔, 🎞️, 🎬)
function setCameraMode(mode) {
  state.cameraMode = mode;

  document.querySelectorAll(".dock-icon-btn[data-mode]").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.mode === mode);
  });

  stickerPickerBar.classList.toggle("hidden", mode !== "sticker");

  const modeLabels = {
    normal: "✨ Chế độ: Chụp chuẩn Locket (Bấm 🧔, 🎞️, 🎬 trên khung ảnh để đổi)",
    aistyle: "👑👕 Chế độ AI Style: Tự động phủ màu AI Glow & tạo Caption thông minh",
    sticker: "🧔 Chế độ Filter Râu & Phụ kiện: Căn mặt vào khung ngắm để ghép!",
    photobooth: "🎞️ Chế độ Photobooth: Bấm chụp để đếm ngược 4 tấm ghép khung tự động!",
    cinema: "🎬 Chế độ Điện ảnh: Khung phim REC + Dấu thời gian"
  };

  activeModeText.textContent = modeLabels[mode] || modeLabels.normal;

  if (mode === "aistyle") {
    selectFilter(FILTERS[1]); // Locket Glow
  } else if (mode === "photobooth") {
    selectFilter(FILTERS[3]); // Film 90s
  }

  drawLiveModeOverlay();
}

// Draw Live AR Sticker / Cinema / Photobooth guides onto #liveOverlayCanvas
function drawLiveModeOverlay() {
  liveOverlayCtx.clearRect(0, 0, 1080, 1080);

  if (state.cameraMode === "sticker") {
    drawStickerGraphic(liveOverlayCtx, state.selectedSticker, true);
  } else if (state.cameraMode === "cinema") {
    drawCinemaFrame(liveOverlayCtx);
  } else if (state.cameraMode === "aistyle") {
    drawAIStyleFrame(liveOverlayCtx);
  } else if (state.cameraMode === "photobooth") {
    drawPhotoboothGuide(liveOverlayCtx);
  }
}

function drawStickerGraphic(context, stickerType, showGuideRing = false) {
  context.save();

  if (showGuideRing) {
    context.strokeStyle = "rgba(255, 255, 255, 0.22)";
    context.lineWidth = 3;
    context.setLineDash([12, 10]);
    context.beginPath();
    context.ellipse(540, 490, 210, 270, 0, 0, Math.PI * 2);
    context.stroke();
    context.setLineDash([]);
  }

  context.textAlign = "center";
  context.textBaseline = "middle";

  if (stickerType === "beard") {
    // Draw stylized vector beard + mustache around chin/mouth area
    context.fillStyle = "#231815";
    context.strokeStyle = "#ffffff";
    context.lineWidth = 8;

    // Mustache
    context.beginPath();
    context.moveTo(540, 560);
    context.bezierCurveTo(460, 535, 390, 575, 375, 610);
    context.bezierCurveTo(435, 615, 495, 595, 540, 580);
    context.bezierCurveTo(585, 595, 645, 615, 705, 610);
    context.bezierCurveTo(690, 575, 620, 535, 540, 560);
    context.closePath();
    context.stroke();
    context.fill();

    // Full Beard chin arc
    context.beginPath();
    context.moveTo(355, 565);
    context.bezierCurveTo(345, 725, 440, 810, 540, 815);
    context.bezierCurveTo(640, 810, 735, 725, 725, 565);
    context.bezierCurveTo(695, 645, 635, 705, 540, 705);
    context.bezierCurveTo(445, 705, 385, 645, 355, 565);
    context.closePath();
    context.stroke();
    context.fill();
  } else if (stickerType === "mustache") {
    context.fillStyle = "#1f1612";
    context.strokeStyle = "#ffffff";
    context.lineWidth = 7;
    context.beginPath();
    context.moveTo(540, 575);
    context.bezierCurveTo(450, 535, 360, 580, 345, 615);
    context.bezierCurveTo(420, 630, 485, 605, 540, 592);
    context.bezierCurveTo(595, 605, 660, 630, 735, 615);
    context.bezierCurveTo(720, 580, 630, 535, 540, 575);
    context.closePath();
    context.stroke();
    context.fill();
  } else if (stickerType === "glasses") {
    context.font = "260px sans-serif";
    context.fillText("🕶️", 540, 440);
  } else if (stickerType === "crown") {
    context.font = "220px sans-serif";
    context.fillText("👑", 540, 220);
  } else if (stickerType === "cat") {
    context.font = "210px sans-serif";
    context.fillText("🐱", 540, 235);
  }

  context.restore();
}

function drawCinemaFrame(context) {
  context.save();
  context.fillStyle = "rgba(0, 0, 0, 0.72)";
  context.fillRect(0, 0, 1080, 110);
  context.fillRect(0, 970, 1080, 110);

  // REC badge
  context.fillStyle = "#ef4444";
  context.beginPath();
  context.arc(86, 56, 13, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = "#ffffff";
  context.font = "700 28px monospace";
  context.textAlign = "left";
  context.fillText("REC  00:04:20", 112, 65);

  const now = new Date();
  const dateStr = now.toLocaleDateString("vi-VN");
  context.textAlign = "right";
  context.fillText(`🎬 LOCKET CAM • ${dateStr}`, 1020, 65);
  context.restore();
}

function drawAIStyleFrame(context) {
  context.save();
  const grad = context.createLinearGradient(0, 0, 1080, 1080);
  grad.addColorStop(0, "rgba(255, 184, 0, 0.22)");
  grad.addColorStop(0.5, "rgba(139, 92, 246, 0.1)");
  grad.addColorStop(1, "rgba(236, 72, 153, 0.22)");
  context.fillStyle = grad;
  context.fillRect(0, 0, 1080, 1080);

  context.fillStyle = "rgba(20, 20, 28, 0.75)";
  roundRect(context, 330, 34, 420, 56, 28);
  context.fill();

  context.fillStyle = "#ffb800";
  context.font = "700 24px -apple-system, sans-serif";
  context.textAlign = "center";
  context.fillText("👑 AI ROYAL GLOW FILTER", 540, 70);
  context.restore();
}

function drawPhotoboothGuide(context) {
  context.save();
  context.strokeStyle = "rgba(255, 255, 255, 0.25)";
  context.lineWidth = 3;
  context.setLineDash([10, 10]);
  context.beginPath();
  context.moveTo(540, 0);
  context.lineTo(540, 1080);
  context.moveTo(0, 540);
  context.lineTo(1080, 540);
  context.stroke();
  context.restore();
}

function triggerScreenFlash() {
  if (!state.flashEnabled && state.cameraMode !== "photobooth") return Promise.resolve();
  return new Promise((resolve) => {
    flashOverlay.classList.add("active");
    setTimeout(() => {
      resolve();
      setTimeout(() => flashOverlay.classList.remove("active"), 180);
    }, 140);
  });
}

// Capture a single 1080x1080 frame from video (or fallback demo)
function grabSingleVideoFrame(stepIndex = 0) {
  const offscreen = document.createElement("canvas");
  offscreen.width = 1080;
  offscreen.height = 1080;
  const offCtx = offscreen.getContext("2d");

  if (state.stream && cameraStream.videoWidth > 0) {
    const vw = cameraStream.videoWidth;
    const vh = cameraStream.videoHeight;
    const size = Math.min(vw, vh);
    const sx = (vw - size) / 2;
    const sy = (vh - size) / 2;

    offCtx.save();
    if (state.isMirrored) {
      offCtx.translate(1080, 0);
      offCtx.scale(-1, 1);
    }
    offCtx.drawImage(cameraStream, sx, sy, size, size, 0, 0, 1080, 1080);
    offCtx.restore();
  } else {
    const palettes = [
      ["#1f2937", "#4f46e5", "#f59e0b"],
      ["#0f172a", "#be185d", "#fb923c"],
      ["#1e1b4b", "#0284c7", "#34d399"],
      ["#31102f", "#7c3aed", "#facc15"]
    ];
    const pal = palettes[stepIndex % palettes.length];
    const grad = offCtx.createLinearGradient(0, 0, 1080, 1080);
    grad.addColorStop(0, pal[0]);
    grad.addColorStop(0.5, pal[1]);
    grad.addColorStop(1, pal[2]);
    offCtx.fillStyle = grad;
    offCtx.fillRect(0, 0, 1080, 1080);

    offCtx.fillStyle = "rgba(255,255,255,0.14)";
    offCtx.beginPath();
    offCtx.arc(540, 480, 210, 0, Math.PI * 2);
    offCtx.fill();

    const emojis = ["😎✨", "😜✌️", "🥰💛", "🤩🔥"];
    offCtx.font = "bold 120px sans-serif";
    offCtx.textAlign = "center";
    offCtx.fillText(emojis[stepIndex % emojis.length], 540, 515);
  }

  return offscreen;
}

async function handleShutterClick() {
  if (state.isCapturingPhotobooth) return;

  if (state.cameraMode === "photobooth") {
    await capturePhotobooth4Shots();
  } else {
    await triggerScreenFlash();
    const frame = grabSingleVideoFrame(0);

    // Bake mode-specific graphic onto the captured frame
    const fCtx = frame.getContext("2d");
    if (state.cameraMode === "sticker") {
      drawStickerGraphic(fCtx, state.selectedSticker, false);
    } else if (state.cameraMode === "cinema") {
      drawCinemaFrame(fCtx);
    } else if (state.cameraMode === "aistyle") {
      drawAIStyleFrame(fCtx);
    }

    state.capturedImageSource = frame;
    enterEditorMode();
  }
}

// 4-Shot Photobooth Mode (🎞️)
async function capturePhotobooth4Shots() {
  state.isCapturingPhotobooth = true;
  countdownOverlay.classList.remove("hidden");
  frameBottomDock.classList.add("hidden");

  const shots = [];

  for (let i = 0; i < 4; i++) {
    photoboothStepText.textContent = `🎞️ Photobooth: Tấm ${i + 1} / 4`;
    for (let sec = 3; sec >= 1; sec--) {
      countdownNumber.textContent = String(sec);
      await new Promise((r) => setTimeout(r, 550));
    }
    countdownNumber.textContent = "📸";
    await triggerScreenFlash();
    shots.push(grabSingleVideoFrame(i));
    await new Promise((r) => setTimeout(r, 250));
  }

  countdownOverlay.classList.add("hidden");
  frameBottomDock.classList.remove("hidden");
  state.isCapturingPhotobooth = false;

  // Compose 2x2 Photobooth Collage inside 1080x1080 Locket Square
  const collage = document.createElement("canvas");
  collage.width = 1080;
  collage.height = 1080;
  const cCtx = collage.getContext("2d");

  // Dark film background
  cCtx.fillStyle = "#111318";
  cCtx.fillRect(0, 0, 1080, 1080);

  const gap = 24;
  const pad = 36;
  const cellSize = (1080 - pad * 2 - gap) / 2; // 492px

  const positions = [
    [pad, pad],
    [pad + cellSize + gap, pad],
    [pad, pad + cellSize + gap],
    [pad + cellSize + gap, pad + cellSize + gap]
  ];

  shots.forEach((shotCanvas, idx) => {
    const [x, y] = positions[idx];
    cCtx.save();
    roundRect(cCtx, x, y, cellSize, cellSize, 26);
    cCtx.clip();
    cCtx.drawImage(shotCanvas, 0, 0, 1080, 1080, x, y, cellSize, cellSize);
    cCtx.restore();

    cCtx.strokeStyle = "rgba(255, 255, 255, 0.22)";
    cCtx.lineWidth = 3;
    roundRect(cCtx, x, y, cellSize, cellSize, 26);
    cCtx.stroke();
  });

  // Center Photobooth badge
  cCtx.fillStyle = "#ffb800";
  roundRect(cCtx, 420, 514, 240, 52, 26);
  cCtx.fill();
  cCtx.fillStyle = "#0d131a";
  cCtx.font = "800 22px -apple-system, sans-serif";
  cCtx.textAlign = "center";
  cCtx.textBaseline = "middle";
  cCtx.fillText("🎞️ PHOTOBOOTH", 540, 540);

  state.capturedImageSource = collage;
  enterEditorMode();
}

function handleFileUpload(e) {
  const file = e.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (ev) => {
    const img = new Image();
    img.onload = () => {
      const offscreen = document.createElement("canvas");
      offscreen.width = 1080;
      offscreen.height = 1080;
      const offCtx = offscreen.getContext("2d");

      const size = Math.min(img.width, img.height);
      const sx = (img.width - size) / 2;
      const sy = (img.height - size) / 2;
      offCtx.drawImage(img, sx, sy, size, size, 0, 0, 1080, 1080);

      if (state.cameraMode === "sticker") {
        drawStickerGraphic(offCtx, state.selectedSticker, false);
      } else if (state.cameraMode === "cinema") {
        drawCinemaFrame(offCtx);
      } else if (state.cameraMode === "aistyle") {
        drawAIStyleFrame(offCtx);
      }

      state.capturedImageSource = offscreen;
      enterEditorMode();
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
}

function enterEditorMode() {
  cameraStream.classList.add("hidden");
  liveOverlayCanvas.classList.add("hidden");
  frameBottomDock.classList.add("hidden");
  stickerPickerBar.classList.add("hidden");
  photoCanvas.classList.remove("hidden");

  cameraControlsSection.classList.add("hidden");
  editorControlsSection.classList.remove("hidden");

  if (!captionInput.value.trim()) {
    const pool = FALLBACK_CAPTIONS[state.selectedVibe];
    captionInput.value = pool[Math.floor(Math.random() * pool.length)];
  }

  renderCanvasOutput();
  generateAICaptions();
}

function returnToCameraMode() {
  state.capturedImageSource = null;
  photoCanvas.classList.add("hidden");
  cameraStream.classList.remove("hidden");
  liveOverlayCanvas.classList.remove("hidden");
  frameBottomDock.classList.remove("hidden");
  stickerPickerBar.classList.toggle("hidden", state.cameraMode !== "sticker");

  editorControlsSection.classList.add("hidden");
  cameraControlsSection.classList.remove("hidden");
  aiSuggestionsContainer.classList.add("hidden");
}

function getOverlayDisplayText() {
  const rawCaption = captionInput.value.trim();
  if (state.badgeStyle === "none") return "";
  if (state.badgeStyle === "aimood") {
    return rawCaption ? `${state.aiMoodTag} • ${rawCaption}` : state.aiMoodTag;
  }
  if (state.badgeStyle === "timestamp") {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, "0");
    const mm = String(now.getMinutes()).padStart(2, "0");
    return rawCaption ? `🕒 ${hh}:${mm} • ${rawCaption}` : `🕒 ${hh}:${mm} • 26°C ✨`;
  }
  return rawCaption;
}

function renderCanvasOutput() {
  if (!state.capturedImageSource) return;

  ctx.save();
  ctx.clearRect(0, 0, 1080, 1080);
  ctx.filter = state.selectedFilter.css;
  ctx.drawImage(state.capturedImageSource, 0, 0, 1080, 1080);
  ctx.restore();

  const displayText = getOverlayDisplayText();
  if (displayText && state.badgeStyle !== "none") {
    drawLocketPillOnCanvas(ctx, displayText);
  }
}

function drawLocketPillOnCanvas(context, text) {
  context.save();
  context.font = "600 34px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";

  const maxTextWidth = 880;
  let clipped = text;
  while (context.measureText(clipped).width > maxTextWidth && clipped.length > 5) {
    clipped = clipped.slice(0, -2) + "…";
  }

  const textWidth = context.measureText(clipped).width;
  const padX = 46;
  const pillW = Math.min(960, textWidth + padX * 2);
  const pillH = 78;
  const pillX = (1080 - pillW) / 2;
  const pillY = 1080 - pillH - 54;

  context.fillStyle = "rgba(15, 18, 26, 0.75)";
  roundRect(context, pillX, pillY, pillW, pillH, 39);
  context.fill();

  context.lineWidth = 2.5;
  context.strokeStyle = "rgba(255, 255, 255, 0.22)";
  context.stroke();

  context.fillStyle = "#ffffff";
  context.fillText(clipped, 540, pillY + pillH / 2 + 2);
  context.restore();
}

function roundRect(context, x, y, w, h, r) {
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + w, y, x + w, y + h, r);
  context.arcTo(x + w, y + h, x, y + h, r);
  context.arcTo(x, y + h, x, y, r);
  context.arcTo(x, y, x + w, y, r);
  context.closePath();
}

async function runAutoEnhanceAI() {
  if (!state.capturedImageSource) return;

  aiScanOverlay.classList.remove("hidden");

  const sampleCtx = state.capturedImageSource.getContext("2d");
  const imgData = sampleCtx.getImageData(0, 0, 1080, 1080).data;
  let totalLum = 0;
  const step = 4 * 40;
  let count = 0;
  for (let i = 0; i < imgData.length; i += step) {
    totalLum += 0.299 * imgData[i] + 0.587 * imgData[i + 1] + 0.114 * imgData[i + 2];
    count++;
  }
  const avgLum = totalLum / count;

  await new Promise((r) => setTimeout(r, 600));

  let recommendedFilter = FILTERS[1];
  if (avgLum < 85) {
    recommendedFilter = FILTERS[2];
    state.aiMoodTag = "🌙 Night Vibe: 98% Chill";
  } else if (avgLum > 175) {
    recommendedFilter = FILTERS[3];
    state.aiMoodTag = "☀️ Sunny Vibe: 100% Rực rỡ";
  } else {
    recommendedFilter = FILTERS[1];
    state.aiMoodTag = "✨ Visual Check: 100% Đỉnh";
  }

  selectFilter(recommendedFilter);
  aiScanOverlay.classList.add("hidden");
  showToast(`🪄 Đã tối ưu màu "${recommendedFilter.name}" & nhãn AI!`);
}

async function generateAICaptions() {
  if (!state.capturedImageSource) return;

  btnGenerateCaption.disabled = true;
  btnGenerateCaption.textContent = "⏳...";
  aiScanOverlay.classList.remove("hidden");

  try {
    let suggestions = [];

    if (state.geminiApiKey) {
      suggestions = await fetchGeminiVisionCaptions(
        state.capturedImageSource,
        state.selectedVibe,
        state.geminiApiKey
      );
    } else {
      await new Promise((r) => setTimeout(r, 450));
      suggestions = [...FALLBACK_CAPTIONS[state.selectedVibe]];
    }

    renderSuggestions(suggestions);
    if (suggestions.length > 0) {
      captionInput.value = suggestions[0];
      renderCanvasOutput();
    }
  } catch (err) {
    console.error("Lỗi gọi Gemini API:", err);
    const fallback = [...FALLBACK_CAPTIONS[state.selectedVibe]];
    renderSuggestions(fallback);
  } finally {
    btnGenerateCaption.disabled = false;
    btnGenerateCaption.textContent = "✨ AI Viết";
    aiScanOverlay.classList.add("hidden");
  }
}

async function fetchGeminiVisionCaptions(sourceCanvas, vibe, apiKey) {
  const dataUrl = sourceCanvas.toDataURL("image/jpeg", 0.75);
  const base64Image = dataUrl.split(",")[1];

  const vibeDescriptions = {
    genz: "hài hước, bắt trend Gen Z Việt Nam, tự nhiên, dí dỏm",
    cute: "dễ thương, ngọt ngào, thả thính nhẹ nhàng",
    chill: "chill, sâu lắng, thơ mộng, tâm trạng nhẹ nhàng",
    roast: "trêu chọc bạn bè vui nhộn, lầy lội trên Locket"
  };

  const prompt = `Bạn là trợ lý viết caption ảnh Locket cho giới trẻ Việt Nam.
Hãy nhìn bức ảnh này và viết đúng 4 câu caption ngắn gọn (dưới 65 ký tự mỗi câu, có kèm 1-2 emoji phù hợp) theo phong cách: ${vibeDescriptions[vibe] || vibeDescriptions.genz}.
Chỉ trả về đúng 4 dòng, mỗi dòng 1 câu caption, không đánh số thứ tự, không giải thích thêm.`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: prompt },
            {
              inline_data: {
                mime_type: "image/jpeg",
                data: base64Image
              }
            }
          ]
        }
      ]
    })
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const data = await res.json();
  const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
  const lines = rawText
    .split("\n")
    .map((l) => l.replace(/^[-*•\d.)\s]+/, "").trim())
    .filter((l) => l.length > 0)
    .slice(0, 4);

  return lines.length > 0 ? lines : FALLBACK_CAPTIONS[vibe];
}

function renderSuggestions(list) {
  aiSuggestionsContainer.innerHTML = "";
  list.forEach((text) => {
    const btn = document.createElement("button");
    btn.className = "suggestion-item";
    btn.textContent = `✨ ${text}`;
    btn.addEventListener("click", () => {
      captionInput.value = text;
      renderCanvasOutput();
      showToast("Đã gắn caption lên ảnh!");
    });
    aiSuggestionsContainer.appendChild(btn);
  });
  aiSuggestionsContainer.classList.remove("hidden");
}

async function shareOrSavePhoto() {
  renderCanvasOutput();

  const captionText = captionInput.value.trim();
  if (captionText && navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(captionText);
    } catch (_) {}
  }

  photoCanvas.toBlob(async (blob) => {
    if (!blob) return;
    const file = new File([blob], `locket-ai-${Date.now()}.png`, { type: "image/png" });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: "Locket AI Photo",
          text: captionText
        });
        showToast("✅ Đã chia sẻ & copy sẵn caption!");
        return;
      } catch (err) {
        if (err.name === "AbortError") return;
      }
    }

    const link = document.createElement("a");
    link.download = file.name;
    link.href = URL.createObjectURL(blob);
    link.click();
    URL.revokeObjectURL(link.href);
    showToast("📥 Đã lưu ảnh 1080x1080 & copy sẵn caption!");
  }, "image/png");
}

function showToast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.remove("hidden");
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => {
    toastEl.classList.add("hidden");
  }, 2600);
}

function bindEvents() {
  btnShutter.addEventListener("click", handleShutterClick);

  btnSwitchCamera.addEventListener("click", () => {
    state.facingMode = state.facingMode === "user" ? "environment" : "user";
    state.isMirrored = state.facingMode === "user";
    btnToggleMirror.classList.toggle("active", state.isMirrored);
    startCamera();
  });

  btnToggleFlash.addEventListener("click", () => {
    state.flashEnabled = !state.flashEnabled;
    btnToggleFlash.classList.toggle("active", state.flashEnabled);
    showToast(state.flashEnabled ? "⚡ Đã bật Flash màn hình" : "⚡ Đã tắt Flash màn hình");
  });

  btnToggleMirror.addEventListener("click", () => {
    state.isMirrored = !state.isMirrored;
    btnToggleMirror.classList.toggle("active", state.isMirrored);
    cameraStream.classList.toggle("mirrored", state.isMirrored);
  });

  // Dock mode buttons (👑👕, 🧔, 🎞️, 🎬, ✕)
  document.querySelectorAll(".dock-icon-btn[data-mode]").forEach((btn) => {
    btn.addEventListener("click", () => {
      setCameraMode(btn.dataset.mode);
    });
  });

  document.getElementById("btnResetMode").addEventListener("click", () => {
    setCameraMode("normal");
    selectFilter(FILTERS[0]);
  });

  // Sticker sub-picker chips
  document.querySelectorAll("#stickerPickerBar .sub-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      document.querySelectorAll("#stickerPickerBar .sub-chip").forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
      state.selectedSticker = chip.dataset.sticker;
      drawLiveModeOverlay();
    });
  });

  fileUploadInput.addEventListener("change", handleFileUpload);

  captionInput.addEventListener("input", () => {
    renderCanvasOutput();
  });

  btnGenerateCaption.addEventListener("click", generateAICaptions);
  btnAutoEnhanceAI.addEventListener("click", runAutoEnhanceAI);

  document.querySelectorAll(".vibe-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      document.querySelectorAll(".vibe-chip").forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
      state.selectedVibe = chip.dataset.vibe;
      generateAICaptions();
    });
  });

  document.querySelectorAll(".badge-style-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".badge-style-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      state.badgeStyle = btn.dataset.style;
      renderCanvasOutput();
    });
  });

  btnRetake.addEventListener("click", returnToCameraMode);

  btnOpenLocketApp.addEventListener("click", (e) => {
    const ua = navigator.userAgent || "";
    const isAndroid = /Android/i.test(ua);
    const isIOS = /iPhone|iPad|iPod/i.test(ua);

    if (isAndroid) {
      e.preventDefault();
      showToast("📲 Đang mở ứng dụng Locket trên Android...");
      window.location.href =
        "intent://locket.camera/#Intent;scheme=https;package=com.locket.Locket;S.browser_fallback_url=https%3A%2F%2Flocket.camera;end";
    } else if (isIOS) {
      showToast("📲 Đang gọi Universal Link mở Locket...");
    } else {
      showToast("📲 Đang mở trang Locket...");
    }
  });

  btnShareOrSave.addEventListener("click", shareOrSavePhoto);

  // Modals
  btnOpenAIModal.addEventListener("click", () => {
    geminiApiKeyInput.value = state.geminiApiKey;
    settingsModal.classList.remove("hidden");
  });

  btnCloseSettings.addEventListener("click", () => {
    settingsModal.classList.add("hidden");
  });

  btnSaveApiKey.addEventListener("click", () => {
    state.geminiApiKey = geminiApiKeyInput.value.trim();
    localStorage.setItem("LOCKET_AI_GEMINI_KEY", state.geminiApiKey);
    updateStatusHeader();
    settingsModal.classList.add("hidden");
    showToast("✅ Đã lưu cấu hình Gemini AI Key!");
  });

  btnClearApiKey.addEventListener("click", () => {
    state.geminiApiKey = "";
    geminiApiKeyInput.value = "";
    localStorage.removeItem("LOCKET_AI_GEMINI_KEY");
    updateStatusHeader();
    showToast("Đã xóa Gemini API Key");
  });

  btnOpenShortcutGuide.addEventListener("click", () => {
    shortcutModal.classList.remove("hidden");
  });

  btnCloseShortcutModal.addEventListener("click", () => {
    shortcutModal.classList.add("hidden");
  });

  btnGotItShortcut.addEventListener("click", () => {
    shortcutModal.classList.add("hidden");
  });
}

document.addEventListener("DOMContentLoaded", init);
