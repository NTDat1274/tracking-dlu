# TrackingZ Web Admin Dashboard — Upgrade & Security Implementation Checklist

> **Mục tiêu:** Đây là tài liệu yêu cầu triển khai dành cho **Antigravity CLI**. Hãy đọc toàn bộ tài liệu trước khi sửa code, sau đó thực hiện theo từng nhóm công việc, ưu tiên bảo mật và không làm hỏng các chức năng hiện có.

---

## 0. Nguyên tắc triển khai

- [ ] Kiểm tra cấu trúc project hiện tại trước khi thay đổi.
- [ ] Xác định framework, routing, state management và cách project đang khởi tạo Supabase/Cloudinary.
- [ ] Tìm toàn bộ reference liên quan đến:
  - `isDemoAdmin`
  - `admin@dlu.edu.vn`
  - demo login / soft login
  - session tạm / localStorage liên quan authentication
  - `SUPABASE_ANON_KEY`
  - `CLOUDINARY_API_KEY`
  - filter theo `faculty` / `khoa`
  - `class_name`
  - các trang `VisitsPage`, `StudentsPage`, `AnalyticsPage`, `FilterBar`
  - export report
  - AI confidence / `confidence`
  - realtime / Supabase channel
  - Cloudinary image deletion
- [ ] Không tạo bảng `classes` mới nếu không cần thiết. Danh sách lớp phải được suy ra trực tiếp từ dữ liệu sinh viên.
- [ ] Không hard-code danh sách lớp.
- [ ] Không hard-code tài khoản admin hoặc token.
- [ ] Sau mỗi nhóm thay đổi, kiểm tra build/type/lint/test theo các script có sẵn của project.
- [ ] Không expose service-role key hoặc secret key ở frontend.
- [ ] Không xóa dữ liệu production nếu chưa xác định rõ cơ chế cascade/an toàn.

---

# 1. 🛡️ SECURITY & AUTH

## 1.1. Mã hóa API Key trên `/settings`

### Yêu cầu

Tại màn hình Cấu hình `/settings`:

- [ ] Ô nhập `SUPABASE_ANON_KEY` phải dùng `type="password"`.
- [ ] Ô nhập `CLOUDINARY_API_KEY` phải dùng `type="password"`.
- [ ] Giá trị mặc định phải hiển thị dạng `••••••••` hoặc tương đương theo native password input.
- [ ] Bổ sung nút toggle bằng icon con mắt:
  - [ ] Trạng thái mặc định: ẩn.
  - [ ] Click lần 1: hiện giá trị tạm thời.
  - [ ] Click lần 2: ẩn lại.
- [ ] Không log API key ra console.
- [ ] Không hiển thị key trong error message.
- [ ] Không đưa key vào URL/query string.
- [ ] Kiểm tra các nơi khác trong UI có thể đang hiển thị các key này dưới dạng plaintext.

### Lưu ý bảo mật

`SUPABASE_ANON_KEY` về bản chất có thể được dùng phía client trong kiến trúc Supabase, nhưng vẫn phải tránh hiển thị/ghi log không cần thiết. Tuyệt đối không biến `service_role` key thành dữ liệu frontend.

---

## 1.2. Xóa hoàn toàn Demo Admin / Soft Login

### Phải loại bỏ

- [ ] Xóa toàn bộ logic `isDemoAdmin`.
- [ ] Xóa tài khoản mặc định `admin@dlu.edu.vn`.
- [ ] Xóa password/demo credential hard-code nếu có.
- [ ] Xóa mọi nhánh login giả lập.
- [ ] Xóa session tạm được dùng để bypass authentication.
- [ ] Xóa các fallback kiểu:
  - "nếu login thất bại thì cho vào dashboard"
  - "nếu không có session thì dùng demo admin"
  - "mock authenticated user"
  - `localStorage` flag dùng để giả lập đăng nhập.
- [ ] Xóa UI thông báo/label cho Demo Admin nếu có.

### Luồng login bắt buộc

Tất cả đăng nhập phải đi qua:

`Supabase Auth -> signInWithPassword`

Pseudo-flow:

