import React from 'react';
import {
  BookOpen,
  X,
  KeyRound,
  Building2,
  Lock,
  Database,
  ShieldCheck,
} from 'lucide-react';


interface UserGuideModalProps {
  onClose: () => void;
}

export const UserGuideModal: React.FC<UserGuideModalProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-red-800 to-red-900 px-6 py-4 text-white flex items-center justify-between border-b-2 border-amber-500">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-full bg-red-950 border border-amber-400 flex items-center justify-center shadow">
              <BookOpen className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h3 className="text-base font-bold tracking-tight">HƯỚNG DẪN SỬ DỤNG HỆ THỐNG</h3>
              <p className="text-xs text-amber-200">
                Phần mềm Quản lý Chương trình Kiểm tra, Giám sát của Đảng (Phiên bản 1.0)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-red-200 hover:text-white p-1.5 rounded-lg hover:bg-red-700/60 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-slate-800 text-sm">
          {/* Mục 1: Đăng nhập & Đổi mật khẩu */}
          <section className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div className="flex items-center space-x-2 text-red-800 font-bold mb-2">
              <KeyRound className="w-5 h-5 text-red-700" />
              <h4 className="text-sm uppercase tracking-wide">1. Đăng nhập & Đổi mật khẩu lần đầu</h4>
            </div>
            <ul className="list-disc list-inside space-y-1.5 text-xs text-slate-600 pl-1 leading-relaxed">
              <li>
                <strong>Tài khoản mặc định:</strong> Tên đăng nhập <code className="bg-slate-200 px-1.5 py-0.5 rounded font-mono text-red-700">admin</code>, mật khẩu khởi tạo <code className="bg-slate-200 px-1.5 py-0.5 rounded font-mono text-red-700">Admin@123456</code>.
              </li>
              <li>
                <strong>Bắt buộc đổi mật khẩu:</strong> Để bảo đảm an toàn dữ liệu ngành Đảng, ngay lần đăng nhập đầu tiên hệ thống sẽ yêu cầu đổi sang mật khẩu mới (tối thiểu 6 ký tự).
              </li>
              <li>
                Sau khi đổi thành công, bạn có thể chủ động đổi lại mật khẩu bất kỳ lúc nào bằng cách bấm biểu tượng chìa khóa trên thanh công cụ góc trên bên phải.
              </li>
            </ul>
          </section>

          {/* Mục 2: Quản lý Cây tổ chức Đơn vị Đảng */}
          <section className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div className="flex items-center space-x-2 text-red-800 font-bold mb-2">
              <Building2 className="w-5 h-5 text-red-700" />
              <h4 className="text-sm uppercase tracking-wide">2. Quản lý Cơ cấu Tổ chức Đảng (Cây phân cấp)</h4>
            </div>
            <div className="space-y-2 text-xs text-slate-600 leading-relaxed">
              <p>Màn hình hiển thị toàn bộ sơ đồ tổ chức Đảng từ Đảng ủy cấp trên đến các Chi bộ cơ sở:</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 my-2">
                <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                  <strong className="text-slate-800 block mb-1">Mở rộng / Thu gọn nhánh:</strong>
                  Bấm vào biểu tượng mũi tên cạnh tên Đảng bộ / Đơn vị để xem danh sách các Chi bộ, cơ quan tham mưu trực thuộc. Bấm "Mở rộng tất cả" hoặc "Thu gọn" ở thanh công cụ để điều khiển nhanh.
                </div>
                <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                  <strong className="text-slate-800 block mb-1">Tìm kiếm & Lọc:</strong>
                  Nhập tên hoặc mã tổ chức Đảng vào ô tìm kiếm để định vị tức thì. Có thể lọc riêng theo loại: Đảng bộ, Chi bộ, BTV, BCH, UBKT.
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                  <strong className="text-slate-800 block mb-1">Thêm đơn vị mới:</strong>
                  - Bấm nút <em>"Thêm Đơn vị Cấp trên"</em> để tạo Đảng bộ gốc.<br />
                  - Bấm biểu tượng <strong>+</strong> trên từng dòng để thêm nhanh Chi bộ trực thuộc đơn vị đó.
                </div>
                <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                  <strong className="text-slate-800 block mb-1">Chỉnh sửa & Xóa:</strong>
                  - Bấm biểu tượng cây bút để sửa tên, mã, loại hình hoặc đơn vị cha.<br />
                  - Bấm biểu tượng thùng rác để xóa (Hệ thống có cơ chế kiểm tra an toàn: nếu đơn vị có cấp dưới thì không được phép xóa).
                </div>
              </div>
            </div>
          </section>

          {/* Mục 3: Cơ chế Vận hành Trực tuyến (Full Online) & Quản trị Tập trung */}
          <section className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div className="flex items-center space-x-2 text-emerald-800 font-bold mb-2">
              <Database className="w-5 h-5 text-emerald-700" />
              <h4 className="text-sm uppercase tracking-wide">3. Cơ chế Vận hành Trực tuyến (Full Online) & CSDL Tập trung</h4>
            </div>
            <ul className="list-disc list-inside space-y-1.5 text-xs text-slate-600 pl-1 leading-relaxed">
              <li>
                <strong>Truy cập trực tuyến linh hoạt:</strong> Cán bộ truy cập phần mềm trực tiếp qua trình duyệt web trên máy tính thông qua mạng nội bộ (LAN) hoặc Internet, không cần cài đặt phần mềm phức tạp trên từng máy tính.
              </li>
              <li>
                <strong>Cơ sở dữ liệu tập trung & Thời gian thực:</strong> Mọi dữ liệu hồ sơ, chương trình kiểm tra giám sát, văn bản quyết định và nhật ký được lưu trữ đồng bộ ngay lập tức trên máy chủ trung tâm.
              </li>
              <li>
                <strong>Đa người dùng đồng thời:</strong> Nhiều cán bộ, chi bộ trực thuộc có thể cùng đăng nhập làm việc đồng thời theo đúng phân quyền (Admin, Biên tập, Xem báo cáo) mà không sợ xung đột dữ liệu.
              </li>
            </ul>
          </section>

          {/* Mục 4: An toàn thông tin & Khóa màn hình */}
          <section className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div className="flex items-center space-x-2 text-amber-800 font-bold mb-2">
              <Lock className="w-5 h-5 text-amber-700" />
              <h4 className="text-sm uppercase tracking-wide">4. Bảo mật & Khóa màn hình tạm thời (Idle Lock)</h4>
            </div>
            <ul className="list-disc list-inside space-y-1.5 text-xs text-slate-600 pl-1 leading-relaxed">
              <li>
                <strong>Khóa màn hình chủ động:</strong> Khi cần rời vị trí làm việc, bấm biểu tượng ổ khóa trên thanh Header để khóa giao diện ngay lập tức.
              </li>
              <li>
                <strong>Tự động khóa khi bất hoạt:</strong> Nếu không có thao tác chuột hoặc bàn phím sau 15 phút, màn hình sẽ tự động khóa để chống lộ lọt thông tin.
              </li>
              <li>
                <strong>Mở khóa:</strong> Chỉ cần nhập lại mật khẩu của cán bộ đang đăng nhập để tiếp tục làm việc mà không làm mất phiên làm việc hiện tại.
              </li>
              <li>
                <strong>Nhật ký kiểm toán (Audit Trail):</strong> Mọi hành động thêm/sửa/xóa đều được lưu vết lại kèm thời gian chính xác trong mục Nhật ký hoạt động.
              </li>
            </ul>
          </section>
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 px-6 py-3.5 border-t border-slate-200 flex items-center justify-between">
          <span className="text-xs text-slate-500 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            Bảo mật cấp ủy • Phân quyền vai trò: Admin, Biên tập, Xem
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-red-700 hover:bg-red-800 text-white rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer"
          >
            Đã hiểu, đóng hướng dẫn
          </button>
        </div>
      </div>
    </div>
  );
};
