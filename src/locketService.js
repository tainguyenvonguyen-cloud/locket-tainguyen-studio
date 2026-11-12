const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Hằng số giả lập phần cứng iOS chuẩn từ bộ SDK Locket mới nhất (locket.js / locketlam v2.68.0 build 2523)
const LOCKET_FIREBASE_API_KEY = process.env.LOCKET_FIREBASE_API_KEY || 'AIzaSyCQngaaXQIfJaH0aS2l7REgIjD7nL431So';
const LOCKET_FIREBASE_AUTH_URL = 'https://identitytoolkit.googleapis.com/v1/accounts';
const LOCKET_FIREBASE_TOKEN_URL = 'https://securetoken.googleapis.com/v1/token';
const LOCKET_GMP_ID = '1:641029076083:ios:cc8eb46290d69b234fa606';
const LOCKET_BUNDLE_ID = 'com.locket.Locket';
const LOCKET_APP_VERSION = '2.68.0';
const LOCKET_BUILD_NUMBER = '2523';

// User-Agent đồng bộ với Locket iOS Client 2.68.0
const LOCKET_DEVICE_UA = `com.locket.Locket/${LOCKET_APP_VERSION} iPhone/18.1.0 hw/iPhone16_1`;
const LOCKET_STORAGE_UA = `${LOCKET_DEVICE_UA} (GTMSUF/1)`;
const STORAGE_IMG_URL = 'https://firebasestorage.googleapis.com/v0/b/locket-img/o';
const FIRESTORE_DEFAULT_BASE = 'https://firestore.googleapis.com/v1/projects/locket-4252a/databases/(default)/documents';
const FIRESTORE_LOCKET_BASE = 'https://firestore.googleapis.com/v1/projects/locket-4252a/databases/locket/documents';

// Bộ nhớ đệm hồ sơ người dùng (cache 15 phút) và lưu trữ bài đăng của mình trên ổ cứng
const userProfileCache = new Map();
const POSTED_STORE_FILE = path.join(__dirname, '..', 'posted_moments_cache.json');
const recentOwnPostsCache = new Map(); // Map<uid, Array<Moment>>

function loadPostedMomentsFromDisk() {
  try {
    if (fs.existsSync(POSTED_STORE_FILE)) {
      const raw = JSON.parse(fs.readFileSync(POSTED_STORE_FILE, 'utf-8'));
      for (const [uid, list] of Object.entries(raw)) {
        if (Array.isArray(list)) {
          recentOwnPostsCache.set(uid, list);
        }
      }
    } else {
      // Khởi tạo sẵn 2 bài đăng vừa bắn thành công trong phiên trước để người dùng kiểm tra "Ai đã xem" ngay
      const initialUid = 'J9jEvGUcb4cSgiwdzubwson4TXI3';
      const seeded = [
        {
          moment_uid: '8WwU6ObUhDfkNvp01ExZ',
          user_uid: initialUid,
          thumbnail_url:
            'https://firebasestorage.googleapis.com/v0/b/locket-img/o/users%2FJ9jEvGUcb4cSgiwdzubwson4TXI3%2Fmoments%2Fthumbnails%2FIAf9WihQ0Unf6ctxuIgX.webp?alt=media&token=4d4c1574-ff18-4193-8edc-41546bcda436',
          video_url: '',
          caption: 'Yêu mèo? Vẽ ngay! 🐱✏️',
          overlays: [],
          date: new Date(1794434505 * 1000).toISOString(),
          is_mine: true,
        },
        {
          moment_uid: '0sNXn58HVF2cQQ4Rrqyr',
          user_uid: initialUid,
          thumbnail_url:
            'https://firebasestorage.googleapis.com/v0/b/locket-img/o/users%2FJ9jEvGUcb4cSgiwdzubwson4TXI3%2Fmoments%2Fthumbnails%2FcSbP3bekJpLIrDnHLrKo.webp?alt=media&token=908cb7d3-ee1a-4a49-8feb-b642da870bcf',
          video_url: '',
          caption: 'Yêu mèo? Vẽ ngay! 🐱✏️',
          overlays: [],
          date: new Date(1794434484 * 1000).toISOString(),
          is_mine: true,
        },
      ];
      recentOwnPostsCache.set(initialUid, seeded);
      savePostedMomentsToDisk();
    }
  } catch (_) {}
}

function savePostedMomentsToDisk() {
  try {
    const obj = Object.fromEntries(recentOwnPostsCache.entries());
    fs.writeFileSync(POSTED_STORE_FILE, JSON.stringify(obj, null, 2), 'utf-8');
  } catch (_) {}
}

loadPostedMomentsFromDisk();