```text
/login
  -> user nhập email/password
  -> supabase.auth.signInWithPassword(...)
  -> thành công
       -> lấy authenticated session
       -> redirect về dashboard
  -> thất bại
       -> hiển thị lỗi
       -> KHÔNG được bypass
```

### Session

- [ ] Dùng session/token thật của Supabase Auth.
- [ ] Không tự tạo JWT giả.
- [ ] Không coi localStorage flag là authentication.
- [ ] Dùng `onAuthStateChange` hoặc cơ chế tương đương để đồng bộ trạng thái đăng nhập.
- [ ] Khi logout phải gọi `supabase.auth.signOut()`.

---

## 1.3. Inactivity Timeout — tự động logout sau 15 phút

### Yêu cầu

Theo dõi các thao tác:

- [ ] `mousemove`
- [ ] `keydown`
- [ ] `click`
- [ ] `scroll`

Timeout:

`15 phút = 900 giây`

Nếu không có thao tác trong 15 phút:

1. [ ] Hủy Supabase session bằng `supabase.auth.signOut()`.
2. [ ] Xóa các state/cache tạm liên quan phiên làm việc.
3. [ ] Không để lại cờ authenticated giả.
4. [ ] Redirect về `/login`.
5. [ ] Hiển thị thông báo:

> **Phiên làm việc đã hết hạn vì lý do bảo mật**

### Kiến trúc đề xuất

Tạo một hook/service dùng chung, ví dụ:

```text
useInactivityTimeout()
```

hoặc:

```text
AuthProvider
  └── inactivity timer
```

### Yêu cầu kỹ thuật

- [ ] Mỗi event user activity phải reset timer.
- [ ] Cleanup event listeners khi component/provider unmount.
- [ ] Không tạo nhiều timer/listener trùng nhau.
- [ ] Không logout liên tục sau khi timeout đã xảy ra.
- [ ] Sau logout, timer phải được cleanup/reset.
- [ ] Chỉ áp dụng timeout cho authenticated session.
- [ ] Không yêu cầu user tương tác để timeout hoạt động.

---

## 1.4. Protected Routes

Các route sau bắt buộc xác thực:

- [ ] `/`
- [ ] `/history`
- [ ] `/students`
- [ ] `/settings`

### Yêu cầu

- [ ] Nếu chưa có Supabase authenticated session/token hợp lệ -> redirect `/login`.
- [ ] Không được render dữ liệu dashboard trước khi xác thực.
- [ ] Không thể bypass bằng cách truy cập URL trực tiếp.
- [ ] Refresh trang vẫn phải kiểm tra session thật.
- [ ] Logout xong không thể dùng Back/URL trực tiếp để truy cập dữ liệu protected.
- [ ] Có trạng thái loading trong lúc kiểm tra session để tránh flash nội dung protected.

### Kiểm tra

```text
Chưa login
  -> /              => /login
  -> /history       => /login
  -> /students      => /login
  -> /settings      => /login

Đã login
  -> các route trên => truy cập bình thường

Logout
  -> mọi route protected => /login
```

---

# 2. 🏫 BUSINESS DATA FILTER — LỌC THEO LỚP

## 2.1. Loại bỏ Filter theo Khoa

### Phạm vi

Kiểm tra toàn bộ project và thay thế filter "Khoa" bằng "Lớp", tối thiểu:

- [ ] `VisitsPage`
- [ ] `StudentsPage`
- [ ] `AnalyticsPage`
- [ ] `FilterBar`

### Yêu cầu UI

Thay:

```text
Tất cả khoa
```

bằng:

```text
Tất cả lớp
```

### Yêu cầu code

- [ ] Không còn dropdown filter theo faculty/khoa ở các màn hình trên.
- [ ] Không còn state/filter parameter không sử dụng liên quan faculty.
- [ ] Không còn query condition theo faculty nếu mục đích cũ chỉ là filter UI.
- [ ] Tìm và xử lý các component dùng chung để tránh còn sót filter Khoa.

---

## 2.2. Dynamic Class Fetching từ Supabase

### Nguồn dữ liệu

Danh sách lớp phải được lấy động từ bảng dữ liệu sinh viên bằng:

