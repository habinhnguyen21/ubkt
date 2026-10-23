# PHẦN MỀM QUẢN LÝ CHƯƠNG TRÌNH KIỂM TRA, GIÁM SÁT CỦA ĐẢNG (FULL ONLINE)

Hệ thống được chuyển đổi thành **Ứng dụng Web Trực tuyến 100% (Full Online Web Application)**, hỗ trợ nhiều cán bộ và chi bộ trực thuộc cùng truy cập làm việc đồng thời qua mạng nội bộ (LAN) hoặc Internet.

---

## 🚀 HƯỚNG DẪN KHỞI CHẠY HỆ THỐNG

### 1. Chạy toàn bộ hệ thống (Server + Web Client)
```bash
npm run dev:all
```
Lệnh trên sẽ khởi chạy đồng thời:
- **Backend Web Server**: `http://localhost:5000` (API REST + Cơ sở dữ liệu tập trung)
- **Frontend Web App**: `http://localhost:5173` (Giao diện người dùng)

### 2. Khởi chạy riêng từng thành phần
- **Khởi chạy Backend Server:**
  ```bash
  npm run server
  ```
- **Khởi chạy Frontend Dev:**
  ```bash
  npm run dev
  ```
- **Đóng gói bản build Production:**
  ```bash
  npm run build
  ```

---

## 👥 THÔNG TIN TÀI KHOẢN HỆ THỐNG

| Tên đăng nhập | Mật khẩu mặc định | Họ và tên | Vai trò | Chức danh |
|:---|:---|:---|:---|:---|
| `admin` | `Admin@123456` | Quản trị viên Hệ thống | `ADMIN` | Chủ nhiệm UBKT |
| `nguyenvanan` | `Admin@123456` | Đ/c Nguyễn Văn An | `BIEN_TAP` | Uỷ viên UBKT |
| `tranthibinh` | `Admin@123456` | Đ/c Trần Thị Bình | `BIEN_TAP` | Phó Chủ nhiệm UBKT |
| `levancuong` | `Admin@123456` | Đ/c Lê Văn Cường | `BIEN_TAP` | Chuyên viên UBKT |

---

## 🌐 KIẾN TRÚC MÁY CHỦ & DỮ LIỆU TẬP TRUNG (FULL ONLINE)

1. **Backend Web Server (`server/server.js`)**:
   - Chạy trên Node.js + Express (cổng 5000).
   - Hỗ trợ đầy đủ REST API: Xác thực, Đổi mật khẩu, Cơ cấu tổ chức Đơn vị, Chương trình KT-GS toàn khóa & hàng năm, Quyết định thay đổi bổ sung, Kho PDF, Quản lý tài khoản cán bộ, Nhật ký kiểm toán.
   - Cơ sở dữ liệu tập trung lưu trữ tại `server/data/database.json`. Khi triển khai lên máy chủ thật (VPS/Server cơ quan), mọi máy tính trong mạng truy cập theo địa chỉ IP/Domain của máy chủ để dùng chung một CSDL duy nhất.

2. **Frontend Web App (`src/`)**:
   - Xây dựng bằng React 19 + TypeScript + Vite + Tailwind CSS.
   - Đã gỡ bỏ hoàn toàn mã nguồn Desktop (`src-tauri`) và thư viện `@tauri-apps/api`.
   - Kết nối trực tuyến với máy chủ qua REST API (có cơ chế dự phòng an toàn).
   - Giao diện cập nhật toàn diện trạng thái máy chủ Online, đèn báo thời gian thực, phục vụ truy cập đa nền tảng trình duyệt.
