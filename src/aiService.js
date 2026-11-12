/**
 * Dịch vụ AI:
 * 1. Tạo ảnh mới theo mô tả (Pollinations Flux + Gemini / Pollinations Text)
 * 2. Chỉnh sửa ảnh bằng AI theo lời nhắn (Gemini Vision / Multimodal OpenAI + Flux)
 */

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

/**
 * Dịch và tối ưu hóa mô tả tiếng Việt sang tiếng Anh để tạo ảnh AI mới
 */
async function enhancePromptForGeneration({ prompt, style = 'realistic_selfie', geminiApiKey = '' }) {
  const styleDesc = STYLE_PROMPTS[style] || STYLE_PROMPTS.realistic_selfie;

  const systemInstruction = `Bạn là trợ lý tạo ảnh AI cho ứng dụng Locket Widget.
Nhiệm vụ: Từ mô tả tiếng Việt của người dùng, hãy trả về đúng định dạng JSON (không dùng markdown block) gồm 1 trường:
"englishPrompt": Câu lệnh tiếng Anh chi tiết (dưới 60 từ) mô tả hình ảnh trực quan để đưa vào mô hình Flux tạo ảnh, kết hợp phong cách: "${styleDesc}".`;

  // 1. Ưu tiên dùng Google Gemini API nếu có key
  if (geminiApiKey && geminiApiKey.trim()) {
    try {
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(geminiApiKey.trim())}`;
      const res = await fetch(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: `${systemInstruction}\n\nÝ tưởng của người dùng: "${prompt}"` }],
            },
          ],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.75,
          },
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const parsed = JSON.parse(rawText);
        if (parsed.englishPrompt) {
          return {
            englishPrompt: parsed.englishPrompt,
            provider: 'Google Gemini 2.5 Flash',
          };
        }
      }
    } catch (_) {}
  }

  // 2. Sử dụng Pollinations Text API miễn phí
  try {
    const res = await fetch('https://text.pollinations.ai/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: systemInstruction },
          { role: 'user', content: `Ý tưởng: "${prompt}"` },
        ],
        model: 'openai',
        jsonMode: true,
      }),
    });

    if (res.ok) {
      const text = await res.text();
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.englishPrompt) {
          return {
            englishPrompt: parsed.englishPrompt,
            provider: 'Pollinations AI (Free)',
          };
        }
      }
    }
  } catch (_) {}

  return {
    englishPrompt: `${prompt}, ${styleDesc}`,
    provider: 'Local Fallback',
  };
}

/**
 * Tạo ảnh AI tỷ lệ 1:1 (1024x1024) chuẩn khung Locket Widget bằng Pollinations Flux
 */
async function generateAIImage({ prompt, style = 'realistic_selfie', seed, geminiApiKey = '' }) {
  const actualSeed = seed || Math.floor(Math.random() * 9999999);

  const enhanced = await enhancePromptForGeneration({
    prompt,
    style,
    geminiApiKey,
  });

  const encodedPrompt = encodeURIComponent(enhanced.englishPrompt);
  const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=1024&seed=${actualSeed}&model=flux&nologo=true`;

  const response = await fetch(imageUrl, {
    method: 'GET',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) LocketAIStudio/2.0',
    },
  });

  if (!response.ok) {
    throw new Error(`Không thể tạo ảnh từ máy chủ AI (${response.status}). Vui lòng thử lại sau giây lát.`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const base64Image = `data:image/jpeg;base64,${buffer.toString('base64')}`;

  return {
    base64Image,
    englishPrompt: enhanced.englishPrompt,
    seed: actualSeed,
    provider: enhanced.provider,
  };
}

/**
 * Dịch lời nhắn chỉnh sửa tiếng Việt sang câu lệnh tiếng Anh ngắn gọn cho mô hình sửa ảnh
 */
async function translateEditInstruction(instruction, geminiApiKey = '') {
  const sys =
    'Translate the user\'s Vietnamese photo-editing request into one short, clear English instruction for an image editing model (e.g. "Add black sunglasses to the person"). Reply with the English instruction only.';
  try {
    if (geminiApiKey && geminiApiKey.trim()) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(geminiApiKey.trim())}`;
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: `${sys}\n\n${instruction}` }] }] }),
        signal: AbortSignal.timeout(15000),
      });
      if (r.ok) {
        const d = await r.json();
        const t = d.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (t) return t;
      }
    }
    // Dịch miễn phí bằng Google Translate (ổn định, không giới hạn lượt như Pollinations Text)
    try {
      const gt = await fetch(
        'https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=t&q=' +
          encodeURIComponent(instruction),
        { signal: AbortSignal.timeout(10000) }
      );
      if (gt.ok) {
        const gd = await gt.json();
        const t = (gd?.[0] || []).map((seg) => seg?.[0] || '').join('').trim();
        if (t) return t;
      }
    } catch (_) {}
    const r = await fetch('https://text.pollinations.ai/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'openai',
        messages: [
          { role: 'system', content: sys },
          { role: 'user', content: instruction },
        ],
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (r.ok) {
      const t = (await r.text()).trim();
      if (t && t.length < 400) return t;
    }
  } catch (_) {}
  return instruction;
}

/**
 * Đọc các chi tiết thực tế đang có trong bức ảnh gốc bằng Gemini Vision (khi có Gemini API Key).
 * Nếu có yêu cầu chỉnh sửa, trả về luôn kế hoạch sửa cục bộ (surgicalEnglishPrompt)
 * nhằm ép mô hình chỉ thêm/sửa đúng chi tiết được yêu cầu và giữ nguyên toàn bộ ảnh gốc.
 */
async function inspectPhotoDetails({
  base64Image,
  instruction = '',
  geminiApiKey = '',
}) {
  const rawBase64 = (base64Image || '').replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '');
  const mimeMatch = (base64Image || '').match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,/);
  const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';

  if (!rawBase64) {
    throw new Error('Chưa có ảnh gốc để AI đọc chi tiết.');
  }

  const key = (geminiApiKey || process.env.GEMINI_API_KEY || '').trim();
  if (!key) {
    return {
      detectedDetails: '',
      surgicalEnglishPrompt: '',
      provider: 'No Vision Key',
    };
  }

  const cleanInstruction = (instruction || '').trim();
  const promptText = cleanInstruction
    ? `Hãy quan sát thật kỹ bức ảnh gốc đính kèm và thực hiện 2 việc, trả về đúng JSON hợp lệ (không markdown):
1. "detectedDetails": Mô tả ngắn gọn bằng tiếng Việt (2-3 câu) các chi tiết thực tế đang có trong ảnh (chủ thể là ai/gì, biểu cảm, trang phục, đồ vật trên tay/xung quanh, bối cảnh, ánh sáng).
2. "surgicalEnglishPrompt": Viết 1 câu lệnh tiếng Anh ngắn gọn, cực kỳ chính xác cho mô hình Image-to-Image Photo Editor để CHỈ thực hiện yêu cầu sau: "${cleanInstruction}". Bắt buộc phải nêu rõ giữ nguyên 100% khuôn mặt, biểu cảm, kiểu tóc, trang phục, tư thế, vật thể xung quanh, phông nền và ánh sáng của ảnh gốc, KHÔNG tạo ra ảnh mới hay người mới.`
    : `Hãy quan sát thật kỹ bức ảnh gốc đính kèm và trả về đúng JSON hợp lệ (không markdown):
1. "detectedDetails": Mô tả chi tiết bằng tiếng Việt (2-4 câu) những gì thực sự có trong ảnh (chủ thể, khuôn mặt, dáng vẻ, quần áo, màu sắc, đồ vật, phông nền, ánh sáng) để người dùng biết AI đã đọc được gì trước khi ra lệnh sửa.
2. "surgicalEnglishPrompt": ""`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(key)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { inlineData: { mimeType, data: rawBase64 } },
            { text: promptText },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.25,
      },
    }),
    signal: AbortSignal.timeout(25000),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Gemini Vision lỗi (${res.status}): ${errText.slice(0, 160)}`);
  }

  const data = await res.json();
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const parsed = JSON.parse(rawText);
  return {
    detectedDetails: (parsed.detectedDetails || '').trim(),
    surgicalEnglishPrompt: (parsed.surgicalEnglishPrompt || '').trim(),
    provider: 'Gemini 2.5 Flash Vision',
  };
}

