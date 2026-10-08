# Web Dashboard Implementation & Refactoring Plan

---

## Phase 1: Lecturer Portal & 3-Role Authentication (Admin / Lecturer / Student)

- [x] **Task 1.1: Mở rộng Bảng `accounts` / Metadata trên Supabase để hỗ trợ 3 Roles**
  - Cập nhật trường `role` trong Supabase Auth / Bảng `accounts` hỗ trợ 3 giá trị: `'admin'`, `'lecturer'`, `'student'`.
  - Cập nhật `AuthContext.tsx` để lưu thông tin role người dùng hiện tại và xử lý tự động điều hướng (Redirect) đúng trang sau khi Login.

- [x] **Task 1.2: Tạo Cổng/Trang Quản Lý Giảng Viên (`LecturerPortalPage.tsx`)**
  - Thiết kế trang `LecturerPortalPage.tsx` dành riêng cho Giảng viên bao gồm 2 tab/khu vực chính:
    1. **Hồ sơ & Ảnh AI Giảng viên:** Nhập Mã GV, Họ tên, Khoa/Phòng ban + Chụp/Upload ảnh chân dung lên Cloudinary (trích xuất Vector 512-D lưu vào bảng `lecturers` để AI lọc bỏ rác bộ nhớ).
    2. **Tra cứu Lịch sử Ra/Vào Khoa (Read-Only):** Cho phép Giảng viên xem danh sách sinh viên ra/vào, vị trí camera ghi nhận, thời gian vào/ra, trạng thái và xem ảnh snapshot (Chỉ xem, không có quyền Thêm/Sửa/Xóa hoặc Cấu hình Cài đặt như Admin).

- [x] **Task 1.3: Cấu hình Phân quyền Routing (`ProtectedRoute`) cho 3 Vai trò**
  - Cập nhật `WebApp.tsx`:
    - Admin $\rightarrow$ Chuyển đến `/overview` (Toàn quyền).
    - Lecturer $\rightarrow$ Chuyển đến `/lecturer-portal` (Chỉ xem Portal Giảng viên + Tra cứu Lịch sử).
    - Student $\rightarrow$ Chuyển đến `/student-portal` (Chỉ xem Portal Sinh viên cá nhân).
  - Ngăn chặn truy cập trái phép bằng URL (Direct link protection).

- [x] **Task 1.4: Tạo Bảng `lecturers` trên Supabase Database**
  - Tạo bảng `lecturers` (`id`, `lecturer_code`, `full_name`, `department`, `avatar_url`, `embedding`, `created_at`).
  - Cài đặt RLS (Row Level Security) và export các API helper trong `lib/supabase.ts` cho các thao tác CRUD Giảng viên.

---

## Phase 2: Enhanced Export Modal (PDF & CSV với Biểu đồ & Tùy chọn thứ tự)

- [x] **Task 2.1: Bổ sung tùy chọn thành phần xuất trong `ExportModal.tsx`**
  - Thêm các Checkbox chọn nội dung xuất: `[x] Bảng Lịch sử lượt ra/vào`, `[x] Biểu đồ Thống kê (Donut/Bar Chart)`, `[x] Báo cáo KPI Tổng hợp`.
  - Bổ sung giao diện cho phép thay đổi thứ tự ưu tiên các phần hiển thị trong file báo cáo (ví dụ: Biểu đồ lên trước $\rightarrow$ Bảng chi tiết bên dưới).

- [x] **Task 2.2: Tối ưu chất lượng & định dạng xuất PDF**
  - Chụp canvas biểu đồ Recharts dạng Image DataURL.
  - Sử dụng `jsPDF` / `html2canvas` render file PDF chuẩn khổ A4, có tiêu đề Trường Đại học Đà Lạt, thông tin lọc, biểu đồ sắc nét và bảng danh sách có đánh số trang.

---

## Phase 3: Web Performance & Realtime Optimization

- [x] **Task 3.1: Loại bỏ Polling 5s dư thừa trên `OverviewPage.tsx`**
  - Xóa bỏ `setInterval` polling 5s trong `OverviewPage.tsx`.
  - Tối ưu `subscribeToStudentRecords` trong `lib/supabase.ts` làm nguồn cập nhật Realtime duy nhất cho Dashboard.

- [x] **Task 3.2: Bổ sung Giám sát Trạng thái Camera Realtime (Heartbeat)**
  - Tạo component/card hiển thị danh sách Camera kèm đèn báo trạng thái (Online/Offline) dựa trên `last_active_at` trong bảng `cameras`.