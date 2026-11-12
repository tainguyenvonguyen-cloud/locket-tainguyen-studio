# 💛 Locket AI Studio (Flux + Gemini -> Locket Widget)

Ứng dụng Web tạo ảnh bằng AI theo tỷ lệ vuông **1:1 chuẩn Locket Widget**, tự động viết Caption tiếng Việt và **bắn thẳng lên màn hình chính của bạn bè** thông qua API `postMomentV2`.

## 🚀 Tính năng chính
1. **Tạo ảnh AI miễn phí (Pollinations Flux)**: Hỗ trợ 6 phong cách (Chụp cam thường iPhone, 3D Pixar, Anime Ghibli, Film Vintage, Cyberpunk, Tự do).
2. **Tự động viết Caption tiếng Việt**: Dùng miễn phí qua Pollinations Text hoặc gắn thêm **Google Gemini API Key** (`gemini-2.5-flash`) để dịch ý tưởng & tạo caption theo 4 tông giọng (Gen Z, Thả thính, Chill, Lầy lội).
3. **Tuỳ chỉnh màu thanh Caption (Locket Gold Overlays)**: Xem trước trực tiếp trên khung mô phỏng Locket Widget 1:1 và chọn màu nền Gradient cho thanh chữ.
4. **Bắn thẳng lên Locket (`postMomentV2`)**: Tự động tải ảnh lên Firebase Storage (`locket-img` bucket) bằng giao thức Resumable Upload 3 bước và gọi API `postMomentV2`.

## 🛠️ Cách chạy ứng dụng
- **Cách 1 (Nhanh nhất trên Windows)**: Nháy đúp vào file `start.bat`.
- **Cách 2 (Dùng Terminal)**:
  ```bash
  node server.js
  ```
  Sau đó mở trình duyệt truy cập: `http://localhost:3456`

