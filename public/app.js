// ============================================================================
// LOCKET DIO AI STUDIO — CAMERA, PHOTOBOOTH 4 KIỂU, CAPTION STUDIO, FEED & CHAT
// ============================================================================

const state = {
  activeScreen: 'camera', // 'camera' | 'history' | 'chat' (mobile)
  camMode: 'camera', // 'camera' | 'photobooth'
  currentBase64Image: null,
  currentVideoDataUrl: null,
  currentVideoMimeType: 'video/mp4',
  originalBase64BeforeEdit: null,
  lastEnglishPrompt: '',
  selectedRecipients: [], // Rỗng = gửi cho tất cả bạn bè
  sendPrivate: false, // true = đăng riêng tư chỉ mình tôi
  locketSession: JSON.parse(localStorage.getItem('locket_session') || 'null'),
  geminiApiKey: localStorage.getItem('locket_gemini_key') || '',
  hfToken: localStorage.getItem('locket_hf_token') || '',

  friends: [],

  // Máy ảnh & Quay video trực tiếp
  cameraStream: null,
  cameraFacingMode: 'user', // 'user' (trước) | 'environment' (sau)
  cameraMirrored: true,
  cameraSourceImage: null,
  cameraAnimFrameId: null,
  cameraZoom: 1,
  micEnabled: true,
  flashEnabled: false,
  videoTapMode: false,
  isRecordingVideo: false,
  mediaRecorder: null,
  recordedChunks: [],
  recordAnimFrameId: null,
  recordStartTime: 0,
  audioMicStream: null,

  // Photobooth 4 Polaroid
  pbStream: null,
  pbSlots: [null, null, null, null],
  pbTheme: 'black_film',
  pbFooterText: 'LOCKET PHOTOBOOTH 💛',
  pbIsCapturing: false,
  pbCustomFrames: JSON.parse(localStorage.getItem('locket_custom_pb_frames') || '[]'),
  pbActiveCustomFrameId: localStorage.getItem('locket_active_pb_frame_id') || '',

  // Locket Dio Caption Studio
  capType: 'text', // 'text' | 'music' | 'time' | 'battery' | 'weather' | 'review'
  captionText: '',
  captionIcon: '',
  captionBgColors: [],
  captionTextColor: '#FFFFFFE6',

  // Lịch sử Bảng tin & Ai đã xem
  feedFilterMode: 'all', // 'all' | 'mine' | 'friend'
  feedViewMode: 'card', // 'card' | 'grid'
  feedSelectedFriendUid: '',
  feedMoments: [],
  myUid: '',

  // Hộp thư Tin nhắn Locket
  conversations: [],
  activeConversationId: null,
  activeChatPeer: null,
  activeMessages: [],

  // Chuỗi Locket (Streak & Lịch tháng)
  streakViewYear: new Date().getFullYear(),
  streakViewMonth: new Date().getMonth(), // 0-11
  streakSelectedDateKey: '',

  // Locket Rollcall (Photo Dump tối đa 10 ảnh)
  rollcallPhotos: [], // [{ id, src, caption }]
  rollcallCollageDataUrl: '',

  // Trạng thái cấu hình AI từ server
  hasServerHfToken: false,
  hasServerGeminiKey: false,
};

const PB_THEMES = {
  black_film: { bg: '#0f1117', border: '#262936', text: '#f9fafb', subText: '#9ca3af' },
  white_clean: { bg: '#f8fafc', border: '#e2e8f0', text: '#0f172a', subText: '#64748b' },
  pastel_pink: { bg: '#fce7f3', border: '#fbcfe8', text: '#831843', subText: '#be185d' },
  locket_gold: { bg: '#fef3c7', border: '#fde68a', text: '#78350f', subText: '#b45309' },
  cyber_purple: { bg: '#1e1b4b', border: '#312e81', text: '#e0e7ff', subText: '#a5b4fc' },
  matcha_cream: { bg: '#ecfdf5', border: '#a7f3d0', text: '#064e3b', subText: '#047857' },
};

// DOM References
const aiEditInstructionInput = document.getElementById('aiEditInstructionInput');
const btnApplyAiEdit = document.getElementById('btnApplyAiEdit');
const btnUndoAiEdit = document.getElementById('btnUndoAiEdit');
const btnPostToLocket = document.getElementById('btnPostToLocket');
const btnPostText = document.getElementById('btnPostText');
const btnDownloadImage = document.getElementById('btnDownloadImage');
const lblDownloadImage = document.getElementById('lblDownloadImage');
const btnToggleCamera = document.getElementById('btnToggleCamera');
const btnToggleCameraText = document.getElementById('btnToggleCameraText');
const shutterButtonContainer = document.getElementById('shutterButtonContainer');
const sendButtonContainer = document.getElementById('sendButtonContainer');

const fileUploadInput = document.getElementById('fileUploadInput');
const btnRetakeOrClearPreview = document.getElementById('btnRetakeOrClearPreview');

const previewPlaceholder = document.getElementById('previewPlaceholder');
const previewImage = document.getElementById('previewImage');
const previewVideo = document.getElementById('previewVideo');
const previewLoading = document.getElementById('previewLoading');
const previewLoadingTitle = document.getElementById('previewLoadingTitle');
const statusAlert = document.getElementById('statusAlert');
const statusAlertText = document.getElementById('statusAlertText');
const englishPromptBox = document.getElementById('englishPromptBox');
const englishPromptText = document.getElementById('englishPromptText');

const loginModal = document.getElementById('loginModal');
const settingsModal = document.getElementById('settingsModal');
const viewsModal = document.getElementById('viewsModal');
const accountBadgeDot = document.getElementById('accountBadgeDot');
const accountAvatarImg = document.getElementById('accountAvatarImg');
const accountStatusText = document.getElementById('accountStatusText');
const geminiStatusText = document.getElementById('geminiStatusText');

// ============================================================================
// KHỞI TẠO & HELPER CHUNG
// ============================================================================

function initApp() {
  updateAccountUI();
  updateGeminiBadge();
  syncServerAiStatus();
  setupAppNavigation();
  setupCameraModes();
  setupCameraTab();
  setupCaptionStudio();
  setupAiEditFeature();
  setupPhotoboothTab();
  setupFeedTab();
  setupStreakScreen();
  setupRollcallScreen();
  setupChatTab();
  renderPostRecipients();

  if (isLoggedIn()) {
    loadFriendsList(true);
    loadConversations(true);
  }

  // Luôn tự động bật Camera ngay khi mở ứng dụng để chỉ cần chạm chụp & giữ quay
  if (state.camMode === 'camera' && !state.cameraStream && !state.cameraSourceImage) {
    openLiveCameraStream().catch(() => {
      // Nếu trình duyệt chặn tự bật hoặc chưa cấp quyền, người dùng có thể chạm nút chụp hoặc nút Cam để bật lại
    });
  }
}

function isLoggedIn() {
  return Boolean(state.locketSession && state.locketSession.idToken);
}

function showStatus(message, type = 'info') {
  statusAlert.classList.remove(
    'hidden',
    'bg-red-500/15',
    'text-red-300',
    'border-red-500/30',
    'bg-emerald-500/15',
    'text-emerald-300',
    'border-emerald-500/30',
    'bg-yellow-500/15',
    'text-yellow-200',
    'border-yellow-500/30'
  );
  statusAlert.classList.add('border');
  if (type === 'error') {
    statusAlert.classList.add('bg-red-500/15', 'text-red-300', 'border-red-500/30');
  } else if (type === 'success') {
    statusAlert.classList.add('bg-emerald-500/15', 'text-emerald-300', 'border-emerald-500/30');
  } else {
    statusAlert.classList.add('bg-yellow-500/15', 'text-yellow-200', 'border-yellow-500/30');
  }
  statusAlertText.textContent = message;
}

function hideStatus() {
  statusAlert.classList.add('hidden');
}
window.hideStatus = hideStatus;

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatTimeAgo(dateInput) {
  if (!dateInput) return '';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '';
  const diffSec = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diffSec < 60) return 'Vừa xong';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)} phút trước`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} giờ trước`;
  if (diffSec < 86400 * 7) return `${Math.floor(diffSec / 86400)} ngày trước`;
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

async function callLocketApi(endpoint, extraBody = {}) {
  if (!isLoggedIn()) {
    loginModal.classList.remove('hidden');
    throw new Error('Vui lòng đăng nhập tài khoản Locket trước.');
  }

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      idToken: state.locketSession.idToken,
      localId: state.locketSession.localId,
      refreshToken: state.locketSession.refreshToken,
      ...extraBody,
    }),
  });

  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(data.error || `Lỗi gọi API ${endpoint}`);
  }

  if (data.refreshedSession) {
    state.locketSession.idToken = data.refreshedSession.idToken;
    state.locketSession.refreshToken =
      data.refreshedSession.refreshToken || state.locketSession.refreshToken;
    state.locketSession.localId =
      data.refreshedSession.localId || state.locketSession.localId;
    localStorage.setItem('locket_session', JSON.stringify(state.locketSession));
  }

  return data;
}

function updateAccountUI() {
  const loggedInInfoBox = document.getElementById('loggedInInfoBox');
  const loggedInUserLabel = document.getElementById('loggedInUserLabel');
  const sidebarUserName = document.getElementById('sidebarUserName');
  const sidebarUserSub = document.getElementById('sidebarUserSub');

  if (isLoggedIn()) {
    accountBadgeDot.classList.remove('bg-red-500');
    accountBadgeDot.classList.add('bg-emerald-400');
    const name =
      state.locketSession.displayName ||
      state.locketSession.email ||
      (state.locketSession.localId || '').slice(0, 8);
    accountStatusText.textContent = name;
    loggedInInfoBox.classList.remove('hidden');
    loggedInUserLabel.textContent = name;
    const defaultIcon = document.getElementById('accountDefaultIcon');
    if (state.locketSession.photoUrl) {
      accountAvatarImg.src = state.locketSession.photoUrl;
      accountAvatarImg.classList.remove('hidden');
      if (defaultIcon) defaultIcon.classList.add('hidden');
    } else {
      accountAvatarImg.classList.add('hidden');
      if (defaultIcon) defaultIcon.classList.remove('hidden');
    }
    if (sidebarUserName) sidebarUserName.textContent = name;
    if (sidebarUserSub) sidebarUserSub.textContent = state.locketSession.email || 'Đã kết nối Locket';
  } else {
    accountBadgeDot.classList.remove('bg-emerald-400');
    accountBadgeDot.classList.add('bg-red-500');
    accountStatusText.textContent = 'Đăng nhập';
    accountAvatarImg.classList.add('hidden');
    const defaultIcon = document.getElementById('accountDefaultIcon');
    if (defaultIcon) defaultIcon.classList.remove('hidden');
    loggedInInfoBox.classList.add('hidden');
    if (sidebarUserName) sidebarUserName.textContent = 'Chưa đăng nhập';
    if (sidebarUserSub) sidebarUserSub.textContent = 'Bấm Đăng nhập để kết nối Locket';
  }
}

function updateGeminiBadge() {
  const hasGemini = Boolean((state.geminiApiKey && state.geminiApiKey.trim()) || state.hasServerGeminiKey);
  const hasHf = Boolean((state.hfToken && state.hfToken.trim()) || state.hasServerHfToken);
  if (hasGemini && hasHf) {
    geminiStatusText.textContent = 'AI: Gemini + Kontext';
  } else if (hasGemini) {
    geminiStatusText.textContent = 'AI: Gemini Vision + Edit';
  } else if (hasHf) {
    geminiStatusText.textContent = 'AI: FLUX Kontext (HF)';
  } else {
    geminiStatusText.textContent = 'AI: Chưa cài Key sửa ảnh';
  }
}

async function syncServerAiStatus() {
  try {
    const res = await fetch('/api/health');
    if (!res.ok) return;
    const data = await res.json();
    state.hasServerHfToken = Boolean(data.hasServerHfToken);
    state.hasServerGeminiKey = Boolean(data.hasServerGeminiKey);
    updateGeminiBadge();
  } catch {
    // Bỏ qua nếu offline
  }
}

// ============================================================================
// ĐIỀU HƯỚNG LOCKET DIO (SIDEBAR TRÁI • CAMERA/LỊCH SỬ GIỮA • CHAT PHẢI)
// ============================================================================

function switchScreen(screenName, subOption = null) {
  state.activeScreen = screenName;
  const screenCamera = document.getElementById('screenCamera');
  const screenHistory = document.getElementById('screenHistory');
  const screenStreak = document.getElementById('screenStreak');
  const screenRollcall = document.getElementById('screenRollcall');
  const screenChat = document.getElementById('screenChat');
  const isDesktop = window.innerWidth >= 1024;

  document.querySelectorAll('.bottom-nav-btn').forEach((b) => b.classList.remove('active'));

  const hideCenterScreens = () => {
    screenCamera?.classList.add('hidden');
    screenHistory?.classList.add('hidden');
    screenStreak?.classList.add('hidden');
    screenRollcall?.classList.add('hidden');
  };

  if (screenName === 'camera') {
    hideCenterScreens();
    screenCamera?.classList.remove('hidden');
    if (!isDesktop) screenChat?.classList.add('hidden');
    document.querySelector('[data-bottom-nav="camera"]')?.classList.add('active');
    if (state.camMode === 'camera' && !state.cameraStream && !state.cameraSourceImage && !state.currentBase64Image && !state.currentVideoDataUrl) {
      openLiveCameraStream().catch(() => {});
    }
  } else if (screenName === 'history') {
    hideCenterScreens();
    screenHistory?.classList.remove('hidden');
    if (!isDesktop) screenChat?.classList.add('hidden');

    if (subOption === 'mine') {
      state.feedFilterMode = 'mine';
      document.querySelector('[data-bottom-nav="history-mine"]')?.classList.add('active');
    } else {
      state.feedFilterMode = 'all';
      document.querySelector('[data-bottom-nav="history-all"]')?.classList.add('active');
    }
    document
      .querySelectorAll('.feed-filter-btn')
      .forEach((b) => b.classList.toggle('active', b.getAttribute('data-feed-filter') === state.feedFilterMode));

    if (isLoggedIn()) {
      if (state.feedMoments.length === 0) {
        loadMomentsFeed();
      } else {
        renderFeedMoments();
      }
    }
  } else if (screenName === 'streak') {
    hideCenterScreens();
    screenStreak?.classList.remove('hidden');
    if (!isDesktop) screenChat?.classList.add('hidden');
    document.querySelector('[data-bottom-nav="streak"]')?.classList.add('active');
    openStreakScreen();
  } else if (screenName === 'rollcall') {
    hideCenterScreens();
    screenRollcall?.classList.remove('hidden');
    if (!isDesktop) screenChat?.classList.add('hidden');
    openRollcallScreen();
  } else if (screenName === 'chat') {
    if (!isDesktop) {
      hideCenterScreens();
    }
    screenChat?.classList.remove('hidden');
    document.querySelector('[data-bottom-nav="chat"]')?.classList.add('active');
    if (isLoggedIn() && state.conversations.length === 0) {
      loadConversations();
    }
  }

  if (!isDesktop) {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

function setupAppNavigation() {
  const leftSidebar = document.getElementById('leftSidebar');
  const closeDrawer = () => leftSidebar.classList.add('hidden');

  document.getElementById('btnToggleLeftDrawer').addEventListener('click', () => {
    if (state.activeScreen === 'rollcall') {
      switchScreen('camera');
    } else {
      switchScreen('rollcall');
    }
  });
  document.getElementById('btnCloseLeftDrawer').addEventListener('click', closeDrawer);
  document.getElementById('btnSidebarLogin').addEventListener('click', () => {
    closeDrawer();
    loginModal.classList.remove('hidden');
  });
  document.getElementById('btnSidebarSyncFriends').addEventListener('click', () => loadFriendsList(false));
  document.getElementById('btnSidebarGoHistory').addEventListener('click', () => {
    closeDrawer();
    switchScreen('history', 'all');
  });
  document.getElementById('btnSidebarGoMine').addEventListener('click', () => {
    closeDrawer();
    switchScreen('history', 'mine');
  });

  document.getElementById('btnTopOpenHistory').addEventListener('click', () => switchScreen('history', 'all'));
  document.getElementById('btnTopOpenChat').addEventListener('click', () => switchScreen('chat'));
  document.getElementById('btnSwipeDownToHistory').addEventListener('click', () => switchScreen('history', 'all'));
  document.getElementById('btnBackToCameraFromHistory').addEventListener('click', () => switchScreen('camera'));
  document.getElementById('btnBackToCameraFromChat').addEventListener('click', () => switchScreen('camera'));

  document.querySelectorAll('.bottom-nav-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = btn.getAttribute('data-bottom-nav');
      if (target === 'camera') switchScreen('camera');
      else if (target === 'streak') switchScreen('streak');
      else if (target === 'history-all') switchScreen('history', 'all');
      else if (target === 'history-mine') switchScreen('history', 'mine');
      else if (target === 'chat') switchScreen('chat');
    });
  });

  const btnPop = document.getElementById('btnToggleRecipientsPopover');
  const pop = document.getElementById('recipientsPopover');
  btnPop.addEventListener('click', (e) => {
    e.stopPropagation();
    pop.classList.toggle('hidden');
  });
  document.addEventListener('click', (e) => {
    if (!pop.contains(e.target) && !btnPop.contains(e.target)) {
      pop.classList.add('hidden');
    }
  });

  // Nút mở nhanh Caption Studio & AI Sửa chi tiết (giữ màn hình chính gọn giống Locket iOS)
  document.getElementById('btnToggleCaptionDrawer')?.addEventListener('click', () => {
    document.getElementById('captionDrawerBox')?.classList.toggle('hidden');
  });
  document.getElementById('btnToggleAiEditDrawer')?.addEventListener('click', () => {
    const box = document.getElementById('aiEditDrawerBox');
    if (box) {
      box.classList.toggle('hidden');
      if (!box.classList.contains('hidden')) {
        document.getElementById('aiEditInstructionInput')?.focus();
      }
    }
  });
}