```text
DISTINCT class_name
```

### Yêu cầu

- [ ] Query Supabase lấy các `class_name` hiện có.
- [ ] Loại bỏ giá trị `null`, `undefined`, empty string hoặc whitespace-only.
- [ ] Trim dữ liệu trước khi hiển thị.
- [ ] Loại bỏ duplicate.
- [ ] Sort danh sách lớp ổn định, dễ sử dụng.
- [ ] Không hard-code:
  - `CTK46`
  - `DTVT45`
  - hoặc bất kỳ lớp cụ thể nào.

### UX

Dropdown phải có:

```text
Tất cả lớp
CTK...
DTVT...
...
```

### Reuse

Ưu tiên tạo một service/hook dùng chung, ví dụ:

```text
useClasses()
```

hoặc:

```text
getDistinctClasses()
```

để các page không tự viết query khác nhau.

---

## 2.3. Tự động nhận lớp mới

Ví dụ admin sửa sinh viên:

```text
class_name = "CTK46"
```

Nếu `CTK46` chưa tồn tại trước đó:

- [ ] CSDL lưu `class_name = CTK46` trong student record.
- [ ] Không cần tạo record/table class riêng.
- [ ] Query distinct class lần tiếp theo phải tự trả về `CTK46`.
- [ ] Dropdown filter tự có `CTK46`.

### Sau khi thêm/sửa sinh viên

- [ ] Refresh/re-fetch class list khi cần.
- [ ] Nếu app có state/cache class list, phải invalidate/update cache.
- [ ] Không yêu cầu developer/admin chỉnh code để thêm lớp mới.

---

# 3. 🎨 UI/UX & DLU BRANDING

## 3.1. Dark Slate DLU

### Màu nền

Áp dụng palette nền tối dịu:

```text
Primary Dark Background: #141820
Secondary Surface:       #1E2430
```

### Status colors

```text
Served:      #9ABE26
Waiting:     #FFA12D
Unattended:  #E2231A
```

### Yêu cầu

- [ ] Áp dụng nhất quán trên dashboard.
- [ ] Không dùng quá nhiều màu accent ngoài hệ thống.
- [ ] Đảm bảo text contrast dễ đọc.
- [ ] Kiểm tra hover/focus/disabled state.
- [ ] Không hard-code màu rải rác nếu project có design tokens/theme system; ưu tiên khai báo token.

---

## 3.2. Theme Switcher

Hỗ trợ 3 chế độ:

```text
Dark
Light
System
```

### Yêu cầu

- [ ] Có control chuyển theme.
- [ ] Dark mode dùng palette DLU Dark Slate.
- [ ] Light mode có palette sáng dễ đọc.
- [ ] System mode tự theo OS preference.
- [ ] Chuyển theme mượt, tránh nhấp nháy.
- [ ] Persist lựa chọn theme nếu kiến trúc hiện tại hỗ trợ persistence.
- [ ] Không để theme setting ảnh hưởng authentication/session.

### Kiểm tra

- [ ] Dark -> Light
- [ ] Light -> Dark
- [ ] System -> OS dark
- [ ] System -> OS light
- [ ] Refresh trang vẫn đúng theme đã chọn.

---

# 4. 🧹 DỌN DẸP UI KHÔNG CẦN THIẾT

## 4.1. Xóa "Xuất báo cáo" khỏi Dashboard

- [ ] Xóa nút **Xuất báo cáo** khỏi trang Tổng quan `/`.
- [ ] Không xóa chức năng export dùng ở nơi khác.

## 4.2. Xóa "Xuất báo cáo" khỏi Students

- [ ] Xóa nút **Xuất báo cáo** khỏi `/students`.

## 4.3. Giữ Export ở đúng nơi

Chỉ giữ:

- [ ] `/history`
- [ ] `/analytics`

Nếu route/component thực tế có tên khác, map theo chức năng tương đương.

---

## 4.4. Xóa cột "Độ tin cậy AI (%)"

Trong bảng Lịch sử:

- [ ] Xóa hoàn toàn column **Độ tin cậy AI (%)**.
- [ ] Xóa header.
- [ ] Xóa cell rendering.
- [ ] Xóa formatter liên quan nếu không còn nơi sử dụng.
- [ ] Không nhất thiết xóa field database nếu field đó vẫn phục vụ logic khác.