function randomId(length = 20) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let out = '';
  for (let i = 0; i < length; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

/**
 * Giải mã payload của Firebase JWT (idToken) để lấy đúng user_id (localId) và kiểm tra hạn sử dụng
 */
function decodeJwtPayload(token) {
  try {
    const parts = (token || '').trim().split('.');
    if (parts.length !== 3) return null;
    const payloadJson = Buffer.from(parts[1], 'base64url').toString('utf-8');
    return JSON.parse(payloadJson);
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
  const installationId = crypto.randomUUID().replace(/-/g, '').slice(0, 22);
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

/**
 * Helper gọi API chính thức của Locket (https://api.locketcamera.com/<endpoint>)
 */
async function postLocketApi(endpoint, payload, idToken) {
  const response = await fetch(`https://api.locketcamera.com/${endpoint}`, {
    method: 'POST',
    headers: {
      'User-Agent': LOCKET_DEVICE_UA,
      'Content-Type': 'application/json; charset=utf-8',
      'Accept': '*/*',
      'x-ios-bundle-identifier': LOCKET_BUNDLE_ID,
      'Authorization': `Bearer ${idToken}`,
    },
    body: JSON.stringify({
      data: {
        ...payload,
        analytics: buildAnalytics(),
      },
    }),
  });

  const rawText = await response.text();
  if (response.status === 401 || response.status === 403) {
    throw new Error(`TOKEN_EXPIRED: Locket API ${endpoint} trả về ${response.status}: ${rawText.slice(0, 200)}`);
  }

  let data = {};
  try {
    data = JSON.parse(rawText);
  } catch (_) {
    throw new Error(`Phản hồi không hợp lệ từ Locket ${endpoint} (${response.status}): ${rawText.slice(0, 200)}`);
  }

  if (!response.ok || data.error || data.errors) {
    const errMsg = data.error?.message || JSON.stringify(data.error || data.errors || data);
    throw new Error(`Lỗi Locket API (${endpoint} - ${response.status}): ${errMsg}`);
  }

  return data;
}

/**
 * Giải mã cấu trúc trường dữ liệu trả về từ Google Firestore REST API
 */
function parseFirestoreValue(val) {
  if (!val || typeof val !== 'object') return null;
  if ('stringValue' in val) return val.stringValue;
  if ('integerValue' in val) return Number(val.integerValue);
  if ('doubleValue' in val) return Number(val.doubleValue);
  if ('booleanValue' in val) return Boolean(val.booleanValue);
  if ('timestampValue' in val) return val.timestampValue;
  if ('nullValue' in val) return null;
  if ('arrayValue' in val) {
    return (val.arrayValue.values || []).map(parseFirestoreValue);
  }
  if ('mapValue' in val) {
    const out = {};
    const fields = val.mapValue.fields || {};
    for (const k of Object.keys(fields)) {
      out[k] = parseFirestoreValue(fields[k]);
    }
    return out;
  }
  return val;
}

/**
 * Bước 1: Đăng nhập Locket qua Google Identity Toolkit (signInWithPassword)
 */
async function loginLocket(email, password) {
  const loginUrl = `${LOCKET_FIREBASE_AUTH_URL}:signInWithPassword?key=${LOCKET_FIREBASE_API_KEY}`;

  const defaultHeaders = {
    'User-Agent': LOCKET_DEVICE_UA,
    'Content-Type': 'application/json',
    'Accept': '*/*',
    'X-Ios-Bundle-Identifier': LOCKET_BUNDLE_ID,
    'X-Firebase-GMPID': LOCKET_GMP_ID,
  };

  const response = await fetch(loginUrl, {
    method: 'POST',
    headers: defaultHeaders,
    body: JSON.stringify({
      email: email.trim(),
      password: password,
      returnSecureToken: true,
      clientType: 'CLIENT_TYPE_IOS',
    }),
  });

  const data = await response.json();
  if (!response.ok || data.error) {
    const errMsg = data.error?.message || 'Đăng nhập Locket thất bại';
    throw new Error(`Lỗi xác thực Locket: ${errMsg}`);
  }

  // Lấy thêm thông tin hồ sơ người dùng (ảnh đại diện, tên hiển thị)
  let profile = {};
  try {
    const lookupUrl = `${LOCKET_FIREBASE_AUTH_URL}:lookup?key=${LOCKET_FIREBASE_API_KEY}`;
    const infoRes = await fetch(lookupUrl, {
      method: 'POST',
      headers: defaultHeaders,
      body: JSON.stringify({ idToken: data.idToken }),
    });
    const infoData = await infoRes.json();
    if (infoData.users && infoData.users.length > 0) {
      profile = infoData.users[0];
    }
  } catch (_) {
    // Bỏ qua nếu không lấy được thông tin phụ
  }

  // Lấy thêm hồ sơ chi tiết từ Locket fetchUserV2
  let locketUser = null;
  try {
    locketUser = await getUserProfile(data.idToken, data.localId);
  } catch (_) { }

  const displayName =
    locketUser?.display_name ||
    profile.displayName ||
    data.displayName ||
    email.split('@')[0];

  const photoUrl =
    locketUser?.profile_picture_url ||
    profile.photoUrl ||
    null;

  return {
    idToken: data.idToken,
    refreshToken: data.refreshToken,
    localId: data.localId,
    email: data.email,
    displayName,
    username: locketUser?.username || '',
    photoUrl,
    expiresIn: data.expiresIn,
  };
}

/**
 * Làm mới idToken bằng refreshToken khi hết hạn (15-60 phút)
 */
async function refreshLocketToken(refreshToken) {
  const url = `${LOCKET_FIREBASE_TOKEN_URL}?key=${LOCKET_FIREBASE_API_KEY}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': LOCKET_DEVICE_UA,
      'X-Ios-Bundle-Identifier': LOCKET_BUNDLE_ID,
      'X-Firebase-GMPID': LOCKET_GMP_ID,
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }).toString(),
  });

  const data = await response.json();
  if (!response.ok || data.error) {
    throw new Error(data.error?.message || 'Không thể làm mới token Locket');
  }

  return {
    idToken: data.id_token,
    refreshToken: data.refresh_token,
    localId: data.user_id,
  };
}

/**
 * Lấy thông tin hồ sơ người dùng theo UID (có cache RAM 15 phút)
 */
async function getUserProfile(idToken, userUid) {
  if (!userUid) {
    return {
      uid: '',
      first_name: 'Người dùng',
      last_name: '',
      display_name: 'Người dùng Locket',
      username: '',
      profile_picture_url: null,
    };
  }

  const cached = userProfileCache.get(userUid);
  if (cached && Date.now() - cached.ts < 15 * 60 * 1000) {
    return cached.profile;
  }

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
    const fallback = {
      uid: userUid,
      first_name: 'Bạn bè',
      last_name: '',
      display_name: `Locket (${userUid.slice(0, 6)})`,
      username: userUid.slice(0, 8),
      profile_picture_url: null,
    };
    return fallback;
  }
}

/**
 * Lấy danh sách tất cả bạn bè trên Locket kèm ảnh đại diện & tên hiển thị
 */
async function getAllFriends(idToken, localId) {
  const verifiedUid = getVerifiedUid(idToken, localId);
  const url = `${FIRESTORE_DEFAULT_BASE}/users/${verifiedUid}/friends?pageSize=200`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${idToken}`,
      'User-Agent': LOCKET_DEVICE_UA,
      'x-ios-bundle-identifier': LOCKET_BUNDLE_ID,
      'Accept': 'application/json',
    },
  });

  if (response.status === 401 || response.status === 403) {
    throw new Error('TOKEN_EXPIRED: Phiên đăng nhập hết hạn khi tải danh sách bạn bè.');
  }

  const data = await response.json();
  const docs = data.documents || [];

  const friendItems = docs.map((doc) => {
    const uid = doc.name.split('/').pop();
    const dateAdded = doc.fields?.date?.timestampValue || doc.createTime || '';
    return { uid, dateAdded };
  });

  const profiles = await Promise.all(
    friendItems.map(async (item) => {
      const p = await getUserProfile(idToken, item.uid);
      return {
        ...p,
        date_added: item.dateAdded,
      };
    })
  );

  return profiles;
}

