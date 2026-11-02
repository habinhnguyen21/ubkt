# PHẦN MỀM QUẢN LÝ CHƯƠNG TRÌNH KIỂM TRA, GIÁM SÁT CỦA ĐẢNG

Hệ thống Quản lý Chương trình Kiểm tra, Giám sát của Đảng vận hành trực tuyến trên nền tảng **GitHub Pages + Firebase Authentication + Cloud Firestore**, hỗ trợ phân quyền chặt chẽ ở tầng cơ sở dữ liệu (`firestore.rules`) theo đúng phạm vi địa bàn được phân công.

---

## 1. CÀI ĐẶT & KHỞI CHẠY

### Yêu cầu môi trường
- **Node.js**: phiên bản 20.x trở lên
- **Firebase CLI** (để triển khai Security Rules & chạy Emulator kiểm thử):
  ```bash
  npm install -g firebase-tools
  ```

### Cài đặt thư viện
```bash
npm install
```

### Khởi chạy môi trường phát triển (Frontend)
```bash
npm run dev
```

### Đóng gói bản build Production & Triển khai GitHub Pages
```bash
npm run build
npm run deploy
```

---

## 2. CẤU HÌNH BIẾN MÔI TRƯỜNG (`.env`)

Sao chép file `.env.example` thành `.env` ở thư mục gốc của dự án:

```bash
cp .env.example .env
```

Các biến môi trường trong `.env`:
- `VITE_FIREBASE_API_KEY`: API Key của ứng dụng Web trên Firebase Console.
- `VITE_FIREBASE_AUTH_DOMAIN`: Tên miền xác thực Firebase (`<project-id>.firebaseapp.com`).
- `VITE_FIREBASE_PROJECT_ID`: Mã dự án Firebase (`ubkt-bf611`).
- `VITE_FIREBASE_STORAGE_BUCKET`: Bucket lưu trữ Firebase.
- `VITE_FIREBASE_MESSAGING_SENDER_ID`: Messaging Sender ID.
- `VITE_FIREBASE_APP_ID`: App ID của ứng dụng Web.
- `JWT_SECRET`, `ALLOWED_ORIGINS`, `PORT`: Dùng khi chạy kèm máy chủ Express nội bộ tùy chọn (`npm run server`).

*(Lưu ý: File `.env` đã được loại trừ trong `.gitignore`, tuyệt đối không commit `.env` lên Git).*

---

## 3. CƠ CHẾ XÁC THỰC & PHÂN QUYỀN (FIREBASE AUTH + FIRESTORE RULES)

1. **Firebase Authentication (Email/Password)**:
   - Mỗi tên đăng nhập `<tendangnhap>` được ánh xạ tự động sang địa chỉ `<tendangnhap>@ubkt.local`.
   - Không lưu bất kỳ trường mật khẩu (`mat_khau`, `mat_khau_hash`) nào trong Firestore collection `users`.
   - Để được cấp tài khoản mới hoặc đặt lại mật khẩu, vui lòng **liên hệ Quản trị viên hệ thống**.

2. **Lưu trữ vai trò & Phân quyền tại `firestore.rules`**:
   - Vai trò (`ADMIN`, `BIEN_TAP`, `XEM`) được lưu trong `users/{uid}` và kiểm tra trực tiếp bằng hàm `get()` trong `firestore.rules` (hoàn toàn miễn phí trên gói Firebase Spark, không cần Cloud Functions trả phí).
   - **Nguyên tắc Mặc định từ chối (Default Deny)**:
     - Mọi thao tác đọc/ghi đều yêu cầu đăng nhập Firebase Auth hợp lệ và tài khoản đang hoạt động (`trang_thai == 1`).
     - `users`: Chỉ `ADMIN` được tạo, sửa, xóa; mỗi người dùng chỉ đọc được hồ sơ `users/{uid}` của chính mình; chặn tuyệt đối mọi bản ghi có chứa trường mật khẩu.
     - `don_vi`, `phan_cong_dia_ban`, `system_config`, `tombstones`: Chỉ `ADMIN` được phép ghi.
     - `chuong_trinh`, `ho_so_dia_ban_records`, `ho_so_dia_ban_files`, `bao_cao_thang`, `pdf_files`, `don_thu`: `ADMIN` được ghi tất cả; `BIEN_TAP` chỉ được tạo/cập nhật các bản ghi thuộc đơn vị mà mình được phân công trong `phan_cong_dia_ban/{uid}`.

---

## 4. TRIỂN KHAI FIRESTORE SECURITY RULES & KIỂM THỬ

### Bước 1: Bật Email/Password trong Firebase Console
1. Mở [Firebase Console](https://console.firebase.google.com/) $\rightarrow$ chọn dự án.
2. Vào **Authentication** $\rightarrow$ **Sign-in method** $\rightarrow$ bật **Email/Password** $\rightarrow$ bấm **Save**.

### Bước 2: Chuyển đổi người dùng hiện có sang Firebase Auth (chạy 1 lần trước khi khóa Rules)
Nếu hệ thống đã có dữ liệu người dùng cũ trên Firestore, người dùng sẽ được tự động chuyển đổi khi đăng nhập hoặc Quản trị viên có thể chạy script di trú hàng loạt:
```bash
MIGRATE_INIT_PASSWORD="<MatKhauKhoiTaoManh>" npm run migrate:auth
```

### Bước 3: Triển khai `firestore.rules` và `firestore.indexes.json` lên Firebase
Đăng nhập Firebase CLI và triển khai:
```bash
firebase login
firebase use ubkt-bf611
firebase deploy --only firestore:rules,firestore:indexes
```

### Bước 4: Chạy kiểm thử tự động Security Rules với Firebase Emulator
Dự án tích hợp bộ kiểm thử `@firebase/rules-unit-testing` tại `tests/firestore.rules.test.mjs`:
```bash
npm run test:rules
```
