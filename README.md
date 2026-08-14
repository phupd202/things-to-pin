# 📌 Things to Pin

Bảng ghim chung của phòng — thay cho việc pin nhiều nội dung trên Viber.

**Mở web → Nhìn → Biết → Click → Làm.**

## Tính năng (Phase 1)

- CRUD Pin: 1 pin = nội dung + link + deadline + thành phần tham gia + độ ưu tiên.
- Collections (nhóm pin): Việc cần chú ý, Tài liệu, Link/Slide... — tự tạo nhóm mới ngay trong composer.
- Dải **"Cần chú ý ngay"**: ghim nổi (⭐), pin quá hạn, deadline hôm nay và trong 3 ngày tới.
- Ghim nổi (⭐) đưa pin quan trọng lên đầu bảng.
- Search + filter theo nhóm, deadline, ghim nổi; lọc theo tổ qua heatmap bên trái.
- Lần đầu vào web: nhập tên đầy đủ (ví dụ *Nguyễn Văn An*) + chọn 1 trong 6 tổ chuyên môn → tên hiển thị dạng **AnNV**, lưu localStorage và bảng `members` trên database để đối chiếu.
- Minh bạch: ghi nhận ai tạo, ai sửa lần cuối, lúc nào.
- Realtime: ai đó ghim/sửa là mọi người thấy ngay (khi dùng Supabase).

## Công nghệ

- Frontend: HTML + CSS + Vanilla JS (không build step).
- Backend: [Supabase](https://supabase.com) (Postgres + API + Realtime).
- Deploy: Vercel (static site).

## Cài đặt

### 1. Tạo backend Supabase (miễn phí)

1. Tạo project tại [supabase.com](https://supabase.com/dashboard).
2. Vào **SQL Editor** → New query → dán toàn bộ nội dung `supabase/schema.sql` → **Run**.
3. Vào **Settings → API**, copy **Project URL** và **anon public key**.
4. Điền vào `js/config.js`:

```js
window.APP_CONFIG = {
  SUPABASE_URL: 'https://xxxx.supabase.co',
  SUPABASE_ANON_KEY: 'eyJ...'
};
```

> Chưa cấu hình Supabase? App vẫn chạy được ở **chế độ cục bộ** (localStorage) — dữ liệu chỉ lưu trên trình duyệt của từng người, phù hợp để xem thử giao diện.

### 2. Chạy local

Chỉ cần serve thư mục tĩnh:

```bash
python3 -m http.server 8080
# hoặc: npx serve .
```

Mở http://localhost:8080

### 3. Deploy Vercel

```bash
npx vercel --prod
```

Hoặc import repo này trên [vercel.com](https://vercel.com/new) — không cần cấu hình gì thêm (static site, không build step).

## Phase 2 (dự kiến)

- Login, tích hợp LDAP/SSO (siết lại RLS policy trong `supabase/schema.sql`).
- Semantic search.
- Bản đồ luồng công việc / digital twin.
- Heatmap tải việc nâng cao.
