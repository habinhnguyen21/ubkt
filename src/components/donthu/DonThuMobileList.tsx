import React, { useState, useEffect } from 'react';
import {
  Search,
  Filter,
  Plus,
  X,
  MoreVertical,
  Eye,
  Edit3,
  Trash2,
  Calendar,
  User as UserIcon,
  Building,
  AlertTriangle,
  CheckCircle2,
  Clock,
  RotateCcw,
} from 'lucide-react';
import type { DonThu } from '../../types';

export interface DonThuMobileListProps {
  items: DonThu[];
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onAddNew?: () => void;
  onViewDetail: (item: DonThu) => void;
  onEdit: (item: DonThu) => void;
  onDelete?: (item: DonThu) => void;
  canEdit?: boolean;
  filterDrawerContent?: React.ReactNode;
  activeFilterCount?: number;
  onClearFilter?: () => void;
  getDeadlineInfo: (item: DonThu) => {
    isOverdue: boolean;
    daysLeft: number;
    deadlineStr: string;
    isCompleted?: boolean;
    completionDate?: string | null;
  };
}

const LOAI_DON_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  'Khiếu nại': { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  'Tố cáo': { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' },
  'Kiến nghị': { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  'Phản ánh': { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
  'Đơn khác': { bg: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-200' },
};

export const DonThuMobileList: React.FC<DonThuMobileListProps> = ({
  items,
  searchQuery,
  onSearchChange,
  onAddNew,
  onViewDetail,
  onEdit,
  onDelete,
  canEdit = true,
  filterDrawerContent,
  activeFilterCount = 0,
  onClearFilter,
  getDeadlineInfo,
}) => {
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  useEffect(() => {
    if (!activeMenuId) return;
    const handleOutside = () => setActiveMenuId(null);
    window.addEventListener('click', handleOutside);
    return () => window.removeEventListener('click', handleOutside);
  }, [activeMenuId]);

  useEffect(() => {
    if (!filterDrawerOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFilterDrawerOpen(false);
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [filterDrawerOpen]);

  return (
    <div className="space-y-3 font-sans">
      {/* ── 1. THANH TÌM KIẾM & BỘ LỌC ── */}
      <div className="space-y-2 bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
        <div className="relative w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Tìm theo cán bộ, loại đơn, lĩnh vực..."
            style={{ fontSize: '16px' }}
            className="w-full pl-9 pr-9 py-2.5 min-h-[44px] bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

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
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Xóa lọc</span>
            </button>
          )}

          {canEdit && onAddNew && (
            <button
              type="button"
              onClick={onAddNew}
              className="min-h-[44px] px-4 py-2 bg-blue-800 hover:bg-blue-900 text-white rounded-lg text-xs font-bold flex items-center justify-center space-x-1.5 shadow-xs transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Thêm đơn</span>
            </button>
          )}
        </div>

        <div className="flex items-center justify-between text-[11.5px] text-slate-500 pt-1 border-t border-slate-100">
          <span>
            Tổng cộng: <strong className="text-slate-800">{items.length}</strong> đơn thư
          </span>
        </div>
      </div>

      {/* ── 2. DANH SÁCH THẺ ── */}
      {items.length === 0 ? (
        <div className="bg-white p-8 rounded-xl border border-slate-200 text-center text-slate-400 shadow-2xs space-y-2">
          <Calendar className="w-8 h-8 mx-auto text-slate-300" />
          <p className="text-xs font-medium">Không tìm thấy đơn thư nào phù hợp.</p>
          {activeFilterCount > 0 && onClearFilter && (
            <button
              type="button"
              onClick={onClearFilter}
              className="text-xs font-bold text-blue-600 hover:underline cursor-pointer"
            >
              Xóa toàn bộ lọc
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2.5">
          {items.map((item, idx) => {
            const deadline = getDeadlineInfo(item);
            const loaiStyle = LOAI_DON_COLORS[item.loai_don] || LOAI_DON_COLORS['Đơn khác'];
            const isMenuOpen = activeMenuId === item.id;

            return (
              <div
                key={item.id}
                className={`bg-white p-3.5 rounded-xl border shadow-2xs space-y-2.5 transition ${
                  deadline.isOverdue ? 'border-rose-300 bg-rose-50/10' : 'border-slate-200'
                }`}
              >
                {/* Hàng 1: STT, Mã đơn / Ngày nhận, Menu 3 chấm */}
                <div className="flex items-start justify-between gap-2 relative">
                  <div className="flex items-start gap-2 min-w-0">
                    <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-mono text-[10.5px] font-bold shrink-0 mt-0.5">
                      {idx + 1}
                    </span>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-900 leading-snug">
                        {item.ma_don ? `Mã: ${item.ma_don}` : `Đơn nhận ngày ${new Date(item.ngay_tiep_nhan).toLocaleDateString('vi-VN')}`}
                      </div>
                      <div className="text-[11px] text-slate-500 truncate">
                        Tiếp nhận: <span className="font-medium text-slate-700">{new Date(item.ngay_tiep_nhan).toLocaleDateString('vi-VN')}</span> (Hạn {item.thoi_han_quy_dinh} ngày)
                      </div>
                    </div>
                  </div>

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

                        <button
                          type="button"
                          onClick={() => {
                            setActiveMenuId(null);
                            onEdit(item);
                          }}
                          className="w-full min-h-[44px] px-3.5 py-2 text-left text-xs text-slate-700 hover:bg-slate-50 flex items-center space-x-2 cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-blue-600" />
                          <span>Cập nhật / Sửa</span>
                        </button>

                        {canEdit && onDelete && (
                          <button
                            type="button"
                            onClick={() => {
                              setActiveMenuId(null);
                              onDelete(item);
                            }}
                            className="w-full min-h-[44px] px-3.5 py-2 text-left text-xs text-rose-600 hover:bg-rose-50 flex items-center space-x-2 cursor-pointer border-t border-slate-100"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                            <span>Xóa đơn thư</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Hàng 2: Nhãn Loại đơn + Lĩnh vực + Trạng thái/Tiến độ */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-100">
                  <span className={`px-2 py-0.5 rounded text-[11px] font-bold border ${loaiStyle.bg} ${loaiStyle.text} ${loaiStyle.border}`}>
                    {item.loai_don}
                  </span>

                  <span className="text-[11px] font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                    {item.linh_vuc}
                  </span>

                  {item.trang_thai === 'Đã hoàn thành' ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-bold text-[11px] bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <CheckCircle2 className="w-3 h-3" />
                      Đã hoàn thành
                    </span>
                  ) : deadline.isOverdue || item.trang_thai === 'Quá hạn' ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-bold text-[11px] bg-rose-50 text-rose-700 border border-rose-200">
                      <AlertTriangle className="w-3 h-3" />
                      Quá hạn {Math.abs(deadline.daysLeft)} ngày
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-semibold text-[11px] bg-blue-50 text-blue-700 border border-blue-200">
                      <Clock className="w-3 h-3" />
                      Còn {deadline.daysLeft} ngày
                    </span>
                  )}
                </div>

                {/* Hàng 3: Cán bộ phụ trách & Đối tượng */}
                <div className="space-y-1 text-xs text-slate-600 bg-slate-50/70 p-2.5 rounded-lg border border-slate-100">
                  <div className="flex items-center gap-1.5 text-slate-700">
                    <UserIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>Phụ trách:</span>
                    <strong className="text-slate-800">{item.can_bo_phu_trach}</strong>
                  </div>

                  <div className="flex items-center gap-1.5 text-slate-700">
                    {item.doi_tuong_lien_quan === 'Tổ chức đảng' ? (
                      <Building className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    ) : (
                      <UserIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    )}
                    <span>Đối tượng:</span>
                    <span className="text-slate-800 font-medium">{item.doi_tuong_lien_quan}</span>
                  </div>

                  {item.huong_xu_ly && (
                    <div className="text-[11px] text-slate-500 pt-0.5">
                      Hướng xử lý: <strong className="text-slate-700">{item.huong_xu_ly}</strong> ({item.phan_loai_xu_ly})
                    </div>
                  )}
                </div>

                {/* Hàng 4: Ghi chú nếu có */}
                {item.ghi_chu_nghiep_vu && (
                  <p
                    onClick={() => onViewDetail(item)}
                    className="text-xs text-slate-600 line-clamp-2 cursor-pointer hover:text-slate-900 italic"
                  >
                    "{item.ghi_chu_nghiep_vu}"
                  </p>
                )}

                {/* Hàng 5: Nút Xem chi tiết nhanh */}
                <div className="pt-1 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => onViewDetail(item)}
                    className="w-full min-h-[44px] px-3 py-2 bg-sky-50 hover:bg-sky-100 text-sky-700 font-bold text-xs rounded-lg border border-sky-200 flex items-center justify-center space-x-1.5 transition cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5 text-sky-600" />
                    <span>Xem chi tiết đơn thư</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── 3. NGĂN KÉO BỘ LỌC ── */}
      {filterDrawerOpen && filterDrawerContent && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity animate-in fade-in"
            onClick={() => setFilterDrawerOpen(false)}
          />

          <div className="relative w-full max-w-lg bg-white rounded-t-2xl shadow-2xl border-t border-slate-200 z-10 max-h-[85vh] flex flex-col animate-in slide-in-from-bottom duration-200">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 rounded-t-2xl">
              <div className="flex items-center space-x-2">
                <Filter className="w-4 h-4 text-blue-700" />
                <h3 className="text-sm font-bold text-slate-800">Bộ lọc đơn thư</h3>
              </div>
              <button
                type="button"
                onClick={() => setFilterDrawerOpen(false)}
                className="w-9 h-9 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-3.5 flex-1">{filterDrawerContent}</div>

            <div className="p-3 border-t border-slate-200 bg-slate-50 flex items-center gap-2">
              {onClearFilter && (
                <button
                  type="button"
                  onClick={() => {
                    onClearFilter();
                    setFilterDrawerOpen(false);
                  }}
                  className="flex-1 min-h-[44px] px-3 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 rounded-lg border border-slate-300 flex items-center justify-center space-x-1 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Xóa lọc</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setFilterDrawerOpen(false)}
                className="flex-1 min-h-[44px] px-3 py-2 text-xs font-bold text-white bg-blue-700 hover:bg-blue-800 rounded-lg shadow-xs flex items-center justify-center cursor-pointer"
              >
                Áp dụng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