---

# 5. ⏳ LOADING & IMAGE FALLBACK

## 5.1. Loading Skeleton

Bổ sung skeleton loading khi đang tải dữ liệu từ Supabase.

### Phạm vi

Ưu tiên:

- [ ] Dashboard cards.
- [ ] Occupants list/table.
- [ ] Students table.
- [ ] History table.
- [ ] Analytics data.
- [ ] Các khu vực fetch dữ liệu async khác.

### Yêu cầu UX

- [ ] Skeleton chỉ hiển thị trong trạng thái loading.
- [ ] Không để màn hình trắng khi request đang chạy.
- [ ] Có trạng thái empty riêng với loading.
- [ ] Có trạng thái error riêng với loading.
- [ ] Skeleton không làm layout nhảy quá mạnh.

---

## 5.2. Avatar/Snapshot Fallback

Khi:

- [ ] Student chưa có ảnh.
- [ ] URL ảnh bị lỗi.
- [ ] Cloudinary resource không tồn tại.
- [ ] Image load error.

Thì phải hiển thị:

```text
Avatar fallback / Snapshot mặc định
```

### Yêu cầu

- [ ] Không để broken-image icon mặc định của browser.
- [ ] `onError` phải chuyển sang fallback.
- [ ] Tránh loop vô hạn nếu fallback URL cũng lỗi.
- [ ] Có thể dùng placeholder/silhouette thống nhất với DLU branding.
- [ ] Áp dụng nhất quán ở Students, History, Occupants và các nơi hiển thị ảnh sinh viên.

---

# 6. ⚡ REALTIME OCCUPANTS

## 6.1. Thẻ "Số người đang có mặt trong phòng"

Dashboard phải hiển thị:

```text
Số người đang có mặt trong phòng
```

### Yêu cầu

- [ ] Count phải phản ánh occupants hiện tại.
- [ ] Dữ liệu lấy từ nguồn attendance/visit hiện tại trong Supabase.
- [ ] Không dùng số hard-code.
- [ ] Khi có người vào/ra, count tự cập nhật.

---

## 6.2. Danh sách Occupants realtime

Hiển thị danh sách người đang có mặt.

Mỗi dòng nên có tối thiểu:

- [ ] Avatar/snapshot.
- [ ] Tên sinh viên.
- [ ] Lớp nếu dữ liệu có.
- [ ] Thời điểm vào.
- [ ] Thời gian đã ở trong phòng.

---

## 6.3. Live Ticking — đồng hồ tăng từng giây

Ví dụ:

```text
00:15:42
00:15:43
00:15:44
...
```

### Yêu cầu

- [ ] Tự động tăng mỗi giây.
- [ ] Tính từ timestamp vào phòng (`check_in`/`entry_time` tương ứng với schema thực tế).
- [ ] Không cần refetch database mỗi giây.
- [ ] Dùng một timer phía client để render live duration.
- [ ] Cleanup interval khi component unmount.
- [ ] Khi occupant rời phòng thì loại khỏi danh sách và dừng ticking cho record đó.

---

# 7. 📡 SUPABASE REALTIME LISTENER

## 7.1. Mục tiêu

Web Admin Dashboard phải tự cập nhật khi AI Desktop ghi nhận sự kiện VÀO/RA vào Supabase.

Không cần:

```text
F5 / Reload
```

---

## 7.2. Cơ chế

Sử dụng Supabase Realtime theo schema thực tế của project.

- [ ] Xác định bảng chứa visit/attendance events.
- [ ] Subscribe các event phù hợp:
  - [ ] `INSERT`
  - [ ] `UPDATE`
  - [ ] `DELETE`
  - hoặc chỉ các event thực sự cần thiết theo schema.
- [ ] Khi event vào/ra xảy ra:
  - [ ] cập nhật occupants count.
  - [ ] cập nhật occupants list.
  - [ ] cập nhật các widget/dashboard liên quan.
