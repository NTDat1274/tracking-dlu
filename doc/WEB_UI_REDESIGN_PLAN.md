# 🌐 KẾ HOẠCH NÂNG CẤP THIẾT KẾ & TÍCH HỢP HỆ THỐNG WEB ADMIN DASHBOARD

> **Dự án:** TrackingZ - Website Quản lý & Thống kê Sinh viên Ra/Vào  
> **Chuẩn thương hiệu:** Bộ Nhận diện Thương hiệu Trường Đại học Đà Lạt (DLU Brand Guidelines)  
> **Mục tiêu:** Bổ sung Đăng nhập (Auth), Form Đăng ký Sinh viên mới, Drawer xem chi tiết lượt đến, loại bỏ các chi tiết thừa và chuẩn hóa màu sắc dịu mắt (Dark Slate DLU).

---

## 1. PHÂN TÍCH VẤN ĐỀ UX/UI & CÁC TÍNH NĂNG CẦN BỎ / THÊM

### A. Các chi tiết cần BỎ / SỬA (Theo phân tích Video Demo)

1. **Loại bỏ Nút "Xuất báo cáo" dư thừa:**
   - _Hiện trạng:_ Nút xuất hiện tràn lan ở trang _Tổng quan_, _Phân tích_, và cả trang _Sinh viên_.
   - _Giải pháp:_ **BỎ nút này ở trang Sinh viên và Tổng quan.** Chỉ giữ lại ở trang **Lịch sử lượt đến** và **Phân tích**.
2. **Loại bỏ Cột "Độ tin cậy AI (%)":**
   - _Hiện trạng:_ Hiển thị chỉ số phần trăm (90%, 95%) trong bảng Lịch sử lượt đến gây hoang mang cho Admin khi chỉ số dao động.
   - _Giải pháp:_ **BỎ hoàn toàn cột này** khỏi bảng Lịch sử. Độ tin cậy chỉ phục vụ debug ở ứng dụng Desktop.
3. **Chuẩn hóa Bộ Nhãn Trạng thái (Status Badges):**
   - _Hiện trạng:_ Trùng lặp và bất đồng bộ giữa các filter (`Exited`, `Unknown`, `Served`, `Waiting`, `Unattended`).
   - _Giải pháp:_ Thống nhất 3 trạng thái chính: **Served** (Đã tiếp nhận - Xanh DLU), **Waiting** (Đang chờ - Cam DLU), **Unattended** (Chưa tiếp nhận - Đỏ DLU).

### B. Các tính năng cốt lõi cần BỔ SUNG (Thiếu theo Đề cương Đồ án)

1. **Hệ thống Đăng nhập & Phân quyền (Supabase Auth):** Bảo vệ toàn bộ trang Web Admin qua trang `/login`.
2. **Trang Quản lý & Đăng ký Sinh viên (Student Enrolment):** Modal form nhập thông tin (Mã SV, Họ tên, Lớp) + Upload ảnh chân dung lên Cloudinary để trích xuất Vector.
3. **Drawer Xem Chi Tiết Lượt Đến (Detailed Visit Log):** Bấm vào dòng lịch sử mở Slide-over Drawer xem ảnh Snapshot toàn cảnh, ảnh crop mặt rõ nhất (`best_crop`), và timeline chính xác.
4. **Bảng Danh sách Sinh viên Hiện diện Realtime (Realtime Occupants):** Xem danh sách và đồng hồ đếm thời gian ở thực tế của những người đang có mặt trong phòng.

---

## 2. CHUẨN MỰC THƯƠNG HIỆU DLU (BRANDING GUIDELINES)

Toàn bộ giao diện Web Admin sẽ chuyển sang phong cách **Dark Slate Theme** chuyên nghiệp, dịu mắt cho người dùng.

### A. Phông chữ (Typography)

- **Phông chính:** `Inter` (dành cho số liệu và UI chính).
- **Phông phụ:** `Be Vietnam Pro` (dành cho tiếng Việt hiển thị sắc nét).

### B. Bảng màu chuẩn (Color Palette)

| Thành phần Web                    | Mã Màu Hex | Ứng dụng & Ý nghĩa                                                             |
| :-------------------------------- | :--------: | :----------------------------------------------------------------------------- |
| **Main Background**               | `#141820`  | Tông tối sâu dịu mắt, giảm mỏi mắt khi quan sát lâu.                           |
| **Card / Container Background**   | `#1E2430`  | Màu nền cho các bảng, card biểu đồ, sidebar.                                   |
| **DLU Green (Primary Accent)**    | `#9ABE26`  | _(PMS 157-8 C)_ Màu nhấn chính. Dùng cho nút bấm, badge _Served_, icon active. |
| **DLU Orange (Secondary Accent)** | `#FFA12D`  | _(PMS 1375 C)_ Màu nhấn phụ. Dùng cho badge _Waiting_, cảnh báo.               |
| **DLU Red (Cảnh báo)**            | `#E2231A`  | _(PMS 485 C)_ Dùng cho badge _Unattended_, nút Đăng xuất / Xóa.                |
| **Text Primary**                  | `#E6E8EC`  | Trắng xám dịu, dễ đọc.                                                         |

---

## 3. KIẾN TRÚC DỮ LIỆU TẬP TRUNG (SUPABASE & CLOUDINARY)

