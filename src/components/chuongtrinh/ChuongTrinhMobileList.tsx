import React, { useState, useEffect } from 'react';
import {
  Search,
  Filter,
  Plus,
  X,
  MoreVertical,
  Eye,
  Edit2,
  Copy,
  Trash2,
  Calendar,
  User as UserIcon,
  FolderOpen,
  Play,
  Check,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
} from 'lucide-react';
import type { ChuongTrinhKtGs, DonVi } from '../../types';
import { formatDateVn } from '../../services/chuongTrinhExcelService';

export interface ChuongTrinhMobileListProps {
  items: ChuongTrinhKtGs[];
  loading?: boolean;
  isAdmin?: boolean;
  canEdit?: boolean;
  canEditItem?: (item: ChuongTrinhKtGs) => boolean;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  // Phân trang
  currentPage: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  // Thao tác
  onAddNew?: () => void;
  onViewDetail: (item: ChuongTrinhKtGs) => void;
  onEdit: (item: ChuongTrinhKtGs) => void;
  onDuplicate: (item: ChuongTrinhKtGs) => void;
  onDelete?: (item: ChuongTrinhKtGs) => void;
  onQuickDangThucHien?: (item: ChuongTrinhKtGs) => void;
  onQuickHoanThanh?: (item: ChuongTrinhKtGs) => void;
  onLinkToDiaBan?: (targetDvId: string, tenDv: string) => void;
  renderAssignedOfficers?: (item: ChuongTrinhKtGs) => React.ReactNode;
  allDonVi?: DonVi[];
  // Ngăn kéo bộ lọc
  filterDrawerContent?: React.ReactNode;
  activeFilterCount?: number;
  onClearFilter?: () => void;
  isNhiemKy?: boolean;
}