- [ ] Không tạo duplicate subscriptions.
- [ ] Cleanup channel khi component/provider unmount.
- [ ] Xử lý reconnect nếu kết nối Realtime bị gián đoạn.

### Kiến trúc đề xuất

Tách logic:

```text
Supabase Realtime
       ↓
Attendance/Visit state
       ↓
Dashboard / Occupants UI
```

Nếu project đang có query/cache layer, ưu tiên invalidate/refetch đúng resource thay vì copy logic dữ liệu ở nhiều nơi.

---

# 8. 🗑️ XÓA SINH VIÊN AN TOÀN — CASCADE CLEANUP

## 8.1. Mục tiêu

Khi admin xóa một sinh viên tại `/students`, phải dọn toàn bộ dữ liệu liên quan.

### Phải xử lý

1. [ ] Student profile.
2. [ ] Lịch sử/visit records liên quan.
3. [ ] Ảnh trên Cloudinary.
4. [ ] Các reference/metadata liên quan nếu có.

---

## 8.2. Xóa history liên quan

- [ ] Xác định foreign key/reference thực tế giữa student và visit/history.
- [ ] Xóa đúng các record liên quan.
- [ ] Tránh xóa nhầm record của sinh viên khác.
- [ ] Nếu DB có foreign key phù hợp, ưu tiên cơ chế `ON DELETE CASCADE` ở tầng database.
- [ ] Nếu schema chưa phù hợp, xử lý transaction/server-side thay vì tin tưởng frontend.

---

## 8.3. Dọn Cloudinary

Khi student có avatar/snapshot trên Cloudinary:

- [ ] Xác định `public_id` hoặc identifier thực tế của resource.
- [ ] Xóa resource Cloudinary khi xóa student.
- [ ] Không chỉ xóa URL trong database.
- [ ] Không expose Cloudinary API secret trong frontend.
- [ ] Nếu Cloudinary deletion yêu cầu secret/signature, thực hiện ở backend/server-side/secure function.
- [ ] Xử lý trường hợp ảnh đã bị xóa trước đó.
- [ ] Xử lý lỗi Cloudinary mà không làm database rơi vào trạng thái không nhất quán.

### Quan trọng

Không đưa:

```text
CLOUDINARY_API_SECRET
```

hoặc credential server-side vào browser bundle.

---

## 8.4. Transaction / Failure Strategy

Thiết kế thao tác delete sao cho tránh trạng thái:

```text
Student đã xóa
nhưng history còn
hoặc ảnh Cloudinary còn
```

Ưu tiên:

```text
Frontend
  -> gọi backend/server-side delete operation
      -> validate admin auth
      -> xác định student
      -> cleanup Cloudinary
      -> cleanup related records
      -> delete student
      -> trả kết quả
```

Nếu project có Supabase Edge Functions/API server, ưu tiên đưa orchestration vào đó.

---

# 9. 🧪 TEST CHECKLIST

## 9.1. Authentication

- [ ] Login đúng email/password -> thành công.
- [ ] Login sai password -> thất bại.
- [ ] Không tồn tại demo login.
- [ ] Không tồn tại `isDemoAdmin`.
- [ ] Không tồn tại admin mặc định hard-code.
- [ ] Direct URL khi chưa login -> `/login`.
- [ ] Refresh khi đã login -> session vẫn hợp lệ.
- [ ] Logout -> không truy cập được protected route.
- [ ] Inactivity 15 phút -> logout + redirect + thông báo.

---

## 9.2. Settings Security

- [ ] Supabase key bị mask mặc định.
- [ ] Cloudinary API key bị mask mặc định.
- [ ] Eye toggle hoạt động.
- [ ] Không log secrets.
- [ ] Không expose secret server-side.

---

## 9.3. Class Filter

- [ ] Không còn "Tất cả khoa".
- [ ] Có "Tất cả lớp".
- [ ] Class list lấy từ Supabase.
- [ ] Duplicate class bị loại.
- [ ] Empty class bị xử lý.
- [ ] Thêm lớp mới vào student -> dropdown nhận lớp mới.
- [ ] Sửa student sang lớp mới -> dropdown nhận lớp mới.

---

## 9.4. Theme/UI

