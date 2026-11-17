import React, { useState, useEffect } from 'react';
import {
  Search,
  Filter,
  Plus,
  X,
  MoreVertical,
  Eye,
  Download,
  Trash2,
  Calendar,
  FileText,
  Building2,
  RotateCcw,
  User as UserIcon,
} from 'lucide-react';
import type { PdfKhoItem, DonVi } from '../../types';

export interface KhoPdfMobileListProps {
  items: PdfKhoItem[];
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onAddNew?: () => void;
  onViewDetail: (item: PdfKhoItem) => void;
  onDownload: (item: PdfKhoItem) => void;
  onDelete?: (item: PdfKhoItem) => void;
  canEdit?: boolean;
  filterDrawerContent?: React.ReactNode;
  activeFilterCount?: number;
  onClearFilter?: () => void;
  allDonVi?: DonVi[];
}

export const KhoPdfMobileList: React.FC<KhoPdfMobileListProps> = ({
  items,
  searchQuery,
  onSearchChange,
  onAddNew,
  onViewDetail,
  onDownload,
  onDelete,
  canEdit = true,
  filterDrawerContent,
  activeFilterCount = 0,
  onClearFilter,
  allDonVi = [],
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

  const findDonViName = (item: PdfKhoItem) => {
    if (item.ten_don_vi) return item.ten_don_vi;
    if (!item.don_vi_id) return 'Toàn cơ quan / Không xác định';
    const dv = allDonVi.find((d) => d.id === item.don_vi_id);
    return dv ? dv.ten : 'Đơn vị khác';
  };

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
            placeholder="Tìm tên tệp, số VB, trích yếu, người ký..."
            style={{ fontSize: '16px' }}
            className="w-full pl-9 pr-9 py-2.5 min-h-[44px] bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#133863] focus:bg-white transition"
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
              className="min-h-[44px] px-4 py-2 bg-[#133863] hover:bg-blue-900 text-white rounded-lg text-xs font-bold flex items-center justify-center space-x-1.5 shadow-xs transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Thêm tệp</span>
            </button>
          )}
        </div>

        <div className="flex items-center justify-between text-[11.5px] text-slate-500 pt-1 border-t border-slate-100">
          <span>
            Tổng cộng: <strong className="text-slate-800">{items.length}</strong> tệp tài liệu
          </span>
        </div>
      </div>

      {/* ── 2. DANH SÁCH THẺ TÀI LIỆU ── */}
      {items.length === 0 ? (
        <div className="bg-white p-8 rounded-xl border border-slate-200 text-center text-slate-400 shadow-2xs space-y-2">
          <FileText className="w-8 h-8 mx-auto text-slate-300" />
          <p className="text-xs font-medium">Không tìm thấy tệp tài liệu nào phù hợp.</p>
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
            const isMenuOpen = activeMenuId === item.id;
            const fname = (item.ten_file || '').toLowerCase();
            const isPdf = fname.endsWith('.pdf') || item.loai_file === 'pdf';
            const isWord = fname.endsWith('.docx') || fname.endsWith('.doc') || item.loai_file === 'docx';
            const donViName = findDonViName(item);

            return (
              <div
                key={item.id}
                className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs space-y-2.5 transition"
              >
                {/* Hàng 1: STT, Số hiệu / Thể loại & Menu ba chấm */}
                <div className="flex items-start justify-between gap-2 relative">
                  <div className="flex items-start gap-2 min-w-0">
                    <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-mono text-[10.5px] font-bold shrink-0 mt-0.5">
                      {idx + 1}
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {item.so_van_ban && (
                          <span className="font-mono text-xs font-bold text-[#133863] bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                            {item.so_van_ban}
                          </span>
                        )}
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                          {item.the_loai_van_ban || (isPdf ? 'Văn bản PDF' : isWord ? 'Văn bản Word' : 'Tài liệu')}
                        </span>
                      </div>
                      <div className="text-xs font-semibold text-slate-900 leading-snug mt-1 line-clamp-2">
                        {item.trich_yeu || item.ten_file}
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
                          <span>Xem chi tiết / Đọc</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setActiveMenuId(null);
                            onDownload(item);
                          }}
                          className="w-full min-h-[44px] px-3.5 py-2 text-left text-xs text-slate-700 hover:bg-slate-50 flex items-center space-x-2 cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Tải tệp xuống</span>
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
                            <span>Gỡ khỏi kho dữ liệu</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Hàng 2: Địa bàn & Người ký */}
                <div className="space-y-1 text-xs text-slate-600 bg-slate-50/70 p-2.5 rounded-lg border border-slate-100">
                  <div className="flex items-center gap-1.5 text-slate-700">
                    <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>Địa bàn:</span>
                    <strong className="text-slate-800">{donViName}</strong>
                  </div>

                  {item.nguoi_ky && (
                    <div className="flex items-center gap-1.5 text-slate-700">
                      <UserIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>Người ký:</span>
                      <span className="text-slate-800 font-medium">{item.nguoi_ky}</span>
                    </div>
                  )}

                  {item.ngay_ban_hanh && (
                    <div className="flex items-center gap-1.5 text-slate-700">
                      <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>Ngày ban hành:</span>
                      <span className="text-slate-800 font-medium">{item.ngay_ban_hanh}</span>
                    </div>
                  )}
                </div>

                {/* Hàng 3: Nút xem tài liệu & Tải về */}
                <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => onViewDetail(item)}
                    className="flex-1 min-h-[44px] px-3 py-2 bg-sky-50 hover:bg-sky-100 text-sky-700 font-bold text-xs rounded-lg border border-sky-200 flex items-center justify-center space-x-1.5 transition cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5 text-sky-600" />
                    <span>Xem văn bản</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onDownload(item)}
                    className="min-h-[44px] px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-lg border border-slate-200 flex items-center justify-center space-x-1 cursor-pointer"
                    title="Tải tệp"
                  >
                    <Download className="w-3.5 h-3.5 text-slate-600" />
                    <span>Tải về</span>
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
                <Filter className="w-4 h-4 text-[#133863]" />
                <h3 className="text-sm font-bold text-slate-800">Bộ lọc kho dữ liệu</h3>
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
                className="flex-1 min-h-[44px] px-3 py-2 text-xs font-bold text-white bg-[#133863] hover:bg-blue-900 rounded-lg shadow-xs flex items-center justify-center cursor-pointer"
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
