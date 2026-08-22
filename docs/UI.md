# Thiết kế giao diện & CSS — Things to Pin

Tài liệu tham khảo cho ai muốn chỉnh giao diện. Toàn bộ style nằm trong **một file** `css/style.css` (~550 dòng), không framework, không preprocessor. Production minify CSS lúc `npm run build`.

## 1. Triết lý thiết kế

- **Bảng ghim / vision board**: mở web là thấy ngay việc cần đọc, cần làm, deadline sắp tới.
- **Tối giản thao tác, hạn chế modal**: chỉ có 1 modal xem chi tiết pin; tạo/sửa pin làm ngay trên trang (composer mở gập, sửa inline trên card).
- **Nhẹ**: HTML + CSS + vanilla JS, render bằng chuỗi template — không dependency giao diện nào.

## 2. Bố cục tổng thể

```
.wrap  (max-width:1280px, căn giữa, padding ngang 32px)
└── .layout  (grid 2 cột: var(--side-w) | 1fr, gap 22px)
    ├── .side-col  (sticky, cuộn riêng)      ← cột widget trái
    │   ├── .sidebar   🔥 Tải việc theo tổ (heatmap)
    │   ├── .fun-card  🌟 Gợi ý hôm nay
    │   ├── .fun-card  🧩 Nghỉ 5 phút (game hôm nay)
    │   └── .fun-card  💡 Ý tưởng & Feedback
    └── .main-col                            ← cột chính
        ├── .topbar     (brand + whoami)
        ├── .greeting
        ├── .composer   (ghim nhanh, mở/gập)
        ├── .urgent-section  (dải "Cần chú ý ngay")
        ├── .toolbar    (search + chip lọc)
        └── .board      (lưới card ghim)
```

Điểm cần biết:

- **Bề rộng cột trái** điều khiển bằng **một biến duy nhất** `--side-w` trong `:root`. Muốn cột rộng/hẹp hơn chỉ sửa chỗ đó — lưới tự giãn, bảng ghim tự dịch theo. Đừng set `width` cứng lên `.sidebar`/`.fun-card`.
- `.layout > *{ min-width:0 }` và `.side-col > *{ max-width:100% }` chống nội dung dài/width quá cỡ làm tràn cột.
- `.board` dùng `grid-template-columns: repeat(auto-fill, minmax(232px, 1fr))` — card tự xếp số cột theo bề rộng màn hình, không cần media query riêng.

## 3. Hệ màu (design tokens)

Tất cả màu là **biến CSS trong `:root`** — đổi theme chỉ cần sửa khối này.

| Nhóm | Biến | Ý nghĩa |
|---|---|---|
| Thương hiệu | `--brand` `#0E6BB5` | Xanh MobiFone — mọi trạng thái *đang chọn* và nút chính (`.btn-solid`, `.fchip.active`, `.team-chip.on`, tab game, nút ➕) |
| | `--brand-dark` `#0A548F` | Hover nút chính, tiêu đề brand/widget |
| | `--brand-soft` `#DCEBF7` | Nền xanh nhạt khi cần accent nhẹ |
| Nền/chữ | `--board` `#EAF1F8` | Nền trang (xanh ghi mát) |
| | `--card` `#FFFFFF` | Nền card/khối |
| | `--line` `#D6E2EE` | Viền |
| | `--ink` / `--ink-soft` | Chữ chính / chữ phụ |
| Collection | `--col-viec`, `--col-taily`, `--col-link`, `--col-neutral` (+ `-ink`) | Nền pastel + màu chữ theo loại pin |
| Độ khẩn | `--urg-red`, `--urg-amber`, `--urg-sage` | Quá hạn/hôm nay, sắp tới, bình thường |
| Độ ưu tiên | `--pr-ttkhan`, `--pr-tkhan`, `--pr-khan`, `--pr-bt` | Chấm màu ưu tiên trên card |
| Khác | `--star` | Vàng ghim nổi ★ |

Quy ước: **màu ngữ nghĩa (đỏ khẩn, vàng deadline, xanh lá đã xong, pastel collection) giữ nguyên khi đổi theme** — chỉ đổi nhóm thương hiệu + nền/chữ.

## 4. Chất "pinboard"

- Nền chấm bi: `radial-gradient(circle at 1px 1px, ...) 0 0/20px 20px` phủ lên `--board`.
- Mỗi card **xoay nhẹ ngẫu nhiên** (±1.4°) theo hash của id pin. Góc xoay truyền từ JS qua biến CSS `--rot` (inline style `--rot:1.4deg`), CSS compose: `.card{ transform:rotate(var(--rot,0deg)) }`. **Lưu ý:** đừng set `transform` inline trực tiếp lên card — sẽ đè mất hiệu ứng hover.
- Hover card: nhấc lên 2px (`rotate(var(--rot)) translateY(-2px)`) + bóng đậm hơn.
- Icon ghim (giọt nước) trên card đổi màu theo độ khẩn của deadline.
- Bóng 2 lớp: `--shadow-card` (nghỉ) / `--shadow-lift` (nổi bật, composer mở).
- Font: **Baloo 2** cho tiêu đề/brand (nét tròn, thân thiện), **Inter** cho nội dung, **IBM Plex Mono** cho badge nhỏ.

## 5. Thành phần lặp lại

- **Chip**: `.fchip` (lọc), `.team-chip` (tổ/người), `.coll-chip` (collection) — bo tròn 20px, trạng thái chọn nền `--brand` chữ trắng (riêng coll-chip giữ nền pastel, viền inset xanh).
- **Nút**: `.btn-solid` (chính, xanh), `.btn-ghost` (phụ, viền).
- **Ô nhập**: `.f-input` — nền `--board`, focus ring xanh `#9CC3E4`.
- **Widget cột trái**: `.sidebar` và `.fun-card` cùng khung (nền trắng, bo 14px, viền `--line`); tiêu đề `h2` màu `--brand-dark`.

## 6. Responsive

3 breakpoint chính:

| Breakpoint | Thay đổi |
|---|---|
| `max-width:900px` | 1 cột; **bảng ghim lên trước** (`.main-col{order:1}`), widget xuống dưới; side-col hết sticky |
| `max-width:560px` | Đệm gọn (12px); **font input ≥16px** chống iOS Safari tự zoom; chip lọc vuốt ngang (ẩn scrollbar); nút to hơn cho vừa ngón tay; board 1 cột |
| trong section | `.row2`, `.seg` gập về 1 cột |

Chống tràn ngang tổng quát: `min-width:0` trên con của grid, `max-width:100%` cho widget — đã kiểm tra không có scroll ngang ở 390px (iPhone 13/14).

## 7. Quy ước khi sửa giao diện

1. Thêm màu mới → khai báo biến trong `:root`, không hardcode rải rác.
2. Trạng thái "đang chọn"/nút chính → dùng `--brand`; hover → `--brand-dark`.
3. Muốn nới cột trái → sửa `--side-w`, không set width lên từng card.
4. Không set `transform` inline lên `.card` — dùng biến `--rot`.
5. Thêm section CSS mới → đặt dưới comment `/* ---------- tên section ---------- */` như các section hiện có, và bổ sung rule responsive vào đúng breakpoint.