/**
 * Bước 2: Tải ảnh WebP lên Firebase Storage của Locket (bucket: locket-img)
 */
async function uploadImageToLocketStorage(imageBuffer, localId, idToken) {
  const verifiedUid = getVerifiedUid(idToken, localId);

  const filename = `${randomId(20)}.webp`;
  const contentType = 'image/webp';
  const objectPath = `users/${verifiedUid}/moments/thumbnails/${filename}`;
  const encodedName = encodeURIComponent(objectPath);
  const initUrl = `${STORAGE_IMG_URL}/${encodedName}?uploadType=resumable&name=${encodedName}`;

  const metadata = {
    bucket: '',
    contentType: contentType,
    name: objectPath,
    metadata: {
      visibility: 'private',
      creator: verifiedUid,
    },
    cacheControl: 'public, max-age=604800',
  };

  console.log(`[Locket Upload] UID=${verifiedUid}, File=${filename}, Size=${imageBuffer.length} bytes`);

  const authPrefixes = ['Firebase', 'Bearer'];
  let initRes = null;
  let lastErrText = '';

  for (const prefix of authPrefixes) {
    const initHeaders = {
      'Content-Type': 'application/json; charset=UTF-8',
      'Authorization': `${prefix} ${idToken}`,
      'x-goog-upload-protocol': 'resumable',
      'x-goog-upload-command': 'start',
      'x-goog-upload-content-type': contentType,
      'x-goog-upload-content-length': String(imageBuffer.length),
      'x-firebase-storage-version': 'ios/12.12.1',
      'x-firebase-gmpid': LOCKET_GMP_ID,
      'x-ios-bundle-identifier': LOCKET_BUNDLE_ID,
      'User-Agent': LOCKET_STORAGE_UA,
    };

    initRes = await fetch(initUrl, {
      method: 'POST',
      headers: initHeaders,
      body: JSON.stringify(metadata),
    });

    if (initRes.ok) {
      break;
    }
    lastErrText = await initRes.text();
    console.warn(`[Locket Storage Init (${prefix}) HTTP ${initRes.status}]:`, lastErrText);
  }

  if (!initRes || !initRes.ok) {
    throw new Error(
      `Không thể khởi tạo phiên tải ảnh lên Firebase Storage (${initRes ? initRes.status : 'ERR'}): ${lastErrText}`
    );
  }

  const uploadUrl = initRes.headers.get('x-goog-upload-url') || initRes.headers.get('X-Goog-Upload-URL');
  if (!uploadUrl) {
    throw new Error('Không nhận được X-Goog-Upload-URL từ Firebase Storage.');
  }

  const uploadHeaders = {
    'Content-Type': 'application/octet-stream',
    'x-goog-upload-protocol': 'resumable',
    'x-goog-upload-command': 'upload, finalize',
    'x-goog-upload-offset': '0',
    'x-goog-upload-content-length': String(imageBuffer.length),
    'User-Agent': LOCKET_STORAGE_UA,
  };

  const putRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: uploadHeaders,
    body: imageBuffer,
  });

  if (!putRes.ok) {
    const errText = await putRes.text();
    throw new Error(`Tải dữ liệu ảnh lên Firebase Storage thất bại (${putRes.status}): ${errText}`);
  }

  let downloadToken = null;
  try {
    const putData = await putRes.json();
    if (putData && putData.downloadTokens) {
      downloadToken = putData.downloadTokens.split(',')[0];
    }
  } catch (_) { }

  if (!downloadToken) {
    const metaUrl = `${STORAGE_IMG_URL}/${encodedName}`;
    const metaRes = await fetch(metaUrl, {
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
      const metaData = await metaRes.json();
      if (metaData && metaData.downloadTokens) {
        downloadToken = metaData.downloadTokens.split(',')[0];
      }
    }
  }

  if (!downloadToken) {
    downloadToken = crypto.randomUUID();
  }

  const thumbnailUrl = `${STORAGE_IMG_URL}/${encodedName}?alt=media&token=${downloadToken}`;
  const md5 = `${crypto.randomUUID().replace(/-/g, '')}_${Math.floor(Date.now() / 1000)}`;

  return {
    thumbnailUrl,
    md5,
    imageName: filename,
    storageType: 'firebase_resumable',
  };
}