// ============================================================================
// CHUYỂN CHẾ ĐỘ MÁY ẢNH • QUAY VIDEO • PHOTOBOOTH (NÚT ✨ GÓC DƯỚI PHẢI)
// ============================================================================

function toggleActionPreviewMode(hasPreview) {
  const btnGalleryLabel = document.getElementById('btnGalleryPickerLabel');
  const btnCancelLeft = document.getElementById('btnCancelPreviewLeft');
  const btnFlipCamera = document.getElementById('btnFlipCamera');
  const recipientStrip = document.getElementById('previewRecipientStrip');
  const historyBtn = document.getElementById('btnSwipeDownToHistory');

  if (hasPreview) {
    shutterButtonContainer.classList.add('hidden');
    sendButtonContainer.classList.remove('hidden');
    btnGalleryLabel?.classList.add('hidden');
    btnCancelLeft?.classList.remove('hidden');
    btnFlipCamera?.classList.add('hidden');
    btnDownloadImage.classList.remove('hidden');
    lblDownloadImage.classList.remove('hidden');
    btnDownloadImage.disabled = false;
    recipientStrip?.classList.remove('hidden');
    historyBtn?.classList.add('hidden');
    renderPostRecipients();
  } else {
    shutterButtonContainer.classList.remove('hidden');
    sendButtonContainer.classList.add('hidden');
    btnGalleryLabel?.classList.remove('hidden');
    btnCancelLeft?.classList.add('hidden');
    btnFlipCamera?.classList.remove('hidden');
    btnDownloadImage.classList.add('hidden');
    lblDownloadImage.classList.add('hidden');
    btnDownloadImage.disabled = true;
    recipientStrip?.classList.add('hidden');
    historyBtn?.classList.remove('hidden');
  }
}

function setCamMode(mode) {
  state.camMode = mode === 'photobooth' ? 'photobooth' : 'camera';
  const trayPb = document.getElementById('trayPhotobooth');
  const pbPill = document.getElementById('photoboothActivePill');
  const starBtn = document.getElementById('btnTogglePhotoboothMode');
  const shutterHint = document.getElementById('lblCenterShutterHint');
  const placeholderTitle = document.getElementById('placeholderTitle');
  const placeholderSub = document.getElementById('placeholderSub');

  if (state.camMode === 'photobooth') {
    trayPb?.classList.remove('hidden');
    pbPill?.classList.remove('hidden');
    if (starBtn) {
      starBtn.classList.remove('bg-white/20', 'text-white');
      starBtn.classList.add('bg-[#f5a623]', 'text-black', 'ring-2', 'ring-[#f5a623]/40');
    }
    if (shutterHint) shutterHint.textContent = 'Chạm để chụp 4 kiểu';
    if (placeholderTitle) placeholderTitle.textContent = 'Photobooth 4 Polaroid';
    if (placeholderSub) {
      placeholderSub.innerHTML =
        'Chạm nút tròn để <strong>đếm ngược chụp 4 kiểu</strong> hoặc chọn ảnh/khung ở khay bên dưới.';
    }
    renderPhotoboothComposite();
  } else {
    trayPb?.classList.add('hidden');
    pbPill?.classList.add('hidden');
    if (starBtn) {
      starBtn.classList.add('bg-white/20', 'text-white');
      starBtn.classList.remove('bg-[#f5a623]', 'text-black', 'ring-2', 'ring-[#f5a623]/40');
    }
    if (shutterHint) {
      shutterHint.textContent = state.videoTapMode ? 'Chạm Quay / Dừng Video' : 'Chạm chụp • Giữ quay';
    }
    if (placeholderTitle) placeholderTitle.textContent = 'Locket Camera 1:1';
    if (placeholderSub) {
      placeholderSub.innerHTML =
        'Chạm nút tròn để <strong>Bật Camera / Chụp ảnh</strong>, giữ nút tròn để <strong>Quay Video</strong>, hoặc bấm <strong>✨ góc dưới phải</strong> để mở <strong>Photobooth</strong>.';
    }
    renderCameraCanvasFrame();
  }
}

function clearMediaPreview() {
  state.currentBase64Image = null;
  state.currentVideoDataUrl = null;
  state.originalBase64BeforeEdit = null;
  previewImage.src = '';
  previewImage.classList.add('hidden');
  if (previewVideo) {
    previewVideo.pause();
    previewVideo.src = '';
    previewVideo.classList.add('hidden');
  }
  btnRetakeOrClearPreview.classList.add('hidden');
  btnUndoAiEdit.classList.add('hidden');
  toggleActionPreviewMode(false);

  const canvas = document.getElementById('cameraPreviewCanvas');
  if (state.cameraStream) {
    canvas.classList.remove('hidden');
    previewPlaceholder.classList.add('hidden');
    renderCameraCanvasFrame();
  } else {
    previewPlaceholder.classList.remove('hidden');
  }
}

function setupCameraModes() {
  const starBtn = document.getElementById('btnTogglePhotoboothMode');
  const exitPbPill = document.getElementById('btnExitPhotoboothPill');
  const videoToggleBtn = document.getElementById('btnVideoModeToggle');
  const shutterBtn = document.getElementById('btnCenterShutterAction');
  const micBtn = document.getElementById('btnToggleMic');
  const zoomBtn = document.getElementById('btnZoomCycle');
  const flashBtn = document.getElementById('btnToggleFlash');

  starBtn?.addEventListener('click', () => {
    setCamMode(state.camMode === 'photobooth' ? 'camera' : 'photobooth');
    if (state.camMode === 'photobooth') {
      document.getElementById('trayPhotobooth')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  });
  exitPbPill?.addEventListener('click', () => setCamMode('camera'));

  micBtn?.addEventListener('click', () => {
    state.micEnabled = !state.micEnabled;
    document.getElementById('micIconOn')?.classList.toggle('hidden', !state.micEnabled);
    document.getElementById('micIconOff')?.classList.toggle('hidden', state.micEnabled);
    showStatus(state.micEnabled ? '🎙️ Đã bật Micro khi quay video' : '🔇 Đã tắt Micro (video không tiếng)', 'info');
  });

  const zoomSteps = [1, 1.5, 2];
  zoomBtn?.addEventListener('click', async () => {
    const idx = zoomSteps.indexOf(state.cameraZoom);
    state.cameraZoom = zoomSteps[(idx + 1) % zoomSteps.length];
    zoomBtn.textContent = `${state.cameraZoom}×`;
    // Thử zoom phần cứng nếu camera hỗ trợ, đồng thời render digital crop zoom trên canvas 1:1
    if (state.cameraStream) {
      const track = state.cameraStream.getVideoTracks()[0];
      const caps = track?.getCapabilities ? track.getCapabilities() : {};
      if (caps.zoom && track.applyConstraints) {
        const clamped = Math.max(caps.zoom.min, Math.min(caps.zoom.max, state.cameraZoom));
        track.applyConstraints({ advanced: [{ zoom: clamped }] }).catch(() => {});
      }
      renderCameraCanvasFrame();
    }
  });

  flashBtn?.addEventListener('click', async () => {
    state.flashEnabled = !state.flashEnabled;
    flashBtn.classList.toggle('bg-[#f5a623]', state.flashEnabled);
    flashBtn.classList.toggle('text-black', state.flashEnabled);
    flashBtn.classList.toggle('bg-[#6e3e1c]/80', !state.flashEnabled);
    flashBtn.classList.toggle('text-[#f5a623]', !state.flashEnabled);
    if (state.cameraStream) {
      const track = state.cameraStream.getVideoTracks()[0];
      const caps = track?.getCapabilities ? track.getCapabilities() : {};
      if (caps.torch && track.applyConstraints) {
        track.applyConstraints({ advanced: [{ torch: state.flashEnabled }] }).catch(() => {});
      }
    }
    showStatus(state.flashEnabled ? '⚡ Đã bật Flash khi chụp / quay' : '⚡ Đã tắt Flash', 'info');
  });

  videoToggleBtn?.addEventListener('click', () => {
    state.videoTapMode = !state.videoTapMode;
    videoToggleBtn.classList.toggle('bg-[#f5a623]', state.videoTapMode);
    videoToggleBtn.classList.toggle('text-black', state.videoTapMode);
    videoToggleBtn.classList.toggle('bg-white/10', !state.videoTapMode);
    videoToggleBtn.classList.toggle('text-stone-300', !state.videoTapMode);
    const hint = document.getElementById('lblCenterShutterHint');
    if (hint && state.camMode === 'camera') {
      hint.textContent = state.videoTapMode ? 'Chạm Quay / Dừng Video' : 'Chạm chụp • Giữ quay';
    }
  });

  // Hỗ trợ cả CHẠM để Chụp ảnh và GIỮ (>= 320ms) để Quay Video giống Locket thật
  let holdTimer = null;
  let holdTriggeredRecord = false;
  let pointerIsDown = false;

  const beginPress = (e) => {
    if (e.button && e.button !== 0) return;
    pointerIsDown = true;
    holdTriggeredRecord = false;
    if (state.camMode !== 'camera' || state.videoTapMode) return;

    holdTimer = setTimeout(async () => {
      if (!pointerIsDown) return;
      holdTriggeredRecord = true;
      await startVideoRecording();
    }, 280);
  };

  const endPress = async () => {
    if (!pointerIsDown) return;
    pointerIsDown = false;
    if (holdTimer) {
      clearTimeout(holdTimer);
      holdTimer = null;
    }

    if (state.isRecordingVideo && holdTriggeredRecord) {
      stopVideoRecording();
      holdTriggeredRecord = false;
      return;
    }

    if (holdTriggeredRecord) {
      holdTriggeredRecord = false;
      return;
    }

    // Xử lý nhấn nhanh (Tap)
    if (state.camMode === 'photobooth') {
      document.getElementById('btnStartAutoPhotobooth')?.click();
      return;
    }

    if (state.videoTapMode) {
      if (state.isRecordingVideo) {
        stopVideoRecording();
      } else {
        await startVideoRecording();
      }
      return;
    }

    if (!state.cameraStream && !state.cameraSourceImage) {
      try {
        await openLiveCameraStream();
      } catch (err) {
        showStatus(`❌ Không thể mở Camera (${err.message}). Hãy bấm Thư viện góc trái để chọn ảnh/video!`, 'error');
      }
    } else {
      document.getElementById('btnCapturePhoto')?.click();
    }
  };

  if (shutterBtn) {
    shutterBtn.style.touchAction = 'none';
    shutterBtn.style.userSelect = 'none';
    shutterBtn.style.webkitUserSelect = 'none';
    shutterBtn.style.webkitTouchCallout = 'none';
    shutterBtn.addEventListener('contextmenu', (e) => e.preventDefault());
    shutterBtn.addEventListener('pointerdown', beginPress);
  }
  window.addEventListener('pointerup', endPress);
  window.addEventListener('pointercancel', endPress);

  btnRetakeOrClearPreview?.addEventListener('click', clearMediaPreview);
  document.getElementById('btnCancelPreviewLeft')?.addEventListener('click', clearMediaPreview);
}

// ============================================================================
// CAPTION STUDIO KIỂU LOCKET DIO (CHỮ • NHẠC • GIỜ • PIN • THỜI TIẾT • REVIEW)
// ============================================================================

function renderLiveCaptionOverlay() {
  const box = document.getElementById('liveCaptionOverlayBox');
  const pill = document.getElementById('liveCaptionPill');
  const iconEl = document.getElementById('liveCaptionIcon');
  const textEl = document.getElementById('liveCaptionText');

  const text = (state.captionText || '').trim();
  const icon = (state.captionIcon || '').trim();

  if (!text && !icon) {
    box.classList.add('hidden');
    return;
  }

  box.classList.remove('hidden');
  if (icon) {
    iconEl.textContent = icon;
    iconEl.classList.remove('hidden');
  } else {
    iconEl.classList.add('hidden');
  }
  textEl.textContent = text;

  pill.style.color = state.captionTextColor || '#FFFFFFE6';
  if (state.captionBgColors && state.captionBgColors.length >= 2) {
    pill.style.background = `linear-gradient(135deg, ${state.captionBgColors[0]}, ${state.captionBgColors[1]})`;
  } else if (state.captionBgColors && state.captionBgColors.length === 1) {
    pill.style.background = state.captionBgColors[0];
  } else {
    pill.style.background = 'rgba(15, 17, 26, 0.72)';
  }
}

function applyCaptionPresetValues(icon, text, colorsStr = null, textColor = null) {
  const iconInput = document.getElementById('capIconInput');
  const textInput = document.getElementById('capTextInput');
  state.captionIcon = icon;
  state.captionText = text;
  iconInput.value = icon;
  textInput.value = text;

  if (colorsStr !== null) {
    state.captionBgColors = colorsStr ? colorsStr.split(',').filter(Boolean) : [];
    state.captionTextColor = textColor || '#FFFFFF';
    document.querySelectorAll('.cap-color-btn').forEach((b) => {
      b.classList.toggle('active', b.getAttribute('data-colors') === colorsStr);
    });
  }
  renderLiveCaptionOverlay();
}

function setupCaptionStudio() {
  const iconInput = document.getElementById('capIconInput');
  const textInput = document.getElementById('capTextInput');
  const helperEl = document.getElementById('capPresetHelper');

  iconInput.addEventListener('input', () => {
    state.captionIcon = iconInput.value;
    renderLiveCaptionOverlay();
  });
  textInput.addEventListener('input', () => {
    state.captionText = textInput.value;
    renderLiveCaptionOverlay();
  });

  document.getElementById('btnClearCaption').addEventListener('click', () => {
    applyCaptionPresetValues('', '', '', '#FFFFFFE6');
  });

  document.querySelectorAll('#capColorPresets .cap-color-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#capColorPresets .cap-color-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      const raw = btn.getAttribute('data-colors') || '';
      state.captionBgColors = raw ? raw.split(',').filter(Boolean) : [];
      state.captionTextColor = btn.getAttribute('data-text') || '#FFFFFFE6';
      renderLiveCaptionOverlay();
    });
  });

  const presetsByType = {
    text: [
      { icon: '💛', text: 'Đi chill hoy', colors: '' },
      { icon: '🔥', text: 'Cháy quá trời', colors: '#f43f5e,#ec4899', tc: '#FFFFFF' },
      { icon: '✨', text: 'Happy Day!', colors: '#facc15,#f59e0b', tc: '#0b0c10' },
      { icon: '💀', text: 'Cứu tôi với', colors: '#111827,#1f2937', tc: '#FFFFFF' },
    ],
    music: [
      { icon: '🎵', text: 'Đang nghe Spotify • Chill Vibes', colors: '#10b981,#059669', tc: '#FFFFFF' },
      { icon: '🎧', text: 'Chìm Sâu - RPT MCK', colors: '#111827,#1f2937', tc: '#FFFFFF' },
      { icon: '🎶', text: 'Chúng Ta Của Tương Lai', colors: '#7c3aed,#4f46e5', tc: '#FFFFFF' },
    ],
    time: [],
    battery: [
      { icon: '🔋', text: 'Pin 92% • Đủ dùng cả ngày', colors: '#10b981,#059669', tc: '#FFFFFF' },
      { icon: '🪫', text: 'Pin yếu 8% • Sắp sập nguồn', colors: '#f43f5e,#ec4899', tc: '#FFFFFF' },
      { icon: '⚡', text: 'Đang cắm sạc 65%', colors: '#facc15,#f59e0b', tc: '#0b0c10' },
    ],
    weather: [
      { icon: '☀️', text: '32°C • Nắng chói chang', colors: '#facc15,#f59e0b', tc: '#0b0c10' },
      { icon: '🌧️', text: '23°C • Trời đang mưa rào', colors: '#0ea5e9,#2563eb', tc: '#FFFFFF' },
      { icon: '⛅', text: '26°C • Mát mẻ dễ chịu', colors: '#0ea5e9,#2563eb', tc: '#FFFFFF' },
      { icon: '❄️', text: '15°C • Lạnh tê tái', colors: '#FFFFFF,#E2E8F0', tc: '#0f172a' },
    ],
    review: [
      { icon: '⭐', text: '5/5 • Quá đỉnh luôn!', colors: '#facc15,#f59e0b', tc: '#0b0c10' },
      { icon: '🧋', text: '9/10 • Trà sữa ngon xuất sắc', colors: '#f43f5e,#ec4899', tc: '#FFFFFF' },
      { icon: '💔', text: '1/5 • Thất vọng tràn trề', colors: '#111827,#1f2937', tc: '#FFFFFF' },
    ],
  };

  document.querySelectorAll('.cap-tab-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      document.querySelectorAll('.cap-tab-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      const type = btn.getAttribute('data-cap-type') || 'text';
      state.capType = type;

      if (type === 'time') {
        const now = new Date();
        const hh = String(now.getHours()).padStart(2, '0');
        const mm = String(now.getMinutes()).padStart(2, '0');
        const dStr = now.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
        applyCaptionPresetValues('🕒', `${hh}:${mm} • Ngày ${dStr}`, '#111827,#1f2937', '#FFFFFF');
      } else if (type === 'battery' && typeof navigator.getBattery === 'function') {
        try {
          const bat = await navigator.getBattery();
          const pct = Math.round(bat.level * 100);
          const ic = bat.charging ? '⚡' : pct <= 20 ? '🪫' : '🔋';
          const status = bat.charging ? 'Đang sạc' : pct <= 20 ? 'Sắp hết pin' : 'Vẫn khỏe';
          applyCaptionPresetValues(ic, `Pin ${pct}% • ${status}`, pct <= 20 ? '#f43f5e,#ec4899' : '#10b981,#059669', '#FFFFFF');
        } catch (_) {}
      } else if (type === 'music') {
        textInput.placeholder = 'Tên bài hát - Ca sĩ...';
        if (!textInput.value.trim()) {
          applyCaptionPresetValues('🎵', 'Đang nghe nhạc chill...', '#10b981,#059669', '#FFFFFF');
        }
      } else if (type === 'weather') {
        textInput.placeholder = 'Nhiệt độ & thời tiết...';
      } else if (type === 'review') {
        textInput.placeholder = 'Số sao & nhận xét...';
      } else {
        textInput.placeholder = 'Nhập caption gửi lên Locket...';
      }

      const items = presetsByType[type] || [];
      if (items.length > 0) {
        helperEl.classList.remove('hidden');
        helperEl.innerHTML = items
          .map(
            (item, i) => `
          <button type="button" data-preset-idx="${i}" class="cap-preset-chip px-2.5 py-1 rounded-full bg-white/5 hover:bg-white/15 border border-white/10 text-[11px] text-gray-200 transition">
            ${escapeHtml(item.icon)} ${escapeHtml(item.text)}
          </button>`
          )
          .join('');
        helperEl.querySelectorAll('.cap-preset-chip').forEach((chip) => {
          chip.addEventListener('click', () => {
            const it = items[Number(chip.getAttribute('data-preset-idx'))];
            if (it) applyCaptionPresetValues(it.icon, it.text, it.colors || '', it.tc || '#FFFFFFE6');
          });
        });
      } else {
        helperEl.classList.add('hidden');
        helperEl.innerHTML = '';
      }
    });
  });
}

