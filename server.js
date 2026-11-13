const http = require('http');
const fs = require('fs');
const path = require('path');

// Nạp biến môi trường từ file .env (nếu có) để dùng chung cho toàn bộ hệ thống web
const ENV_PATH = path.join(__dirname, '.env');
if (fs.existsSync(ENV_PATH)) {
  const envLines = fs.readFileSync(ENV_PATH, 'utf8').split(/\r?\n/);
  for (const line of envLines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx > 0) {
      const k = trimmed.slice(0, eqIdx).trim();
      const v = trimmed.slice(eqIdx + 1).trim();
      if (k && !process.env[k]) {
        process.env[k] = v;
      }
    }
  }
}
const {
  loginLocket,
  refreshLocketToken,
  getAllFriends,
  uploadImageToLocketStorage,
  uploadVideoToLocketStorage,
  postMomentToLocket,
  getMomentsFeed,
  getMomentViewsAndReactions,
  reactToMoment,
  deleteMoment,
  getConversations,
  getMessages,
  sendChatMessage,
  reactToChatMessage,
} = require('./src/locketService');
const { generateAIImage, editAIImage, inspectPhotoDetails } = require('./src/aiService');

const PORT = process.env.PORT || 3456;
const PUBLIC_DIR = path.join(__dirname, 'public');
const PB_FRAMES_FILE = path.join(__dirname, 'data', 'pb-frames.json');
const BUILTIN_PB_FRAMES = [
  {
    id: 'frame_vuon_khoi',
    name: 'Vươn Khơi',
    dataUrl: '/frames/vuon_khoi.png',
    mode: 'overlay',
    hideFooter: true,
    isBuiltin: true,
  },
];

function readSavedPbFrames() {
  try {
    let frames = [];
    let activeFrameId = 'frame_vuon_khoi';
    if (fs.existsSync(PB_FRAMES_FILE)) {
      const raw = JSON.parse(fs.readFileSync(PB_FRAMES_FILE, 'utf8'));
      if (Array.isArray(raw.frames)) frames = raw.frames;
      if (typeof raw.activeFrameId === 'string') activeFrameId = raw.activeFrameId;
    }
    for (const bf of BUILTIN_PB_FRAMES) {
      if (!frames.some((f) => f.id === bf.id)) {
        frames.unshift(bf);
      }
    }
    return { frames, activeFrameId };
  } catch {
    return { frames: BUILTIN_PB_FRAMES, activeFrameId: 'frame_vuon_khoi' };
  }
}

function writeSavedPbFrames(payload) {
  fs.mkdirSync(path.dirname(PB_FRAMES_FILE), { recursive: true });
  let frames = Array.isArray(payload.frames) ? payload.frames : [];
  for (const bf of BUILTIN_PB_FRAMES) {
    if (!frames.some((f) => f.id === bf.id)) {
      frames.unshift(bf);
    }
  }
  fs.writeFileSync(
    PB_FRAMES_FILE,
    JSON.stringify(
      {
        frames,
        activeFrameId: typeof payload.activeFrameId === 'string' ? payload.activeFrameId : '',
      },
      null,
      2
    ),
    'utf8'
  );
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
};

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  });
  res.end(JSON.stringify(payload));
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let totalBytes = 0;
    const MAX_BYTES = 60 * 1024 * 1024; // Cho phép tối đa 60MB cho ảnh & video base64

    req.on('data', (chunk) => {
      totalBytes += chunk.length;
      if (totalBytes > MAX_BYTES) {
        reject(new Error('Dữ liệu gửi lên vượt quá giới hạn 60MB'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf-8');
        resolve(raw ? JSON.parse(raw) : {});
      } catch (err) {
        reject(new Error('JSON không hợp lệ'));
      }
    });

    req.on('error', reject);
  });
}

/**
 * Tự động làm mới idToken bằng refreshToken nếu token hết hạn (401/403/TOKEN_EXPIRED)
 */
