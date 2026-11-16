/**
 * Cầu nối API gốc cho ứng dụng iOS (.ipa qua Capacitor)
 * Khi chạy trong iPhone app (window.Capacitor.isNativePlatform() === true),
 * toàn bộ lời gọi fetch('/api/...') sẽ chạy trực tiếp bằng CapacitorHttp & LocketNative Swift Plugin
 * mà không cần bật server Node.js trên máy tính.
 */
(function () {
  const isNative =
    typeof window !== 'undefined' &&
    window.Capacitor &&
    typeof window.Capacitor.isNativePlatform === 'function' &&
    window.Capacitor.isNativePlatform();

  if (!isNative) {
    return;
  }

  const platform =
    typeof window.Capacitor.getPlatform === 'function' ? window.Capacitor.getPlatform() : 'ios';
  const CLOUD_BACKEND_ORIGIN = 'https://locket-tainguyen-studio.onrender.com';

  // Trên Android APK: dùng trực tiếp backend đám mây Render cho /api/* và tự động đồng bộ giao diện mới nhất (OTA)
  if (platform === 'android') {
    const origFetch = window.fetch.bind(window);
    window.fetch = function (input, init) {
      const urlStr = typeof input === 'string' ? input : input?.url || '';
      if (urlStr.startsWith('/api/') && window.location.hostname === 'localhost') {
        return origFetch(`${CLOUD_BACKEND_ORIGIN}${urlStr}`, init);
      }
      return origFetch(input, init);
    };

    // Nếu đang mở bản đóng gói cục bộ (localhost) trong APK và có mạng -> tự động nạp bản web mới nhất trên Render
    // để mỗi khi chủ web sửa code/giao diện thì App Android cập nhật ngay lập tức mà không cần cài lại APK!
    if (window.location.hostname === 'localhost' && !window.sessionStorage.getItem('android_ota_checked')) {
      window.sessionStorage.setItem('android_ota_checked', '1');
      origFetch(`${CLOUD_BACKEND_ORIGIN}/api/health`, { method: 'GET', cache: 'no-store' })
        .then((r) => {
          if (r && r.ok) {
            window.location.replace(`${CLOUD_BACKEND_ORIGIN}/?from_apk=1`);
          }
        })
        .catch(() => {
          // Nếu đang offline hoặc server đang khởi động, giữ nguyên giao diện gói sẵn trong APK
        });
    }
    return;
  }

  const LOCKET_FIREBASE_API_KEY = 'AIzaSyCQngaaXQIfJaH0aS2l7REgIjD7nL431So';
  const LOCKET_FIREBASE_AUTH_URL = 'https://identitytoolkit.googleapis.com/v1/accounts';
  const LOCKET_FIREBASE_TOKEN_URL = 'https://securetoken.googleapis.com/v1/token';
  const LOCKET_GMP_ID = '1:641029076083:ios:cc8eb46290d69b234fa606';
  const LOCKET_BUNDLE_ID = 'com.locket.Locket';
  const LOCKET_APP_VERSION = '2.68.0';
  const LOCKET_BUILD_NUMBER = '2523';

  const LOCKET_DEVICE_UA = `com.locket.Locket/${LOCKET_APP_VERSION} iPhone/18.1.0 hw/iPhone16_1`;
  const LOCKET_STORAGE_UA = `${LOCKET_DEVICE_UA} (GTMSUF/1)`;
  const STORAGE_IMG_URL = 'https://firebasestorage.googleapis.com/v0/b/locket-img/o';
  const FIRESTORE_DEFAULT_BASE =
    'https://firestore.googleapis.com/v1/projects/locket-4252a/databases/(default)/documents';
  const FIRESTORE_LOCKET_BASE =
    'https://firestore.googleapis.com/v1/projects/locket-4252a/databases/locket/documents';

  const STYLE_PROMPTS = {
    realistic_selfie:
      'candid iPhone 15 Pro Max photo, natural lighting, authentic casual everyday moment, realistic skin texture, slight depth of field, high quality photography',
    cute_3d:
      'cute 3D Pixar Disney animation style, adorable, soft volumetric lighting, vibrant colors, octane render, 8k',
    anime_ghibli:
      'Studio Ghibli anime illustration style, Makoto Shinkai sky, warm nostalgic atmosphere, detailed hand-drawn aesthetic',
    film_vintage:
      '35mm Kodak Portra 400 film photography, warm vintage grain, retro 90s aesthetic, nostalgic golden hour lighting',
    cyberpunk:
      'cyberpunk neon aesthetic, glowing futuristic city lights, cinematic atmosphere, highly detailed digital art',
    none: 'high quality, detailed, sharp focus, aesthetic composition',
  };

  const userProfileCache = new Map();
  const RECENT_POSTS_KEY = 'locket_recent_own_posts';

  function getHttp() {
    const http = window.Capacitor?.Plugins?.CapacitorHttp;
    if (!http) throw new Error('CapacitorHttp chưa sẵn sàng trên thiết bị.');
    return http;
  }

  function getLocketNative() {
    return (
      window.Capacitor?.Plugins?.LocketNative ||
      (window.Capacitor?.registerPlugin ? window.Capacitor.registerPlugin('LocketNative') : null)
    );
  }

  function genUuid() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  function randomId(length = 20) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let out = '';
    for (let i = 0; i < length; i++) {
      out += chars[Math.floor(Math.random() * chars.length)];
    }
    return out;
  }

  function getHeader(headers, name) {
    if (!headers || !name) return undefined;
    const lower = name.toLowerCase();
    for (const [k, v] of Object.entries(headers)) {
      if (k.toLowerCase() === lower) return v;
    }
    return undefined;
  }

  async function nativeRequest({ url, method = 'GET', headers = {}, data, responseType = 'json', readTimeout = 60000, connectTimeout = 30000 }) {
    const res = await getHttp().request({
      url,
      method,
      headers,
      data,
      responseType,
      readTimeout,
      connectTimeout,
    });
    return {
      status: res.status || 0,
      ok: res.status >= 200 && res.status < 300,
      headers: res.headers || {},
      data: res.data,
    };
  }

  function parseJsonSafe(raw) {
    if (raw && typeof raw === 'object') return raw;
    if (typeof raw !== 'string') return {};
    try {
      return JSON.parse(raw);
    } catch (_) {
      return {};
    }
  }

  function loadOwnPostsMap() {
    try {
      const raw = localStorage.getItem(RECENT_POSTS_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (_) {
      return {};
    }
  }

  function saveOwnPostsMap(mapObj) {
    try {
      localStorage.setItem(RECENT_POSTS_KEY, JSON.stringify(mapObj));
    } catch (_) {}
  }

  function decodeJwtPayload(token) {
    try {
      const parts = (token || '').trim().split('.');
      if (parts.length !== 3) return null;
      let b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      while (b64.length % 4) b64 += '=';
      const bin = atob(b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const jsonStr = new TextDecoder('utf-8').decode(bytes);
      return JSON.parse(jsonStr);
    } catch (_) {
      return null;
    }
  }

  function getVerifiedUid(idToken, fallbackLocalId) {
    const claims = decodeJwtPayload(idToken);
    if (claims) {
      const nowSec = Math.floor(Date.now() / 1000);
      if (claims.exp && claims.exp < nowSec) {
        throw new Error('TOKEN_EXPIRED: Phiên đăng nhập Locket (idToken) đã hết hạn (401).');
      }
      return claims.user_id || claims.sub || fallbackLocalId;
    }
    return fallbackLocalId;
  }

  function buildAnalytics() {
    const installationId = genUuid().replace(/-/g, '').slice(0, 22);
    return {
      ios_version: `${LOCKET_APP_VERSION}.${LOCKET_BUILD_NUMBER}`,
      experiments: {
        flag_18: { '@type': 'type.googleapis.com/google.protobuf.Int64Value', value: '1203' },
        flag_7: { '@type': 'type.googleapis.com/google.protobuf.Int64Value', value: '800' },
        flag_10: { '@type': 'type.googleapis.com/google.protobuf.Int64Value', value: '505' },
      },
      installation_id: installationId,
      platform: 'ios',
    };
  }

  function parseFirestoreValue(val) {
    if (!val || typeof val !== 'object') return null;
    if ('stringValue' in val) return val.stringValue;
    if ('integerValue' in val) return Number(val.integerValue);
    if ('doubleValue' in val) return Number(val.doubleValue);
    if ('booleanValue' in val) return Boolean(val.booleanValue);
    if ('timestampValue' in val) return val.timestampValue;
    if ('nullValue' in val) return null;
    if ('arrayValue' in val) return (val.arrayValue.values || []).map(parseFirestoreValue);
    if ('mapValue' in val) {
      const out = {};
      const fields = val.mapValue.fields || {};
      for (const k of Object.keys(fields)) out[k] = parseFirestoreValue(fields[k]);
      return out;
    }
    return val;
  }

  async function postLocketApi(endpoint, payload, idToken) {
    const res = await nativeRequest({
      url: `https://api.locketcamera.com/${endpoint}`,
      method: 'POST',
      headers: {
        'User-Agent': LOCKET_DEVICE_UA,
        'Content-Type': 'application/json; charset=utf-8',
        'Accept': '*/*',
        'x-ios-bundle-identifier': LOCKET_BUNDLE_ID,
        'Authorization': `Bearer ${idToken}`,
      },
      data: {
        data: {
          ...payload,
          analytics: buildAnalytics(),
        },
      },
      responseType: 'text',
    });

    const rawText = typeof res.data === 'string' ? res.data : JSON.stringify(res.data || {});
    if (res.status === 401 || res.status === 403) {
      throw new Error(`TOKEN_EXPIRED: Locket API ${endpoint} trả về ${res.status}: ${rawText.slice(0, 200)}`);
    }

    const data = parseJsonSafe(res.data);
    if (!res.ok || data.error || data.errors) {
      const errMsg = data.error?.message || JSON.stringify(data.error || data.errors || data || rawText.slice(0, 150));
      throw new Error(`Lỗi Locket API (${endpoint} - ${res.status}): ${errMsg}`);
    }
    return data;
  }

  async function getUserProfile(idToken, userUid) {
    if (!userUid) {
      return { uid: '', first_name: 'Người dùng', last_name: '', display_name: 'Người dùng Locket', username: '', profile_picture_url: null };
    }
    const cached = userProfileCache.get(userUid);
    if (cached && Date.now() - cached.ts < 15 * 60 * 1000) return cached.profile;
    try {
      const res = await postLocketApi('fetchUserV2', { user_uid: userUid }, idToken);
      const u = res?.result?.data || res?.data || {};
      const firstName = u.first_name || '';
      const lastName = u.last_name || '';
      const fullName = `${firstName} ${lastName}`.trim() || u.username || `User ${userUid.slice(0, 6)}`;
      const profile = {
        uid: u.uid || userUid,
        first_name: firstName,
        last_name: lastName,
        display_name: fullName,
        username: u.username || '',
        profile_picture_url: u.profile_picture_url || null,
      };
      userProfileCache.set(userUid, { profile, ts: Date.now() });
      return profile;
    } catch (_) {
      return {
        uid: userUid,
        first_name: 'Bạn bè',
        last_name: '',
        display_name: `Locket (${userUid.slice(0, 6)})`,
        username: userUid.slice(0, 8),
        profile_picture_url: null,
      };
    }
  }

  async function loginLocket(email, password) {
    const loginUrl = `${LOCKET_FIREBASE_AUTH_URL}:signInWithPassword?key=${LOCKET_FIREBASE_API_KEY}`;
    const defaultHeaders = {
      'User-Agent': LOCKET_DEVICE_UA,
      'Content-Type': 'application/json',
      'Accept': '*/*',
      'X-Ios-Bundle-Identifier': LOCKET_BUNDLE_ID,
      'X-Firebase-GMPID': LOCKET_GMP_ID,
    };

    const res = await nativeRequest({
      url: loginUrl,
      method: 'POST',
      headers: defaultHeaders,
      data: {
        email: email.trim(),
        password,
        returnSecureToken: true,
        clientType: 'CLIENT_TYPE_IOS',
      },
    });
    const data = parseJsonSafe(res.data);
    if (!res.ok || data.error) {
      throw new Error(`Lỗi xác thực Locket: ${data.error?.message || 'Đăng nhập Locket thất bại'}`);
    }

    let profile = {};
    try {
      const lookupRes = await nativeRequest({
        url: `${LOCKET_FIREBASE_AUTH_URL}:lookup?key=${LOCKET_FIREBASE_API_KEY}`,
        method: 'POST',
        headers: defaultHeaders,
        data: { idToken: data.idToken },
      });
      const infoData = parseJsonSafe(lookupRes.data);
      if (infoData.users && infoData.users.length > 0) profile = infoData.users[0];
    } catch (_) {}

    let locketUser = null;
    try {
      locketUser = await getUserProfile(data.idToken, data.localId);
    } catch (_) {}

    return {
      idToken: data.idToken,
      refreshToken: data.refreshToken,
      localId: data.localId,
      email: data.email,
      displayName: locketUser?.display_name || profile.displayName || data.displayName || email.split('@')[0],
      username: locketUser?.username || '',
      photoUrl: locketUser?.profile_picture_url || profile.photoUrl || null,
      expiresIn: data.expiresIn,
    };
  }

  async function refreshLocketToken(refreshToken) {
    const formStr = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }).toString();

    const res = await nativeRequest({
      url: `${LOCKET_FIREBASE_TOKEN_URL}?key=${LOCKET_FIREBASE_API_KEY}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': LOCKET_DEVICE_UA,
        'X-Ios-Bundle-Identifier': LOCKET_BUNDLE_ID,
        'X-Firebase-GMPID': LOCKET_GMP_ID,
      },
      data: formStr,
    });
    const data = parseJsonSafe(res.data);
    if (!res.ok || data.error) {
      throw new Error(data.error?.message || 'Không thể làm mới token Locket');
    }
    return {
      idToken: data.id_token,
      refreshToken: data.refresh_token,
      localId: data.user_id,
    };
  }

  async function runWithAutoRefresh(body, actionFn) {
    const { idToken, localId, refreshToken } = body || {};
    if (!idToken) throw new Error('Bạn chưa đăng nhập tài khoản Locket (thiếu idToken).');

    let activeToken = idToken;
    let activeLocalId = localId || '';
    let refreshedSession = null;

    try {
      const data = await actionFn(activeToken, activeLocalId);
      return { data, refreshedSession };
    } catch (err) {
      const msg = err.message || '';
      if (refreshToken && (msg.includes('401') || msg.includes('403') || msg.includes('TOKEN_EXPIRED'))) {
        refreshedSession = await refreshLocketToken(refreshToken);
        activeToken = refreshedSession.idToken;
        activeLocalId = refreshedSession.localId || activeLocalId;
        const data = await actionFn(activeToken, activeLocalId);
        return { data, refreshedSession };
      }
      throw err;
    }
  }

  function base64ByteLength(cleanBase64) {
    const len = cleanBase64.length;
    let padding = 0;
    if (cleanBase64.endsWith('==')) padding = 2;
    else if (cleanBase64.endsWith('=')) padding = 1;
    return Math.floor((len * 3) / 4) - padding;
  }

  async function uploadImageToLocketStorage(rawBase64, localId, idToken) {
    const verifiedUid = getVerifiedUid(idToken, localId);
    const filename = `${randomId(20)}.webp`;
    const contentType = 'image/webp';
    const objectPath = `users/${verifiedUid}/moments/thumbnails/${filename}`;
    const encodedName = encodeURIComponent(objectPath);
    const initUrl = `${STORAGE_IMG_URL}/${encodedName}?uploadType=resumable&name=${encodedName}`;
    const byteLength = base64ByteLength(rawBase64);

    const metadata = {
      bucket: '',
      contentType,
      name: objectPath,
      metadata: {
        visibility: 'private',
        creator: verifiedUid,
      },
      cacheControl: 'public, max-age=604800',
    };

    let initRes = null;
    let lastErrText = '';
    for (const prefix of ['Firebase', 'Bearer']) {
      initRes = await nativeRequest({
        url: initUrl,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=UTF-8',
          'Authorization': `${prefix} ${idToken}`,
          'x-goog-upload-protocol': 'resumable',
          'x-goog-upload-command': 'start',
          'x-goog-upload-content-type': contentType,
          'x-goog-upload-content-length': String(byteLength),
          'x-firebase-storage-version': 'ios/12.12.1',
          'x-firebase-gmpid': LOCKET_GMP_ID,
          'x-ios-bundle-identifier': LOCKET_BUNDLE_ID,
          'User-Agent': LOCKET_STORAGE_UA,
        },
        data: metadata,
        responseType: 'text',
      });
      if (initRes.ok) break;
      lastErrText = typeof initRes.data === 'string' ? initRes.data : JSON.stringify(initRes.data || {});
    }

    if (!initRes || !initRes.ok) {
      throw new Error(`Không thể khởi tạo phiên tải ảnh lên Firebase Storage (${initRes ? initRes.status : 'ERR'}): ${lastErrText}`);
    }

    const uploadUrl = getHeader(initRes.headers, 'x-goog-upload-url');
    if (!uploadUrl) {
      throw new Error('Không nhận được X-Goog-Upload-URL từ Firebase Storage.');
    }

    const locketNative = getLocketNative();
    if (!locketNative || typeof locketNative.uploadBinary !== 'function') {
      throw new Error('LocketNative plugin không khả dụng để tải ảnh nhị phân.');
    }

    const putRes = await locketNative.uploadBinary({
      url: uploadUrl,
      method: 'PUT',
      headers: {
        'Content-Type': 'application/octet-stream',
        'x-goog-upload-protocol': 'resumable',
        'x-goog-upload-command': 'upload, finalize',
        'x-goog-upload-offset': '0',
        'x-goog-upload-content-length': String(byteLength),
        'User-Agent': LOCKET_STORAGE_UA,
      },
      base64Body: rawBase64,
    });

    if (putRes.status < 200 || putRes.status >= 300) {
      throw new Error(`Tải dữ liệu ảnh lên Firebase Storage thất bại (${putRes.status}): ${putRes.body || ''}`);
    }

    let downloadToken = null;
    const putData = parseJsonSafe(putRes.body);
    if (putData && putData.downloadTokens) {
      downloadToken = String(putData.downloadTokens).split(',')[0];
    }

    if (!downloadToken) {
      const metaRes = await nativeRequest({
        url: `${STORAGE_IMG_URL}/${encodedName}`,
        method: 'GET',
        headers: {
          'Content-Type': 'application/json; charset=UTF-8',
          'Authorization': `Firebase ${idToken}`,
          'Accept': '*/*',
          'User-Agent': LOCKET_STORAGE_UA,
          'x-firebase-gmpid': LOCKET_GMP_ID,
        },
      });
      if (metaRes.ok) {
        const metaData = parseJsonSafe(metaRes.data);
        if (metaData && metaData.downloadTokens) {
          downloadToken = String(metaData.downloadTokens).split(',')[0];
        }
      }
    }

    if (!downloadToken) downloadToken = genUuid();

    return {
      thumbnailUrl: `${STORAGE_IMG_URL}/${encodedName}?alt=media&token=${downloadToken}`,
      md5: `${genUuid().replace(/-/g, '')}_${Math.floor(Date.now() / 1000)}`,
      imageName: filename,
      storageType: 'firebase_resumable',
    };
  }

  async function postMomentToLocket({ idToken, localId, thumbnailUrl, md5, caption = '', textColor = '#FFFFFFE6', bgColors = [], icon = '', recipients = [], sentToSelfOnly = false }) {
    const verifiedUid = getVerifiedUid(idToken, localId);
    const trimmedCaption = (caption || '').trim();
    const trimmedIcon = (icon || '').trim();
    const finalColors = Array.isArray(bgColors) ? bgColors.filter(Boolean) : [];
    const isPrivate = Boolean(sentToSelfOnly);
    const finalRecipients = isPrivate ? [] : (Array.isArray(recipients) ? recipients.filter(Boolean) : []);

    const overlays = [];
    if (trimmedCaption || trimmedIcon || finalColors.length > 0) {
      const overlayData = {
        text: trimmedCaption,
        type: 'standard',
        text_color: textColor || '#FFFFFFE6',
        max_lines: { value: '4', '@type': 'type.googleapis.com/google.protobuf.Int64Value' },
        background: {
          material_blur: finalColors.length > 0 ? 'regular' : 'ultra_thin',
          colors: finalColors,
        },
      };
      if (trimmedIcon) overlayData.icon = { data: trimmedIcon, type: 'emoji' };
      overlays.push({
        overlay_type: 'caption',
        overlay_id: 'caption:standard',
        alt_text: trimmedIcon ? `${trimmedIcon} ${trimmedCaption}`.trim() : trimmedCaption,
        data: overlayData,
      });
    }

    const dataPayload = {
      thumbnail_url: thumbnailUrl,
      overlays,
      sent_to_self_only: isPrivate,
      sent_to_all: !isPrivate && finalRecipients.length === 0,
      recipients: finalRecipients,
      md5: md5 || `${genUuid().replace(/-/g, '')}_${Math.floor(Date.now() / 1000)}`,
      analytics: buildAnalytics(),
    };
    if (trimmedCaption && overlays.length === 0) dataPayload.caption = trimmedCaption;

    const res = await nativeRequest({
      url: 'https://api.locketcamera.com/postMomentV2',
      method: 'POST',
      headers: {
        'User-Agent': LOCKET_DEVICE_UA,
        'Content-Type': 'application/json; charset=utf-8',
        'Accept': '*/*',
        'x-ios-bundle-identifier': LOCKET_BUNDLE_ID,
        'Authorization': `Bearer ${idToken}`,
      },
      data: { data: dataPayload },
      responseType: 'text',
    });

    const rawText = typeof res.data === 'string' ? res.data : JSON.stringify(res.data || {});
    const data = parseJsonSafe(res.data);
    if (!res.ok || data.error || data.errors) {
      const errMsg = data.error?.message || JSON.stringify(data.error || data.errors || data || rawText.slice(0, 150));
      throw new Error(`Đăng lên Locket thất bại (${res.status}): ${errMsg}`);
    }

    const resObj = data.result || data;
    if (resObj && ((resObj.status !== undefined && resObj.status !== 200 && resObj.status !== 'success' && resObj.status !== null) || resObj.errors)) {
      throw new Error(`Máy chủ Locket từ chối bài đăng (status ${resObj.status}): ${JSON.stringify(resObj)}`);
    }

    const momentData = resObj?.data || {};
    const canonicalUid = momentData.canonical_uid || momentData.moment_uid || randomId(20);
    if (verifiedUid) {
      const mapObj = loadOwnPostsMap();
      const existingList = Array.isArray(mapObj[verifiedUid]) ? mapObj[verifiedUid] : [];
      existingList.unshift({
        moment_uid: canonicalUid,
        user_uid: verifiedUid,
        thumbnail_url: thumbnailUrl,
        video_url: '',
        caption: trimmedIcon ? `${trimmedIcon} ${trimmedCaption}`.trim() : trimmedCaption,
        overlays,
        date: new Date().toISOString(),
        is_mine: true,
      });
      mapObj[verifiedUid] = existingList.slice(0, 50);
      saveOwnPostsMap(mapObj);
    }
    return data;
  }

  async function getAllFriends(idToken, localId) {
    const verifiedUid = getVerifiedUid(idToken, localId);
    const res = await nativeRequest({
      url: `${FIRESTORE_DEFAULT_BASE}/users/${verifiedUid}/friends?pageSize=200`,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${idToken}`,
        'User-Agent': LOCKET_DEVICE_UA,
        'x-ios-bundle-identifier': LOCKET_BUNDLE_ID,
        'Accept': 'application/json',
      },
    });
    if (res.status === 401 || res.status === 403) {
      throw new Error('TOKEN_EXPIRED: Phiên đăng nhập hết hạn khi tải danh sách bạn bè.');
    }
    const docs = parseJsonSafe(res.data).documents || [];
    const friendItems = docs.map((doc) => ({
      uid: doc.name.split('/').pop(),
      dateAdded: doc.fields?.date?.timestampValue || doc.createTime || '',
    }));
    return Promise.all(
      friendItems.map(async (item) => ({
        ...(await getUserProfile(idToken, item.uid)),
        date_added: item.dateAdded,
      }))
    );
  }

  async function getMomentsFeed(idToken, localId, { filteredByUserId = null, limit = 50 } = {}) {
    const verifiedUid = getVerifiedUid(idToken, localId);
    const momentsMap = new Map();

    if (!filteredByUserId || filteredByUserId === verifiedUid) {
      const mapObj = loadOwnPostsMap();
      for (const m of mapObj[verifiedUid] || []) {
        momentsMap.set(m.moment_uid, m);
      }
    }

    const structuredQuery = {
      from: [{ collectionId: 'entries' }],
      orderBy: [
        { field: { fieldPath: 'date' }, direction: 'DESCENDING' },
        { field: { fieldPath: '__name__' }, direction: 'DESCENDING' },
      ],
      limit: Number(limit) || 50,
    };
    if (filteredByUserId) {
      structuredQuery.where = {
        fieldFilter: {
          field: { fieldPath: 'user' },
          op: 'EQUAL',
          value: { stringValue: filteredByUserId },
        },
      };
    }

    for (const base of [FIRESTORE_LOCKET_BASE, FIRESTORE_DEFAULT_BASE]) {
      try {
        const qRes = await nativeRequest({
          url: `${base}/history/${verifiedUid}:runQuery`,
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${idToken}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'x-ios-bundle-identifier': LOCKET_BUNDLE_ID,
            'User-Agent': LOCKET_DEVICE_UA,
          },
          data: { structuredQuery },
        });
        if (qRes.ok) {
          const rows = parseJsonSafe(qRes.data);
          if (Array.isArray(rows)) {
            for (const row of rows) {
              if (!row.document) continue;
              const doc = row.document;
              const fields = doc.fields || {};
              const get = (k) => parseFirestoreValue(fields[k]);
              const momentUid = get('canonical_uid') || get('moment_uid') || doc.name.split('/').pop();
              const userUid = get('user') || filteredByUserId || verifiedUid;
              const overlays = get('overlays') || [];
              let caption = get('caption') || '';
              if (!caption && Array.isArray(overlays) && overlays.length > 0) {
                caption = overlays[0]?.alt_text || overlays[0]?.data?.text || '';
              }
              if (!momentsMap.has(momentUid)) {
                momentsMap.set(momentUid, {
                  moment_uid: momentUid,
                  user_uid: userUid,
                  thumbnail_url: get('thumbnail_url') || '',
                  video_url: get('video_url') || '',
                  caption,
                  overlays,
                  date: get('date') || doc.createTime || new Date().toISOString(),
                  md5: get('md5') || '',
                  is_mine: userUid === verifiedUid,
                });
              }
            }
          }
          if (momentsMap.size > 0) break;
        }
      } catch (_) {}
    }

    try {
      const latestRes = await postLocketApi(
        'getLatestMomentV2',
        { should_count_missed_moments: true, include_group_moments: true, excluded_users: [] },
        idToken
      );
      const rawMoments = latestRes?.result?.data?.moments || latestRes?.result?.data || [];
      const list = Array.isArray(rawMoments) ? rawMoments : [rawMoments];
      for (const item of list) {
        if (!item || typeof item !== 'object') continue;
        const mUid = item.canonical_uid || item.moment_uid || item.id;
        const uUid = item.user || item.user_uid || verifiedUid;
        if (!mUid || (filteredByUserId && uUid !== filteredByUserId)) continue;
        const overlays = item.overlays || [];
        let caption = item.caption || '';
        if (!caption && Array.isArray(overlays) && overlays.length > 0) {
          caption = overlays[0]?.alt_text || overlays[0]?.data?.text || '';
        }
        let dateStr = item.date;
        if (dateStr && typeof dateStr === 'object' && dateStr._seconds) dateStr = new Date(dateStr._seconds * 1000).toISOString();
        else if (typeof dateStr === 'number') dateStr = new Date(dateStr * 1000).toISOString();

        if (!momentsMap.has(mUid)) {
          momentsMap.set(mUid, {
            moment_uid: mUid,
            user_uid: uUid,
            thumbnail_url: item.thumbnail_url || '',
            video_url: item.video_url || '',
            caption,
            overlays,
            date: dateStr || new Date().toISOString(),
            md5: item.md5 || '',
            is_mine: uUid === verifiedUid,
          });
        }
      }
    } catch (_) {}

    const allMoments = Array.from(momentsMap.values()).sort(
      (a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime()
    );
    const uniqueUids = [...new Set(allMoments.map((m) => m.user_uid).filter(Boolean))];
    const profileLookup = Object.fromEntries(
      await Promise.all(uniqueUids.map(async (uid) => [uid, await getUserProfile(idToken, uid)]))
    );
    return {
      myUid: verifiedUid,
      moments: allMoments.map((m) => ({
        ...m,
        author: profileLookup[m.user_uid] || {
          uid: m.user_uid,
          display_name: m.is_mine ? 'Tôi' : `Locket (${(m.user_uid || '').slice(0, 6)})`,
          username: '',
          profile_picture_url: null,
        },
      })),
    };
  }

  async function getMomentViewsAndReactions(idToken, localId, momentUid) {
    if (!momentUid) throw new Error('Thiếu mã khoảnh khắc (momentUid).');
    const viewerMap = new Map();
    const reactionsList = [];
    let apiCount = 0;
    let rawViewsData = null;

    try {
      const viewsRes = await postLocketApi('getMomentViews', { moment_uid: momentUid }, idToken);
      rawViewsData = viewsRes?.result?.data || viewsRes?.data || viewsRes;
      if (rawViewsData && typeof rawViewsData === 'object') {
        if (typeof rawViewsData.count === 'number') apiCount = rawViewsData.count;
        const candidates =
          rawViewsData.moment_views ||
          rawViewsData.views ||
          rawViewsData.viewers ||
          rawViewsData.users ||
          (Array.isArray(rawViewsData) ? rawViewsData : []);
        if (Array.isArray(candidates)) {
          for (const item of candidates) {
            if (typeof item === 'string') viewerMap.set(item, { uid: item, viewed_at: '', reaction: null });
            else if (item && typeof item === 'object') {
              const uid = item.user || item.user_uid || item.uid || item.id;
              let viewedAt = item.date || item.viewed_at || item.created_at || '';
              if (viewedAt && typeof viewedAt === 'object' && viewedAt._seconds) {
                viewedAt = new Date(viewedAt._seconds * 1000).toISOString();
              }
              if (uid) viewerMap.set(uid, { uid, viewed_at: viewedAt, reaction: item.reaction || null });
            }
          }
        }
      }
    } catch (_) {}

    for (const base of [FIRESTORE_DEFAULT_BASE, FIRESTORE_LOCKET_BASE]) {
      try {
        const rRes = await nativeRequest({
          url: `${base}/moments/${momentUid}/reactions?pageSize=100`,
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${idToken}`,
            'User-Agent': LOCKET_DEVICE_UA,
            'x-ios-bundle-identifier': LOCKET_BUNDLE_ID,
            'Accept': 'application/json',
          },
        });
        if (rRes.ok) {
          for (const doc of parseJsonSafe(rRes.data).documents || []) {
            const f = doc.fields || {};
            const senderUid = f.user?.stringValue || f.sender?.stringValue || doc.name.split('/').pop();
            const emoji = f.string?.stringValue || f.emoji?.stringValue || f.reaction?.stringValue || '❤️';
            const createdAt = f.created_at?.timestampValue || f.date?.timestampValue || doc.createTime || '';
            if (senderUid && !reactionsList.some((r) => r.uid === senderUid && r.emoji === emoji)) {
              reactionsList.push({ uid: senderUid, emoji, created_at: createdAt });
              const existing = viewerMap.get(senderUid);
              viewerMap.set(senderUid, { uid: senderUid, viewed_at: existing?.viewed_at || createdAt, reaction: emoji });
            }
          }
        }
      } catch (_) {}

      try {
        const vRes = await nativeRequest({
          url: `${base}/moments/${momentUid}/views?pageSize=100`,
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${idToken}`,
            'User-Agent': LOCKET_DEVICE_UA,
            'x-ios-bundle-identifier': LOCKET_BUNDLE_ID,
            'Accept': 'application/json',
          },
        });
        if (vRes.ok) {
          for (const doc of parseJsonSafe(vRes.data).documents || []) {
            const f = doc.fields || {};
            const viewerUid = f.user?.stringValue || f.uid?.stringValue || doc.name.split('/').pop();
            const viewedAt = f.date?.timestampValue || f.created_at?.timestampValue || doc.createTime || '';
            if (viewerUid && !viewerMap.has(viewerUid)) {
              viewerMap.set(viewerUid, { uid: viewerUid, viewed_at: viewedAt, reaction: null });
            }
          }
        }
      } catch (_) {}
    }

    const allUids = [...new Set([...viewerMap.keys(), ...reactionsList.map((r) => r.uid)].filter(Boolean))];
    const profilesByUid = Object.fromEntries(
      await Promise.all(allUids.map(async (uid) => [uid, await getUserProfile(idToken, uid)]))
    );
    const enrichedViewers = Array.from(viewerMap.values()).map((v) => {
      const p = profilesByUid[v.uid] || {};
      return {
        uid: v.uid,
        display_name: p.display_name || `Locket (${v.uid.slice(0, 6)})`,
        username: p.username || '',
        profile_picture_url: p.profile_picture_url || null,
        viewed_at: v.viewed_at,
        reaction: v.reaction,
      };
    });
    const enrichedReactions = reactionsList.map((r) => {
      const p = profilesByUid[r.uid] || {};
      return {
        uid: r.uid,
        display_name: p.display_name || `Locket (${r.uid.slice(0, 6)})`,
        username: p.username || '',
        profile_picture_url: p.profile_picture_url || null,
        emoji: r.emoji,
        created_at: r.created_at,
      };
    });
    return {
      moment_uid: momentUid,
      total_views: Math.max(apiCount, enrichedViewers.length),
      total_reactions: enrichedReactions.length,
      viewers: enrichedViewers,
      reactions: enrichedReactions,
      raw: rawViewsData,
    };
  }

  async function deleteMoment(idToken, localId, momentUid) {
    const verifiedUid = getVerifiedUid(idToken, localId);
    const res = await postLocketApi('deleteMomentV2', { moment_uid: momentUid, canonical_uid: momentUid }, idToken);
    if (verifiedUid) {
      const mapObj = loadOwnPostsMap();
      if (Array.isArray(mapObj[verifiedUid])) {
        mapObj[verifiedUid] = mapObj[verifiedUid].filter((m) => m.moment_uid !== momentUid);
        saveOwnPostsMap(mapObj);
      }
    }
    return res;
  }

  async function getConversations(idToken, localId) {
    const verifiedUid = getVerifiedUid(idToken, localId);
    const res = await nativeRequest({
      url: `${FIRESTORE_DEFAULT_BASE}/users/${verifiedUid}/conversations?pageSize=50`,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${idToken}`,
        'User-Agent': LOCKET_DEVICE_UA,
        'x-ios-bundle-identifier': LOCKET_BUNDLE_ID,
        'Accept': 'application/json',
      },
    });
    if (res.status === 401 || res.status === 403) {
      throw new Error('TOKEN_EXPIRED: Phiên đăng nhập hết hạn khi tải hộp thư Locket.');
    }
    const docs = parseJsonSafe(res.data).documents || [];
    const convList = docs.map((doc) => {
      const fields = doc.fields || {};
      const convId = doc.name.split('/').pop();
      const members = (fields.members?.arrayValue?.values || []).map((v) => v.stringValue).filter(Boolean);
      const peerUid = members.find((m) => m !== verifiedUid) || members[0] || null;
      const latestMsgField = fields.latest_message?.mapValue?.fields || {};
      const latestMessage = {
        text: latestMsgField.body?.stringValue || '',
        sender_uid: latestMsgField.sender?.stringValue || '',
        thumbnail_url: latestMsgField.thumbnail_url?.stringValue || '',
        timestamp: latestMsgField.created_at?.timestampValue || doc.updateTime || doc.createTime || '',
      };
      return {
        conversation_id: convId,
        peer_uid: peerUid,
        members,
        latest_message: latestMessage,
        unread_count: parseInt(fields.unread_count?.integerValue || '0', 10),
        is_read: fields.is_read?.booleanValue !== false,
        updated_at: latestMessage.timestamp || doc.updateTime || '',
      };
    });
    convList.sort((a, b) => new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime());
    const uniquePeerUids = [...new Set(convList.map((c) => c.peer_uid).filter(Boolean))];
    const peerMap = Object.fromEntries(
      await Promise.all(uniquePeerUids.map(async (uid) => [uid, await getUserProfile(idToken, uid)]))
    );
    return convList.map((c) => ({
      ...c,
      peer: peerMap[c.peer_uid] || {
        uid: c.peer_uid || '',
        display_name: c.peer_uid ? `Bạn bè (${c.peer_uid.slice(0, 6)})` : 'Cuộc trò chuyện Locket',
        username: '',
        profile_picture_url: null,
      },
    }));
  }

  async function getMessages(idToken, localId, conversationId) {
    if (!conversationId) throw new Error('Thiếu mã cuộc trò chuyện (conversationId).');
    const verifiedUid = getVerifiedUid(idToken, localId);
    const res = await nativeRequest({
      url: `${FIRESTORE_DEFAULT_BASE}/conversations/${conversationId}/messages?pageSize=100`,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${idToken}`,
        'User-Agent': LOCKET_DEVICE_UA,
        'x-ios-bundle-identifier': LOCKET_BUNDLE_ID,
        'Accept': 'application/json',
      },
    });
    if (res.status === 401 || res.status === 403) {
      throw new Error('TOKEN_EXPIRED: Phiên đăng nhập hết hạn khi tải tin nhắn.');
    }
    const docs = parseJsonSafe(res.data).documents || [];
    const messages = docs.map((doc) => {
      const fields = doc.fields || {};
      const senderUid = fields.sender?.stringValue || '';
      const reactions = (fields.reactions?.arrayValue?.values || [])
        .map((r) => {
          const rf = r.mapValue?.fields || {};
          return {
            sender: rf.sender?.stringValue || '',
            emoji: rf.emoji?.stringValue || '',
            created_at: rf.created_at?.timestampValue || '',
          };
        })
        .filter((r) => r.emoji);
      return {
        message_id: doc.name.split('/').pop(),
        sender_uid: senderUid,
        is_me: senderUid === verifiedUid,
        text: fields.body?.stringValue || '',
        thumbnail_url: fields.thumbnail_url?.stringValue || '',
        reply_moment: fields.reply_moment?.stringValue || null,
        timestamp: fields.created_at?.timestampValue || doc.createTime || '',
        reactions,
      };
    });
    messages.sort((a, b) => new Date(a.timestamp || 0).getTime() - new Date(b.timestamp || 0).getTime());
    return { myUid: verifiedUid, conversation_id: conversationId, messages };
  }

  async function sendChatMessage(idToken, { receiverUid, text = '', momentUid = null }) {
    if (!receiverUid) throw new Error('Thiếu UID người nhận tin nhắn (receiverUid).');
    const msgText =
      text !== null && text !== undefined && String(text).trim() !== ''
        ? String(text).trim()
        : momentUid
          ? '\u200b'
          : '';
    if (!msgText) throw new Error('Vui lòng nhập nội dung tin nhắn.');

    return postLocketApi(
      'sendChatMessageV2',
      {
        receiver_uid: receiverUid,
        msg: msgText,
        moment_uid: momentUid || null,
        from_memory: false,
        intensity: { value: '0', '@type': 'type.googleapis.com/google.protobuf.Int64Value' },
        client_token: genUuid().toUpperCase(),
      },
      idToken
    );
  }

  // -------------------- AI Generation & Image-to-Image Editing --------------------

  async function fetchImageAsDataUrl(imageUrl) {
    const locketNative = getLocketNative();
    if (locketNative && typeof locketNative.fetchBinaryBase64 === 'function') {
      const res = await locketNative.fetchBinaryBase64({
        url: imageUrl,
        headers: { 'User-Agent': 'Mozilla/5.0 LocketAIStudio/2.0' },
      });
      if (res.status < 200 || res.status >= 300 || !res.base64) {
        throw new Error(`Không thể tải ảnh từ máy chủ AI (${res.status}).`);
      }
      return `data:${res.mimeType || 'image/jpeg'};base64,${res.base64}`;
    }
    throw new Error('LocketNative plugin không khả dụng để tải ảnh.');
  }

  async function enhancePromptForGeneration({ prompt, style = 'realistic_selfie', geminiApiKey = '' }) {
    const styleDesc = STYLE_PROMPTS[style] || STYLE_PROMPTS.realistic_selfie;
    const systemInstruction = `Bạn là trợ lý tạo ảnh AI cho ứng dụng Locket Widget.
Nhiệm vụ: Từ mô tả tiếng Việt của người dùng, hãy trả về đúng định dạng JSON (không dùng markdown block) gồm 1 trường:
"englishPrompt": Câu lệnh tiếng Anh chi tiết (dưới 60 từ) mô tả hình ảnh trực quan để đưa vào mô hình Flux tạo ảnh, kết hợp phong cách: "${styleDesc}".`;

    if (geminiApiKey && geminiApiKey.trim()) {
      try {
        const res = await nativeRequest({
          url: `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(geminiApiKey.trim())}`,
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          data: {
            contents: [{ parts: [{ text: `${systemInstruction}\n\nÝ tưởng của người dùng: "${prompt}"` }] }],
            generationConfig: { responseMimeType: 'application/json', temperature: 0.75 },
          },
        });
        if (res.ok) {
          const parsed = parseJsonSafe(res.data?.candidates?.[0]?.content?.parts?.[0]?.text || '');
          if (parsed.englishPrompt) return { englishPrompt: parsed.englishPrompt, provider: 'Google Gemini 2.5 Flash' };
        }
      } catch (_) {}
    }

    try {
      const gtRes = await nativeRequest({
        url:
          'https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=t&q=' +
          encodeURIComponent(prompt),
        method: 'GET',
      });
      if (gtRes.ok && Array.isArray(gtRes.data?.[0])) {
        const t = gtRes.data[0].map((s) => s?.[0] || '').join('').trim();
        if (t) return { englishPrompt: `${t}, ${styleDesc}`, provider: 'Flux + Google Translate' };
      }
    } catch (_) {}

    return { englishPrompt: `${prompt}, ${styleDesc}`, provider: 'Local Fallback' };
  }

  async function generateAIImage({ prompt, style = 'realistic_selfie', seed, geminiApiKey = '' }) {
    const actualSeed = seed || Math.floor(Math.random() * 9999999);
    const enhanced = await enhancePromptForGeneration({ prompt, style, geminiApiKey });
    const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(enhanced.englishPrompt)}?width=1024&height=1024&seed=${actualSeed}&model=flux&nologo=true`;
    const base64Image = await fetchImageAsDataUrl(imageUrl);
    return { base64Image, englishPrompt: enhanced.englishPrompt, seed: actualSeed, provider: enhanced.provider };
  }

  async function translateEditInstruction(instruction, geminiApiKey = '') {
    const sys =
      'Translate the user\'s Vietnamese photo-editing request into one short, clear English instruction for an image editing model (e.g. "Add black sunglasses to the person"). Reply with the English instruction only.';
    try {
      if (geminiApiKey && geminiApiKey.trim()) {
        const r = await nativeRequest({
          url: `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(geminiApiKey.trim())}`,
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          data: { contents: [{ parts: [{ text: `${sys}\n\n${instruction}` }] }] },
        });
        const t = r.data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (r.ok && t) return t;
      }
      const gt = await nativeRequest({
        url:
          'https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=t&q=' +
          encodeURIComponent(instruction),
        method: 'GET',
      });
      if (gt.ok && Array.isArray(gt.data?.[0])) {
        const t = gt.data[0].map((s) => s?.[0] || '').join('').trim();
        if (t) return t;
      }
    } catch (_) {}
    return instruction;
  }

  async function editImageViaGradioSpaces(rawBase64, englishInstruction, mimeType = 'image/jpeg') {
    const locketNative = getLocketNative();
    if (!locketNative || typeof locketNative.uploadMultipart !== 'function') {
      throw new Error('LocketNative plugin không khả dụng.');
    }
    const spaces = [
      {
        name: 'FLUX.1 Kontext',
        base: 'https://black-forest-labs-flux-1-kontext-dev.hf.space',
        endpoint: '/infer',
        buildData: (file) => [file, englishInstruction, 0, true, 2.5, 24],
      },
      {
        name: 'Qwen-Image-Edit',
        base: 'https://qwen-qwen-image-edit.hf.space',
        endpoint: '/infer',
        buildData: (file) => [file, englishInstruction, 0, true, 4.0, 30, false],
      },
    ];

    const errors = [];
    for (const sp of spaces) {
      try {
        const upRes = await locketNative.uploadMultipart({
          url: `${sp.base}/gradio_api/upload`,
          fieldName: 'files',
          fileName: 'input.jpg',
          mimeType,
          base64Body: rawBase64,
        });
        if (upRes.status < 200 || upRes.status >= 300) throw new Error(`upload ${upRes.status}`);
        const uploadedArr = parseJsonSafe(upRes.body);
        const uploaded = Array.isArray(uploadedArr) ? uploadedArr[0] : uploadedArr;
        const fileData = { path: uploaded, meta: { _type: 'gradio.FileData' } };

        const callRes = await nativeRequest({
          url: `${sp.base}/gradio_api/call${sp.endpoint}`,
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          data: { data: sp.buildData(fileData) },
        });
        if (!callRes.ok) throw new Error(`call ${callRes.status}`);
        const { event_id } = parseJsonSafe(callRes.data);

        const sseRes = await nativeRequest({
          url: `${sp.base}/gradio_api/call${sp.endpoint}/${event_id}`,
          method: 'GET',
          responseType: 'text',
          readTimeout: 120000,
        });
        const lines = String(sseRes.data || '').split('\n');
        let resultData = null;
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].startsWith('event: error')) {
            throw new Error((lines[i + 1] || 'error').replace(/^data:\s*/, '').slice(0, 160));
          }
          if (lines[i].startsWith('event: complete')) {
            resultData = JSON.parse((lines[i + 1] || '').replace(/^data:\s*/, ''));
            break;
          }
        }
        if (!resultData) throw new Error('không có kết quả');

        const out = Array.isArray(resultData) ? resultData[0] : resultData;
        let outUrl = out?.url || (out?.path ? `${sp.base}/gradio_api/file=${out.path}` : null);
        if (!outUrl) throw new Error('không có ảnh đầu ra');
        if (outUrl.startsWith('/')) outUrl = sp.base + outUrl;

        const dataUrl = await fetchImageAsDataUrl(outUrl);
        return { base64Image: dataUrl, provider: sp.name };
      } catch (e) {
        errors.push(`${sp.name}: ${e.message}`);
      }
    }
    throw new Error(errors.join(' | '));
  }

  async function editAIImage({ base64Image, instruction, previousPrompt = '', geminiApiKey = '' }) {
    const cleanInstruction = (instruction || '').trim();
    if (!cleanInstruction) throw new Error('Vui lòng nhập lời nhắn mô tả cách bạn muốn AI chỉnh sửa bức ảnh.');

    const rawBase64 = (base64Image || '').replace(/^data:image\/\w+;base64,/, '');
    const mimeMatch = (base64Image || '').match(/^data:(image\/\w+);base64,/);
    const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';

    if (geminiApiKey && geminiApiKey.trim() && rawBase64) {
      try {
        const editRes = await nativeRequest({
          url: `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp-image-generation:generateContent?key=${encodeURIComponent(geminiApiKey.trim())}`,
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          data: {
            contents: [
              {
                parts: [
                  { inlineData: { mimeType, data: rawBase64 } },
                  {
                    text: `Edit this image according to the following instruction while keeping the main subject, pose, and composition recognizable: "${cleanInstruction}"`,
                  },
                ],
              },
            ],
            generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
          },
        });
        if (editRes.ok) {
          const parts = editRes.data?.candidates?.[0]?.content?.parts || [];
          const imgPart = parts.find((p) => p.inlineData && p.inlineData.data);
          if (imgPart) {
            return {
              base64Image: `data:${imgPart.inlineData.mimeType || 'image/png'};base64,${imgPart.inlineData.data}`,
              englishPrompt: `Gemini Direct Image Edit: ${cleanInstruction}`,
              provider: 'Google Gemini Image Editor',
            };
          }
        }
      } catch (_) {}
    }

    if (rawBase64) {
      const englishInstruction = await translateEditInstruction(cleanInstruction, geminiApiKey);
      const edited = await editImageViaGradioSpaces(rawBase64, englishInstruction, mimeType);
      return {
        base64Image: edited.base64Image,
        englishPrompt: englishInstruction,
        provider: `${edited.provider} (sửa trực tiếp ảnh gốc)`,
      };
    }

    const fallbackPrompt = previousPrompt
      ? `${previousPrompt}, ${cleanInstruction}`
      : `${cleanInstruction}, candid iPhone photography`;
    const generated = await generateAIImage({ prompt: fallbackPrompt, geminiApiKey });
    return generated;
  }

  // -------------------- Router giả lập /api/* --------------------

  async function handleApiRoute(pathname, body) {
    if (pathname === '/api/health') {
      return { status: 'ok', service: 'Locket AI Studio Pro (iOS Native)' };
    }
    if (pathname === '/api/locket/login') {
      if (!body.email || !body.password) throw new Error('Vui lòng nhập đầy đủ Email và Mật khẩu Locket.');
      const session = await loginLocket(body.email, body.password);
      return { success: true, session };
    }
    if (pathname === '/api/locket/refresh') {
      if (!body.refreshToken) throw new Error('Thiếu refreshToken.');
      const session = await refreshLocketToken(body.refreshToken);
      return { success: true, session };
    }
    if (pathname === '/api/ai/generate-image') {
      if (!body.prompt || !body.prompt.trim()) throw new Error('Vui lòng nhập mô tả bức ảnh bạn muốn AI tạo.');
      const res = await generateAIImage({
        prompt: body.prompt.trim(),
        style: body.style,
        tone: body.tone,
        seed: body.seed,
        geminiApiKey: body.geminiApiKey,
      });
      return { success: true, ...res };
    }
    if (pathname === '/api/ai/edit-image') {
      if (!body.instruction || !body.instruction.trim()) {
        throw new Error('Vui lòng nhập lời nhắn mô tả cách bạn muốn AI chỉnh sửa ảnh.');
      }
      const res = await editAIImage({
        base64Image: body.base64Image,
        instruction: body.instruction.trim(),
        previousPrompt: body.previousPrompt,
        geminiApiKey: body.geminiApiKey,
      });
      return { success: true, ...res };
    }
    if (pathname === '/api/locket/post') {
      if (!body.base64Image) throw new Error('Chưa có hình ảnh để đăng lên Locket.');
      const rawBase64 = body.base64Image.replace(/^data:image\/\w+;base64,/, '');
      const { data, refreshedSession } = await runWithAutoRefresh(body, async (activeToken, activeLocalId) => {
        const up = await uploadImageToLocketStorage(rawBase64, activeLocalId, activeToken);
        const momentResponse = await postMomentToLocket({
          idToken: activeToken,
          localId: activeLocalId,
          thumbnailUrl: up.thumbnailUrl,
          md5: up.md5,
          caption: body.caption,
          textColor: body.textColor,
          bgColors: body.bgColors,
          icon: body.icon,
          recipients: body.recipients,
          sentToSelfOnly: Boolean(body.sentToSelfOnly),
        });
        return { thumbnailUrl: up.thumbnailUrl, momentResponse };
      });
      return { success: true, ...data, refreshedSession };
    }
    if (pathname === '/api/locket/friends') {
      const { data: friends, refreshedSession } = await runWithAutoRefresh(body, (t, uid) => getAllFriends(t, uid));
      return { success: true, friends, refreshedSession };
    }
    if (pathname === '/api/locket/feed') {
      const { data, refreshedSession } = await runWithAutoRefresh(body, (t, uid) =>
        getMomentsFeed(t, uid, { filteredByUserId: body.filteredByUserId, limit: body.limit })
      );
      return { success: true, ...data, refreshedSession };
    }
    if (pathname === '/api/locket/moment/views') {
      const { data, refreshedSession } = await runWithAutoRefresh(body, (t, uid) =>
        getMomentViewsAndReactions(t, uid, body.momentUid)
      );
      return { success: true, ...data, refreshedSession };
    }
    if (pathname === '/api/locket/moment/react') {
      const { data: result, refreshedSession } = await runWithAutoRefresh(body, (t) =>
        postLocketApi(
          'reactToMoment',
          {
            moment_uid: body.momentUid,
            reaction: body.emoji || '💛',
            from_memory: false,
            intensity: { '@type': 'type.googleapis.com/google.protobuf.Int64Value', value: '0' },
          },
          t
        )
      );
      return { success: true, result, refreshedSession };
    }
    if (pathname === '/api/locket/moment/delete') {
      const { data: result, refreshedSession } = await runWithAutoRefresh(body, (t, uid) =>
        deleteMoment(t, uid, body.momentUid)
      );
      return { success: true, result, refreshedSession };
    }
    if (pathname === '/api/locket/chat/conversations') {
      const { data: conversations, refreshedSession } = await runWithAutoRefresh(body, (t, uid) =>
        getConversations(t, uid)
      );
      return { success: true, conversations, refreshedSession };
    }
    if (pathname === '/api/locket/chat/messages') {
      const { data, refreshedSession } = await runWithAutoRefresh(body, (t, uid) =>
        getMessages(t, uid, body.conversationId)
      );
      return { success: true, ...data, refreshedSession };
    }
    if (pathname === '/api/locket/chat/send') {
      const { data: result, refreshedSession } = await runWithAutoRefresh(body, (t) =>
        sendChatMessage(t, { receiverUid: body.receiverUid, text: body.text, momentUid: body.momentUid })
      );
      return { success: true, result, refreshedSession };
    }
    if (pathname === '/api/locket/chat/react') {
      const { data: result, refreshedSession } = await runWithAutoRefresh(body, (t) =>
        postLocketApi(
          'sendChatMessageReaction',
          {
            conversation_id: body.conversationId,
            message_id: body.messageId,
            emoji: body.emoji || '❤️',
          },
          t
        )
      );
      return { success: true, result, refreshedSession };
    }
    throw new Error(`Endpoint không tồn tại: ${pathname}`);
  }

  const originalFetch = window.fetch.bind(window);
  window.fetch = async function (input, init) {
    const urlStr = typeof input === 'string' ? input : input?.url || '';
    if (urlStr.startsWith('/api/')) {
      try {
        let body = {};
        if (init && typeof init.body === 'string') {
          body = JSON.parse(init.body);
        }
        const payload = await handleApiRoute(urlStr, body);
        return new Response(JSON.stringify(payload), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message || 'Lỗi xử lý trên iOS' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }
    return originalFetch(input, init);
  };

  // Tiện ích lưu ảnh vào Album Ảnh iPhone nếu gọi từ nút tải ảnh
  window.__saveImageToIphonePhotos = async function (base64Image) {
    const locketNative = getLocketNative();
    if (!locketNative || typeof locketNative.saveToPhotos !== 'function') return false;
    const raw = (base64Image || '').replace(/^data:image\/\w+;base64,/, '');
    await locketNative.saveToPhotos({ base64Body: raw });
    return true;
  };
})();