// ============================================================================
// DANH SÁCH BẠN BÈ & NGƯỜI NHẬN TRÊN HEADER / LEFTSIDEBAR
// ============================================================================

async function loadFriendsList(silent = false) {
  if (!isLoggedIn()) return;
  try {
    const data = await callLocketApi('/api/locket/friends');
    state.friends = data.friends || [];
    renderPostRecipients();
    renderSidebarFriends();
    populateFriendDropdowns();
    if (!silent) {
      showStatus(`✅ Đã đồng bộ ${state.friends.length} người bạn trên Locket!`, 'success');
    }
  } catch (err) {
    if (!silent) {
      showStatus(`❌ Không thể tải danh sách bạn bè: ${err.message}`, 'error');
    }
  }
}

document.getElementById('btnLoadFriendsForPost').addEventListener('click', () => loadFriendsList(false));

function renderSidebarFriends() {
  const listEl = document.getElementById('sidebarFriendsList');
  const countEl = document.getElementById('sidebarFriendCount');
  if (countEl) countEl.textContent = String(state.friends.length);
  if (!listEl) return;

  if (!state.friends.length) {
    listEl.innerHTML = `<div class="text-[11px] text-gray-500 py-3 text-center">Chưa có danh sách bạn bè.</div>`;
    return;
  }

  listEl.innerHTML = state.friends
    .map((f) => {
      const av = f.profile_picture_url
        ? `<img src="${escapeHtml(f.profile_picture_url)}" class="w-8 h-8 rounded-full object-cover border border-white/15 shrink-0" />`
        : `<div class="w-8 h-8 rounded-full bg-yellow-400/20 text-yellow-300 font-bold text-xs flex items-center justify-center shrink-0">${escapeHtml((f.display_name || 'U').slice(0, 1).toUpperCase())}</div>`;

      return `
        <button type="button" data-sidebar-friend="${escapeHtml(f.uid)}" class="sidebar-friend-item w-full p-2 rounded-2xl hover:bg-white/5 transition flex items-center justify-between gap-2 text-left">
          <div class="flex items-center gap-2.5 min-w-0">
            ${av}
            <div class="min-w-0">
              <div class="text-xs font-bold text-white truncate">${escapeHtml(f.display_name)}</div>
              <div class="text-[10px] text-gray-400 truncate">${f.username ? '@' + escapeHtml(f.username) : 'Bạn bè Locket'}</div>
            </div>
          </div>
          <span class="text-[11px] text-yellow-400">💬</span>
        </button>
      `;
    })
    .join('');

  listEl.querySelectorAll('.sidebar-friend-item').forEach((btn) => {
    btn.addEventListener('click', () => {
      const uid = btn.getAttribute('data-sidebar-friend');
      document.getElementById('leftSidebar').classList.add('hidden');
      const existingConv = state.conversations.find((c) => c.peer_uid === uid);
      switchScreen('chat');
      if (existingConv) {
        loadConversationMessages(existingConv.conversation_id, existingConv.peer);
      } else {
        const friendObj = state.friends.find((f) => f.uid === uid) || { uid, display_name: `Bạn bè (${uid.slice(0, 6)})` };
        openDirectComposeWithFriend(friendObj);
      }
    });
  });
}

function handleRecipientOptionClick(uid) {
  if (uid === 'PRIVATE') {
    state.sendPrivate = true;
    state.selectedRecipients = [];
  } else if (uid === 'ALL') {
    state.sendPrivate = false;
    state.selectedRecipients = [];
  } else {
    state.sendPrivate = false;
    if (state.selectedRecipients.includes(uid)) {
      state.selectedRecipients = state.selectedRecipients.filter((id) => id !== uid);
    } else {
      state.selectedRecipients.push(uid);
    }
  }
  renderPostRecipients();
}

function renderPostRecipients() {
  const container = document.getElementById('postRecipientsContainer');
  const previewStrip = document.getElementById('previewRecipientScroll');
  const topLabel = document.getElementById('topRecipientLabel');
  const isPrivate = Boolean(state.sendPrivate);
  const allActive = !isPrivate && state.selectedRecipients.length === 0;

  if (isPrivate) {
    topLabel.textContent = '🔒 Riêng tư';
  } else if (allActive) {
    topLabel.textContent = state.friends.length ? `${state.friends.length} người bạn` : 'Mọi người';
  } else {
    topLabel.textContent = `Đã chọn ${state.selectedRecipients.length} bạn`;
  }

  // 1. Render Popover trên Header
  let popHtml = `
    <button type="button" data-uid="PRIVATE" class="recipient-pill text-xs px-3 py-1.5 rounded-full border transition font-bold ${
      isPrivate ? 'bg-[#f5a623] text-black border-[#f5a623]' : 'bg-white/5 text-stone-300 border-white/10 hover:bg-white/10'
    }">🔒 Riêng tư</button>
    <button type="button" data-uid="ALL" class="recipient-pill text-xs px-3 py-1.5 rounded-full border transition font-bold ${
      allActive ? 'bg-[#f5a623] text-black border-[#f5a623]' : 'bg-white/5 text-stone-300 border-white/10 hover:bg-white/10'
    }">🌍 Tất cả${state.friends.length ? ` (${state.friends.length})` : ''}</button>
  `;

  state.friends.forEach((f) => {
    const isSelected = !isPrivate && state.selectedRecipients.includes(f.uid);
    const avatarHtml = f.profile_picture_url
      ? `<img src="${escapeHtml(f.profile_picture_url)}" class="w-4 h-4 rounded-full object-cover" />`
      : `<span>👤</span>`;
    popHtml += `
      <button type="button" data-uid="${escapeHtml(f.uid)}" class="recipient-pill text-xs px-2.5 py-1 rounded-full border transition flex items-center gap-1.5 font-semibold ${
        isSelected ? 'bg-[#f5a623]/20 text-[#f5a623] border-[#f5a623]' : 'bg-white/5 text-stone-300 border-white/10 hover:bg-white/10'
      }">
        ${avatarHtml}
        <span>${escapeHtml(f.display_name)}</span>
      </button>
    `;
  });

  if (container) {
    container.innerHTML = popHtml;
    container.querySelectorAll('.recipient-pill').forEach((btn) => {
      btn.addEventListener('click', () => handleRecipientOptionClick(btn.getAttribute('data-uid')));
    });
  }

  // 2. Render Thanh Avatar ngang ngay dưới nút Gửi sau khi chụp/quay (kiểu Locket iOS)
  if (previewStrip) {
    let stripHtml = `
      <button type="button" data-uid="PRIVATE" class="preview-rec-item shrink-0 w-14 flex flex-col items-center gap-1.5 group">
        <span class="w-12 h-12 rounded-full flex items-center justify-center transition ${
          isPrivate
            ? 'bg-[#2a2318] border-2 border-[#f5a623] text-[#f5a623] shadow-[0_0_14px_rgba(245,166,35,0.45)]'
            : 'bg-[#211d18] border border-white/15 text-stone-300 group-hover:border-white/35'
        }">
          <svg class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1s3.1 1.39 3.1 3.1v2z"/>
          </svg>
        </span>
        <span class="text-[11px] font-bold truncate w-full text-center ${isPrivate ? 'text-[#f5a623]' : 'text-stone-400'}">Riêng tư</span>
      </button>

      <button type="button" data-uid="ALL" class="preview-rec-item shrink-0 w-14 flex flex-col items-center gap-1.5 group">
        <span class="w-12 h-12 rounded-full flex items-center justify-center transition ${
          allActive
            ? 'bg-[#f5a623]/20 border-2 border-[#f5a623] text-[#f5a623] shadow-[0_0_14px_rgba(245,166,35,0.45)]'
            : 'bg-[#211d18] border border-white/15 text-stone-300 group-hover:border-white/35'
        }">
          <svg class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
          </svg>
        </span>
        <span class="text-[11px] font-bold truncate w-full text-center ${allActive ? 'text-[#f5a623]' : 'text-stone-400'}">Tất cả</span>
      </button>
    `;

    state.friends.forEach((f) => {
      const isSelected = !isPrivate && state.selectedRecipients.includes(f.uid);
      const shortName = (f.display_name || 'Bạn bè').trim().split(/\s+/).slice(-1)[0];
      const avInner = f.profile_picture_url
        ? `<img src="${escapeHtml(f.profile_picture_url)}" class="w-full h-full object-cover rounded-full" />`
        : `<span class="text-sm font-extrabold text-stone-200">${escapeHtml((f.display_name || 'U').slice(0, 1).toUpperCase())}</span>`;

      stripHtml += `
        <button type="button" data-uid="${escapeHtml(f.uid)}" title="${escapeHtml(f.display_name)}" class="preview-rec-item shrink-0 w-14 flex flex-col items-center gap-1.5 group">
          <span class="w-12 h-12 rounded-full p-0.5 flex items-center justify-center transition ${
            isSelected
              ? 'border-2 border-[#f5a623] bg-[#f5a623]/15 shadow-[0_0_14px_rgba(245,166,35,0.45)]'
              : 'border border-white/15 bg-[#211d18] group-hover:border-white/35'
          }">
            <span class="w-full h-full rounded-full overflow-hidden flex items-center justify-center bg-[#2a241d]">
              ${avInner}
            </span>
          </span>
          <span class="text-[11px] font-bold truncate w-full text-center ${isSelected ? 'text-[#f5a623]' : 'text-stone-300'}">${escapeHtml(shortName)}</span>
        </button>
      `;
    });

    if (isLoggedIn() && !state.friends.length) {
      stripHtml += `
        <button type="button" id="btnQuickSyncFriendsInStrip" class="shrink-0 w-14 flex flex-col items-center gap-1.5 group">
          <span class="w-12 h-12 rounded-full border border-dashed border-white/25 bg-[#211d18] hover:border-[#f5a623] flex items-center justify-center text-base text-stone-300 transition">🔄</span>
          <span class="text-[10px] font-semibold text-stone-400 truncate w-full text-center">Tải bạn</span>
        </button>
      `;
    }

    previewStrip.innerHTML = stripHtml;
    previewStrip.querySelectorAll('.preview-rec-item').forEach((btn) => {
      btn.addEventListener('click', () => handleRecipientOptionClick(btn.getAttribute('data-uid')));
    });
    document.getElementById('btnQuickSyncFriendsInStrip')?.addEventListener('click', () => loadFriendsList(false));
  }
}

function populateFriendDropdowns() {
  const feedSelect = document.getElementById('feedFriendSelect');
  const chatSelect = document.getElementById('chatStartWithFriendSelect');

  if (feedSelect) {
    const currentVal = feedSelect.value;
    feedSelect.innerHTML = `<option value="">👥 Lọc theo bạn bè (${state.friends.length})...</option>`;
    state.friends.forEach((f) => {
      const opt = document.createElement('option');
      opt.value = f.uid;
      opt.textContent = `👤 ${f.display_name}`;
      feedSelect.appendChild(opt);
    });
    feedSelect.value = currentVal;
  }

  if (chatSelect) {
    chatSelect.innerHTML = `<option value="">➕ Nhắn tin mới cho bạn bè...</option>`;
    state.friends.forEach((f) => {
      const opt = document.createElement('option');
      opt.value = f.uid;
      opt.textContent = `💬 Nhắn cho ${f.display_name}`;
      chatSelect.appendChild(opt);
    });
  }
}

// ============================================================================
// CHỌN ẢNH TỪ THƯ VIỆN & HIỂN THỊ XEM TRƯỚC
// ============================================================================

fileUploadInput.addEventListener('change', (e) => {
  const file = e.target.files?.[0];
  if (!file) return;

  if (file.type && file.type.startsWith('video/')) {
    const reader = new FileReader();
    reader.onload = () => {
      const videoDataUrl = reader.result;
      const tempVid = document.createElement('video');
      tempVid.muted = true;
      tempVid.playsInline = true;
      tempVid.src = videoDataUrl;
      tempVid.onloadeddata = () => {
        tempVid.currentTime = Math.min(0.2, tempVid.duration || 0);
      };
      tempVid.onseeked = () => {
        const thumbUrl = captureVideoFrameSquare(tempVid, false);
        state.currentVideoMimeType = file.type || 'video/mp4';
        setPreviewVideo(videoDataUrl, thumbUrl);
        showStatus('🎥 Đã chọn video từ thư viện! Bạn có thể thêm Caption hoặc bấm Gửi Locket.', 'info');
      };
      tempVid.onerror = () => {
        showStatus('❌ Không thể đọc file video này.', 'error');
      };
    };
    reader.readAsDataURL(file);
    e.target.value = '';
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      state.cameraSourceImage = img;
      const offscreen = document.createElement('canvas');
      offscreen.width = 1000;
      offscreen.height = 1000;
      const ctx = offscreen.getContext('2d');
      const minSide = Math.min(img.width, img.height);
      const sx = (img.width - minSide) / 2;
      const sy = (img.height - minSide) / 2;
      ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, 1000, 1000);
      const dataUrl = offscreen.toDataURL('image/webp', 0.92);
      state.originalBase64BeforeEdit = dataUrl;
      btnUndoAiEdit.classList.add('hidden');
      setPreviewImage(dataUrl);
      showStatus('🖼️ Đã chọn ảnh từ thư viện! Bạn có thể thêm Caption, nhắn AI sửa ảnh hoặc bấm Gửi Locket.', 'info');
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
  e.target.value = '';
});

function updateQuickThumbnails(thumbUrl) {
  if (!thumbUrl) return;
  const gThumb = document.getElementById('galleryThumbPreview');
  const gIcon = document.getElementById('galleryFallbackIcon');
  if (gThumb) {
    gThumb.src = thumbUrl;
    gThumb.classList.remove('hidden');
    gIcon?.classList.add('hidden');
  }
  const hThumb = document.getElementById('historyButtonThumb');
  const hIcon = document.getElementById('historyButtonFallback');
  if (hThumb) {
    hThumb.src = thumbUrl;
    hThumb.classList.remove('hidden');
    hIcon?.classList.add('hidden');
  }
}