/**
 * Sửa TRỰC TIẾP bức ảnh người dùng đã chụp (image-to-image) bằng các Space AI trên Hugging Face
 * (FLUX.1 Kontext, Qwen-Image-Edit-2511-LoRAs-Fast, Qwen-Image-Edit).
 * Tuyệt đối chỉ chỉnh sửa trên pixel ảnh gốc, không tạo ảnh mới từ text.
 */
async function editImageViaGradioSpaces(
  imageBuffer,
  englishInstruction,
  mimeType = 'image/jpeg',
  hfToken = ''
) {
  const token = (hfToken || process.env.HF_TOKEN || '').trim();
  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};
  const base64DataUrl = `data:${mimeType};base64,${imageBuffer.toString('base64')}`;

  const spaces = [
    {
      name: 'FLUX.1 Kontext',
      base: 'https://black-forest-labs-flux-1-kontext-dev.hf.space',
      endpoint: '/infer',
      mode: 'upload',
      buildData: (file) => [file, englishInstruction, 0, true, 2.5, 28],
    },
    {
      name: 'Qwen-Image-Edit-2511',
      base: 'https://prithivmlmods-qwen-image-edit-2511-loras-fast.hf.space',
      endpoint: '/edit_image',
      mode: 'b64_json',
      buildData: () => [JSON.stringify([base64DataUrl]), englishInstruction, 'None', 0, true, 1.0, 4],
    },
    {
      name: 'Qwen-Image-Edit',
      base: 'https://qwen-qwen-image-edit.hf.space',
      endpoint: '/infer',
      mode: 'upload',
      buildData: (file) => [file, englishInstruction, 0, true, 4.0, 30, false],
    },
  ];

  const errors = [];
  for (const sp of spaces) {
    try {
      let payloadData;
      if (sp.mode === 'upload') {
        const form = new FormData();
        form.append('files', new Blob([imageBuffer], { type: mimeType }), 'input.jpg');
        const upRes = await fetch(`${sp.base}/gradio_api/upload`, {
          method: 'POST',
          headers: authHeaders,
          body: form,
          signal: AbortSignal.timeout(30000),
        });
        if (!upRes.ok) throw new Error(`upload ${upRes.status}`);
        const uploaded = (await upRes.json())[0];
        const fileData = {
          path: uploaded,
          url: `${sp.base}/gradio_api/file=${uploaded}`,
          orig_name: 'input.jpg',
          mime_type: mimeType,
          meta: { _type: 'gradio.FileData' },
        };
        payloadData = sp.buildData(fileData);
      } else {
        payloadData = sp.buildData();
      }

      const callRes = await fetch(`${sp.base}/gradio_api/call${sp.endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ data: payloadData }),
        signal: AbortSignal.timeout(30000),
      });
      if (!callRes.ok) throw new Error(`call ${callRes.status}`);
      const { event_id } = await callRes.json();

      const sseRes = await fetch(`${sp.base}/gradio_api/call${sp.endpoint}/${event_id}`, {
        headers: authHeaders,
        signal: AbortSignal.timeout(120000),
      });
      const sseText = await sseRes.text();
      const lines = sseText.split('\n');
      let resultData = null;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith('event: error')) {
          const rawErr = (lines[i + 1] || '').replace(/^data:\s*/, '').trim();
          let errMsg = rawErr || 'ZeroGPU error';
          try {
            const parsedErr = JSON.parse(rawErr);
            if (parsedErr && parsedErr.error) errMsg = parsedErr.error;
            else if (parsedErr === null) errMsg = 'ZeroGPU từ chối / hết lượt ẩn danh (cần HF Token)';
          } catch (_) {}
          throw new Error(String(errMsg).slice(0, 180));
        }
        if (lines[i].startsWith('event: complete')) {
          resultData = JSON.parse((lines[i + 1] || '').replace(/^data:\s*/, ''));
          break;
        }
      }
      if (!resultData) throw new Error('không có kết quả trả về');

      const out = Array.isArray(resultData) ? resultData[0] : resultData;
      if (typeof out === 'string' && out.startsWith('data:image/')) {
        const m = out.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/);
        if (m) {
          return { buffer: Buffer.from(m[2], 'base64'), mime: m[1], provider: sp.name };
        }
      }
      let outUrl = out?.url || (out?.path ? `${sp.base}/gradio_api/file=${out.path}` : null);
      if (!outUrl) throw new Error('không có ảnh đầu ra');
      if (outUrl.startsWith('/')) outUrl = sp.base + outUrl;

      const imgRes = await fetch(outUrl, { headers: authHeaders, signal: AbortSignal.timeout(60000) });
      if (!imgRes.ok) throw new Error(`tải ảnh ${imgRes.status}`);
      const buf = Buffer.from(await imgRes.arrayBuffer());
      const outMime = imgRes.headers.get('content-type') || 'image/png';
      return { buffer: buf, mime: outMime, provider: sp.name };
    } catch (e) {
      errors.push(`${sp.name}: ${e.message}`);
    }
  }
  throw new Error(errors.join(' | '));
}

/**
 * Chỉnh sửa ĐÚNG CÁC CHI TIẾT trong bức ảnh gốc theo lời nhắn của người dùng.
 * TUYỆT ĐỐI KHÔNG tự tạo ra ảnh mới từ văn bản (không fallback sang text-to-image).
 */
async function editAIImage({
  base64Image,
  instruction,
  geminiApiKey = '',
  hfToken = '',
  pollinationsApiKey = '',
}) {
  const cleanInstruction = (instruction || '').trim();
  if (!cleanInstruction) {
    throw new Error('Vui lòng nhập lời nhắn mô tả chi tiết bạn muốn thêm hoặc sửa trong ảnh.');
  }

  const rawBase64 = (base64Image || '').replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '');
  const mimeMatch = (base64Image || '').match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,/);
  const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';

  if (!rawBase64) {
    throw new Error('Bạn cần chụp hoặc chọn một bức ảnh gốc trước khi yêu cầu AI chỉnh sửa chi tiết!');
  }

  const gKey = (geminiApiKey || process.env.GEMINI_API_KEY || '').trim();
  const hToken = (hfToken || process.env.HF_TOKEN || '').trim();
  const pKey = (pollinationsApiKey || process.env.POLLINATIONS_API_KEY || '').trim();

  // Bước 1: Đọc các chi tiết thực tế trong ảnh gốc trước khi sửa (nếu có Gemini Vision Key)
  let detectedDetails = '';
  let surgicalEnglishPrompt = '';
  if (gKey) {
    try {
      const inspected = await inspectPhotoDetails({
        base64Image,
        instruction: cleanInstruction,
        geminiApiKey: gKey,
      });
      detectedDetails = inspected.detectedDetails || '';
      surgicalEnglishPrompt = inspected.surgicalEnglishPrompt || '';
    } catch (_) {}
  }

  const errors = [];

  // Bước 2: Dùng Gemini Native Image Editor (chỉnh pixel trực tiếp trên ảnh gốc)
  if (gKey) {
    const strictPrompt = [
      'You are an exact pixel-preserving photo retoucher. Do NOT generate a brand-new image or replace the scene.',
      detectedDetails ? `Observed details in the original photo: ${detectedDetails}` : '',
      `Apply ONLY this specific requested edit to the attached original photo: "${cleanInstruction}".`,
      'Preserve the exact same person(s), facial features, identity, pose, clothing, lighting, camera framing, and untouched background elements identically.',
    ]
      .filter(Boolean)
      .join('\n');

    for (const model of ['gemini-2.5-flash-image']) {
      try {
        const geminiEditUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(
          gKey
        )}`;
        const editRes = await fetch(geminiEditUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { inlineData: { mimeType, data: rawBase64 } },
                  { text: strictPrompt },
                ],
              },
            ],
            generationConfig: {
              responseModalities: ['TEXT', 'IMAGE'],
            },
          }),
          signal: AbortSignal.timeout(45000),
        });

        if (editRes.ok) {
          const editData = await editRes.json();
          const parts = editData.candidates?.[0]?.content?.parts || [];
          const imgPart = parts.find((p) => p.inlineData && p.inlineData.data);
          if (imgPart) {
            const outMime = imgPart.inlineData.mimeType || 'image/png';
            return {
              base64Image: `data:${outMime};base64,${imgPart.inlineData.data}`,
              detectedDetails,
              englishPrompt: surgicalEnglishPrompt || cleanInstruction,
              provider: `Google ${model} (chỉ sửa chi tiết ảnh gốc)`,
            };
          }
          const txtPart = parts.find((p) => p.text)?.text || 'Không trả về ảnh';
          errors.push(`${model}: ${txtPart.slice(0, 120)}`);
        } else if (editRes.status === 429) {
          errors.push('Gemini Key gói Free chỉ hỗ trợ 🔍 Đọc ảnh, chưa mở quota sửa ảnh (429)');
        } else {
          const errTxt = await editRes.text().catch(() => '');
          errors.push(`${model} (${editRes.status}): ${errTxt.slice(0, 120)}`);
        }
      } catch (e) {
        errors.push(`${model}: ${e.message}`);
      }
    }
  }

  // Chuẩn bị câu lệnh tiếng Anh chặt chẽ giữ nguyên toàn bộ bối cảnh & chi tiết ảnh gốc
  const translated = surgicalEnglishPrompt || (await translateEditInstruction(cleanInstruction, gKey));
  const strictEnglishEdit = surgicalEnglishPrompt
    ? surgicalEnglishPrompt
    : `Keep the exact same person, face, pose, clothes, objects, lighting and background completely unchanged, ONLY apply this edit: ${translated}`;

  // Bước 3: Pollinations /v1/images/edits (nếu có Pollinations API Key)
  if (pKey) {
    for (const pModel of ['black-forest-labs/flux.1-kontext-pro', 'black-forest-labs/flux.2-klein-4b']) {
      try {
        const form = new FormData();
        form.append('model', pModel);
        form.append('prompt', strictEnglishEdit);
        form.append('image', new Blob([Buffer.from(rawBase64, 'base64')], { type: mimeType }), 'photo.jpg');
        const r = await fetch('https://gen.pollinations.ai/v1/images/edits', {
          method: 'POST',
          headers: { Authorization: `Bearer ${pKey}` },
          body: form,
          signal: AbortSignal.timeout(45000),
        });
        if (r.ok) {
          const ct = r.headers.get('content-type') || '';
          if (ct.includes('image/')) {
            const buf = Buffer.from(await r.arrayBuffer());
            return {
              base64Image: `data:${ct.split(';')[0]};base64,${buf.toString('base64')}`,
              detectedDetails,
              englishPrompt: strictEnglishEdit,
              provider: `Pollinations ${pModel}`,
            };
          }
          const j = await r.json();
          const b64 = j?.data?.[0]?.b64_json;
          if (b64) {
            return {
              base64Image: `data:image/png;base64,${b64}`,
              detectedDetails,
              englishPrompt: strictEnglishEdit,
              provider: `Pollinations ${pModel}`,
            };
          }
        } else {
          errors.push(`${pModel}: HTTP ${r.status}`);
        }
      } catch (e) {
        errors.push(`${pModel}: ${e.message}`);
      }
    }
  }

  // Bước 4: Sửa trực tiếp trên ảnh gốc qua Hugging Face Image-to-Image (FLUX.1 Kontext / Qwen-Image-Edit)
  try {
    const edited = await editImageViaGradioSpaces(
      Buffer.from(rawBase64, 'base64'),
      strictEnglishEdit,
      mimeType,
      hToken
    );
    return {
      base64Image: `data:${edited.mime};base64,${edited.buffer.toString('base64')}`,
      detectedDetails,
      englishPrompt: strictEnglishEdit,
      provider: `${edited.provider} (chỉ sửa chi tiết ảnh gốc)`,
    };
  } catch (e) {
    errors.push(e.message);
  }

  // Bước 5: TUYỆT ĐỐI KHÔNG tự tạo ảnh mới! Báo rõ để người dùng giữ nguyên ảnh gốc hoặc thêm HF Token miễn phí.
  const needKeyHint = !hToken
    ? ' 👉 Hãy mở ⚙️ Cấu hình và dán Hugging Face Token (hf_... tạo miễn phí 1 phút tại huggingface.co/settings/tokens, không cần thẻ) để mở khóa FLUX Kontext & Qwen-Image-Edit sửa trực tiếp trên ảnh gốc!'
    : '';

  throw new Error(
    `Chưa thể sửa trực tiếp chi tiết trên ảnh gốc (${errors.join(' ; ')}). Ảnh gốc của bạn vẫn được giữ nguyên.${needKeyHint}`
  );
}

module.exports = {
  generateAIImage,
  editAIImage,
  inspectPhotoDetails,
};