- [ ] Dark theme đúng palette.
- [ ] Light theme hoạt động.
- [ ] System theme hoạt động.
- [ ] Chuyển theme không gây UI flicker nghiêm trọng.
- [ ] Status colors đúng:
  - [ ] Served `#9ABE26`
  - [ ] Waiting `#FFA12D`
  - [ ] Unattended `#E2231A`

---

## 9.5. Loading/Image

- [ ] Skeleton xuất hiện khi fetch.
- [ ] Empty state không bị nhầm với loading.
- [ ] Error state không bị nhầm với loading.
- [ ] Avatar thiếu ảnh -> fallback.
- [ ] Avatar URL lỗi -> fallback.
- [ ] Không có broken image.

---

## 9.6. Realtime

- [ ] AI Desktop ghi event IN -> Dashboard tự cập nhật.
- [ ] AI Desktop ghi event OUT -> Dashboard tự cập nhật.
- [ ] Occupant count thay đổi realtime.
- [ ] Occupant list thay đổi realtime.
- [ ] Timer tăng mỗi giây.
- [ ] Không cần F5.
- [ ] Không duplicate Realtime listener.
- [ ] Listener cleanup đúng.

---

## 9.7. Student Delete

- [ ] Delete student thành công.
- [ ] Related history được cleanup.
- [ ] Cloudinary image được cleanup.
- [ ] Không xóa nhầm dữ liệu student khác.
- [ ] Delete thất bại có thông báo rõ ràng.
- [ ] Không để lại secret trong browser.
- [ ] Kiểm tra consistency sau khi delete.

---

# 10. 🔍 SEARCH/REVIEW SAU KHI IMPLEMENT

Sau khi hoàn thành, chạy search toàn project để chắc chắn không còn các thành phần cũ:

```text
isDemoAdmin
admin@dlu.edu.vn
demo admin
soft login
mock auth
Tất cả khoa
faculty filter
Độ tin cậy AI
Xuất báo cáo
```

Ngoại lệ: tài liệu migration/test hoặc comment có thể chứa tên cũ nếu thực sự cần, nhưng code production không được còn logic bypass/security cũ.

---

# 11. 📋 DEFINITION OF DONE

Feature chỉ được xem là hoàn thành khi:

- [ ] Authentication 100% dựa trên Supabase Auth.
- [ ] Không còn Demo Admin/Soft Login.
- [ ] Protected Routes hoạt động.
- [ ] Inactivity timeout 15 phút hoạt động.
- [ ] API key inputs được mask + eye toggle.
- [ ] Filter toàn hệ thống chuyển từ Khoa -> Lớp.
- [ ] Class list dynamic từ `DISTINCT class_name`.
- [ ] Lớp mới tự xuất hiện sau khi student được thêm/sửa.
- [ ] DLU Dark Slate branding được áp dụng.
- [ ] Dark/Light/System theme hoạt động.
- [ ] Export chỉ còn History và Analytics.
- [ ] AI confidence column bị loại khỏi History.
- [ ] Skeleton loading hoạt động.
- [ ] Avatar fallback hoạt động.
- [ ] Occupants count realtime.
- [ ] Occupants live ticking từng giây.
- [ ] Supabase Realtime tự cập nhật IN/OUT.
- [ ] Student deletion cleanup đầy đủ.
- [ ] Cloudinary cleanup được thực hiện server-side nếu cần secret.
- [ ] Không có credential/secret nhạy cảm trong frontend bundle.
- [ ] Build/typecheck/lint/test hiện có của project đều pass.
- [ ] Không có regression rõ ràng ở các chức năng hiện hữu.

---

# 12. 🚀 THỨ TỰ ƯU TIÊN ĐỀ XUẤT CHO ANTIGRAVITY CLI

Thực hiện theo thứ tự:

```text
PHASE 1 — Audit
  ↓
PHASE 2 — Security/Auth
  ↓
PHASE 3 — Data Filter/Class
  ↓
PHASE 4 — Realtime/Occupants
  ↓
PHASE 5 — Student Delete/Cascade Cleanup
  ↓
PHASE 6 — UI/Theme/Branding
  ↓
PHASE 7 — Loading/Image Fallback
  ↓
PHASE 8 — Cleanup/Regression Test
```