function setPreviewImage(base64DataUrl) {
  state.currentBase64Image = base64DataUrl;
  state.currentVideoDataUrl = null;
  previewPlaceholder.classList.add('hidden');
  document.getElementById('cameraPreviewCanvas')?.classList.add('hidden');
  document.getElementById('pbVideo')?.classList.add('hidden');
  if (previewVideo) {
    previewVideo.pause();
    previewVideo.src = '';
    previewVideo.classList.add('hidden');
  }
  previewImage.src = base64DataUrl;
  previewImage.classList.remove('hidden');
  btnRetakeOrClearPreview.classList.remove('hidden');
  btnPostToLocket.disabled = false;
  toggleActionPreviewMode(true);
  updateQuickThumbnails(base64DataUrl);
  renderLiveCaptionOverlay();
}

function setPreviewVideo(videoDataUrl, thumbDataUrl) {
  state.currentVideoDataUrl = videoDataUrl;
  state.currentBase64Image = thumbDataUrl || state.currentBase64Image;
  previewPlaceholder.classList.add('hidden');
  document.getElementById('cameraPreviewCanvas')?.classList.add('hidden');
  document.getElementById('pbVideo')?.classList.add('hidden');
  previewImage.classList.add('hidden');
  if (previewVideo) {
    previewVideo.src = videoDataUrl;
    previewVideo.classList.remove('hidden');
    previewVideo.play().catch(() => {});
  }
  btnRetakeOrClearPreview.classList.remove('hidden');
  btnPostToLocket.disabled = false;
  toggleActionPreviewMode(true);
  if (thumbDataUrl) updateQuickThumbnails(thumbDataUrl);
  renderLiveCaptionOverlay();
}

// ============================================================================
// 🪄 CHỈNH SỬA ẢNH BẰNG AI THEO LỜI NHẮN
// ============================================================================

function setupAiEditFeature() {
  const btnInspect = document.getElementById('btnInspectPhotoDetails');
  if (btnInspect) {
    btnInspect.addEventListener('click', () => triggerInspectPhotoDetails());
  }
  btnApplyAiEdit.addEventListener('click', () => triggerAiPhotoEdit());
  aiEditInstructionInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      triggerAiPhotoEdit();
    }
  });
  btnUndoAiEdit.addEventListener('click', () => {
    if (state.originalBase64BeforeEdit) {
      setPreviewImage(state.originalBase64BeforeEdit);
      btnUndoAiEdit.classList.add('hidden');
      showStatus('↩️ Đã khôi phục về bức ảnh gốc ban đầu!', 'info');
    }
  });
}

function showDetectedDetailsBox(detailsText) {
  const box = document.getElementById('aiDetectedDetailsBox');
  const txt = document.getElementById('aiDetectedDetailsText');
  if (!box || !txt) return;
  if (detailsText && detailsText.trim()) {
    txt.textContent = detailsText.trim();
    box.classList.remove('hidden');
  } else {
    box.classList.add('hidden');
  }
}

function ensureCapturedPhotoForAiEdit() {
  if (!state.currentBase64Image && state.cameraStream) {
    renderCameraCanvasFrame();
    const canvas = document.getElementById('cameraPreviewCanvas');
    const snapped = canvas.toDataURL('image/jpeg', 0.9);
    state.originalBase64BeforeEdit = snapped;
    setPreviewImage(snapped);
  }
  if (!state.currentBase64Image) {
    showStatus('⚠️ Hãy chụp ảnh hoặc chọn 1 ảnh từ Thư viện trước khi đọc/sửa bằng AI!', 'error');
    return false;
  }
  if (!state.originalBase64BeforeEdit) {
    state.originalBase64BeforeEdit = state.currentBase64Image;
  }
  return true;
}

async function triggerInspectPhotoDetails() {
  if (!ensureCapturedPhotoForAiEdit()) return;
  if (!state.geminiApiKey || !state.geminiApiKey.trim()) {
    showStatus('⚠️ Cần nhập Google Gemini API Key trong ⚙️ Cấu hình để AI đọc chi tiết từ ảnh gốc.', 'error');
    document.getElementById('btnOpenSettings')?.click();
    return;
  }

  const btnInspect = document.getElementById('btnInspectPhotoDetails');
  if (btnInspect) {
    btnInspect.disabled = true;
    btnInspect.textContent = '⏳ Đang đọc...';
  }
  hideStatus();

  try {
    const res = await fetch('/api/ai/analyze-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        base64Image: state.currentBase64Image,
        instruction: aiEditInstructionInput.value.trim(),
        geminiApiKey: state.geminiApiKey,
      }),
    });
    const data = await res.json();
    if (!res.ok || data.error) {
      throw new Error(data.error || 'Không thể đọc chi tiết ảnh');
    }
    if (data.detectedDetails) {
      showDetectedDetailsBox(data.detectedDetails);
      showStatus('👁️ AI đã đọc xong các chi tiết trong ảnh! Giờ bạn có thể nhập lệnh chỉ thêm/sửa phần bạn muốn.', 'success');
    } else {
      showStatus('ℹ️ Chưa đọc được chi tiết ảnh, bạn hãy kiểm tra lại Gemini API Key.', 'info');
    }
  } catch (err) {
    showStatus(`❌ Lỗi đọc chi tiết ảnh: ${err.message}`, 'error');
  } finally {
    if (btnInspect) {
      btnInspect.disabled = false;
      btnInspect.textContent = '🔍 Đọc ảnh';
    }
  }
}

async function triggerAiPhotoEdit() {
  const instruction = aiEditInstructionInput.value.trim();
  if (!instruction) {
    showStatus('⚠️ Hãy nhập lời nhắn mô tả chi tiết bạn muốn thêm hoặc sửa trong ảnh!', 'error');
    aiEditInstructionInput.focus();
    return;
  }

  if (!ensureCapturedPhotoForAiEdit()) return;

  hideStatus();
  btnApplyAiEdit.disabled = true;
  btnApplyAiEdit.textContent = '⏳ Đang sửa...';
  previewLoadingTitle.textContent = `🪄 AI đang đọc ảnh gốc & sửa chi tiết: "${instruction}"...`;
  previewLoading.classList.remove('hidden');

  try {
    const res = await fetch('/api/ai/edit-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        base64Image: state.currentBase64Image,
        instruction,
        geminiApiKey: state.geminiApiKey,
        hfToken: state.hfToken,
      }),
    });

    const data = await res.json();
    if (!res.ok || data.error) {
      throw new Error(data.error || 'Không thể chỉnh sửa chi tiết ảnh gốc bằng AI');
    }

    setPreviewImage(data.base64Image);
    state.lastEnglishPrompt = data.englishPrompt || state.lastEnglishPrompt;

    if (data.detectedDetails) {
      showDetectedDetailsBox(data.detectedDetails);
    }

    if (state.originalBase64BeforeEdit) {
      btnUndoAiEdit.classList.remove('hidden');
    }

    if (data.englishPrompt) {
      englishPromptBox.classList.remove('hidden');
      englishPromptText.textContent = data.englishPrompt;
    }

    showStatus(`✨ Đã sửa chi tiết trên ảnh gốc (${data.provider || 'AI Editor'})!`, 'success');
  } catch (err) {
    showStatus(`❌ ${err.message}`, 'error');
  } finally {
    btnApplyAiEdit.disabled = false;
    btnApplyAiEdit.textContent = '✨ AI Sửa';
    previewLoading.classList.add('hidden');
  }
}

function compressImageForLocket(dataUrl, targetSize = 800, quality = 0.85) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = targetSize;
        canvas.height = targetSize;
        const ctx = canvas.getContext('2d');
        const minSide = Math.min(img.width, img.height);
        const sx = (img.width - minSide) / 2;
        const sy = (img.height - minSide) / 2;
        ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, targetSize, targetSize);

        let compressed = canvas.toDataURL('image/webp', quality);
        if (!compressed.startsWith('data:image/webp')) {
          compressed = canvas.toDataURL('image/jpeg', quality);
        }
        resolve(compressed);
      } catch (_) {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

// Bắn ảnh/video + Caption Studio lên Locket
btnPostToLocket.addEventListener('click', async () => {
  if (!state.currentBase64Image && !state.currentVideoDataUrl) {
    showStatus('⚠️ Hãy chụp ảnh, quay video hoặc ghép Photobooth trước khi gửi!', 'error');
    return;
  }
  if (!isLoggedIn()) {
    loginModal.classList.remove('hidden');
    return;
  }

  btnPostToLocket.disabled = true;
  btnPostText.textContent = 'Đang gửi...';
  showStatus(
    state.currentVideoDataUrl
      ? '🎥 Đang tải video & Caption lên Locket của bạn bè...'
      : '🚀 Đang gửi khoảnh khắc & Caption lên Locket của bạn bè...',
    'info'
  );

  try {
    const optimizedBase64 = state.currentBase64Image
      ? await compressImageForLocket(state.currentBase64Image)
      : '';

    await callLocketApi('/api/locket/post', {
      base64Image: optimizedBase64,
      base64Video: state.currentVideoDataUrl || undefined,
      videoMimeType: state.currentVideoDataUrl ? state.currentVideoMimeType : undefined,
      caption: (state.captionText || '').trim(),
      icon: (state.captionIcon || '').trim(),
      textColor: state.captionTextColor || '#FFFFFFE6',
      bgColors: Array.isArray(state.captionBgColors) ? state.captionBgColors : [],
      recipients: state.sendPrivate ? [] : state.selectedRecipients,
      sentToSelfOnly: Boolean(state.sendPrivate),
    });

    const targetDesc = state.sendPrivate
      ? 'riêng tư (chỉ mình bạn xem)'
      : state.selectedRecipients.length > 0
        ? `${state.selectedRecipients.length} bạn đã chọn`
        : 'tất cả bạn bè';

    showStatus(
      state.currentVideoDataUrl
        ? `🎉 Đã đăng Video thành công (${targetDesc})!`
        : `🎉 Đã gửi ảnh thành công (${targetDesc})!`,
      'success'
    );
  } catch (err) {
    const isNetworkDown = /failed to fetch|load failed|networkerror/i.test(err?.message || '');
    const friendlyMsg = isNetworkDown
      ? 'Mất kết nối tới máy chủ (link HTTPS tunnel cũ đã hết hạn hoặc mạng chập chờn). Hãy mở lại link HTTPS mới nhất!'
      : err.message;
    showStatus(`❌ Lỗi đăng Locket: ${friendlyMsg}`, 'error');
  } finally {
    btnPostToLocket.disabled = false;
    btnPostText.textContent = 'Gửi Locket';
  }
});

btnDownloadImage.addEventListener('click', async () => {
  if (state.currentVideoDataUrl) {
    const ext = state.currentVideoMimeType?.includes('webm') ? 'webm' : 'mp4';
    const a = document.createElement('a');
    a.href = state.currentVideoDataUrl;
    a.download = `locket_video_${Date.now()}.${ext}`;
    a.click();
    showStatus('✅ Đang tải video về máy!', 'success');
    return;
  }
  if (!state.currentBase64Image) return;
  if (typeof window.__saveImageToIphonePhotos === 'function') {
    try {
      await window.__saveImageToIphonePhotos(state.currentBase64Image);
      showStatus('✅ Đã lưu ảnh vào Album Ảnh trên iPhone!', 'success');
      return;
    } catch (err) {
      showStatus(`⚠️ Không thể lưu vào Album Ảnh: ${err.message}`, 'error');
    }
  }
  const a = document.createElement('a');
  a.href = state.currentBase64Image;
  a.download = `locket_${Date.now()}.png`;
  a.click();
});

// ============================================================================
// MÁY ẢNH & QUAY VIDEO TRỰC TIẾP (HỖ TRỢ LẬT CAMERA + ZOOM + MIC)
// ============================================================================

async function openLiveCameraStream() {
  stopCameraStream();
  const cameraVideo = document.getElementById('cameraVideo');
  const canvas = document.getElementById('cameraPreviewCanvas');

  const stream = await navigator.mediaDevices.getUserMedia({
    video: {
      width: { ideal: 1080 },
      height: { ideal: 1080 },
      facingMode: state.cameraFacingMode,
    },
    audio: false,
  });
  state.cameraStream = stream;
  state.cameraSourceImage = null;
  cameraVideo.srcObject = stream;
  await cameraVideo.play();

  previewImage.classList.add('hidden');
  previewVideo?.classList.add('hidden');
  previewPlaceholder.classList.add('hidden');
  document.getElementById('pbVideo')?.classList.add('hidden');
  canvas.classList.remove('hidden');
  btnToggleCameraText.textContent = 'Tắt Cam';
  const hint = document.getElementById('lblCenterShutterHint');
  if (hint && state.camMode === 'camera') {
    hint.textContent = state.videoTapMode ? 'Chạm Quay / Dừng Video' : 'Chạm chụp • Giữ quay';
  }
  startCameraRenderLoop();
}

async function startVideoRecording() {
  if (state.isRecordingVideo) return;
  if (!state.cameraStream) {
    try {
      await openLiveCameraStream();
    } catch (err) {
      showStatus(`❌ Không thể mở Camera để quay video (${err.message}).`, 'error');
      return;
    }
  }

  const canvas = document.getElementById('cameraPreviewCanvas');
  if (!canvas || typeof canvas.captureStream !== 'function' || typeof MediaRecorder === 'undefined') {
    showStatus('⚠️ Trình duyệt này chưa hỗ trợ quay video trực tiếp. Bạn có thể chọn video từ Thư viện!', 'error');
    return;
  }

  const videoStream = canvas.captureStream(30);
  let combinedTracks = [...videoStream.getVideoTracks()];

  if (state.micEnabled && navigator.mediaDevices?.getUserMedia) {
    try {
      const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      state.audioMicStream = micStream;
      combinedTracks = combinedTracks.concat(micStream.getAudioTracks());
    } catch (_) {
      // Bỏ qua nếu người dùng từ chối mic, vẫn quay video không tiếng
    }
  }

  const combinedStream = new MediaStream(combinedTracks);
  const mimeCandidates = [
    'video/mp4;codecs=avc1,mp4a.40.2',
    'video/mp4',
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
  ];
  const chosenMime = mimeCandidates.find((m) => MediaRecorder.isTypeSupported(m)) || '';

  state.recordedChunks = [];
  state.currentVideoMimeType = chosenMime ? chosenMime.split(';')[0] : 'video/webm';

  try {
    state.mediaRecorder = chosenMime
      ? new MediaRecorder(combinedStream, { mimeType: chosenMime })
      : new MediaRecorder(combinedStream);
  } catch (_) {
    state.mediaRecorder = new MediaRecorder(combinedStream);
  }

  state.mediaRecorder.ondataavailable = (ev) => {
    if (ev.data && ev.data.size > 0) state.recordedChunks.push(ev.data);
  };

  state.mediaRecorder.onstop = () => {
    if (state.audioMicStream) {
      state.audioMicStream.getTracks().forEach((t) => t.stop());
      state.audioMicStream = null;
    }
    const blob = new Blob(state.recordedChunks, { type: state.currentVideoMimeType || 'video/mp4' });
    renderCameraCanvasFrame();
    const thumbUrl = canvas.toDataURL('image/webp', 0.9);
    const reader = new FileReader();
    reader.onload = () => {
      setPreviewVideo(reader.result, thumbUrl);
      showStatus('🎥 Đã quay xong video! Nhấn nút vàng ➤ để đăng lên Locket.', 'success');
    };
    reader.readAsDataURL(blob);
  };

  state.isRecordingVideo = true;
  state.recordStartTime = performance.now();
  const MAX_RECORD_MS = 15000;
  document.getElementById('btnCenterShutterAction')?.classList.add('is-recording');
  document.getElementById('locketViewfinder')?.classList.add('is-recording');

  const ringOverlay = document.getElementById('recordingRingOverlay');
  const ringPath = document.getElementById('recordingRingPath');
  ringOverlay?.classList.remove('hidden');
  if (ringPath) {
    ringPath.style.strokeDashoffset = '1000';
  }

  state.mediaRecorder.start(200);

  const animateRing = (now) => {
    if (!state.isRecordingVideo) return;
    const elapsed = now - state.recordStartTime;
    const progress = Math.min(1, elapsed / MAX_RECORD_MS);
    if (ringPath) {
      ringPath.style.strokeDashoffset = String(1000 * (1 - progress));
    }
    if (progress >= 1) {
      stopVideoRecording();
      return;
    }
    state.recordAnimFrameId = requestAnimationFrame(animateRing);
  };
  state.recordAnimFrameId = requestAnimationFrame(animateRing);
}

function stopVideoRecording() {
  if (!state.isRecordingVideo) return;
  state.isRecordingVideo = false;
  if (state.recordAnimFrameId) {
    cancelAnimationFrame(state.recordAnimFrameId);
    state.recordAnimFrameId = null;
  }
  document.getElementById('btnCenterShutterAction')?.classList.remove('is-recording');
  document.getElementById('locketViewfinder')?.classList.remove('is-recording');
  const ringOverlay = document.getElementById('recordingRingOverlay');
  const ringPath = document.getElementById('recordingRingPath');
  ringOverlay?.classList.add('hidden');
  if (ringPath) {
    ringPath.style.strokeDashoffset = '1000';
  }
  if (state.mediaRecorder && state.mediaRecorder.state !== 'inactive') {
    try {
      state.mediaRecorder.stop();
    } catch (_) {}
  }
}

function setupCameraTab() {
  const btnFlipCamera = document.getElementById('btnFlipCamera');
  const btnMirrorCamera = document.getElementById('btnMirrorCamera');
  const canvas = document.getElementById('cameraPreviewCanvas');
  const btnCapturePhoto = document.getElementById('btnCapturePhoto');

  btnToggleCamera.addEventListener('click', async () => {
    if (state.cameraStream) {
      stopCameraStream();
      btnToggleCameraText.textContent = 'Bật Cam';
      canvas.classList.add('hidden');
      if (!state.currentBase64Image && !state.currentVideoDataUrl) {
        previewPlaceholder.classList.remove('hidden');
      }
      return;
    }
    try {
      await openLiveCameraStream();
    } catch (err) {
      showStatus(`❌ Không thể mở Camera (${err.message}). Bạn có thể bấm Thư viện góc trái để chọn ảnh/video!`, 'error');
    }
  });

  btnFlipCamera.addEventListener('click', async () => {
    state.cameraFacingMode = state.cameraFacingMode === 'user' ? 'environment' : 'user';
    state.cameraMirrored = state.cameraFacingMode === 'user';

    if (state.cameraStream) {
      try {
        await openLiveCameraStream();
      } catch (err) {
        showStatus(`❌ Không thể đổi camera: ${err.message}`, 'error');
      }
    } else {
      try {
        await openLiveCameraStream();
      } catch (err) {
        showStatus(`ℹ️ Đã chuyển sang ${state.cameraFacingMode === 'user' ? 'Camera Trước' : 'Camera Sau'}.`, 'info');
      }
    }
  });

  btnMirrorCamera?.addEventListener('click', () => {
    state.cameraMirrored = !state.cameraMirrored;
    renderCameraCanvasFrame();
  });

  btnCapturePhoto.addEventListener('click', () => {
    renderCameraCanvasFrame();
    const flash = document.getElementById('cameraFlashOverlay');
    if (flash) {
      flash.classList.remove('hidden');
      setTimeout(() => flash.classList.add('hidden'), state.flashEnabled ? 280 : 150);
    }

    const dataUrl = canvas.toDataURL('image/webp', 0.92);
    state.originalBase64BeforeEdit = dataUrl;
    btnUndoAiEdit.classList.add('hidden');
    setPreviewImage(dataUrl);
    showStatus('📸 Đã chụp ảnh! Bạn có thể chọn Caption hoặc bấm nút vàng ➤ để gửi Locket.', 'success');
  });
}

function stopCameraStream() {
  stopVideoRecording();
  if (state.cameraAnimFrameId) {
    cancelAnimationFrame(state.cameraAnimFrameId);
    state.cameraAnimFrameId = null;
  }
  if (state.cameraStream) {
    state.cameraStream.getTracks().forEach((t) => t.stop());
    state.cameraStream = null;
  }
}

function startCameraRenderLoop() {
  const loop = () => {
    if (!state.cameraStream) return;
    renderCameraCanvasFrame();
    state.cameraAnimFrameId = requestAnimationFrame(loop);
  };
  loop();
}

function renderCameraCanvasFrame() {
  const canvas = document.getElementById('cameraPreviewCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const size = canvas.width;
  const video = document.getElementById('cameraVideo');
  const source = state.cameraStream ? video : state.cameraSourceImage;
  if (!source) return;

  const srcW = state.cameraStream ? video.videoWidth : source.width;
  const srcH = state.cameraStream ? video.videoHeight : source.height;
  if (!srcW || !srcH) return;

  ctx.clearRect(0, 0, size, size);
  ctx.save();
  const minSide = Math.min(srcW, srcH);
  const zoom = Math.max(1, state.cameraZoom || 1);
  const cropSide = minSide / zoom;
  const sx = (srcW - cropSide) / 2;
  const sy = (srcH - cropSide) / 2;

  if (state.cameraStream && state.cameraMirrored) {
    ctx.translate(size, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(source, sx, sy, cropSide, cropSide, 0, 0, size, size);
  ctx.restore();
}

// ============================================================================
// PHOTOBOOTH LOCKET 4 KIỂU
// ============================================================================

function setupPhotoboothTab() {
  const pbVideo = document.getElementById('pbVideo');
  const btnStartAutoPhotobooth = document.getElementById('btnStartAutoPhotobooth');
  const pbMultiFileInput = document.getElementById('pbMultiFileInput');
  const btnClearPbSlots = document.getElementById('btnClearPbSlots');
  const pbFooterTextInput = document.getElementById('pbFooterTextInput');

  pbMultiFileInput.addEventListener('change', async (e) => {
    const files = Array.from(e.target.files || []).slice(0, 4);
    if (!files.length) return;
    for (let i = 0; i < files.length; i++) {
      const dataUrl = await readFileAsDataUrl(files[i]);
      setPhotoboothSlot(i, dataUrl);
    }
    await renderPhotoboothComposite();
    showStatus('🎞️ Đã ghép ảnh vào khung Photobooth Locket!', 'success');
    e.target.value = '';
  });

  btnClearPbSlots.addEventListener('click', () => {
    for (let i = 0; i < 4; i++) setPhotoboothSlot(i, null);
  });

  btnStartAutoPhotobooth.addEventListener('click', async () => {
    if (state.pbIsCapturing) return;

    stopCameraStream();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1080 },
          height: { ideal: 1080 },
          facingMode: state.cameraFacingMode,
        },
        audio: false,
      });
      state.pbStream = stream;
      pbVideo.srcObject = stream;
      pbVideo.classList.toggle('scale-x-[-1]', state.cameraFacingMode === 'user');
      await pbVideo.play();
    } catch (err) {
      showStatus(`❌ Không thể mở Camera Photobooth (${err.message}). Hãy chọn 4 ảnh ở khay bên dưới!`, 'error');
      return;
    }

    state.pbIsCapturing = true;
    previewImage.classList.add('hidden');
    previewPlaceholder.classList.add('hidden');
    document.getElementById('cameraPreviewCanvas').classList.add('hidden');
    pbVideo.classList.remove('hidden');

    const countdownOverlay = document.getElementById('pbCountdownOverlay');
    const countdownText = document.getElementById('pbCountdownText');
    const stepLabel = document.getElementById('pbStepLabel');
    const flashOverlay = document.getElementById('cameraFlashOverlay');
    const shutterHint = document.getElementById('lblCenterShutterHint');

    for (let shot = 0; shot < 4; shot++) {
      shutterHint.textContent = `Đang chụp kiểu ${shot + 1}/4...`;
      countdownOverlay.classList.remove('hidden');

      for (let sec = 3; sec >= 1; sec--) {
        countdownText.textContent = String(sec);
        stepLabel.textContent = `Tạo dáng tấm ${shot + 1}/4`;
        await new Promise((r) => setTimeout(r, 850));
      }

      flashOverlay.classList.remove('hidden');
      setTimeout(() => flashOverlay.classList.add('hidden'), 160);

      const shotDataUrl = captureVideoFrameSquare(pbVideo, state.cameraFacingMode === 'user');
      setPhotoboothSlot(shot, shotDataUrl);
      await new Promise((r) => setTimeout(r, 420));
    }

    countdownOverlay.classList.add('hidden');
    pbVideo.classList.add('hidden');
    stopPhotoboothStream();
    state.pbIsCapturing = false;
    shutterHint.textContent = 'Chụp 4 kiểu (3s/tấm)';

    await renderPhotoboothComposite();
    showStatus('🎉 Đã ghép xong tấm Photobooth 4 Polaroid chuẩn Locket!', 'success');
  });

  document.querySelectorAll('.pb-theme-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.pb-theme-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      state.pbTheme = btn.getAttribute('data-pb-theme') || 'black_film';
      renderPhotoboothComposite();
    });
  });

  pbFooterTextInput.addEventListener('input', () => {
    state.pbFooterText = pbFooterTextInput.value;
    renderPhotoboothComposite();
  });

  // Khung Photobooth tùy chỉnh của người dùng
  const btnAddPbFrame = document.getElementById('btnAddPbFrame');
  const pbCustomFrameInput = document.getElementById('pbCustomFrameInput');
  const chkPbHideFooter = document.getElementById('chkPbHideFooter');

  renderCustomPbFramesList();
  loadCustomPbFrames();

  btnAddPbFrame.addEventListener('click', () => {
    pbCustomFrameInput.click();
  });

  pbCustomFrameInput.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    try {
      const { dataUrl, hasAlpha } = await normalizeCustomFrameFile(file);
      const id = `frame_${Date.now()}`;
      const shortName = (file.name || 'Khung riêng').replace(/\.[^.]+$/, '').slice(0, 18) || 'Khung riêng';
      const newFrame = {
        id,
        name: shortName,
        dataUrl,
        mode: hasAlpha ? 'overlay' : 'background',
        hideFooter: hasAlpha,
      };
      state.pbCustomFrames.unshift(newFrame);
      state.pbActiveCustomFrameId = id;
      saveCustomPbFrames();
      renderCustomPbFramesList();
      await renderPhotoboothComposite();
      showStatus(
        hasAlpha
          ? `🖼️ Đã thêm khung PNG trong suốt "${shortName}" (chế độ Đè trên ảnh)!`
          : `🖼️ Đã thêm khung ảnh "${shortName}" (chế độ Làm nền sau)!`,
        'success'
      );
    } catch (err) {
      showStatus(`❌ Không thể đọc file khung: ${err.message}`, 'error');
    }
  });

  document.querySelectorAll('.pb-frame-mode-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const frame = getActiveCustomPbFrame();
      if (!frame) return;
      frame.mode = btn.getAttribute('data-pb-frame-mode') === 'background' ? 'background' : 'overlay';
      saveCustomPbFrames();
      renderCustomPbFramesList();
      renderPhotoboothComposite();
    });
  });

  chkPbHideFooter.addEventListener('change', () => {
    const frame = getActiveCustomPbFrame();
    if (!frame) return;
    frame.hideFooter = chkPbHideFooter.checked;
    saveCustomPbFrames();
    renderPhotoboothComposite();
  });
}