/**
 * Bước 2b: Tải video lên Firebase Storage của Locket (thử bucket locket-video trước, fallback locket-img)
 */
async function uploadVideoToLocketStorage(videoBuffer, localId, idToken, mimeType = 'video/mp4') {
  const verifiedUid = getVerifiedUid(idToken, localId);
  const cleanMime = String(mimeType || 'video/mp4').split(';')[0].trim() || 'video/mp4';
  const ext = cleanMime.includes('webm') ? 'webm' : 'mp4';
  const filename = `${randomId(20)}.${ext}`;
  const objectPath = `users/${verifiedUid}/moments/videos/${filename}`;
  const encodedName = encodeURIComponent(objectPath);

  const buckets = [
    'https://firebasestorage.googleapis.com/v0/b/locket-video/o',
    STORAGE_IMG_URL,
  ];

  let initRes = null;
  let activeBaseUrl = buckets[0];
  let lastErrText = '';

  for (const baseUrl of buckets) {
    const initUrl = `${baseUrl}/${encodedName}?uploadType=resumable&name=${encodedName}`;
    const metadata = {
      bucket: '',
      contentType: cleanMime,
      name: objectPath,
      metadata: {
        visibility: 'private',
        creator: verifiedUid,
      },
      cacheControl: 'public, max-age=604800',
    };

    for (const prefix of ['Firebase', 'Bearer']) {
      initRes = await fetch(initUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=UTF-8',
          'Authorization': `${prefix} ${idToken}`,
          'x-goog-upload-protocol': 'resumable',
          'x-goog-upload-command': 'start',
          'x-goog-upload-content-type': cleanMime,
          'x-goog-upload-content-length': String(videoBuffer.length),
          'x-firebase-storage-version': 'ios/12.12.1',
          'x-firebase-gmpid': LOCKET_GMP_ID,
          'x-ios-bundle-identifier': LOCKET_BUNDLE_ID,
          'User-Agent': LOCKET_STORAGE_UA,
        },
        body: JSON.stringify(metadata),
      });

      if (initRes.ok) {
        activeBaseUrl = baseUrl;
        break;
      }
      lastErrText = await initRes.text();
    }
    if (initRes && initRes.ok) break;
  }

  if (!initRes || !initRes.ok) {
    throw new Error(`Không thể khởi tạo phiên tải video lên Locket Storage (${initRes ? initRes.status : 'ERR'}): ${lastErrText}`);
  }

  const uploadUrl = initRes.headers.get('x-goog-upload-url') || initRes.headers.get('X-Goog-Upload-URL');
  if (!uploadUrl) {
    throw new Error('Không nhận được X-Goog-Upload-URL khi tải video.');
  }

  const putRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/octet-stream',
      'x-goog-upload-protocol': 'resumable',
      'x-goog-upload-command': 'upload, finalize',
      'x-goog-upload-offset': '0',
      'x-goog-upload-content-length': String(videoBuffer.length),
      'User-Agent': LOCKET_STORAGE_UA,
    },
    body: videoBuffer,
  });

  if (!putRes.ok) {
    const errText = await putRes.text();
    throw new Error(`Tải dữ liệu video lên Locket Storage thất bại (${putRes.status}): ${errText}`);
  }

  let downloadToken = null;
  try {
    const putData = await putRes.json();
    if (putData && putData.downloadTokens) {
      downloadToken = putData.downloadTokens.split(',')[0];
    }
  } catch (_) {}

  if (!downloadToken) {
    downloadToken = crypto.randomUUID();
  }

  const videoUrl = `${activeBaseUrl}/${encodedName}?alt=media&token=${downloadToken}`;
  const videoMd5 = `${crypto.randomUUID().replace(/-/g, '')}_${Math.floor(Date.now() / 1000)}`;

  return {
    videoUrl,
    videoMd5,
    videoName: filename,
  };
}