export const ChuongTrinhMobileList: React.FC<ChuongTrinhMobileListProps> = ({
  items,
  loading = false,
  isAdmin = false,
  canEdit = false,
  canEditItem,
  searchQuery,
  onSearchChange,
  currentPage,
  pageSize,
  onPageChange,
  onAddNew,
  onViewDetail,
  onEdit,
  onDuplicate,
  onDelete,
  onQuickDangThucHien,
  onQuickHoanThanh,
  onLinkToDiaBan,
  renderAssignedOfficers,
  allDonVi = [],
  filterDrawerContent,
  activeFilterCount = 0,
  onClearFilter,
  isNhiemKy = false,
}) => {
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  // Đóng menu ba chấm khi chạm ra ngoài
  useEffect(() => {
    if (!activeMenuId) return;
    const handleOutsideClick = () => setActiveMenuId(null);
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, [activeMenuId]);

  // Đóng ngăn kéo khi nhấn Esc
  useEffect(() => {
    if (!filterDrawerOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFilterDrawerOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [filterDrawerOpen]);

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const paginatedItems = items.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Render loại hình badge
  const renderLoaiHinh = (loaiHinh?: string | null) => {
    if (!loaiHinh) return null;
    if (loaiHinh === 'KIEM_TRA') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
          Kiểm tra
        </span>
      );
    }
    if (loaiHinh === 'GIAM_SAT') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-purple-50 text-purple-800 border border-purple-200">
          Giám sát
        </span>
      );
    }
    return null;
  };

  // Render trạng thái badge
  const renderTrangThai = (status?: string | null) => {
    switch (status) {
      case 'DANG_THUC_HIEN':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            Đang thực hiện
          </span>
        );
      case 'DA_HOAN_THANH':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-teal-50 text-teal-700 border border-teal-200">
            Hoàn thành
          </span>
        );
      case 'QUA_HAN':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            Quá hạn
          </span>
        );
      case 'CHUA_THUC_HIEN':
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-300">
            Chưa thực hiện
          </span>
        );
    }
  };

  const renderThoiGian = (item: ChuongTrinhKtGs) => {
    if (item.thoi_gian_loai === 'CA_NHIEM_KY' || (!item.ngay_bat_dau && !item.ngay_ket_thuc)) {
      if (item.nhiem_ky) return `Cả nhiệm kỳ ${item.nhiem_ky}`;
      return `Năm ${item.nam}`;
    }
    if (item.ngay_bat_dau && item.ngay_ket_thuc) {
      return `${formatDateVn(item.ngay_bat_dau)} – ${formatDateVn(item.ngay_ket_thuc)}`;
    }
    if (item.ngay_bat_dau) {
      return `Từ ${formatDateVn(item.ngay_bat_dau)}`;
    }
    return `Năm ${item.nam}`;
  };

  return (
    <div className="space-y-3 font-sans">
      {/* ── 1. THANH TÌM KIẾM & NÚT BỘ LỌC + THÊM MỚI (CHIỀU CAO TỐI THIỂU 44PX) ── */}
      <div className="space-y-2 bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
        {/* Ô tìm kiếm luôn thấy ngay đầu danh sách */}
        <div className="relative w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Tìm theo tên, số VB, nội dung, đơn vị..."
            style={{ fontSize: '16px' }} // Chữ >= 16px để iOS Safari không tự phóng to
            className="w-full pl-9 pr-9 py-2.5 min-h-[44px] bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-600 cursor-pointer"
              title="Xóa tìm kiếm"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Hàng nút chức năng: Bộ lọc + Thêm mới */}
        <div className="flex items-center gap-2">
          {filterDrawerContent && (
            <button
              type="button"
              onClick={() => setFilterDrawerOpen(true)}
              className={`flex-1 min-h-[44px] px-3 py-2 rounded-lg text-xs font-bold flex items-center justify-center space-x-1.5 transition cursor-pointer border ${
                activeFilterCount > 0
                  ? 'bg-blue-50 text-blue-800 border-blue-300'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <Filter className="w-4 h-4" />
              <span>Bộ lọc</span>
              {activeFilterCount > 0 && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-blue-600 text-white">
                  {activeFilterCount}
                </span>
              )}
            </button>
          )}

          {activeFilterCount > 0 && onClearFilter && (
            <button
              type="button"
              onClick={onClearFilter}
              className="min-h-[44px] px-3 py-2 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 flex items-center justify-center space-x-1 cursor-pointer"
              title="Xóa toàn bộ tiêu chí lọc"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Xóa lọc</span>
            </button>
          )}

          {canEdit && onAddNew && (
            <button
              type="button"
              onClick={onAddNew}
              className="min-h-[44px] px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-lg text-xs font-bold flex items-center justify-center space-x-1.5 shadow-xs transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Thêm mới</span>
            </button>
          )}
        </div>

        {/* Thông tin số lượng */}
        <div className="flex items-center justify-between text-[11.5px] text-slate-500 pt-1 border-t border-slate-100">
          <span>
            Tổng cộng: <strong className="text-slate-800">{items.length}</strong>{' '}
            {isNhiemKy ? 'chương trình toàn khóa' : 'chương trình'}
          </span>
          {items.length > 0 && (
            <span>
              Trang {currentPage}/{totalPages}
            </span>
          )}
        </div>
      </div>

      {/* ── 2. DANH SÁCH THẺ (MOBILE CARDS) ── */}
      {loading ? (
        <div className="bg-white p-8 rounded-xl border border-slate-200 text-center text-slate-500 shadow-2xs space-y-2">
          <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs">Đang nạp dữ liệu chương trình...</p>
        </div>
      ) : items.length === 0 ? (
        <div className="bg-white p-8 rounded-xl border border-slate-200 text-center text-slate-400 shadow-2xs space-y-2">
          <Calendar className="w-8 h-8 mx-auto text-slate-300" />
          <p className="text-xs font-medium">Không tìm thấy chương trình nào phù hợp.</p>
          {activeFilterCount > 0 && onClearFilter && (
            <button
              type="button"
              onClick={onClearFilter}
              className="text-xs font-bold text-blue-600 hover:underline cursor-pointer"
            >
              Xóa toàn bộ lọc để xem tất cả
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2.5">
          {paginatedItems.map((item, idx) => {
            const stt = (currentPage - 1) * pageSize + idx + 1;
            const isMenuOpen = activeMenuId === item.id;
            const itemEditable = canEditItem ? canEditItem(item) : canEdit;

            // Tìm đơn vị địa bàn để hiển thị nút mở Hồ sơ địa bàn
            const targetDv =
              (item.doi_tuong_don_vi_id && allDonVi.find((d) => d.id === item.doi_tuong_don_vi_id)) ||
              allDonVi.find((d) => d.ten.toLowerCase() === (item.doi_tuong || '').toLowerCase());

            return (
              <div
                key={item.id}
                className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs space-y-2.5 transition active:bg-slate-50/50"
              >
                {/* Hàng 1: STT, Tên cơ quan ban hành / Chủ thể & Menu 3 chấm */}
                <div className="flex items-start justify-between gap-2 relative">
                  <div className="flex items-start gap-2 min-w-0">
                    <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-mono text-[10.5px] font-bold shrink-0 mt-0.5">
                      {stt}
                    </span>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-900 leading-snug">
                        {item.chu_the || item.co_quan_ban_hanh}
                      </div>
                      {item.doi_tuong && (
                        <div className="text-[11px] text-slate-600 mt-0.5">
                          Đối tượng: <strong className="text-slate-800">{item.doi_tuong}</strong>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Menu ba chấm (vùng chạm 44x44px) */}
                  <div className="relative shrink-0">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveMenuId(isMenuOpen ? null : item.id);
                      }}
                      className="w-11 h-11 flex items-center justify-center text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition cursor-pointer"
                      aria-label="Thao tác"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>

                    {/* Dropdown Menu */}
                    {isMenuOpen && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="absolute right-0 top-10 z-50 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 w-44 animate-in fade-in zoom-in-95 duration-150"
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setActiveMenuId(null);
                            onViewDetail(item);
                          }}
                          className="w-full min-h-[44px] px-3.5 py-2 text-left text-xs text-slate-700 hover:bg-slate-50 flex items-center space-x-2 cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5 text-sky-600" />
                          <span>Xem chi tiết</span>
                        </button>

                        {itemEditable && (
                          <button
                            type="button"
                            onClick={() => {
                              setActiveMenuId(null);
                              onEdit(item);
                            }}
                            className="w-full min-h-[44px] px-3.5 py-2 text-left text-xs text-slate-700 hover:bg-slate-50 flex items-center space-x-2 cursor-pointer"
                          >
                            <Edit2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Chỉnh sửa</span>
                          </button>
                        )}

                        {itemEditable && (
                          <button
                            type="button"
                            onClick={() => {
                              setActiveMenuId(null);
                              onDuplicate(item);
                            }}
                            className="w-full min-h-[44px] px-3.5 py-2 text-left text-xs text-slate-700 hover:bg-slate-50 flex items-center space-x-2 cursor-pointer"
                          >
                            <Copy className="w-3.5 h-3.5 text-amber-600" />
                            <span>Nhân bản</span>
                          </button>
                        )}

                        {isAdmin && onDelete && (
                          <button
                            type="button"
                            onClick={() => {
                              setActiveMenuId(null);
                              onDelete(item);
                            }}
                            className="w-full min-h-[44px] px-3.5 py-2 text-left text-xs text-rose-600 hover:bg-rose-50 flex items-center space-x-2 cursor-pointer border-t border-slate-100"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                            <span>Xóa chương trình</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Hàng 2: Nhãn Loại hình + Trạng thái + Năm/Số VB */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-100">
                  {renderLoaiHinh(item.loai_hinh)}
                  {renderTrangThai(item.trang_thai)}

                  {item.so_van_ban && (
                    <span className="font-mono text-[11px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                      {item.so_van_ban}
                    </span>
                  )}

                  {item.nam && (
                    <span className="text-[11px] font-bold text-slate-600 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                      Năm {item.nam}
                    </span>
                  )}
                </div>

                {/* Hàng 3: Thời gian & Cán bộ phụ trách */}
                <div className="space-y-1 text-xs text-slate-600 bg-slate-50/70 p-2.5 rounded-lg border border-slate-100">
                  <div className="flex items-center gap-1.5 text-slate-700">
                    <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>Thời gian:</span>
                    <strong className="text-slate-800">{renderThoiGian(item)}</strong>
                  </div>

                  {isAdmin && renderAssignedOfficers && (
                    <div className="flex items-start gap-1.5 text-slate-700 pt-0.5">
                      <UserIcon className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                      <span className="shrink-0">Phụ trách:</span>
                      <div className="flex-1">{renderAssignedOfficers(item)}</div>
                    </div>
                  )}

                  {item.linh_vuc && (
                    <div className="text-[11px] text-slate-500 pt-0.5">
                      Lĩnh vực: <span className="text-slate-700 font-medium">{item.linh_vuc}</span>
                    </div>
                  )}
                </div>

                {/* Hàng 4: Nội dung tóm tắt */}
                {item.noi_dung && (
                  <p
                    onClick={() => onViewDetail(item)}
                    className="text-xs text-slate-600 line-clamp-2 cursor-pointer hover:text-slate-900"
                    title={item.noi_dung}
                  >
                    {item.noi_dung}
                  </p>
                )}

                {/* Hàng 5: Nút hành động nhanh (cao tối thiểu 44px) */}
                <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100">
                  {/* Nút Xem chi tiết */}
                  <button
                    type="button"
                    onClick={() => onViewDetail(item)}
                    className="flex-1 min-h-[44px] px-3 py-2 bg-sky-50 hover:bg-sky-100 text-sky-700 font-bold text-xs rounded-lg border border-sky-200 flex items-center justify-center space-x-1.5 transition cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5 text-sky-600" />
                    <span>Xem chi tiết</span>
                  </button>

                  {/* Nút mở Hồ sơ địa bàn nếu khớp đơn vị */}
                  {targetDv && onLinkToDiaBan && (
                    <button
                      type="button"
                      onClick={() => onLinkToDiaBan(targetDv.id, targetDv.ten)}
                      className="min-h-[44px] px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold text-xs rounded-lg border border-blue-200 flex items-center space-x-1 transition cursor-pointer"
                      title={`Xem hồ sơ địa bàn của ${targetDv.ten}`}
                    >
                      <FolderOpen className="w-3.5 h-3.5 text-blue-600" />
                      <span className="hidden xs:inline">Hồ sơ</span>
                    </button>
                  )}

                  {/* Nút chuyển trạng thái nhanh */}
                  {itemEditable && item.trang_thai === 'CHUA_THUC_HIEN' && onQuickDangThucHien && (
                    <button
                      type="button"
                      onClick={() => onQuickDangThucHien(item)}
                      className="min-h-[44px] px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold text-xs rounded-lg flex items-center space-x-1 cursor-pointer"
                      title="Bấm để chuyển sang Đang thực hiện"
                    >
                      <Play className="w-3 h-3 fill-current" />
                      <span>Đang TH</span>
                    </button>
                  )}

                  {itemEditable && onQuickHoanThanh && (item.trang_thai === 'DANG_THUC_HIEN' || item.trang_thai === 'QUA_HAN') && (
                    <button
                      type="button"
                      onClick={() => onQuickHoanThanh(item)}
                      className="min-h-[44px] px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg flex items-center space-x-1 cursor-pointer"
                      title="Bấm để chuyển sang Hoàn thành"
                    >
                      <Check className="w-3 h-3" />
                      <span>Xong</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── 3. PHÂN TRANG (VÙNG CHẠM TỐI THIỂU 44PX) ── */}
      {items.length > pageSize && (
        <div className="bg-white p-3 rounded-xl border border-slate-200 flex items-center justify-between text-xs text-slate-700 shadow-2xs">
          <button
            type="button"
            disabled={currentPage <= 1}
            onClick={() => onPageChange(Math.max(1, currentPage - 1))}
            className="min-h-[44px] min-w-[44px] px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-bold flex items-center space-x-1 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 transition cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Trước</span>
          </button>

          <span className="font-semibold text-slate-600">
            Trang <strong className="text-slate-900">{currentPage}</strong> / {totalPages}
          </span>

          <button
            type="button"
            disabled={currentPage >= totalPages}
            onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
            className="min-h-[44px] min-w-[44px] px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-bold flex items-center space-x-1 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 transition cursor-pointer"
          >
            <span>Sau</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── 4. NGĂN KÉO BỘ LỌC (FILTER DRAWER) DẠNG SHEET ── */}
      {filterDrawerOpen && filterDrawerContent && (
        <>
          {/* Lớp nền mờ */}
          <div
            onClick={() => setFilterDrawerOpen(false)}
            aria-hidden="true"
            className="fixed inset-0 bg-black/60 z-50 backdrop-blur-xs transition-opacity"
          />

          {/* Khung ngăn kéo trượt từ dưới lên */}
          <div
            style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom, 0px))' }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl shadow-2xl max-h-[85vh] flex flex-col animate-in slide-in-from-bottom duration-200"
          >
            {/* Header ngăn kéo */}
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Filter className="w-4 h-4 text-blue-700" />
                <h3 className="text-sm font-bold text-slate-900">Bộ lọc chương trình</h3>
                {activeFilterCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800">
                    {activeFilterCount}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setFilterDrawerOpen(false)}
                className="w-11 h-11 flex items-center justify-center text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
                aria-label="Đóng bộ lọc"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Nội dung các tiêu chí lọc */}
            <div className="p-4 overflow-y-auto space-y-4 flex-1">
              {filterDrawerContent}
            </div>

            {/* Footer ngăn kéo: Áp dụng & Xóa lọc */}
            <div className="p-3 border-t border-slate-200 flex items-center gap-2 bg-slate-50">
              {onClearFilter && (
                <button
                  type="button"
                  onClick={() => {
                    onClearFilter();
                    setFilterDrawerOpen(false);
                  }}
                  className="flex-1 min-h-[44px] py-2.5 px-3 rounded-lg border border-slate-300 text-slate-700 font-bold text-xs bg-white hover:bg-slate-100 transition cursor-pointer"
                >
                  Xóa toàn bộ lọc
                </button>
              )}
              <button
                type="button"
                onClick={() => setFilterDrawerOpen(false)}
                className="flex-1 min-h-[44px] py-2.5 px-3 rounded-lg bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs shadow-xs transition cursor-pointer"
              >
                Áp dụng & Đóng
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ChuongTrinhMobileList;