function getActiveCustomPbFrame() {
  if (!state.pbActiveCustomFrameId) return null;
  return state.pbCustomFrames.find((f) => f.id === state.pbActiveCustomFrameId) || null;
}

function openPbFramesDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('No IndexedDB'));
    const req = indexedDB.open('locket_pb_frames_db', 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('kv')) {
        db.createObjectStore('kv');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbSetPbFrames(frames, activeId) {
  try {
    const db = await openPbFramesDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction('kv', 'readwrite');
      const store = tx.objectStore('kv');
      store.put(frames, 'frames');
      store.put(activeId || '', 'activeId');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Bỏ qua nếu trình duyệt chặn IndexedDB
  }
}

async function idbGetPbFrames() {
  try {
    const db = await openPbFramesDb();
    return await new Promise((resolve) => {
      const tx = db.transaction('kv', 'readonly');
      const store = tx.objectStore('kv');
      const r1 = store.get('frames');
      const r2 = store.get('activeId');
      tx.oncomplete = () => {
        resolve({
          frames: Array.isArray(r1.result) ? r1.result : null,
          activeId: typeof r2.result === 'string' ? r2.result : '',
        });
      };
      tx.onerror = () => resolve({ frames: null, activeId: '' });
    });
  } catch {
    return { frames: null, activeId: '' };
  }
}

async function loadCustomPbFrames() {
  let loaded = false;
  const local = await idbGetPbFrames();
  if (local.frames && local.frames.length > 0) {
    state.pbCustomFrames = local.frames;
    state.pbActiveCustomFrameId = local.activeId || state.pbActiveCustomFrameId || '';
    loaded = true;
  }

  try {
    const res = await fetch('/api/photobooth/frames');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.frames) && (data.frames.length > 0 || !loaded)) {
        state.pbCustomFrames = data.frames;
        state.pbActiveCustomFrameId = data.activeFrameId || '';
        await idbSetPbFrames(state.pbCustomFrames, state.pbActiveCustomFrameId);
        loaded = true;
      }
    }
  } catch {
    // Offline: giữ dữ liệu từ IndexedDB / localStorage
  }

  if (loaded) {
    renderCustomPbFramesList();
    if (state.camMode === 'photobooth') {
      renderPhotoboothComposite();
    }
  }
}

function saveCustomPbFrames() {
  idbSetPbFrames(state.pbCustomFrames, state.pbActiveCustomFrameId || '');
  try {
    localStorage.setItem('locket_custom_pb_frames', JSON.stringify(state.pbCustomFrames));
    localStorage.setItem('locket_active_pb_frame_id', state.pbActiveCustomFrameId || '');
  } catch {
    // IndexedDB và server vẫn lưu đầy đủ ngay cả khi localStorage vượt 5MB
  }
  fetch('/api/photobooth/frames', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      frames: state.pbCustomFrames,
      activeFrameId: state.pbActiveCustomFrameId || '',
    }),
  }).catch(() => {});
}

function normalizeCustomFrameFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Lỗi đọc file'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('File ảnh không hợp lệ'));
      img.onload = () => {
        const size = 1000;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        const scale = Math.max(size / img.width, size / img.height);
        const w = img.width * scale;
        const h = img.height * scale;
        const dx = (size - w) / 2;
        const dy = (size - h) / 2;
        ctx.clearRect(0, 0, size, size);
        ctx.drawImage(img, dx, dy, w, h);

        // Kiểm tra nhanh xem ảnh có vùng trong suốt (PNG overlay) hay không
        const sample = ctx.getImageData(0, 0, size, size).data;
        let hasAlpha = false;
        for (let i = 3; i < sample.length; i += 64) {
          if (sample[i] < 245) {
            hasAlpha = true;
            break;
          }
        }
        const dataUrl = hasAlpha ? canvas.toDataURL('image/png') : canvas.toDataURL('image/webp', 0.9);
        resolve({ dataUrl, hasAlpha });
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function renderCustomPbFramesList() {
  const container = document.getElementById('pbCustomFramesList');
  const optionsBox = document.getElementById('pbCustomFrameOptions');
  const chkHideFooter = document.getElementById('chkPbHideFooter');
  if (!container) return;

  const activeId = state.pbActiveCustomFrameId;
  const activeFrame = getActiveCustomPbFrame();

  let html = `
    <button
      type="button"
      data-select-pb-frame=""
      class="shrink-0 h-12 px-3 rounded-xl border text-[10px] font-bold transition flex flex-col items-center justify-center ${
        !activeFrame
          ? 'bg-yellow-400/20 border-yellow-400 text-yellow-300'
          : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'
      }"
    >
      <span>🚫</span>
      <span>Mặc định</span>
    </button>
  `;

  state.pbCustomFrames.forEach((frame) => {
    const isActive = frame.id === activeId;
    html += `
      <div class="relative shrink-0 group">
        <button
          type="button"
          data-select-pb-frame="${escapeHtml(frame.id)}"
          title="${escapeHtml(frame.name)}"
          class="w-12 h-12 rounded-xl overflow-hidden border transition block ${
            isActive ? 'border-2 border-yellow-400 ring-2 ring-yellow-400/30' : 'border-white/15 hover:border-white/40'
          }"
          style="background-image: linear-gradient(45deg, #1f2937 25%, transparent 25%), linear-gradient(-45deg, #1f2937 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #1f2937 75%), linear-gradient(-45deg, transparent 75%, #1f2937 75%); background-size: 10px 10px; background-position: 0 0, 0 5px, 5px -5px, -5px 0;"
        >
          <img src="${frame.dataUrl}" alt="${escapeHtml(frame.name)}" class="w-full h-full object-cover" />
        </button>
        <button
          type="button"
          data-delete-pb-frame="${escapeHtml(frame.id)}"
          title="Xóa khung này"
          class="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-600 text-white text-[9px] font-black flex items-center justify-center shadow hover:bg-red-500"
        >✕</button>
      </div>
    `;
  });

  container.innerHTML = html;

  container.querySelectorAll('[data-select-pb-frame]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.pbActiveCustomFrameId = btn.getAttribute('data-select-pb-frame') || '';
      saveCustomPbFrames();
      renderCustomPbFramesList();
      renderPhotoboothComposite();
    });
  });

  container.querySelectorAll('[data-delete-pb-frame]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const delId = btn.getAttribute('data-delete-pb-frame');
      state.pbCustomFrames = state.pbCustomFrames.filter((f) => f.id !== delId);
      if (state.pbActiveCustomFrameId === delId) {
        state.pbActiveCustomFrameId = '';
      }
      saveCustomPbFrames();
      renderCustomPbFramesList();
      renderPhotoboothComposite();
    });
  });

  if (optionsBox) {
    if (activeFrame) {
      optionsBox.classList.remove('hidden');
      document.querySelectorAll('.pb-frame-mode-btn').forEach((btn) => {
        btn.classList.toggle('active', btn.getAttribute('data-pb-frame-mode') === activeFrame.mode);
      });
      if (chkHideFooter) chkHideFooter.checked = Boolean(activeFrame.hideFooter);
    } else {
      optionsBox.classList.add('hidden');
    }
  }
}

function stopPhotoboothStream() {
  if (state.pbStream) {
    state.pbStream.getTracks().forEach((t) => t.stop());
    state.pbStream = null;
  }
}