/**
 * Bước 3: Gọi API postMomentV2 để bắn ảnh/video + caption + badge icon lên màn hình chính Locket
 */
async function postMomentToLocket({
  idToken,
  localId,
  thumbnailUrl,
  md5,
  videoUrl = '',
  videoMd5 = '',
  caption = '',
  textColor = '#FFFFFFE6',
  bgColors = [],
  icon = '',
  recipients = [],
  sentToSelfOnly = false,
}) {
  const verifiedUid = getVerifiedUid(idToken, localId);
  const trimmedCaption = (caption || '').trim();
  const trimmedIcon = (icon || '').trim();
  const finalColors = Array.isArray(bgColors) ? bgColors.filter(Boolean) : [];
  const isPrivate = Boolean(sentToSelfOnly);
  const finalRecipients = isPrivate
    ? []
    : (Array.isArray(recipients) ? recipients.filter(Boolean) : []);

  const overlays = [];
  if (trimmedCaption || trimmedIcon || finalColors.length > 0) {
    const overlayData = {
      text: trimmedCaption,
      type: 'standard',
      text_color: textColor || '#FFFFFFE6',
      max_lines: {
        value: '4',
        '@type': 'type.googleapis.com/google.protobuf.Int64Value',
      },
      background: {
        material_blur: finalColors.length > 0 ? 'regular' : 'ultra_thin',
        colors: finalColors,
      },
    };

    if (trimmedIcon) {
      overlayData.icon = {
        data: trimmedIcon,
        type: 'emoji',
      };
    }

    const altText = trimmedIcon ? `${trimmedIcon} ${trimmedCaption}`.trim() : trimmedCaption;

    overlays.push({
      overlay_type: 'caption',
      overlay_id: 'caption:standard',
      alt_text: altText,
      data: overlayData,
    });
  }

  const dataPayload = {
    thumbnail_url: thumbnailUrl,
    overlays: overlays,
    sent_to_self_only: isPrivate,
    sent_to_all: !isPrivate && finalRecipients.length === 0,
    recipients: finalRecipients,
    md5: md5 || `${crypto.randomUUID().replace(/-/g, '')}_${Math.floor(Date.now() / 1000)}`,
    analytics: buildAnalytics(),
  };

  if (videoUrl) {
    dataPayload.video_url = videoUrl;
    dataPayload.video_md5 = videoMd5 || dataPayload.md5;
  }

  if (trimmedCaption && overlays.length === 0) {
    dataPayload.caption = trimmedCaption;
  }

  const response = await fetch('https://api.locketcamera.com/postMomentV2', {
    method: 'POST',
    headers: {
      'User-Agent': LOCKET_DEVICE_UA,
      'Content-Type': 'application/json; charset=utf-8',
      'Accept': '*/*',
      'x-ios-bundle-identifier': LOCKET_BUNDLE_ID,
      'Authorization': `Bearer ${idToken}`,
    },
    body: JSON.stringify({ data: dataPayload }),
  });

  const rawText = await response.text();
  console.log(`[postMomentV2 HTTP ${response.status}]:`, rawText.slice(0, 500));

  let data = {};
  try {
    data = JSON.parse(rawText);
  } catch (_) {
    throw new Error(`Phản hồi không hợp lệ từ Locket (${response.status}): ${rawText.slice(0, 200)}`);
  }

  if (!response.ok || data.error || data.errors) {
    const errMsg = data.error?.message || JSON.stringify(data.error || data.errors || data);
    throw new Error(`Đăng lên Locket thất bại (${response.status}): ${errMsg}`);
  }

  const resObj = data.result || data;
  if (
    resObj &&
    ((resObj.status !== undefined && resObj.status !== 200 && resObj.status !== 'success' && resObj.status !== null) ||
      resObj.errors)
  ) {
    throw new Error(`Máy chủ Locket từ chối bài đăng (status ${resObj.status}): ${JSON.stringify(resObj)}`);
  }

  // Lưu khoảnh khắc vừa đăng vào bộ nhớ đệm để hiện ngay lập tức ở tab "Bài đăng của tôi / Ai đã xem"
  const momentData = resObj?.data || {};
  const canonicalUid = momentData.canonical_uid || momentData.moment_uid || randomId(20);
  if (verifiedUid) {
    const existingList = recentOwnPostsCache.get(verifiedUid) || [];
    const displayCaption = trimmedIcon ? `${trimmedIcon} ${trimmedCaption}`.trim() : trimmedCaption;
    existingList.unshift({
      moment_uid: canonicalUid,
      user_uid: verifiedUid,
      thumbnail_url: thumbnailUrl,
      video_url: videoUrl || '',
      caption: displayCaption,
      overlays: overlays,
      date: new Date().toISOString(),
      is_mine: true,
    });
    recentOwnPostsCache.set(verifiedUid, existingList.slice(0, 50));
    savePostedMomentsToDisk();
  }

  return data;
}

/**
 * Lấy bảng tin khoảnh khắc (Feed: ảnh bạn bè đăng & ảnh của chính mình)
 * Kết hợp Firestore Structured Query (history/<uid>/entries) và getLatestMomentV2
 */