## PHASE 1 — Audit

- [ ] Đọc toàn bộ source.
- [ ] Xác định các file/component/service liên quan.
- [ ] Xác định schema Supabase hiện tại.
- [ ] Xác định cơ chế Cloudinary hiện tại.
- [ ] Xác định routing/auth architecture.
- [ ] Không sửa code lớn trước khi hiểu architecture.

## PHASE 2 — Security/Auth

- [ ] Supabase Auth.
- [ ] Protected routes.
- [ ] Demo removal.
- [ ] Inactivity timeout.
- [ ] Settings key masking.

## PHASE 3 — Data Filter

- [ ] Dynamic classes.
- [ ] Replace faculty filters.
- [ ] Shared class hook/service.
- [ ] Validate new-class behavior.

## PHASE 4 — Realtime

- [ ] Realtime subscription.
- [ ] Occupant count.
- [ ] Occupant list.
- [ ] Live ticking.
- [ ] Cleanup/reconnect.

## PHASE 5 — Delete/Cleanup

- [ ] Student deletion.
- [ ] History cleanup.
- [ ] Cloudinary cleanup.
- [ ] Secure server-side orchestration.

## PHASE 6 — UI/Theme

- [ ] Dark Slate.
- [ ] DLU status colors.
- [ ] Light/Dark/System.

## PHASE 7 — UX

- [ ] Skeleton.
- [ ] Avatar fallback.
- [ ] Remove unnecessary UI.

## PHASE 8 — Verification

- [ ] Search old auth logic.
- [ ] Search old faculty filter.
- [ ] Search removed UI.
- [ ] Run build/typecheck/lint/test.
- [ ] Verify all Definition of Done items.

---

# 13. 🤖 INSTRUCTION FOR ANTIGRAVITY CLI

Khi thực hiện:

1. **Không chỉ sửa UI.** Phải kiểm tra cả database/query/auth/backend/server-side logic khi yêu cầu có liên quan.
2. **Không giả định schema.** Hãy đọc schema/query hiện tại để xác định đúng tên bảng và column.
3. **Không tạo dữ liệu giả để làm cho UI "có vẻ hoạt động".**
4. **Không bypass authentication để test.** Nếu cần test, dùng test account/configuration phù hợp.
5. **Không expose secret/server credential ra frontend.**
6. **Không xóa bảng hoặc migration hiện hữu một cách phá vỡ dữ liệu.**
7. **Ưu tiên thay đổi nhỏ, có thể kiểm chứng và giữ backward compatibility khi hợp lý.**
8. Sau mỗi phase, kiểm tra lỗi và sửa regression trước khi sang phase tiếp theo.
9. Khi gặp điểm không thể triển khai đúng vì thiếu schema/API/backend, **dừng ở điểm đó và báo rõ blocker + file/logic liên quan**, không tự bịa implementation.
10. Cuối cùng tạo một báo cáo ngắn gồm:
    - Files đã thay đổi.
    - Database/schema changes (nếu có).
    - Security changes.
    - Realtime changes.
    - Tests/checks đã chạy.
    - Các vấn đề còn tồn tại (nếu có).

---

## FINAL STATUS

| Nhóm | Trạng thái |
|---|---|
| Security & Auth | ⬜ Chưa thực hiện |
| Protected Routes | ⬜ Chưa thực hiện |
| Inactivity Timeout | ⬜ Chưa thực hiện |
| Dynamic Class Filter | ⬜ Chưa thực hiện |
| DLU Branding | ⬜ Chưa thực hiện |
| Theme Switcher | ⬜ Chưa thực hiện |
| Loading Skeleton | ⬜ Chưa thực hiện |
| Image Fallback | ⬜ Chưa thực hiện |
| Realtime Occupants | ⬜ Chưa thực hiện |
| Supabase Realtime | ⬜ Chưa thực hiện |
| Student Cascade Cleanup | ⬜ Chưa thực hiện |
| Cloudinary Cleanup | ⬜ Chưa thực hiện |
| Regression Test | ⬜ Chưa thực hiện |

**End of specification.**
