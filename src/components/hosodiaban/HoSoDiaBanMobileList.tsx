import React, { useState, useEffect } from 'react';
import {
  Building2,
  Eye,
  Trash2,
  FileText,
  CheckCircle2,
  MoreVertical,
  User as UserIcon,
  HelpCircle,
  ListTodo,
} from 'lucide-react';
import type { DiaBanRecord, TrangThaiHoSoDiaBan } from '../../types';

export interface HoSoDiaBanMobileListProps {
  records: DiaBanRecord[];
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onViewRecord: (record: DiaBanRecord) => void;
  onDeleteRecord?: (record: DiaBanRecord) => void;
  canEdit?: boolean;
  renderTrangThaiBadge: (status?: TrangThaiHoSoDiaBan) => React.ReactNode;
  onOpenBaoCaoThangModal?: (record: DiaBanRecord) => void;
  onOpenVanDeModal?: (record: DiaBanRecord) => void;
  onOpenChiDaoModal?: (record: DiaBanRecord) => void;
  showCanBo?: boolean;
}

export const HoSoDiaBanMobileList: React.FC<HoSoDiaBanMobileListProps> = ({
  records,
  selectedIds,
  onToggleSelect,
  onViewRecord,
  onDeleteRecord,
  canEdit = true,
  renderTrangThaiBadge,
  onOpenBaoCaoThangModal,
  onOpenVanDeModal,
  onOpenChiDaoModal,
  showCanBo = false,
}) => {
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  useEffect(() => {
    if (!activeMenuId) return;
    const handleOutside = () => setActiveMenuId(null);
    window.addEventListener('click', handleOutside);
    return () => window.removeEventListener('click', handleOutside);
  }, [activeMenuId]);

  if (records.length === 0) {
    return (
      <div className="p-8 text-center text-slate-400 bg-white rounded-xl border border-dashed border-slate-200">
        Không có địa bàn nào
      </div>
    );
  }

  return (
    <div className="space-y-3 font-sans">
      {records.map((item) => {
        const isChecked = selectedIds.has(item.id);
        const isMenuOpen = activeMenuId === item.id;
        const vanDeCount = item.so_van_de_theo_doi ?? 0;
        const chiDaoCount = item.so_chi_dao_chua_hoan_thanh ?? 0;
        const hasBcThang = item.tinh_trang_bao_cao_thang === 'DA_NOP_DUNG_HAN' || item.tinh_trang_bao_cao_thang === 'DA_NOP_MUON';
        const canBoName = item.can_bo_phu_trach_ten || item.can_bo_phu_trach_id;

        return (
          <div
            key={item.id}
            className={`p-3.5 rounded-xl border shadow-2xs space-y-2.5 transition ${
              isChecked ? 'bg-blue-50/40 border-blue-300' : 'bg-white border-slate-200'
            }`}
          >
            {/* Hàng 1: Checkbox, Tên địa bàn & Menu ba chấm */}
            <div className="flex items-start justify-between gap-2 relative">
              <div className="flex items-start gap-2.5 min-w-0">
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => onToggleSelect(item.id)}
                  className="w-5 h-5 rounded border-slate-300 text-[#133863] focus:ring-[#133863] cursor-pointer mt-0.5 shrink-0"
                />
                <div className="min-w-0">
                  <div className="flex items-start space-x-1.5">
                    <Building2 className="w-4 h-4 text-[#133863] shrink-0 mt-0.5" />
                    <div className="text-xs font-bold text-slate-900 leading-snug">
                      {item.ten_dia_ban}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 mt-1">
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                      {item.loai_to_chuc === 'DANG_BO' ? 'ĐẢNG BỘ' : 'CHI BỘ'}
                    </span>
                    {renderTrangThaiBadge(item.trang_thai_ho_so)}
                  </div>
                </div>
              </div>

              {/* Menu 3 chấm */}
              <div className="relative shrink-0">
                <button
                  type="button"
                  aria-label="Thao tác"
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveMenuId(isMenuOpen ? null : item.id);
                  }}
                  className="w-11 h-11 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition cursor-pointer"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>

                {isMenuOpen && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="absolute right-0 top-full mt-1 w-48 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-30"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setActiveMenuId(null);
                        onViewRecord(item);
                      }}
                      className="w-full min-h-[44px] px-3.5 py-2 text-left text-xs text-slate-700 hover:bg-slate-50 flex items-center space-x-2 cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5 text-blue-600" />
                      <span>Xem chi tiết hồ sơ</span>
                    </button>

                    {onOpenBaoCaoThangModal && (
                      <button
                        type="button"
                        onClick={() => {
                          setActiveMenuId(null);
                          onOpenBaoCaoThangModal(item);
                        }}
                        className="w-full min-h-[44px] px-3.5 py-2 text-left text-xs text-slate-700 hover:bg-slate-50 flex items-center space-x-2 cursor-pointer"
                      >
                        <FileText className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Báo cáo tháng</span>
                      </button>
                    )}

                    {onOpenVanDeModal && (
                      <button
                        type="button"
                        onClick={() => {
                          setActiveMenuId(null);
                          onOpenVanDeModal(item);
                        }}
                        className="w-full min-h-[44px] px-3.5 py-2 text-left text-xs text-slate-700 hover:bg-slate-50 flex items-center space-x-2 cursor-pointer"
                      >
                        <HelpCircle className="w-3.5 h-3.5 text-amber-600" />
                        <span>Vấn đề theo dõi</span>
                      </button>
                    )}

                    {onOpenChiDaoModal && (
                      <button
                        type="button"
                        onClick={() => {
                          setActiveMenuId(null);
                          onOpenChiDaoModal(item);
                        }}
                        className="w-full min-h-[44px] px-3.5 py-2 text-left text-xs text-slate-700 hover:bg-slate-50 flex items-center space-x-2 cursor-pointer"
                      >
                        <ListTodo className="w-3.5 h-3.5 text-purple-600" />
                        <span>Chỉ đạo chưa xong</span>
                      </button>
                    )}

                    {canEdit && onDeleteRecord && (
                      <button
                        type="button"
                        onClick={() => {
                          setActiveMenuId(null);
                          onDeleteRecord(item);
                        }}
                        className="w-full min-h-[44px] px-3.5 py-2 text-left text-xs text-rose-600 hover:bg-rose-50 flex items-center space-x-2 cursor-pointer border-t border-slate-100"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                        <span>Xóa hồ sơ</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Hàng 2: Cán bộ phụ trách nếu ở chế độ flat */}
            {showCanBo && canBoName && (
              <div className="flex items-center gap-1.5 text-xs text-slate-700 bg-slate-50/70 p-2 rounded-lg border border-slate-100">
                <UserIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="text-slate-500">Phụ trách:</span>
                <strong className="text-slate-800">{canBoName}</strong>
              </div>
            )}

            {/* Hàng 3: Chỉ số theo dõi (Báo cáo tháng, Vấn đề, Chỉ đạo) */}
            <div className="grid grid-cols-3 gap-2 text-center text-xs pt-1 border-t border-slate-100">
              <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                <span className="block text-[10px] text-slate-500 font-semibold mb-0.5">Báo cáo</span>
                {hasBcThang ? (
                  <span className="inline-flex items-center gap-0.5 text-emerald-700 font-bold text-[11px]">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Đã nộp
                  </span>
                ) : (
                  <span className="text-slate-400 font-medium text-[11px]">Chưa nộp</span>
                )}
              </div>

              <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                <span className="block text-[10px] text-slate-500 font-semibold mb-0.5">Vấn đề</span>
                <span className={`font-bold text-[11px] ${vanDeCount > 0 ? 'text-amber-700' : 'text-slate-400'}`}>
                  {vanDeCount} vấn đề
                </span>
              </div>

              <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                <span className="block text-[10px] text-slate-500 font-semibold mb-0.5">Chỉ đạo</span>
                <span className={`font-bold text-[11px] ${chiDaoCount > 0 ? 'text-purple-700' : 'text-slate-400'}`}>
                  {chiDaoCount} việc
                </span>
              </div>
            </div>

            {/* Hàng 4: Nút Xem chi tiết nhanh */}
            <div className="pt-1 border-t border-slate-100">
              <button
                type="button"
                onClick={() => onViewRecord(item)}
                className="w-full min-h-[44px] px-3 py-2 bg-blue-50 hover:bg-blue-100 text-[#133863] font-bold text-xs rounded-lg border border-blue-200 flex items-center justify-center space-x-1.5 transition cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5 text-[#133863]" />
                <span>Mở hồ sơ địa bàn</span>
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};