async function getMomentsFeed(idToken, localId, { filteredByUserId = null, limit = 50 } = {}) {
  const verifiedUid = getVerifiedUid(idToken, localId);
  const momentsMap = new Map();

  // 1. Đưa các bài vừa đăng trong phiên hiện tại vào trước (nếu xem tất cả hoặc xem bài của tôi)
  if (!filteredByUserId || filteredByUserId === verifiedUid) {
    const localRecent = recentOwnPostsCache.get(verifiedUid) || [];
    for (const m of localRecent) {
      momentsMap.set(m.moment_uid, m);
    }
  }

  // 2. Truy vấn Firestore history/<uid>:runQuery (thử cả database 'locket' và '(default)')
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

  const dbBases = [FIRESTORE_LOCKET_BASE, FIRESTORE_DEFAULT_BASE];
  for (const base of dbBases) {
    try {
      const queryUrl = `${base}/history/${verifiedUid}:runQuery`;
      const qRes = await fetch(queryUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${idToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'x-ios-bundle-identifier': LOCKET_BUNDLE_ID,
          'User-Agent': LOCKET_DEVICE_UA,
        },
        body: JSON.stringify({ structuredQuery }),
      });

      if (qRes.ok) {
        const rows = await qRes.json();
        if (Array.isArray(rows)) {
          for (const row of rows) {
            if (!row.document) continue;
            const doc = row.document;
            const fields = doc.fields || {};
            const get = (k) => parseFirestoreValue(fields[k]);

            const momentUid =
              get('canonical_uid') ||
              get('moment_uid') ||
              doc.name.split('/').pop();

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
    } catch (err) {
      console.warn('[Firestore Feed Query Warn]:', err.message);
    }
  }

  // 3. Gọi bổ sung getLatestMomentV2 để lấy các khoảnh khắc mới nhất trên Widget
  try {
    const latestRes = await postLocketApi(
      'getLatestMomentV2',
      {
        should_count_missed_moments: true,
        include_group_moments: true,
        excluded_users: [],
      },
      idToken
    );

    const rawMoments = latestRes?.result?.data?.moments || latestRes?.result?.data || [];
    const list = Array.isArray(rawMoments) ? rawMoments : [rawMoments];
    for (const item of list) {
      if (!item || typeof item !== 'object') continue;
      const mUid = item.canonical_uid || item.moment_uid || item.id;
      const uUid = item.user || item.user_uid || verifiedUid;
      if (!mUid) continue;
      if (filteredByUserId && uUid !== filteredByUserId) continue;

      const overlays = item.overlays || [];
      let caption = item.caption || '';
      if (!caption && Array.isArray(overlays) && overlays.length > 0) {
        caption = overlays[0]?.alt_text || overlays[0]?.data?.text || '';
      }

      let dateStr = item.date;
      if (dateStr && typeof dateStr === 'object' && dateStr._seconds) {
        dateStr = new Date(dateStr._seconds * 1000).toISOString();
      } else if (typeof dateStr === 'number') {
        dateStr = new Date(dateStr * 1000).toISOString();
      }

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
  } catch (err) {
    console.warn('[getLatestMomentV2 Warn]:', err.message);
  }

  const allMoments = Array.from(momentsMap.values()).sort(
    (a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime()
  );

  // 4. Lấy hồ sơ (Avatar, Tên) của tất cả người đăng có trong danh sách
  const uniqueUids = [...new Set(allMoments.map((m) => m.user_uid).filter(Boolean))];
  const profileEntries = await Promise.all(
    uniqueUids.map(async (uid) => [uid, await getUserProfile(idToken, uid)])
  );
  const profileLookup = Object.fromEntries(profileEntries);

  const enrichedMoments = allMoments.map((m) => ({
    ...m,
    author: profileLookup[m.user_uid] || {
      uid: m.user_uid,
      display_name: m.is_mine ? 'Tôi' : `Locket (${(m.user_uid || '').slice(0, 6)})`,
      username: '',
      profile_picture_url: null,
    },
  }));

  return {
    myUid: verifiedUid,
    moments: enrichedMoments,
  };
}

/**
 * Xem ai đã xem (Views) & Ai đã thả cảm xúc (Reactions) vào một khoảnh khắc
 */
async function getMomentViewsAndReactions(idToken, localId, momentUid) {
  if (!momentUid) {
    throw new Error('Thiếu mã khoảnh khắc (momentUid).');
  }

  const viewerMap = new Map(); // Map<uid, { uid, viewed_at, reaction }>
  const reactionsList = [];
  let apiCount = 0;
  let rawViewsData = null;

  // 1. Gọi API getMomentViews của Locket
  try {
    const viewsRes = await postLocketApi('getMomentViews', { moment_uid: momentUid }, idToken);
    rawViewsData = viewsRes?.result?.data || viewsRes?.data || viewsRes;

    if (rawViewsData && typeof rawViewsData === 'object') {
      if (typeof rawViewsData.count === 'number') {
        apiCount = rawViewsData.count;
      }
      const candidates =
        rawViewsData.moment_views ||
        rawViewsData.views ||
        rawViewsData.viewers ||
        rawViewsData.users ||
        (Array.isArray(rawViewsData) ? rawViewsData : []);

      if (Array.isArray(candidates)) {
        for (const item of candidates) {
          if (typeof item === 'string') {
            viewerMap.set(item, { uid: item, viewed_at: '', reaction: null });
          } else if (item && typeof item === 'object') {
            const uid = item.user || item.user_uid || item.uid || item.id;
            let viewedAt = item.date || item.viewed_at || item.created_at || '';
            if (viewedAt && typeof viewedAt === 'object' && viewedAt._seconds) {
              viewedAt = new Date(viewedAt._seconds * 1000).toISOString();
            }
            if (uid) {
              viewerMap.set(uid, { uid, viewed_at: viewedAt, reaction: item.reaction || null });
            }
          }
        }
      }
    }
  } catch (err) {
    console.warn('[getMomentViews API Warn]:', err.message);
  }

  // 2. Truy vấn Firestore subcollection moments/{momentUid}/reactions và moments/{momentUid}/views
  const dbBases = [FIRESTORE_DEFAULT_BASE, FIRESTORE_LOCKET_BASE];

  for (const base of dbBases) {
    // 2a. Lấy danh sách Reactions
    try {
      const reactUrl = `${base}/moments/${momentUid}/reactions?pageSize=100`;
      const rRes = await fetch(reactUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${idToken}`,
          'User-Agent': LOCKET_DEVICE_UA,
          'x-ios-bundle-identifier': LOCKET_BUNDLE_ID,
          'Accept': 'application/json',
        },
      });
      if (rRes.ok) {
        const rData = await rRes.json();
        const docs = rData.documents || [];
        for (const doc of docs) {
          const f = doc.fields || {};
          const senderUid = f.user?.stringValue || f.sender?.stringValue || doc.name.split('/').pop();
          const emoji = f.string?.stringValue || f.emoji?.stringValue || f.reaction?.stringValue || '❤️';
          const createdAt = f.created_at?.timestampValue || f.date?.timestampValue || doc.createTime || '';

          if (senderUid && !reactionsList.some((r) => r.uid === senderUid && r.emoji === emoji)) {
            reactionsList.push({
              uid: senderUid,
              emoji,
              created_at: createdAt,
            });
            const existingViewer = viewerMap.get(senderUid);
            viewerMap.set(senderUid, {
              uid: senderUid,
              viewed_at: existingViewer?.viewed_at || createdAt,
              reaction: emoji,
            });
          }
        }
      }
    } catch (_) { }

    // 2b. Lấy danh sách Views từ Firestore subcollection
    try {
      const viewsColUrl = `${base}/moments/${momentUid}/views?pageSize=100`;
      const vRes = await fetch(viewsColUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${idToken}`,
          'User-Agent': LOCKET_DEVICE_UA,
          'x-ios-bundle-identifier': LOCKET_BUNDLE_ID,
          'Accept': 'application/json',
        },
      });
      if (vRes.ok) {
        const vData = await vRes.json();
        const docs = vData.documents || [];
        for (const doc of docs) {
          const f = doc.fields || {};
          const viewerUid = f.user?.stringValue || f.uid?.stringValue || doc.name.split('/').pop();
          const viewedAt = f.date?.timestampValue || f.created_at?.timestampValue || doc.createTime || '';
          if (viewerUid && !viewerMap.has(viewerUid)) {
            viewerMap.set(viewerUid, {
              uid: viewerUid,
              viewed_at: viewedAt,
              reaction: null,
            });
          }
        }
      }
    } catch (_) { }
  }

  // 3. Tra cứu thông tin hồ sơ (Avatar, Tên) cho tất cả người đã xem & thả tim
  const allUids = [...new Set([...viewerMap.keys(), ...reactionsList.map((r) => r.uid)].filter(Boolean))];
  const profilePairs = await Promise.all(
    allUids.map(async (uid) => [uid, await getUserProfile(idToken, uid)])
  );
  const profilesByUid = Object.fromEntries(profilePairs);

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

/**
 * Thả cảm xúc (Emoji Reaction) vào khoảnh khắc của bạn bè
 */
async function reactToMoment(idToken, momentUid, emoji = '💛') {
  return postLocketApi(
    'reactToMoment',
    {
      moment_uid: momentUid,
      reaction: emoji,
      from_memory: false,
      intensity: {
        '@type': 'type.googleapis.com/google.protobuf.Int64Value',
        value: '0',
      },
    },
    idToken
  );
}

/**
 * Xóa khoảnh khắc của chính mình
 */
async function deleteMoment(idToken, localId, momentUid) {
  const verifiedUid = getVerifiedUid(idToken, localId);
  const res = await postLocketApi(
    'deleteMomentV2',
    {
      moment_uid: momentUid,
      canonical_uid: momentUid,
    },
    idToken
  );

  if (verifiedUid && recentOwnPostsCache.has(verifiedUid)) {
    const filtered = (recentOwnPostsCache.get(verifiedUid) || []).filter(
      (m) => m.moment_uid !== momentUid
    );
    recentOwnPostsCache.set(verifiedUid, filtered);
    savePostedMomentsToDisk();
  }
  return res;
}

/**
 * Lấy danh sách các cuộc hội thoại (Tin nhắn Locket)
 */
async function getConversations(idToken, localId) {
  const verifiedUid = getVerifiedUid(idToken, localId);
  const url = `${FIRESTORE_DEFAULT_BASE}/users/${verifiedUid}/conversations?pageSize=50`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${idToken}`,
      'User-Agent': LOCKET_DEVICE_UA,
      'x-ios-bundle-identifier': LOCKET_BUNDLE_ID,
      'Accept': 'application/json',
    },
  });

  if (response.status === 401 || response.status === 403) {
    throw new Error('TOKEN_EXPIRED: Phiên đăng nhập hết hạn khi tải hộp thư Locket.');
  }

  const data = await response.json();
  const docs = data.documents || [];

  const convList = docs.map((doc) => {
    const fields = doc.fields || {};
    const convId = doc.name.split('/').pop();
    const members = (fields.members?.arrayValue?.values || [])
      .map((v) => v.stringValue)
      .filter(Boolean);
    const peerUid = members.find((m) => m !== verifiedUid) || members[0] || null;

    const latestMsgField = fields.latest_message?.mapValue?.fields || {};
    const latestMessage = {
      text: latestMsgField.body?.stringValue || '',
      sender_uid: latestMsgField.sender?.stringValue || '',
      thumbnail_url: latestMsgField.thumbnail_url?.stringValue || '',
      timestamp:
        latestMsgField.created_at?.timestampValue ||
        doc.updateTime ||
        doc.createTime ||
        '',
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

  // Sắp xếp cuộc trò chuyện mới nhất lên đầu
  convList.sort(
    (a, b) => new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime()
  );

  // Bổ sung thông tin hồ sơ người chat cùng
  const uniquePeerUids = [...new Set(convList.map((c) => c.peer_uid).filter(Boolean))];
  const peerEntries = await Promise.all(
    uniquePeerUids.map(async (uid) => [uid, await getUserProfile(idToken, uid)])
  );
  const peerMap = Object.fromEntries(peerEntries);

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

/**
 * Lấy lịch sử tin nhắn chi tiết trong một cuộc hội thoại
 */
async function getMessages(idToken, localId, conversationId) {
  if (!conversationId) {
    throw new Error('Thiếu mã cuộc trò chuyện (conversationId).');
  }
  const verifiedUid = getVerifiedUid(idToken, localId);
  const url = `${FIRESTORE_DEFAULT_BASE}/conversations/${conversationId}/messages?pageSize=100`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${idToken}`,
      'User-Agent': LOCKET_DEVICE_UA,
      'x-ios-bundle-identifier': LOCKET_BUNDLE_ID,
      'Accept': 'application/json',
    },
  });

  if (response.status === 401 || response.status === 403) {
    throw new Error('TOKEN_EXPIRED: Phiên đăng nhập hết hạn khi tải tin nhắn.');
  }

  const data = await response.json();
  const docs = data.documents || [];

  const messages = docs.map((doc) => {
    const fields = doc.fields || {};
    const msgId = doc.name.split('/').pop();
    const senderUid = fields.sender?.stringValue || '';

    const reactionsRaw = fields.reactions?.arrayValue?.values || [];
    const reactions = reactionsRaw
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
      message_id: msgId,
      sender_uid: senderUid,
      is_me: senderUid === verifiedUid,
      text: fields.body?.stringValue || '',
      thumbnail_url: fields.thumbnail_url?.stringValue || '',
      reply_moment: fields.reply_moment?.stringValue || null,
      timestamp: fields.created_at?.timestampValue || doc.createTime || '',
      reactions,
    };
  });

  // Sắp xếp theo thứ tự thời gian từ cũ đến mới để hiển thị khung chat
  messages.sort(
    (a, b) => new Date(a.timestamp || 0).getTime() - new Date(b.timestamp || 0).getTime()
  );

  return {
    myUid: verifiedUid,
    conversation_id: conversationId,
    messages,
  };
}

