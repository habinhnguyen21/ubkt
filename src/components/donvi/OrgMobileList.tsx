import React, { useState, useEffect } from 'react';
import {
  MoreVertical,
  Eye,
  Plus,
  Edit2,
  ArrowRightLeft,
  Power,
  Trash2,
  Layers,
} from 'lucide-react';
import type { DonVi } from '../../types';

export interface OrgMobileListProps {
  units: DonVi[];
  allUnits: DonVi[];
  canEdit: boolean;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onViewUnit: (unit: DonVi) => void;
  onEditUnit: (unit: DonVi) => void;
  onAddChild: (unit: DonVi) => void;
  onChangeParent: (unit: DonVi) => void;
  onToggleStatus: (unit: DonVi) => void;
  onDeleteUnit?: (unit: DonVi) => void;
}

export const OrgMobileList: React.FC<OrgMobileListProps> = ({
  units,
  allUnits,
  canEdit,
  selectedIds,
  onToggleSelect,
  onViewUnit,
  onEditUnit,
  onAddChild,
  onChangeParent,
  onToggleStatus,
  onDeleteUnit,
}) => {
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  useEffect(() => {
    if (!activeMenuId) return;
    const handleOutside = () => setActiveMenuId(null);
    window.addEventListener('click', handleOutside);
    return () => window.removeEventListener('click', handleOutside);
  }, [activeMenuId]);

  const findParentName = (parentId?: string | null) => {
    if (!parentId) return 'Không có (Cấp cao nhất)';
    const p = allUnits.find((u) => u.id === parentId);
    return p ? p.ten : '--';
  };

  const renderStatusTag = (status?: string) => {
    if (status === 'TAM_NGUNG') {
      return (
        <span className="px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-amber-50 text-amber-700 border border-amber-200 inline-flex items-center space-x-1">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
          <span>Tạm ngừng</span>
        </span>
      );
    }
    if (status === 'CHAM_DUT') {
      return (
        <span className="px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-rose-50 text-rose-700 border border-rose-200 inline-flex items-center space-x-1">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
          <span>Đã chấm dứt</span>
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 inline-flex items-center space-x-1">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
        <span>Đang hoạt động</span>
      </span>
    );
  };

  if (units.length === 0) {
    return (
      <div className="p-8 text-center text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
        Không tìm thấy tổ chức nào
      </div>
    );
  }

  return (
    <div className="space-y-3 font-sans">
      {units.map((unit) => {
        const isMenuOpen = activeMenuId === unit.id;
        const isSelected = selectedIds.has(unit.id);
        const parentName = findParentName(unit.don_vi_cha_id);

        return (
          <div
            key={unit.id}
            className={`p-3.5 rounded-xl border shadow-2xs space-y-2.5 transition ${
              isSelected ? 'bg-blue-50/40 border-blue-300' : 'bg-white border-slate-200'
            }`}
          >
            {/* Hàng 1: Checkbox, Tên tổ chức & Menu ba chấm */}
            <div className="flex items-start justify-between gap-2 relative">
              <div className="flex items-start gap-2.5 min-w-0">
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => onToggleSelect(unit.id)}
                  className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer mt-0.5 shrink-0"
                />
                <div className="min-w-0">
                  <div className="text-xs font-bold text-slate-900 leading-snug">
                    {unit.ten}
                  </div>
                  {unit.ma && (
                    <div className="text-[11px] font-mono text-slate-500">
                      Mã: <span className="font-semibold text-slate-700">{unit.ma}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="relative shrink-0">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveMenuId(isMenuOpen ? null : unit.id);
                  }}
                  className="w-11 h-11 flex items-center justify-center text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition cursor-pointer"
                  aria-label="Thao tác"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>

                {isMenuOpen && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="absolute right-0 top-10 z-50 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 w-48 animate-in fade-in zoom-in-95 duration-150"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setActiveMenuId(null);
                        onViewUnit(unit);
                      }}
                      className="w-full min-h-[44px] px-3.5 py-2 text-left text-xs text-slate-700 hover:bg-slate-50 flex items-center space-x-2 cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5 text-blue-600" />
                      <span>Xem thông tin</span>
                    </button>

                    {canEdit && (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setActiveMenuId(null);
                            onAddChild(unit);
                          }}
                          className="w-full min-h-[44px] px-3.5 py-2 text-left text-xs text-emerald-700 hover:bg-emerald-50 flex items-center space-x-2 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Thêm cấp dưới</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setActiveMenuId(null);
                            onEditUnit(unit);
                          }}
                          className="w-full min-h-[44px] px-3.5 py-2 text-left text-xs text-slate-700 hover:bg-slate-50 flex items-center space-x-2 cursor-pointer"
                        >
                          <Edit2 className="w-3.5 h-3.5 text-slate-600" />
                          <span>Sửa thông tin</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setActiveMenuId(null);
                            onChangeParent(unit);
                          }}
                          className="w-full min-h-[44px] px-3.5 py-2 text-left text-xs text-indigo-700 hover:bg-indigo-50 flex items-center space-x-2 cursor-pointer"
                        >
                          <ArrowRightLeft className="w-3.5 h-3.5 text-indigo-600" />
                          <span>Chuyển cấp trên</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setActiveMenuId(null);
                            onToggleStatus(unit);
                          }}
                          className="w-full min-h-[44px] px-3.5 py-2 text-left text-xs text-amber-700 hover:bg-amber-50 flex items-center space-x-2 cursor-pointer"
                        >
                          <Power className="w-3.5 h-3.5 text-amber-600" />
                          <span>Đổi trạng thái</span>
                        </button>

                        {onDeleteUnit && (
                          <button
                            type="button"
                            onClick={() => {
                              setActiveMenuId(null);
                              onDeleteUnit(unit);
                            }}
                            className="w-full min-h-[44px] px-3.5 py-2 text-left text-xs text-rose-600 hover:bg-rose-50 flex items-center space-x-2 cursor-pointer border-t border-slate-100"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                            <span>Xóa tổ chức</span>
                          </button>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Hàng 2: Trạng thái & Cấp trên */}
            <div className="space-y-1 text-xs text-slate-600 bg-slate-50/70 p-2.5 rounded-lg border border-slate-100">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Trạng thái:</span>
                <div>{renderStatusTag(unit.trang_thai)}</div>
              </div>

              <div className="flex items-start gap-1 text-slate-700 pt-0.5">
                <Layers className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                <span className="text-slate-500">Cấp trên:</span>
                <span className="text-slate-800 font-medium truncate flex-1">{parentName}</span>
              </div>
            </div>

            {/* Hàng 3: Nút Xem chi tiết nhanh */}
            <div className="pt-1 border-t border-slate-100">
              <button
                type="button"
                onClick={() => onViewUnit(unit)}
                className="w-full min-h-[44px] px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs rounded-lg border border-blue-200 flex items-center justify-center space-x-1.5 transition cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5 text-blue-600" />
                <span>Xem thông tin tổ chức</span>
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};