function readFileAsDataUrl(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });
}

function captureVideoFrameSquare(videoEl, mirror = true) {
  const canvas = document.createElement('canvas');
  canvas.width = 720;
  canvas.height = 720;
  const ctx = canvas.getContext('2d');
  const vw = videoEl.videoWidth || 720;
  const vh = videoEl.videoHeight || 720;
  const minSide = Math.min(vw, vh);
  const sx = (vw - minSide) / 2;
  const sy = (vh - minSide) / 2;

  ctx.save();
  if (mirror) {
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(videoEl, sx, sy, minSide, minSide, 0, 0, canvas.width, canvas.height);
  ctx.restore();
  return canvas.toDataURL('image/jpeg', 0.92);
}

function setPhotoboothSlot(index, dataUrl) {
  state.pbSlots[index] = dataUrl;
  const slotEl = document.querySelector(`.pb-slot[data-slot="${index}"]`);
  if (!slotEl) return;
  const imgEl = slotEl.querySelector('img');
  const lblEl = slotEl.querySelector('span');
  if (!imgEl || !lblEl) return;

  if (dataUrl) {
    imgEl.src = dataUrl;
    imgEl.classList.remove('hidden');
    lblEl.classList.add('hidden');
  } else {
    imgEl.src = '';
    imgEl.classList.add('hidden');
    lblEl.classList.remove('hidden');
  }
}

function loadImageElement(src) {
  return new Promise((resolve) => {
    if (!src) return resolve(null);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function drawRoundedImage(ctx, img, x, y, w, h, radius) {
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
  ctx.clip();

  if (img) {
    // Cắt trung tâm đúng tỉ lệ khung đích (object-cover) để ảnh không bị méo
    const imgRatio = img.width / img.height;
    const boxRatio = w / h;
    let sx = 0;
    let sy = 0;
    let sw = img.width;
    let sh = img.height;
    if (imgRatio > boxRatio) {
      sw = img.height * boxRatio;
      sx = (img.width - sw) / 2;
    } else {
      sh = img.width / boxRatio;
      sy = (img.height - sh) / 2;
    }
    ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
  } else {
    ctx.fillStyle = 'rgba(128, 128, 128, 0.15)';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = 'rgba(156, 163, 175, 0.5)';
    ctx.font = '700 28px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('📸', x + w / 2, y + h / 2);
  }
  ctx.restore();
}

async function renderPhotoboothComposite() {
  const hasAnyPhoto = state.pbSlots.some(Boolean);
  if (!hasAnyPhoto) return;

  const size = 1000;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  const theme = PB_THEMES[state.pbTheme] || PB_THEMES.black_film;
  const activeCustomFrame = getActiveCustomPbFrame();
  const [images, customFrameImg] = await Promise.all([
    Promise.all(state.pbSlots.map((src) => loadImageElement(src))),
    activeCustomFrame ? loadImageElement(activeCustomFrame.dataUrl) : Promise.resolve(null),
  ]);
  const isCustomOverlay = Boolean(customFrameImg && activeCustomFrame.mode === 'overlay');
  const isCustomBg = Boolean(customFrameImg && activeCustomFrame.mode === 'background');
  const hideDefaultFooter = Boolean(activeCustomFrame && activeCustomFrame.hideFooter);

  const dateStr = new Date().toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const footerTitle = (state.pbFooterText || 'LOCKET PHOTOBOOTH 💛').trim();

  ctx.fillStyle = theme.bg;
  ctx.fillRect(0, 0, size, size);
  if (isCustomBg) {
    ctx.drawImage(customFrameImg, 0, 0, size, size);
  }

  // Bố cục 4 Polaroid chuẩn 1000×1000 px
  const cardW = 410;
  const cardH = 425;
  [
    { x: 65, y: 45, rot: -0.03 },
    { x: 520, y: 50, rot: 0.03 },
    { x: 70, y: 485, rot: 0.025 },
    { x: 515, y: 480, rot: -0.025 },
  ].forEach((pos, idx) => {
    ctx.save();
    ctx.translate(pos.x + cardW / 2, pos.y + cardH / 2);
    ctx.rotate(pos.rot);
    ctx.translate(-cardW / 2, -cardH / 2);
    ctx.shadowColor = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur = 20;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.roundRect(0, 0, cardW, cardH, 16);
    ctx.fill();
    ctx.shadowBlur = 0;
    drawRoundedImage(ctx, images[idx], 20, 20, cardW - 40, cardW - 55, 10);
    ctx.fillStyle = '#1e293b';
    ctx.font = '700 18px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(idx === 3 ? dateStr : `#0${idx + 1}`, cardW / 2, cardH - 22);
    ctx.restore();
  });
  if (!hideDefaultFooter) {
    ctx.fillStyle = theme.text;
    ctx.font = '800 28px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(footerTitle, size / 2, size - 24);
  }

  // Vẽ khung PNG tùy chỉnh đè lên trên cùng nếu người dùng chọn chế độ "Đè trên ảnh"
  if (isCustomOverlay) {
    ctx.drawImage(customFrameImg, 0, 0, size, size);
  }

  let finalDataUrl = canvas.toDataURL('image/webp', 0.92);
  if (!finalDataUrl.startsWith('data:image/webp')) {
    finalDataUrl = canvas.toDataURL('image/jpeg', 0.92);
  }
  state.originalBase64BeforeEdit = finalDataUrl;
  setPreviewImage(finalDataUrl);
}

// ============================================================================
// LỊCH SỬ KHOẢNH KHẮC & AI ĐÃ XEM (CHẾ ĐỘ THẺ & CHẾ ĐỘ LƯỚI LOCKET DIO)
// ============================================================================

function setupFeedTab() {
  const btnRefreshFeed = document.getElementById('btnRefreshFeed');
  const feedFriendSelect = document.getElementById('feedFriendSelect');

  btnRefreshFeed.addEventListener('click', () => loadMomentsFeed());

  document.querySelectorAll('.feed-view-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.feed-view-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      state.feedViewMode = btn.getAttribute('data-feed-view') || 'card';
      renderFeedMoments();
    });
  });

  document.querySelectorAll('.feed-filter-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.feed-filter-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      state.feedFilterMode = btn.getAttribute('data-feed-filter') || 'all';
      feedFriendSelect.value = '';
      state.feedSelectedFriendUid = '';
      renderFeedMoments();
    });
  });

  feedFriendSelect.addEventListener('change', () => {
    const friendUid = feedFriendSelect.value;
    state.feedSelectedFriendUid = friendUid;
    if (friendUid) {
      document.querySelectorAll('.feed-filter-btn').forEach((b) => b.classList.remove('active'));
      state.feedFilterMode = 'friend';
      loadMomentsFeed(friendUid);
    } else {
      state.feedFilterMode = 'all';
      loadMomentsFeed();
    }
  });

  document.getElementById('btnCloseViewsModal').addEventListener('click', () => {
    viewsModal.classList.add('hidden');
  });
}

async function loadMomentsFeed(specificUserUid = null) {
  if (!isLoggedIn()) {
    loginModal.classList.remove('hidden');
    return;
  }

  const loadingBox = document.getElementById('feedLoadingBox');
  const grid = document.getElementById('feedMomentsGrid');
  loadingBox.classList.remove('hidden');
  grid.classList.add('hidden');

  try {
    if (!state.friends.length) loadFriendsList(true);
    const data = await callLocketApi('/api/locket/feed', {
      filteredByUserId: specificUserUid || null,
      limit: 60,
    });
    state.myUid = data.myUid || state.locketSession.localId;
    state.feedMoments = data.moments || [];
    renderFeedMoments();
  } catch (err) {
    showStatus(`❌ Không thể tải lịch sử Locket: ${err.message}`, 'error');
  } finally {
    loadingBox.classList.add('hidden');
    grid.classList.remove('hidden');
  }
}

function renderFeedMoments() {
  const grid = document.getElementById('feedMomentsGrid');
  let list = state.feedMoments;

  if (state.feedFilterMode === 'mine') {
    list = list.filter((m) => m.is_mine || m.user_uid === state.myUid);
  } else if (state.feedFilterMode === 'friend' && state.feedSelectedFriendUid) {
    list = list.filter((m) => m.user_uid === state.feedSelectedFriendUid);
  }

  if (!list.length) {
    grid.className = 'grid grid-cols-1 gap-4';
    grid.innerHTML = `
      <div class="dio-panel rounded-3xl p-10 text-center space-y-3">
        <div class="text-4xl">📭</div>
        <p class="text-sm font-bold text-white">Chưa có khoảnh khắc nào</p>
        <p class="text-xs text-gray-400">Hãy bấm "Tải lại" hoặc quay lại Máy ảnh để đăng một ảnh mới nhé!</p>
      </div>
    `;
    return;
  }

  if (state.feedViewMode === 'grid') {
    grid.className = 'grid grid-cols-3 gap-2';
    grid.innerHTML = list
      .map(
        (m, idx) => `
      <button type="button" data-grid-idx="${idx}" class="grid-moment-tile aspect-square rounded-2xl overflow-hidden relative bg-[#12151f] border border-white/10 group">
        <img src="${escapeHtml(m.thumbnail_url)}" loading="lazy" alt="Locket" class="w-full h-full object-cover group-hover:scale-105 transition" />
        ${
          m.caption
            ? `<div class="absolute bottom-1.5 inset-x-1.5 px-1.5 py-0.5 rounded-full bg-black/70 text-[9px] text-white font-bold truncate">${escapeHtml(m.caption)}</div>`
            : ''
        }
        ${m.is_mine ? `<span class="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-yellow-400"></span>` : ''}
      </button>`
      )
      .join('');

    grid.querySelectorAll('.grid-moment-tile').forEach((tile) => {
      tile.addEventListener('click', () => {
        document.querySelector('[data-feed-view="card"]')?.click();
      });
    });
    return;
  }

  grid.className = 'grid grid-cols-1 gap-4';
  grid.innerHTML = list
    .map((m) => {
      const authorName = escapeHtml(m.author?.display_name || (m.is_mine ? 'Bạn' : 'Bạn bè'));
      const avatarUrl = m.author?.profile_picture_url;
      const avatarHtml = avatarUrl
        ? `<img src="${escapeHtml(avatarUrl)}" class="w-9 h-9 rounded-full object-cover border border-yellow-400/40" />`
        : `<div class="w-9 h-9 rounded-full bg-yellow-400/20 text-yellow-300 font-bold text-xs flex items-center justify-center">${authorName.slice(0, 1).toUpperCase()}</div>`;

      const mediaHtml = m.video_url
        ? `<video src="${escapeHtml(m.video_url)}" poster="${escapeHtml(m.thumbnail_url)}" controls loop playsinline class="w-full h-full object-cover"></video>`
        : `<img src="${escapeHtml(m.thumbnail_url)}" loading="lazy" alt="Locket Moment" class="w-full h-full object-cover" />`;

      const captionHtml = m.caption
        ? `<div class="absolute bottom-4 inset-x-4 flex justify-center pointer-events-none">
             <div class="caption-preview-pill px-4 py-1.5 rounded-full text-xs sm:text-sm font-bold text-white bg-black/65 text-center max-w-full break-words border border-white/15">
               ${escapeHtml(m.caption)}
             </div>
           </div>`
        : '';

      const bottomInteractionBar = m.is_mine
        ? `
          <div class="flex items-center gap-2">
            <button type="button" data-views-moment="${escapeHtml(m.moment_uid)}" class="btn-check-views flex-1 py-2.5 px-4 rounded-full bg-[#1a1d28] hover:bg-yellow-400/20 border border-yellow-400/35 text-yellow-300 font-extrabold text-xs flex items-center justify-center gap-2 transition">
              <span>👁️</span><span>Ai đã xem & thả tim</span>
            </button>
            <button type="button" data-delete-moment="${escapeHtml(m.moment_uid)}" class="btn-delete-moment w-10 h-10 rounded-full bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-xs text-red-300 flex items-center justify-center transition" title="Xoá bài">🗑️</button>
          </div>
        `
        : `
          <div class="space-y-2">
            <div class="flex items-center gap-1.5 bg-[#181b26] border border-white/10 rounded-full pl-3.5 pr-2 py-1.5">
              <input type="text" placeholder="Gửi tin nhắn..." data-reply-input="${escapeHtml(m.moment_uid)}" class="flex-1 bg-transparent text-xs text-white placeholder-gray-400 focus:outline-none min-w-0" />
              <div class="flex items-center gap-0.5">
                ${['💛', '❤️', '🔥', '😍', '😂']
                  .map(
                    (emoji) => `<button type="button" data-react-moment="${escapeHtml(m.moment_uid)}" data-emoji="${emoji}" class="btn-react-moment hover:scale-125 transition text-sm px-1">${emoji}</button>`
                  )
                  .join('')}
              </div>
              <button type="button" data-reply-moment="${escapeHtml(m.moment_uid)}" data-receiver-uid="${escapeHtml(m.user_uid)}" class="btn-reply-moment px-3 py-1.5 rounded-full bg-yellow-400 hover:bg-yellow-300 text-black text-[11px] font-extrabold transition">Gửi</button>
            </div>
            <div class="flex justify-end">
              <button type="button" data-views-moment="${escapeHtml(m.moment_uid)}" class="btn-check-views text-[11px] text-gray-400 hover:text-yellow-300 font-semibold flex items-center gap-1">👁️ Ai đã thả cảm xúc</button>
            </div>
          </div>
        `;

      return `
        <article class="dio-panel rounded-[36px] p-4 flex flex-col space-y-3 border border-white/10">
          <div class="locket-squircle relative w-full overflow-hidden bg-[#12151f]">
            ${mediaHtml}
            ${captionHtml}
          </div>
          <div class="flex items-center justify-center gap-2">
            ${avatarHtml}
            <span class="text-xs font-extrabold text-white">${authorName}</span>
            <span class="text-xs text-gray-500">•</span>
            <span class="text-xs font-semibold text-gray-400">${formatTimeAgo(m.date)}</span>
          </div>
          ${bottomInteractionBar}
        </article>
      `;
    })
    .join('');

  grid.querySelectorAll('.btn-check-views').forEach((btn) => {
    btn.addEventListener('click', () => openMomentViewsModal(btn.getAttribute('data-views-moment')));
  });

  grid.querySelectorAll('.btn-react-moment').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const momentUid = btn.getAttribute('data-react-moment');
      const emoji = btn.getAttribute('data-emoji');
      btn.classList.add('scale-150');
      try {
        await callLocketApi('/api/locket/moment/react', { momentUid, emoji });
        showStatus(`🎉 Đã thả ${emoji} vào khoảnh khắc!`, 'success');
      } catch (err) {
        showStatus(`❌ Không thể thả cảm xúc: ${err.message}`, 'error');
      } finally {
        setTimeout(() => btn.classList.remove('scale-150'), 300);
      }
    });
  });

  grid.querySelectorAll('.btn-reply-moment').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const momentUid = btn.getAttribute('data-reply-moment');
      const receiverUid = btn.getAttribute('data-receiver-uid');
      const inputEl = grid.querySelector(`input[data-reply-input="${momentUid}"]`);
      const text = inputEl ? inputEl.value.trim() : '';
      if (!text) {
        showStatus('⚠️ Hãy nhập tin nhắn phản hồi trước khi bấm Gửi nhé!', 'error');
        return;
      }
      btn.disabled = true;
      try {
        await callLocketApi('/api/locket/chat/send', { receiverUid, text, momentUid });
        if (inputEl) inputEl.value = '';
        showStatus('💬 Đã gửi tin nhắn phản hồi vào hộp thư Locket!', 'success');
      } catch (err) {
        showStatus(`❌ Lỗi gửi phản hồi: ${err.message}`, 'error');
      } finally {
        btn.disabled = false;
      }
    });
  });

  grid.querySelectorAll('.btn-delete-moment').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const momentUid = btn.getAttribute('data-delete-moment');
      if (!confirm('Bạn có chắc chắn muốn xoá khoảnh khắc này khỏi Locket không?')) return;
      try {
        await callLocketApi('/api/locket/moment/delete', { momentUid });
        state.feedMoments = state.feedMoments.filter((m) => m.moment_uid !== momentUid);
        renderFeedMoments();
        showStatus('🗑️ Đã xoá khoảnh khắc khỏi Locket!', 'success');
      } catch (err) {
        showStatus(`❌ Không thể xoá: ${err.message}`, 'error');
      }
    });
  });
}

