import React, { useState, useEffect } from 'react';
import type { DonVi, User, NhatKy } from '../../types';
import { api } from '../../services/api';
import {
  X,
  Building2,
  User as UserIcon,
  Clock,
  Edit2,
  Plus,
  GitBranch,
  Power,
  History,
  FolderTree,
  Layers,
  ChevronRight,
  LogOut,
} from 'lucide-react';

interface OrgDetailDrawerProps {
  unit: DonVi | null;
  allUnits: DonVi[];
  currentUser: User;
  onClose: () => void;
  onEdit: (unit: DonVi) => void;
  onAddChild: (parentUnit: DonVi) => void;
  onChangeParent: (unit: DonVi) => void;
  onToggleStatus: (unit: DonVi) => void;
  onViewHistory: (unit: DonVi) => void;
  onSelectUnit: (unit: DonVi) => void;
}

export const OrgDetailDrawer: React.FC<OrgDetailDrawerProps> = ({
  unit,
  allUnits,
  currentUser,
  onClose,
  onEdit,
  onAddChild,
  onChangeParent,
  onToggleStatus,
  onViewHistory,
  onSelectUnit,
}) => {
  const [relations, setRelations] = useState<{
    chuongTrinhCount: number;
    donThuCount: number;
    childrenCount: number;
    history: NhatKy[];
  }>({
    chuongTrinhCount: 0,
    donThuCount: 0,
    childrenCount: 0,
    history: [],
  });
  const [loadingRelations, setLoadingRelations] = useState(false);

  // Lắng nghe phím ESC để đóng
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    if (!unit) return;
    let isMounted = true;
    setLoadingRelations(true);
    api
      .getDonViRelations(unit.id)
      .then((res) => {
        if (isMounted && res) {
          setRelations(res);
        }
      })
      .catch((err) => {
        console.warn('Lỗi tải dữ liệu liên quan đơn vị:', err);
      })
      .finally(() => {
        if (isMounted) setLoadingRelations(false);
      });

    return () => {
      isMounted = false;
    };
  }, [unit]);

  if (!unit) return null;

  const parentUnit = allUnits.find((u) => u.id === unit.don_vi_cha_id);
  const directChildren = allUnits.filter((u) => u.don_vi_cha_id === unit.id && !u.deleted_at);
  const canEdit = currentUser.vai_tro === 'ADMIN' || currentUser.vai_tro === 'BIEN_TAP';

  const renderStatusBadge = () => {
    const status = unit.trang_thai || 'DANG_HOAT_DONG';
    switch (status) {
      case 'DANG_HOAT_DONG':
        return (
          <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Đang hoạt động</span>
          </span>
        );
      case 'TAM_NGUNG':
        return (
          <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
            <span>Tạm ngừng hoạt động</span>
          </span>
        );
      case 'CHAM_DUT':
        return (
          <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <span className="w-2 h-2 rounded-full bg-rose-500"></span>
            <span>Đã chấm dứt hoạt động</span>
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 z-40 w-full max-w-lg bg-white shadow-2xl border-l border-slate-200 flex flex-col transform transition-transform duration-300 ease-in-out">
      {/* Header */}
      <div className="p-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
        <div className="flex items-center space-x-3 overflow-hidden">
          <div className="w-9 h-9 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold shrink-0 shadow-sm">
            <Building2 className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-white truncate" title={unit.ten}>
              {unit.ten}
            </h3>
            <p className="text-xs text-slate-400">
              {parentUnit ? `Trực thuộc: ${parentUnit.ten}` : 'Tổ chức cấp cao nhất (Gốc)'}
            </p>
          </div>
        </div>

        {/* NÚT ĐÓNG / THOÁT RÕ RÀNG Ở HEADER */}
        <button
          onClick={onClose}
          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg text-xs font-bold transition flex items-center space-x-1.5 border border-slate-700 cursor-pointer shadow-sm"
          title="Đóng bảng xem chi tiết (hoặc bấm phím ESC)"
        >
          <X className="w-4 h-4 text-rose-400" />
          <span>Đóng / Thoát</span>
        </button>
      </div>

      {/* Action Toolbar */}
      {canEdit && (
        <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-1 overflow-x-auto text-xs">
          <button
            onClick={() => onEdit(unit)}
            className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-md font-semibold bg-white border border-slate-200 text-slate-700 hover:text-blue-700 hover:border-blue-300 hover:bg-blue-50/50 shadow-2xs transition cursor-pointer"
          >
            <Edit2 className="w-3.5 h-3.5 text-blue-600" />
            <span>Sửa</span>
          </button>

          <button
            onClick={() => onAddChild(unit)}
            className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-md font-semibold bg-white border border-slate-200 text-slate-700 hover:text-emerald-700 hover:border-emerald-300 hover:bg-emerald-50/50 shadow-2xs transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 text-emerald-600" />
            <span>Thêm cấp dưới</span>
          </button>

          <button
            onClick={() => onChangeParent(unit)}
            className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-md font-semibold bg-white border border-slate-200 text-slate-700 hover:text-indigo-700 hover:border-indigo-300 hover:bg-indigo-50/50 shadow-2xs transition cursor-pointer"
          >
            <GitBranch className="w-3.5 h-3.5 text-indigo-600" />
            <span>Đổi cấp trên</span>
          </button>

          <button
            onClick={() => onToggleStatus(unit)}
            className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-md font-semibold bg-white border border-slate-200 text-slate-700 hover:text-amber-700 hover:border-amber-300 hover:bg-amber-50/50 shadow-2xs transition cursor-pointer"
          >
            <Power className="w-3.5 h-3.5 text-amber-600" />
            <span>Đổi trạng thái</span>
          </button>

          <button
            onClick={() => onViewHistory(unit)}
            className="inline-flex items-center space-x-1 px-2 py-1.5 rounded-md font-semibold bg-white border border-slate-200 text-slate-600 hover:text-slate-900 shadow-2xs transition cursor-pointer"
            title="Lịch sử thay đổi"
          >
            <History className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-5 space-y-6">
        {/* Trạng thái hoạt động */}
        <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-200">
          <div>
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
              Trạng thái hoạt động
            </div>
            {renderStatusBadge()}
          </div>

          {canEdit && (
            <button
              onClick={() => onToggleStatus(unit)}
              className="text-xs font-semibold text-blue-600 hover:text-blue-800 underline"
            >
              Chuyển trạng thái
            </button>
          )}
        </div>

        {/* Thống kê liên kết phân hệ */}
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-2.5 flex items-center space-x-1.5">
            <Layers className="w-4 h-4 text-blue-600" />
            <span>Dữ liệu nghiệp vụ liên kết</span>
          </h4>
          <div className="grid grid-cols-3 gap-2.5">
            <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-100 text-center">
              <p className="text-lg font-bold text-blue-700">
                {loadingRelations ? '...' : relations.chuongTrinhCount}
              </p>
              <p className="text-[11px] text-blue-900/80 font-medium">Cuộc KT-GS</p>
            </div>
            <div className="p-3 bg-purple-50/50 rounded-xl border border-purple-100 text-center">
              <p className="text-lg font-bold text-purple-700">
                {loadingRelations ? '...' : relations.donThuCount}
              </p>
              <p className="text-[11px] text-purple-900/80 font-medium">Đơn thư</p>
            </div>
            <div className="p-3 bg-emerald-50/50 rounded-xl border border-emerald-100 text-center">
              <p className="text-lg font-bold text-emerald-700">
                {directChildren.length}
              </p>
              <p className="text-[11px] text-emerald-900/80 font-medium">Trực thuộc</p>
            </div>
          </div>
        </div>

        {/* Thông tin cơ bản */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center space-x-1.5">
            <Building2 className="w-4 h-4 text-blue-600" />
            <span>Thông tin tổ chức</span>
          </h4>

          <div className="divide-y divide-slate-100 text-xs rounded-xl border border-slate-200 overflow-hidden bg-white">
            <div className="p-3 flex justify-between items-start gap-4">
              <span className="text-slate-500 font-medium shrink-0">Tên tổ chức:</span>
              <span className="font-bold text-slate-900 text-right">{unit.ten}</span>
            </div>

            <div className="p-3 flex justify-between items-center gap-4">
              <span className="text-slate-500 font-medium shrink-0">Tổ chức cấp trên:</span>
              {parentUnit ? (
                <button
                  type="button"
                  onClick={() => onSelectUnit(parentUnit)}
                  className="font-semibold text-blue-600 hover:text-blue-800 hover:underline text-right flex items-center space-x-1"
                >
                  <span>{parentUnit.ten}</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              ) : (
                <span className="text-slate-400 italic">-- Cấp cao nhất (Gốc) --</span>
              )}
            </div>

            <div className="p-3 flex justify-between items-center gap-4">
              <span className="text-slate-500 font-medium shrink-0">Thứ tự hiển thị:</span>
              <span className="font-mono font-bold text-slate-700">#{unit.thu_tu}</span>
            </div>

            <div className="p-3">
              <span className="text-slate-500 font-medium block mb-1">Ghi chú / Địa bàn:</span>
              <p className="text-slate-800 leading-relaxed italic bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                {unit.ghi_chu || 'Không có ghi chú.'}
              </p>
            </div>
          </div>
        </div>

        {/* Danh sách tổ chức trực thuộc */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center space-x-1.5">
              <FolderTree className="w-4 h-4 text-emerald-600" />
              <span>Tổ chức trực thuộc ({directChildren.length})</span>
            </h4>
            {canEdit && (
              <button
                onClick={() => onAddChild(unit)}
                className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 hover:underline flex items-center space-x-1"
              >
                <Plus className="w-3 h-3" />
                <span>Thêm trực thuộc</span>
              </button>
            )}
          </div>

          {directChildren.length === 0 ? (
            <div className="p-4 rounded-xl border border-dashed border-slate-200 text-center text-slate-400 text-xs">
              Chưa có đơn vị trực thuộc nào
            </div>
          ) : (
            <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl bg-white overflow-hidden max-h-48 overflow-y-auto">
              {directChildren.map((child) => (
                <div
                  key={child.id}
                  onClick={() => onSelectUnit(child)}
                  className="p-2.5 hover:bg-slate-50 flex items-center justify-between transition cursor-pointer group"
                >
                  <div className="flex items-center space-x-2 min-w-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400 group-hover:bg-blue-600 transition"></span>
                    <span className="text-xs font-medium text-slate-800 group-hover:text-blue-700 truncate">
                      {child.ten}
                    </span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-blue-600" />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Thông tin hệ thống / Kiểm toán */}
        <div className="space-y-2.5">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center space-x-1.5">
            <Clock className="w-4 h-4 text-slate-500" />
            <span>Thông tin hệ thống</span>
          </h4>

          <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200 space-y-2 text-[11px] text-slate-600">
            <div className="flex justify-between items-center">
              <span className="flex items-center space-x-1">
                <UserIcon className="w-3 h-3 text-slate-400" />
                <span>Người tạo:</span>
              </span>
              <span className="font-semibold text-slate-800">
                {unit.nguoi_tao_ten || 'Hệ thống'}
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="flex items-center space-x-1">
                <Clock className="w-3 h-3 text-slate-400" />
                <span>Thời gian tạo:</span>
              </span>
              <span className="font-mono text-slate-700">
                {unit.created_at ? new Date(unit.created_at).toLocaleString('vi-VN') : 'Ban đầu'}
              </span>
            </div>

            {unit.nguoi_cap_nhat_ten && (
              <div className="flex justify-between items-center pt-1 border-t border-slate-200/60">
                <span className="flex items-center space-x-1">
                  <UserIcon className="w-3 h-3 text-slate-400" />
                  <span>Cập nhật gần nhất:</span>
                </span>
                <span className="font-semibold text-slate-800">{unit.nguoi_cap_nhat_ten}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* FOOTER: NÚT THOÁT / ĐÓNG RÕ RÀNG */}
      <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
        <span className="text-xs text-slate-500">
          Phím tắt: nhấn <strong>ESC</strong> để đóng
        </span>
        <button
          type="button"
          onClick={onClose}
          className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition cursor-pointer flex items-center space-x-1.5 shadow-sm"
        >
          <LogOut className="w-4 h-4 text-rose-400" />
          <span>Đóng / Thoát</span>
        </button>
      </div>
    </div>
  );
};