async function runWithAutoRefresh(body, actionFn) {
  const { idToken, localId, refreshToken } = body || {};
  if (!idToken) {
    throw new Error('Bạn chưa đăng nhập tài khoản Locket (thiếu idToken).');
  }

  let activeToken = idToken;
  let activeLocalId = localId || '';
  let refreshedSession = null;

  try {
    const data = await actionFn(activeToken, activeLocalId);
    return { data, refreshedSession };
  } catch (err) {
    const msg = err.message || '';
    if (
      refreshToken &&
      (msg.includes('401') || msg.includes('403') || msg.includes('TOKEN_EXPIRED'))
    ) {
      console.log('[Locket Auth] Đang tự động làm mới idToken bằng refreshToken...');
      refreshedSession = await refreshLocketToken(refreshToken);
      activeToken = refreshedSession.idToken;
      activeLocalId = refreshedSession.localId || activeLocalId;
      const data = await actionFn(activeToken, activeLocalId);
      return { data, refreshedSession };
    }
    throw err;
  }
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    });
    return res.end();
  }

  const reqUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = reqUrl.pathname;

  try {
    // 1. Health check
    if (pathname === '/api/health' && req.method === 'GET') {
      return sendJson(res, 200, {
        status: 'ok',
        service: 'Locket AI Studio Pro',
        hasServerHfToken: Boolean((process.env.HF_TOKEN || '').trim()),
        hasServerGeminiKey: Boolean((process.env.GEMINI_API_KEY || '').trim()),
      });
    }

    // 1b. Lưu & tải khung Photobooth tùy chỉnh (giữ vĩnh viễn cho đến khi người dùng xóa)
    if (pathname === '/api/photobooth/frames' && req.method === 'GET') {
      return sendJson(res, 200, { success: true, ...readSavedPbFrames() });
    }
    if (pathname === '/api/photobooth/frames' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      writeSavedPbFrames({
        frames: body.frames,
        activeFrameId: body.activeFrameId,
      });
      return sendJson(res, 200, { success: true });
    }

    // 2. Đăng nhập Locket
    if (pathname === '/api/locket/login' && req.method === 'POST') {
      const { email, password } = await parseJsonBody(req);
      if (!email || !password) {
        return sendJson(res, 400, { error: 'Vui lòng nhập đầy đủ Email và Mật khẩu Locket.' });
      }
      const session = await loginLocket(email, password);
      return sendJson(res, 200, { success: true, session });
    }

    // 3. Làm mới Token Locket
    if (pathname === '/api/locket/refresh' && req.method === 'POST') {
      const { refreshToken } = await parseJsonBody(req);
      if (!refreshToken) {
        return sendJson(res, 400, { error: 'Thiếu refreshToken.' });
      }
      const refreshed = await refreshLocketToken(refreshToken);
      return sendJson(res, 200, { success: true, session: refreshed });
    }

    // 4. Tạo ảnh bằng AI (Flux + Gemini/Pollinations)
    if (pathname === '/api/ai/generate-image' && req.method === 'POST') {
      const { prompt, style, tone, seed, geminiApiKey } = await parseJsonBody(req);
      if (!prompt || !prompt.trim()) {
        return sendJson(res, 400, { error: 'Vui lòng nhập mô tả bức ảnh bạn muốn AI tạo.' });
      }
      const result = await generateAIImage({
        prompt: prompt.trim(),
        style,
        tone,
        seed,
        geminiApiKey,
      });
      return sendJson(res, 200, { success: true, ...result });
    }

    // 5a. Đọc chi tiết trong ảnh bằng AI trước khi chỉnh sửa
    if (pathname === '/api/ai/analyze-image' && req.method === 'POST') {
      const { base64Image, instruction, geminiApiKey } = await parseJsonBody(req);
      if (!base64Image) {
        return sendJson(res, 400, { error: 'Chưa có ảnh gốc để AI đọc chi tiết.' });
      }
      const result = await inspectPhotoDetails({
        base64Image,
        instruction: instruction || '',
        geminiApiKey,
      });
      return sendJson(res, 200, { success: true, ...result });
    }

    // 5. Chỉnh sửa chi tiết trong ảnh gốc bằng AI theo lời nhắn (KHÔNG tự tạo ảnh mới)
    if (pathname === '/api/ai/edit-image' && req.method === 'POST') {
      const { base64Image, instruction, geminiApiKey, hfToken, pollinationsApiKey } = await parseJsonBody(req);
      if (!base64Image) {
        return sendJson(res, 400, { error: 'Bạn cần chụp hoặc chọn một bức ảnh gốc trước khi sửa bằng AI.' });
      }
      if (!instruction || !instruction.trim()) {
        return sendJson(res, 400, { error: 'Vui lòng nhập lời nhắn mô tả chi tiết bạn muốn thêm hoặc sửa.' });
      }
      const result = await editAIImage({
        base64Image,
        instruction: instruction.trim(),
        geminiApiKey,
        hfToken,
        pollinationsApiKey,
      });
      return sendJson(res, 200, { success: true, ...result });
    }

    // 6. Tải ảnh/video lên Firebase Storage của Locket & Gọi postMomentV2
    if (pathname === '/api/locket/post' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      const {
        base64Image,
        base64Video,
        videoMimeType,
        caption,
        textColor,
        bgColors,
        icon,
        recipients,
        sentToSelfOnly,
      } = body;

      if (!base64Image && !base64Video) {
        return sendJson(res, 400, { error: 'Chưa có hình ảnh hoặc video để đăng lên Locket.' });
      }

      const base64Clean = (base64Image || '').replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '');
      const imageBuffer = base64Clean ? Buffer.from(base64Clean, 'base64') : null;

      const base64VideoClean = (base64Video || '').replace(/^data:video\/[a-zA-Z0-9+.-]+(?:;[^;]+)*;base64,/, '');
      const videoBuffer = base64VideoClean ? Buffer.from(base64VideoClean, 'base64') : null;

      const { data, refreshedSession } = await runWithAutoRefresh(
        body,
        async (activeToken, activeLocalId) => {
          const uploadResult = imageBuffer
            ? await uploadImageToLocketStorage(imageBuffer, activeLocalId, activeToken)
            : { thumbnailUrl: '', md5: '' };

          const videoResult = videoBuffer
            ? await uploadVideoToLocketStorage(
                videoBuffer,
                activeLocalId,
                activeToken,
                videoMimeType || 'video/mp4'
              )
            : { videoUrl: '', videoMd5: '' };

          const momentResponse = await postMomentToLocket({
            idToken: activeToken,
            localId: activeLocalId,
            thumbnailUrl: uploadResult.thumbnailUrl,
            md5: uploadResult.md5,
            videoUrl: videoResult.videoUrl,
            videoMd5: videoResult.videoMd5,
            caption,
            textColor,
            bgColors,
            icon,
            recipients,
            sentToSelfOnly: Boolean(sentToSelfOnly),
          });
          return {
            thumbnailUrl: uploadResult.thumbnailUrl,
            videoUrl: videoResult.videoUrl || '',
            momentResponse,
          };
        }
      );

      return sendJson(res, 200, {
        success: true,
        ...data,
        refreshedSession,
      });
    }

    // 7. Lấy danh sách bạn bè trên Locket
    if (pathname === '/api/locket/friends' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      const { data: friends, refreshedSession } = await runWithAutoRefresh(
        body,
        (activeToken, activeLocalId) => getAllFriends(activeToken, activeLocalId)
      );
      return sendJson(res, 200, { success: true, friends, refreshedSession });
    }

    // 8. Lấy Bảng Tin Khoảnh Khắc (Feed: Ảnh bạn bè đăng & Ảnh của tôi)
    if (pathname === '/api/locket/feed' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      const { filteredByUserId, limit } = body;
      const { data, refreshedSession } = await runWithAutoRefresh(
        body,
        (activeToken, activeLocalId) =>
          getMomentsFeed(activeToken, activeLocalId, { filteredByUserId, limit })
      );
      return sendJson(res, 200, { success: true, ...data, refreshedSession });
    }

    // 9. Xem Ai Đã Xem & Ai Đã Thả Cảm Xúc vào một khoảnh khắc
    if (pathname === '/api/locket/moment/views' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      const { momentUid } = body;
      const { data, refreshedSession } = await runWithAutoRefresh(
        body,
        (activeToken, activeLocalId) =>
          getMomentViewsAndReactions(activeToken, activeLocalId, momentUid)
      );
      return sendJson(res, 200, { success: true, ...data, refreshedSession });
    }

    // 10. Thả cảm xúc (Emoji Reaction) vào khoảnh khắc của bạn bè
    if (pathname === '/api/locket/moment/react' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      const { momentUid, emoji } = body;
      const { data: result, refreshedSession } = await runWithAutoRefresh(
        body,
        (activeToken) => reactToMoment(activeToken, momentUid, emoji)
      );
      return sendJson(res, 200, { success: true, result, refreshedSession });
    }

    // 11. Xóa khoảnh khắc của chính mình
    if (pathname === '/api/locket/moment/delete' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      const { momentUid } = body;
      const { data: result, refreshedSession } = await runWithAutoRefresh(
        body,
        (activeToken, activeLocalId) => deleteMoment(activeToken, activeLocalId, momentUid)
      );
      return sendJson(res, 200, { success: true, result, refreshedSession });
    }

    // 12. Lấy danh sách hội thoại Tin Nhắn (Chat Conversations)
    if (pathname === '/api/locket/chat/conversations' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      const { data: conversations, refreshedSession } = await runWithAutoRefresh(
        body,
        (activeToken, activeLocalId) => getConversations(activeToken, activeLocalId)
      );
      return sendJson(res, 200, { success: true, conversations, refreshedSession });
    }

    // 13. Lấy lịch sử tin nhắn chi tiết trong 1 cuộc hội thoại
    if (pathname === '/api/locket/chat/messages' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      const { conversationId } = body;
      const { data, refreshedSession } = await runWithAutoRefresh(
        body,
        (activeToken, activeLocalId) => getMessages(activeToken, activeLocalId, conversationId)
      );
      return sendJson(res, 200, { success: true, ...data, refreshedSession });
    }

    // 14. Gửi tin nhắn văn bản hoặc trả lời vào khoảnh khắc
    if (pathname === '/api/locket/chat/send' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      const { receiverUid, text, momentUid } = body;
      const { data: result, refreshedSession } = await runWithAutoRefresh(
        body,
        (activeToken) => sendChatMessage(activeToken, { receiverUid, text, momentUid })
      );
      return sendJson(res, 200, { success: true, result, refreshedSession });
    }

    // 15. Thả biểu tượng cảm xúc vào một tin nhắn trong chat
    if (pathname === '/api/locket/chat/react' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      const { conversationId, messageId, emoji } = body;
      const { data: result, refreshedSession } = await runWithAutoRefresh(
        body,
        (activeToken) => reactToChatMessage(activeToken, { conversationId, messageId, emoji })
      );
      return sendJson(res, 200, { success: true, result, refreshedSession });
    }

    // Phục vụ file tĩnh trong thư mục public/
    const safePath = pathname === '/' ? '/index.html' : pathname;
    const filePath = path.join(PUBLIC_DIR, path.normalize(safePath));

    if (!filePath.startsWith(PUBLIC_DIR)) {
      return sendJson(res, 403, { error: 'Forbidden' });
    }

    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      const noCacheExts = ['.html', '.js', '.css', '.json'];
      const headers = { 'Content-Type': contentType };
      if (noCacheExts.includes(ext)) {
        headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, proxy-revalidate';
        headers['Pragma'] = 'no-cache';
        headers['Expires'] = '0';
      }
      res.writeHead(200, headers);
      fs.createReadStream(filePath).pipe(res);
    } else {
      return sendJson(res, 404, { error: 'Không tìm thấy đường dẫn yêu cầu.' });
    }
  } catch (error) {
    console.error('[Locket AI Studio Error]:', error.message);
    return sendJson(res, 500, { error: error.message || 'Đã xảy ra lỗi không xác định.' });
  }
});

server.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🚀 Locket AI Studio Pro đang chạy tại: http://localhost:${PORT}`);
  console.log(`====================================================`);
});