async function openMomentViewsModal(momentUid) {
  viewsModal.classList.remove('hidden');
  const summaryEl = document.getElementById('viewsModalSummary');
  const bodyEl = document.getElementById('viewsModalBody');
  summaryEl.textContent = '⏳ Đang kiểm tra lượt xem & thả tim từ Locket...';
  bodyEl.innerHTML = '';

  try {
    const data = await callLocketApi('/api/locket/moment/views', { momentUid });
    const viewers = data.viewers || [];
    const totalViews = data.total_views ?? viewers.length;
    const totalReacts = data.total_reactions ?? (data.reactions || []).length;
    summaryEl.textContent = `👁️ ${totalViews} lượt xem  •  💛 ${totalReacts} thả cảm xúc`;

    if (!viewers.length && !totalReacts) {
      bodyEl.innerHTML = `<div class="text-center py-6 text-xs text-gray-400">👀 Chưa có ai mở xem khoảnh khắc này.</div>`;
      return;
    }

    bodyEl.innerHTML = viewers
      .map((v) => {
        const av = v.profile_picture_url
          ? `<img src="${escapeHtml(v.profile_picture_url)}" class="w-9 h-9 rounded-full object-cover border border-white/15" />`
          : `<div class="w-9 h-9 rounded-full bg-yellow-400/20 text-yellow-300 font-bold text-xs flex items-center justify-center">${escapeHtml((v.display_name || 'U').slice(0, 1))}</div>`;
        const badge = v.reaction
          ? `<span class="px-2.5 py-1 rounded-full bg-pink-500/20 border border-pink-500/30 text-sm">${escapeHtml(v.reaction)}</span>`
          : `<span class="text-[11px] text-emerald-400 font-semibold bg-emerald-500/10 px-2.5 py-1 rounded-full">👁️ Đã xem</span>`;

        return `
          <div class="flex items-center justify-between p-2.5 rounded-2xl bg-white/5 border border-white/10">
            <div class="flex items-center gap-2.5">
              ${av}
              <div>
                <div class="text-xs font-extrabold text-white">${escapeHtml(v.display_name)}</div>
                <div class="text-[10px] text-gray-400">${formatTimeAgo(v.viewed_at) || 'Đã xem'}</div>
              </div>
            </div>
            ${badge}
          </div>
        `;
      })
      .join('');
  } catch (err) {
    summaryEl.textContent = `❌ Lỗi: ${err.message}`;
  }
}

// ============================================================================
// HỘP THƯ TIN NHẮN LOCKET (RIGHTSIDEBAR DESKTOP • CHAT PANE MOBILE)
// ============================================================================

function setupChatTab() {
  const btnRefreshConversations = document.getElementById('btnRefreshConversations');
  const btnReloadActiveMessages = document.getElementById('btnReloadActiveMessages');
  const chatStartWithFriendSelect = document.getElementById('chatStartWithFriendSelect');
  const formSendChatMessage = document.getElementById('formSendChatMessage');

  document.getElementById('btnBackToConvList').addEventListener('click', () => {
    document.getElementById('chatDetailPane').classList.add('hidden');
    document.getElementById('chatConversationsPane').classList.remove('hidden');
  });

  btnRefreshConversations.addEventListener('click', () => loadConversations());

  btnReloadActiveMessages.addEventListener('click', () => {
    if (state.activeConversationId) {
      loadConversationMessages(state.activeConversationId, state.activeChatPeer);
    }
  });

  chatStartWithFriendSelect.addEventListener('change', () => {
    const friendUid = chatStartWithFriendSelect.value;
    if (!friendUid) return;
    const existingConv = state.conversations.find((c) => c.peer_uid === friendUid);
    if (existingConv) {
      loadConversationMessages(existingConv.conversation_id, existingConv.peer);
    } else {
      const friendObj = state.friends.find((f) => f.uid === friendUid) || { uid: friendUid, display_name: `Bạn bè (${friendUid.slice(0, 6)})` };
      openDirectComposeWithFriend(friendObj);
    }
    chatStartWithFriendSelect.value = '';
  });

  formSendChatMessage.addEventListener('submit', async (e) => {
    e.preventDefault();
    const inputEl = document.getElementById('chatMessageInput');
    const btnSend = document.getElementById('btnSendChatMessage');
    const text = inputEl.value.trim();
    if (!text || !state.activeChatPeer?.uid) return;

    btnSend.disabled = true;
    inputEl.disabled = true;
    try {
      await callLocketApi('/api/locket/chat/send', { receiverUid: state.activeChatPeer.uid, text });
      inputEl.value = '';
      if (state.activeConversationId) {
        await loadConversationMessages(state.activeConversationId, state.activeChatPeer);
      } else {
        await loadConversations();
      }
    } catch (err) {
      showStatus(`❌ Gửi tin nhắn thất bại: ${err.message}`, 'error');
    } finally {
      btnSend.disabled = false;
      inputEl.disabled = false;
      inputEl.focus();
    }
  });
}

async function loadConversations(silent = false) {
  if (!isLoggedIn()) {
    if (!silent) loginModal.classList.remove('hidden');
    return;
  }

  const listEl = document.getElementById('conversationsList');
  if (!silent) {
    listEl.innerHTML = `<div class="p-8 text-center text-xs text-gray-400">⏳ Đang tải hộp thư Locket...</div>`;
  }
  try {
    const data = await callLocketApi('/api/locket/chat/conversations');
    state.conversations = data.conversations || [];
    renderConversationsList();
  } catch (err) {
    if (!silent) {
      listEl.innerHTML = `<div class="p-6 text-center text-xs text-red-400">❌ Lỗi tải hộp thư: ${escapeHtml(err.message)}</div>`;
    }
  }
}

function renderConversationsList() {
  const listEl = document.getElementById('conversationsList');
  const unreadBadge = document.getElementById('chatUnreadBadge');
  const bottomBadge = document.getElementById('bottomChatBadge');
  const totalUnread = state.conversations.reduce((sum, c) => sum + (c.unread_count || 0), 0);
  if (totalUnread > 0) {
    unreadBadge.textContent = String(totalUnread);
    unreadBadge.classList.remove('hidden');
    if (bottomBadge) {
      bottomBadge.textContent = String(totalUnread);
      bottomBadge.classList.remove('hidden');
    }
  } else {
    unreadBadge.classList.add('hidden');
    bottomBadge?.classList.add('hidden');
  }

  if (!state.conversations.length) {
    listEl.innerHTML = `<div class="p-8 text-center text-xs text-gray-400">📭 Chưa có hội thoại nào. Chọn bạn bè ở trên để nhắn tin mới!</div>`;
    return;
  }

  listEl.innerHTML = state.conversations
    .map((c) => {
      const peerName = escapeHtml(c.peer?.display_name || 'Bạn bè Locket');
      const avatarHtml = c.peer?.profile_picture_url
        ? `<img src="${escapeHtml(c.peer.profile_picture_url)}" class="w-10 h-10 rounded-full object-cover border border-white/10" />`
        : `<div class="w-10 h-10 rounded-full bg-yellow-400/20 text-yellow-300 font-bold text-xs flex items-center justify-center">${peerName.slice(0, 1).toUpperCase()}</div>`;
      const lastText = escapeHtml(c.latest_message?.text || '📷 Đã phản hồi khoảnh khắc');
      const unreadDot = c.unread_count > 0 ? `<span class="px-1.5 py-0.5 rounded-full bg-yellow-400 text-black font-extrabold text-[10px]">${c.unread_count}</span>` : '';

      return `
        <button type="button" data-conv-id="${escapeHtml(c.conversation_id)}" class="conv-item w-full text-left p-3 hover:bg-white/5 transition flex items-center gap-2.5">
          ${avatarHtml}
          <div class="flex-1 min-w-0">
            <div class="flex items-center justify-between gap-2">
              <span class="text-xs font-extrabold text-white truncate">${peerName}</span>
              <span class="text-[10px] text-gray-500 whitespace-nowrap">${formatTimeAgo(c.updated_at)}</span>
            </div>
            <div class="flex items-center justify-between gap-2 mt-0.5">
              <p class="text-[11px] ${c.unread_count > 0 ? 'text-white font-bold' : 'text-gray-400'} truncate">${lastText}</p>
              ${unreadDot}
            </div>
          </div>
        </button>
      `;
    })
    .join('');

  listEl.querySelectorAll('.conv-item').forEach((btn) => {
    btn.addEventListener('click', () => {
      const convId = btn.getAttribute('data-conv-id');
      const conv = state.conversations.find((item) => item.conversation_id === convId);
      if (conv) loadConversationMessages(conv.conversation_id, conv.peer);
    });
  });
}

function showChatDetailPane(peer) {
  document.getElementById('chatConversationsPane').classList.add('hidden');
  document.getElementById('chatDetailPane').classList.remove('hidden');

  document.getElementById('chatActivePeerName').textContent = peer?.display_name || 'Bạn bè Locket';
  document.getElementById('chatActivePeerSub').textContent = peer?.username ? `@${peer.username}` : 'Locket Chat';
  const av = document.getElementById('chatActivePeerAvatar');
  if (peer?.profile_picture_url) {
    av.innerHTML = `<img src="${escapeHtml(peer.profile_picture_url)}" class="w-full h-full rounded-full object-cover" />`;
  } else {
    av.textContent = (peer?.display_name || '💬').slice(0, 1).toUpperCase();
  }
}

function openDirectComposeWithFriend(friendObj) {
  state.activeConversationId = null;
  state.activeChatPeer = friendObj;
  showChatDetailPane(friendObj);
  document.getElementById('chatMessageInput').disabled = false;
  document.getElementById('btnSendChatMessage').disabled = false;
  document.getElementById('chatMessagesList').innerHTML = `
    <div class="h-full flex flex-col items-center justify-center text-center p-6 text-gray-400 space-y-2">
      <div class="text-2xl">👋</div>
      <p class="text-xs font-bold text-white">Nhắn tin với ${escapeHtml(friendObj.display_name)}</p>
    </div>
  `;
}

async function loadConversationMessages(conversationId, peerObj) {
  state.activeConversationId = conversationId;
  state.activeChatPeer = peerObj;
  showChatDetailPane(peerObj);
  document.getElementById('chatMessageInput').disabled = false;
  document.getElementById('btnSendChatMessage').disabled = false;

  const msgContainer = document.getElementById('chatMessagesList');
  msgContainer.innerHTML = `<div class="p-6 text-center text-xs text-gray-400">⏳ Đang tải tin nhắn...</div>`;
  try {
    const data = await callLocketApi('/api/locket/chat/messages', { conversationId });
    state.activeMessages = data.messages || [];
    renderMessagesTimeline();
  } catch (err) {
    msgContainer.innerHTML = `<div class="p-6 text-center text-xs text-red-400">❌ Không thể tải tin nhắn: ${escapeHtml(err.message)}</div>`;
  }
}

function renderMessagesTimeline() {
  const msgContainer = document.getElementById('chatMessagesList');
  if (!state.activeMessages.length) {
    msgContainer.innerHTML = `<div class="p-6 text-center text-xs text-gray-500">Chưa có tin nhắn nào.</div>`;
    return;
  }

  msgContainer.innerHTML = state.activeMessages
    .map((m) => {
      const alignClass = m.is_me ? 'items-end' : 'items-start';
      const bubbleClass = m.is_me
        ? 'bg-gradient-to-r from-yellow-400 to-amber-400 text-black font-semibold rounded-2xl rounded-br-sm'
        : 'bg-white/10 text-white rounded-2xl rounded-bl-sm border border-white/10';
      const thumbHtml = m.thumbnail_url
        ? `<div class="mb-1 rounded-2xl overflow-hidden border border-white/15 w-32 h-32 bg-black/40"><img src="${escapeHtml(m.thumbnail_url)}" class="w-full h-full object-cover" /></div>`
        : '';
      const reactionsBadge =
        m.reactions && m.reactions.length > 0
          ? `<div class="flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full bg-white/10 text-[11px]">${m.reactions.map((r) => escapeHtml(r.emoji)).join(' ')}</div>`
          : '';

      return `
        <div class="flex flex-col ${alignClass} group">
          ${thumbHtml}
          <div class="flex items-center gap-1.5 max-w-[85%] ${m.is_me ? 'flex-row-reverse' : 'flex-row'}">
            <div class="px-3.5 py-2 text-xs leading-relaxed break-words shadow ${bubbleClass}">${escapeHtml(m.text)}</div>
            <div class="opacity-0 group-hover:opacity-100 transition flex items-center gap-0.5 bg-black/60 px-1.5 py-0.5 rounded-full border border-white/10">
              ${['❤️', '💛', '😂', '🔥']
                .map((emoji) => `<button type="button" data-msg-id="${escapeHtml(m.message_id)}" data-emoji="${emoji}" class="btn-react-msg hover:scale-125 transition text-[11px] px-0.5">${emoji}</button>`)
                .join('')}
            </div>
          </div>
          ${reactionsBadge}
          <span class="text-[9px] text-gray-500 mt-0.5 px-1">${formatTimeAgo(m.timestamp)}</span>
        </div>
      `;
    })
    .join('');

  msgContainer.scrollTop = msgContainer.scrollHeight;
  msgContainer.querySelectorAll('.btn-react-msg').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const messageId = btn.getAttribute('data-msg-id');
      const emoji = btn.getAttribute('data-emoji');
      if (!state.activeConversationId || !messageId) return;
      try {
        await callLocketApi('/api/locket/chat/react', { conversationId: state.activeConversationId, messageId, emoji });
        await loadConversationMessages(state.activeConversationId, state.activeChatPeer);
      } catch (err) {
        showStatus(`❌ Không thể thả cảm xúc: ${err.message}`, 'error');
      }
    });
  });
}

// ============================================================================
// ĐĂNG NHẬP LOCKET & GEMINI API KEY SETTINGS
// ============================================================================

document.getElementById('btnOpenLogin').addEventListener('click', () => loginModal.classList.remove('hidden'));
document.getElementById('btnCloseLogin').addEventListener('click', () => loginModal.classList.add('hidden'));

const tabEmailLogin = document.getElementById('tabEmailLogin');
const tabTokenLogin = document.getElementById('tabTokenLogin');
const formEmailLogin = document.getElementById('formEmailLogin');
const formTokenLogin = document.getElementById('formTokenLogin');

tabEmailLogin.addEventListener('click', () => {
  tabEmailLogin.className = 'py-2 rounded-lg bg-yellow-400 text-black transition';
  tabTokenLogin.className = 'py-2 rounded-lg text-gray-400 hover:text-white transition';
  formEmailLogin.classList.remove('hidden');
  formTokenLogin.classList.add('hidden');
});

tabTokenLogin.addEventListener('click', () => {
  tabTokenLogin.className = 'py-2 rounded-lg bg-yellow-400 text-black transition';
  tabEmailLogin.className = 'py-2 rounded-lg text-gray-400 hover:text-white transition';
  formTokenLogin.classList.remove('hidden');
  formEmailLogin.classList.add('hidden');
});

formEmailLogin.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('locketEmail').value.trim();
  const password = document.getElementById('locketPassword').value;
  const btnSubmitLogin = document.getElementById('btnSubmitLogin');
  btnSubmitLogin.disabled = true;
  btnSubmitLogin.textContent = 'Đang xác thực...';

  try {
    const res = await fetch('/api/locket/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || 'Đăng nhập thất bại');

    state.locketSession = data.session;
    localStorage.setItem('locket_session', JSON.stringify(data.session));
    updateAccountUI();
    loginModal.classList.add('hidden');
    loadFriendsList(true);
    loadConversations(true);
    showStatus(`✅ Đã kết nối Locket: ${data.session.displayName || data.session.email}`, 'success');
  } catch (err) {
    const isNetworkDown = /failed to fetch|load failed|networkerror/i.test(err?.message || '');
    const friendlyMsg = isNetworkDown
      ? 'Không kết nối được tới máy chủ Locket Studio (server trên máy tính đang tắt hoặc link HTTPS tunnel cũ đã hết hạn). Hãy bật lại server / mở link HTTPS mới rồi thử lại!'
      : err.message;
    alert(`Lỗi đăng nhập Locket: ${friendlyMsg}`);
  } finally {
    btnSubmitLogin.disabled = false;
    btnSubmitLogin.textContent = 'Đăng nhập Locket';
  }
});

formTokenLogin.addEventListener('submit', (e) => {
  e.preventDefault();
  const localId = document.getElementById('manualLocalId').value.trim();
  const idToken = document.getElementById('manualIdToken').value.trim();
  if (!localId || !idToken) return;

  state.locketSession = { localId, idToken, displayName: `UID_${localId.slice(0, 6)}` };
  localStorage.setItem('locket_session', JSON.stringify(state.locketSession));
  updateAccountUI();
  loginModal.classList.add('hidden');
  loadFriendsList(true);
  loadConversations(true);
  showStatus('✅ Đã lưu Token Locket!', 'success');
});

document.getElementById('btnLogoutLocket').addEventListener('click', () => {
  state.locketSession = null;
  state.friends = [];
  state.feedMoments = [];
  state.conversations = [];
  localStorage.removeItem('locket_session');
  updateAccountUI();
  renderSidebarFriends();
  showStatus('Đã đăng xuất tài khoản Locket.', 'info');
});

document.getElementById('btnOpenSettings').addEventListener('click', () => {
  document.getElementById('geminiKeyInput').value = state.geminiApiKey;
  document.getElementById('hfTokenInput').value = state.hfToken;
  settingsModal.classList.remove('hidden');
});
document.getElementById('btnCloseSettings').addEventListener('click', () => settingsModal.classList.add('hidden'));
document.getElementById('btnSaveSettings').addEventListener('click', () => {
  state.geminiApiKey = document.getElementById('geminiKeyInput').value.trim();
  state.hfToken = document.getElementById('hfTokenInput').value.trim();
  localStorage.setItem('locket_gemini_key', state.geminiApiKey);
  localStorage.setItem('locket_hf_token', state.hfToken);
  updateGeminiBadge();
  settingsModal.classList.add('hidden');
  showStatus('✅ Đã lưu cấu hình AI (Gemini Key & Hugging Face Token)!', 'success');
});