Tất cả dữ liệu được lưu trữ tập trung tại **Cloud Supabase PostgreSQL** (Không chia làm 2 DB riêng biệt):
┌─────────────────────────────────────────┐
│ SUPABASE CLOUD (PostgreSQL) │
├─────────────────────────────────────────┤
│ 1. Table: students (Hồ sơ SV & Face) │
│ 2. Table: student_records (Lịch sử) │
│ 3. Supabase Auth (Admin accounts) │
└───────────────────▲─────────────────────┘
│
┌─────────────────────────────────┴─────────────────────────────────┐
│ │
┌────────┴──────────────────────────┐ ┌────────────────────────┴───────────────────┐
│ PYTHON DESKTOP ENGINE │ │ REACT WEB ADMIN DASHBOARD │
├───────────────────────────────────┤ ├────────────────────────────────────────────┤
│ - Nạp danh sách SV khi startup │ │ - Đăng nhập Admin bảo mật (/login) │
│ - Tracking AI & InsightFace local │ │ - Thêm/Xóa/Sửa SV + Upload ảnh Cloudinary │
│ - Đẩy sự kiện Vào/Ra + Link ảnh │ │ - Realtime Dashboard (WebSocket) │
└───────────────────────────────────┘ └────────────────────────────────────────────┘

---

## 4. BẢNG CƠ SỞ DỮ LIỆU CHUẨN (SUPABASE SQL SCHEMA)

```sql
-- 1. Bảng Hồ sơ Sinh viên
CREATE TABLE students (
    student_id TEXT PRIMARY KEY, -- Mã sinh viên (VD: 2212390)
    full_name TEXT NOT NULL,
    class_name TEXT,
    email TEXT,
    portrait_url TEXT, -- Link ảnh chân dung trên Cloudinary
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Bảng Lịch sử Ra/Vào
CREATE TABLE student_records (
    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    track_id INT8 NOT NULL,
    student_id TEXT REFERENCES students(student_id) ON DELETE SET NULL,
    student_name TEXT DEFAULT 'Không rõ mặt',
    time_in TIMESTAMP WITH TIME ZONE,
    time_out TIMESTAMP WITH TIME ZONE,
    duration_seconds FLOAT8,
    status TEXT DEFAULT 'WAITING', -- 'Served', 'Waiting', 'Unattended'
    snapshot_url TEXT, -- Link ảnh toàn cảnh trên Cloudinary
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

5. CÁC MÀN HÌNH CẦN THIẾT KẾ VÀ NÂNG CẤP
   Màn hình 1: Trang Đăng Nhập (/login)
   Form đăng nhập Email & Password bảo mật với logo DLU.
   Tích hợp supabase.auth.signInWithPassword.
   Chuyển hướng tự động nếu chưa đăng nhập (Protected Route).
   Màn hình 2: Trang Tổng Quan (/ - Dashboard)
   Thẻ đếm tổng quan: Tổng lượt hôm nay, Số người hiện có trong phòng (Realtime Occupants), Thời gian ở trung bình.Bảng "Đang có mặt trong phòng": Hiển thị danh sách các sinh viên đang ở trong phòng kèm đồng hồ đếm thời gian ở tăng dần thời gian thực.Biểu đồ: Giữ nguyên các biểu đồ cột cao điểm, xu hướng 7 ngày, doughnut chart nhưng chuyển sang màu nhận diện DLU Green (#9ABE26).Màn hình 3: Trang Lịch Sử Lượt Đến (/history)Bỏ cột Độ tin cậy AI (%).Bấm vào mỗi dòng bản ghi hoặc nút "Xem chi tiết" $\rightarrow$ Mở Slide-over Drawer bên phải:Ảnh Snapshot toàn cảnh lúc vào cửa (từ Cloudinary).Chuỗi ảnh crop khuôn mặt rõ nhất (best_crop).Mốc thời gian chi tiết: Giờ vào, Giờ ra, Tổng thời gian ở lại (tính bằng giây).Màn hình 4: Trang Quản Lý Sinh Viên (/students)Bỏ nút "Xuất báo cáo" ở góc phải.Thêm nút "+ Thêm Sinh Viên Mới" $\rightarrow$ Mở Modal Form:Nhập: Mã SV, Họ tên, Khóa/Lớp, Email.Khung Upload Ảnh Chân Dung (Xem trước ảnh crop mặt).Khi lưu: Đẩy ảnh lên Cloudinary lấy URL, lưu record vào bảng students trên Supabase.Mỗi thẻ/dòng sinh viên có thêm nút Sửa và Xóa.6. LỘ TRÌNH THỰC THI (ROADMAP)[x] Bước 1: Khởi tạo file tài liệu kế hoạch docs/WEB_UI_REDESIGN_PLAN.md.[ ] Bước 2: Cập nhật SQL Schema trên Supabase (Tạo bảng students, student_records, và Auth users).[ ] Bước 3: Phát triển Module Auth (/login & Protected Routes Guard).[ ] Bước 4: Refactor tông màu Dark Slate DLU (#9ABE26, #FFA12D), sửa giao diện các trang Dashboard, History, Students.[ ] Bước 5: Xây dựng Modal "Thêm Sinh viên" (Upload Cloudinary) và Slide-over Drawer "Xem chi tiết lượt đến".[ ] Bước 6: Tích hợp Supabase Realtime Subscription cho danh sách sinh viên hiện diện trong phòng.[ ] Bước 7: Kiểm thử toàn diện và nghiệm thu Web Admin.