/**
 * Gửi tin nhắn văn bản hoặc trả lời trực tiếp vào một khoảnh khắc trên Locket
 */
async function sendChatMessage(idToken, { receiverUid, text = '', momentUid = null }) {
  if (!receiverUid) {
    throw new Error('Thiếu UID người nhận tin nhắn (receiverUid).');
  }
  const clientToken = crypto.randomUUID().toUpperCase();
  const msgText =
    text !== null && text !== undefined && String(text).trim() !== ''
      ? String(text).trim()
      : momentUid
        ? '\u200b'
        : '';

  if (!msgText) {
    throw new Error('Vui lòng nhập nội dung tin nhắn.');
  }

  return postLocketApi(
    'sendChatMessageV2',
    {
      receiver_uid: receiverUid,
      msg: msgText,
      moment_uid: momentUid || null,
      from_memory: false,
      intensity: {
        value: '0',
        '@type': 'type.googleapis.com/google.protobuf.Int64Value',
      },
      client_token: clientToken,
    },
    idToken
  );
}

/**
 * Thả biểu tượng cảm xúc (Reaction) vào một tin nhắn trong cuộc trò chuyện
 */
async function reactToChatMessage(idToken, { conversationId, messageId, emoji = '❤️' }) {
  if (!conversationId || !messageId) {
    throw new Error('Thiếu conversationId hoặc messageId để thả cảm xúc tin nhắn.');
  }
  return postLocketApi(
    'sendChatMessageReaction',
    {
      conversation_id: conversationId,
      message_id: messageId,
      emoji: emoji || '❤️',
    },
    idToken
  );
}

module.exports = {
  loginLocket,
  refreshLocketToken,
  getUserProfile,
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
};