// ============================================================================
// CHUỖI LOCKET (STREAK & LỊCH THEO THÁNG)
// ============================================================================

function toLocalDateKey(dateInput) {
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getStreakMomentsByDate() {
  const byDate = new Map();
  const myUid = state.myUid || state.locketSession?.localId || '';
  for (const m of state.feedMoments || []) {
    const isMine = m.is_mine || (myUid && m.user_uid === myUid);
    if (!isMine || !m.date) continue;
    const key = toLocalDateKey(m.date);
    if (!key) continue;
    if (!byDate.has(key)) byDate.set(key, []);
    byDate.get(key).push(m);
  }
  return byDate;
}

function computeStreakStats(byDate) {
  const keys = Array.from(byDate.keys()).sort();
  const today = new Date();
  const todayKey = toLocalDateKey(today);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const yesterdayKey = toLocalDateKey(yesterday);

  let bestStreak = 0;
  let run = 0;
  let prevTime = null;
  for (const k of keys) {
    const [yy, mm, dd] = k.split('-').map(Number);
    const t = new Date(yy, mm - 1, dd).getTime();
    if (prevTime !== null && Math.round((t - prevTime) / 86400000) === 1) {
      run += 1;
    } else {
      run = 1;
    }
    if (run > bestStreak) bestStreak = run;
    prevTime = t;
  }

  let currentStreak = 0;
  const hasToday = byDate.has(todayKey);
  if (hasToday || byDate.has(yesterdayKey)) {
    const cursor = new Date(hasToday ? today : yesterday);
    while (byDate.has(toLocalDateKey(cursor))) {
      currentStreak += 1;
      cursor.setDate(cursor.getDate() - 1);
    }
  }

  return { currentStreak, bestStreak, hasToday, todayKey };
}

function renderStreakDayMoments(dayKey, byDate) {
  const titleEl = document.getElementById('streakSelectedDayTitle');
  const listEl = document.getElementById('streakDayMomentsList');
  if (!titleEl || !listEl) return;

  const items = byDate.get(dayKey) || [];
  if (!dayKey) {
    titleEl.textContent = 'Chọn một ngày trên lịch để xem lại';
    listEl.innerHTML = '';
    return;
  }
  const [yy, mm, dd] = dayKey.split('-');
  titleEl.textContent = `Ngày ${dd}/${mm}/${yy} (${items.length} khoảnh khắc)`;

  if (items.length === 0) {
    listEl.innerHTML = `<div class="col-span-3 rounded-2xl bg-black/30 border border-white/10 p-4 text-center text-[11px] text-stone-400">Chưa có khoảnh khắc nào bạn đăng trong ngày này.</div>`;
    return;
  }

  listEl.innerHTML = items
    .map((m) => {
      const thumb = m.thumbnail_url || m.video_url || '';
      const cap = (m.caption || '').replace(/</g, '&lt;');
      return `
        <div class="aspect-square rounded-2xl overflow-hidden bg-black/50 border border-white/10 relative group">
          ${
            m.video_url && !m.thumbnail_url
              ? `<video src="${m.video_url}" class="w-full h-full object-cover" muted playsinline></video>`
              : `<img src="${thumb}" alt="${cap}" class="w-full h-full object-cover" loading="lazy" />`
          }
          ${cap ? `<div class="absolute inset-x-0 bottom-0 bg-black/65 px-1.5 py-1 text-[10px] text-white truncate">${cap}</div>` : ''}
        </div>
      `;
    })
    .join('');
}

function renderStreakCalendar() {
  const byDate = getStreakMomentsByDate();
  const stats = computeStreakStats(byDate);

  const curEl = document.getElementById('streakCurrentCount');
  const bestEl = document.getElementById('streakBestCount');
  const todayTitleEl = document.getElementById('streakTodayTitle');
  const todaySubEl = document.getElementById('streakTodaySub');
  const monthLabelEl = document.getElementById('streakMonthLabel');
  const gridEl = document.getElementById('streakCalendarGrid');

  if (curEl) curEl.textContent = String(stats.currentStreak);
  if (bestEl) bestEl.textContent = String(stats.bestStreak);

  if (todayTitleEl && todaySubEl) {
    if (!isLoggedIn()) {
      todayTitleEl.textContent = '🔒 Chưa đăng nhập Locket';
      todaySubEl.textContent = 'Đăng nhập để đồng bộ chuỗi ngày và ảnh đã đăng.';
    } else if (stats.hasToday) {
      todayTitleEl.textContent = '✅ Đã giữ chuỗi hôm nay!';
      todaySubEl.textContent = `Tuyệt vời — bạn đang có chuỗi ${stats.currentStreak} ngày liên tiếp.`;
    } else {
      todayTitleEl.textContent = '⏳ Hôm nay bạn chưa đăng Locket';
      todaySubEl.textContent = 'Chụp ngay 1 khoảnh khắc để thắp lửa giữ chuỗi!';
    }
  }

  const year = state.streakViewYear;
  const month = state.streakViewMonth;
  if (monthLabelEl) {
    monthLabelEl.textContent = `Tháng ${String(month + 1).padStart(2, '0')}/${year}`;
  }
  if (!gridEl) return;

  const firstDay = new Date(year, month, 1);
  const startOffset = (firstDay.getDay() + 6) % 7; // T2 = 0 .. CN = 6
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  if (!state.streakSelectedDateKey) {
    state.streakSelectedDateKey = stats.todayKey;
  }

  const cells = [];
  for (let i = 0; i < startOffset; i += 1) {
    cells.push('<div class="aspect-square"></div>');
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dayMoments = byDate.get(key) || [];
    const hasPost = dayMoments.length > 0;
    const isToday = key === stats.todayKey;
    const isSelected = key === state.streakSelectedDateKey;
    const thumb = hasPost ? (dayMoments[0].thumbnail_url || '') : '';

    cells.push(`
      <button
        type="button"
        data-streak-day="${key}"
        class="aspect-square rounded-xl relative overflow-hidden flex flex-col items-center justify-center text-xs font-bold transition border ${
          isSelected
            ? 'border-[#f5a623] ring-2 ring-[#f5a623]/40'
            : hasPost
              ? 'border-amber-400/50'
              : 'border-white/5 bg-white/[0.03] hover:bg-white/10'
        } ${isToday && !hasPost ? 'text-[#f5a623]' : 'text-white'}"
      >
        ${thumb ? `<img src="${thumb}" class="absolute inset-0 w-full h-full object-cover opacity-55" loading="lazy" />` : ''}
        <span class="relative z-10 drop-shadow">${day}</span>
        ${hasPost ? `<span class="relative z-10 text-[9px] leading-none mt-0.5">🔥</span>` : ''}
      </button>
    `);
  }

  gridEl.innerHTML = cells.join('');
  gridEl.querySelectorAll('[data-streak-day]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.streakSelectedDateKey = btn.getAttribute('data-streak-day');
      renderStreakCalendar();
    });
  });

  renderStreakDayMoments(state.streakSelectedDateKey, byDate);
}

async function openStreakScreen() {
  renderStreakCalendar();
  if (isLoggedIn() && state.feedMoments.length === 0) {
    await loadMomentsFeed();
    renderStreakCalendar();
  }
}

function setupStreakScreen() {
  document.getElementById('btnBackToCameraFromStreak')?.addEventListener('click', () => switchScreen('camera'));
  document.getElementById('btnStreakGoHistory')?.addEventListener('click', () => switchScreen('history', 'all'));
  document.getElementById('btnStreakSnapNow')?.addEventListener('click', () => switchScreen('camera'));

  document.getElementById('btnStreakPrevMonth')?.addEventListener('click', () => {
    state.streakViewMonth -= 1;
    if (state.streakViewMonth < 0) {
      state.streakViewMonth = 11;
      state.streakViewYear -= 1;
    }
    renderStreakCalendar();
  });

  document.getElementById('btnStreakNextMonth')?.addEventListener('click', () => {
    state.streakViewMonth += 1;
    if (state.streakViewMonth > 11) {
      state.streakViewMonth = 0;
      state.streakViewYear += 1;
    }
    renderStreakCalendar();
  });

  document.getElementById('btnRefreshStreak')?.addEventListener('click', async () => {
    if (!isLoggedIn()) {
      showStatus('Hãy đăng nhập Locket để đồng bộ chuỗi ngày!', 'error');
      return;
    }
    await loadMomentsFeed();
    renderStreakCalendar();
  });
}

// ============================================================================
// LOCKET ROLLCALL (PHOTO DUMP TỔNG HỢP TỐI ĐA 10 ẢNH)
// ============================================================================

async function renderRollcallCollage() {
  const canvas = document.getElementById('rollcallCanvas');
  const overlay = document.getElementById('rollcallEmptyOverlay');
  const btnPost = document.getElementById('btnRollcallUseForPost');
  const btnDown = document.getElementById('btnRollcallDownload');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  ctx.fillStyle = '#0f0d0b';
  ctx.fillRect(0, 0, W, H);

  const photos = state.rollcallPhotos || [];
  const hasEnough = photos.length >= 2;
  if (overlay) overlay.classList.toggle('hidden', photos.length > 0);
  if (btnPost) btnPost.disabled = photos.length === 0;
  if (btnDown) btnDown.disabled = photos.length === 0;

  if (photos.length === 0) {
    state.rollcallCollageDataUrl = '';
    return;
  }

  // Nền warm gradient chuẩn Locket
  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, '#181410');
  grad.addColorStop(1, '#080706');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  const title = (document.getElementById('rollcallTitleInput')?.value || 'Rollcall ✨').trim();
  ctx.fillStyle = '#f5a623';
  ctx.font = '800 34px Inter, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`📣 ${title}`, 48, 72);

  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.font = '600 22px Inter, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(`${photos.length} khoảnh khắc`, W - 48, 70);

  const padX = 44;
  const topY = 104;
  const bottomY = H - 64;
  const areaW = W - padX * 2;
  const areaH = bottomY - topY;
  const count = photos.length;
  const cols = count === 1 ? 1 : count <= 4 ? 2 : count <= 9 ? 3 : 4;
  const rows = Math.ceil(count / cols);
  const gap = 14;
  const cellW = (areaW - gap * (cols - 1)) / cols;
  const cellH = (areaH - gap * (rows - 1)) / rows;

  for (let i = 0; i < count; i += 1) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = padX + col * (cellW + gap);
    const y = topY + row * (cellH + gap);
    try {
      const img = await loadImageElement(photos[i].src);
      drawRoundedImage(ctx, img, x, y, cellW, cellH, 24);
    } catch {
      ctx.fillStyle = '#24211c';
      ctx.fillRect(x, y, cellW, cellH);
    }
  }

  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.font = '700 20px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(hasEnough ? 'LOCKET ROLLCALL • PHOTO DUMP' : 'LOCKET ROLLCALL (Chọn thêm ảnh để ghép lưới)', W / 2, H - 24);

  state.rollcallCollageDataUrl = canvas.toDataURL('image/jpeg', 0.92);
}

function renderRollcallBuilder() {
  const badge = document.getElementById('rollcallCountBadge');
  const strip = document.getElementById('rollcallSelectedStrip');
  const picker = document.getElementById('rollcallFeedPicker');

  if (badge) badge.textContent = `${state.rollcallPhotos.length}/10`;

  if (strip) {
    if (state.rollcallPhotos.length === 0) {
      strip.innerHTML = '<div class="text-[11px] text-stone-500 py-3">Chưa có ảnh nào được chọn.</div>';
    } else {
      strip.innerHTML = state.rollcallPhotos
        .map(
          (p, idx) => `
          <button type="button" data-rollcall-remove="${idx}" class="relative w-14 h-14 rounded-xl overflow-hidden border border-[#f5a623]/60 shrink-0 group">
            <img src="${p.src}" class="w-full h-full object-cover" />
            <span class="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/75 text-white text-[10px] flex items-center justify-center">✕</span>
          </button>`
        )
        .join('');
      strip.querySelectorAll('[data-rollcall-remove]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const idx = Number(btn.getAttribute('data-rollcall-remove'));
          state.rollcallPhotos.splice(idx, 1);
          renderRollcallBuilder();
        });
      });
    }
  }

  if (picker) {
    const imgMoments = (state.feedMoments || []).filter((m) => m.thumbnail_url);
    if (imgMoments.length === 0) {
      picker.innerHTML = `<div class="col-span-4 text-center text-[11px] text-stone-400 py-4">${
        isLoggedIn() ? 'Chưa có ảnh Locket nào — bấm "Chọn thêm ảnh từ thư viện máy".' : 'Đăng nhập Locket hoặc chọn ảnh từ thư viện máy ở trên.'
      }</div>`;
    } else {
      picker.innerHTML = imgMoments
        .slice(0, 24)
        .map((m) => {
          const selected = state.rollcallPhotos.some((p) => p.id === m.id);
          return `
            <button
              type="button"
              data-rollcall-pick="${m.id}"
              class="aspect-square rounded-xl overflow-hidden relative border-2 transition ${
                selected ? 'border-[#f5a623] scale-[0.96]' : 'border-white/10 hover:border-white/30'
              }"
            >
              <img src="${m.thumbnail_url}" class="w-full h-full object-cover" loading="lazy" />
              ${selected ? '<span class="absolute top-1 right-1 w-5 h-5 rounded-full bg-[#f5a623] text-black text-[10px] font-black flex items-center justify-center">✓</span>' : ''}
            </button>
          `;
        })
        .join('');

      picker.querySelectorAll('[data-rollcall-pick]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-rollcall-pick');
          const existIdx = state.rollcallPhotos.findIndex((p) => p.id === id);
          if (existIdx >= 0) {
            state.rollcallPhotos.splice(existIdx, 1);
            renderRollcallBuilder();
            return;
          }
          if (state.rollcallPhotos.length >= 10) {
            showStatus('Rollcall hỗ trợ tối đa 10 ảnh!', 'error');
            return;
          }
          const moment = imgMoments.find((m) => m.id === id);
          if (moment) {
            state.rollcallPhotos.push({ id: moment.id, src: moment.thumbnail_url, caption: moment.caption || '' });
            renderRollcallBuilder();
          }
        });
      });
    }
  }

  renderRollcallCollage();
}

async function openRollcallScreen() {
  renderRollcallBuilder();
  if (isLoggedIn() && state.feedMoments.length === 0) {
    await loadMomentsFeed();
    renderRollcallBuilder();
  }
}

function setupRollcallScreen() {
  document.getElementById('btnBackToCameraFromRollcall')?.addEventListener('click', () => switchScreen('camera'));
  document.getElementById('btnRollcallOpenSidebar')?.addEventListener('click', () => {
    document.getElementById('leftSidebar')?.classList.remove('hidden');
  });

  document.getElementById('rollcallTitleInput')?.addEventListener('input', () => {
    renderRollcallCollage();
  });

  document.getElementById('btnRollcallClear')?.addEventListener('click', () => {
    state.rollcallPhotos = [];
    renderRollcallBuilder();
  });

  document.getElementById('btnRollcallRefreshFeed')?.addEventListener('click', async () => {
    if (!isLoggedIn()) {
      showStatus('Hãy đăng nhập Locket để tải ảnh gần đây!', 'error');
      return;
    }
    await loadMomentsFeed();
    renderRollcallBuilder();
  });

  document.getElementById('rollcallFileInput')?.addEventListener('change', async (e) => {
    const files = Array.from(e.target.files || []);
    for (const file of files) {
      if (state.rollcallPhotos.length >= 10) break;
      const dataUrl = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.readAsDataURL(file);
      });
      state.rollcallPhotos.push({
        id: `local_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        src: dataUrl,
        caption: '',
      });
    }
    e.target.value = '';
    renderRollcallBuilder();
  });

  document.getElementById('btnRollcallDownload')?.addEventListener('click', () => {
    if (!state.rollcallCollageDataUrl) return;
    const link = document.createElement('a');
    link.href = state.rollcallCollageDataUrl;
    link.download = `locket-rollcall-${Date.now()}.jpg`;
    link.click();
  });

  document.getElementById('btnRollcallUseForPost')?.addEventListener('click', () => {
    if (!state.rollcallCollageDataUrl) return;
    const title = (document.getElementById('rollcallTitleInput')?.value || 'Rollcall ✨').trim();
    state.captionIcon = '📣';
    state.captionText = title;
    const iconInput = document.getElementById('capIconInput');
    const capInput = document.getElementById('capTextInput');
    if (iconInput) iconInput.value = '📣';
    if (capInput) capInput.value = title;
    renderLiveCaptionOverlay();
    setPreviewImage(state.rollcallCollageDataUrl);
    switchScreen('camera');
    showStatus('📣 Đã nạp ảnh Rollcall! Chọn người nhận rồi bấm Gửi lên Locket.', 'success');
  });
}

initApp();
