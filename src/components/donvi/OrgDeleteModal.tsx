import React, { useState } from 'react';
import type { DonVi } from '../../types';
import { AlertTriangle, Trash2, X, Building2, ShieldAlert } from 'lucide-react';

interface OrgDeleteModalProps {
  isOpen: boolean;
  unit: DonVi | null;
  allUnits: DonVi[];
  onClose: () => void;
  onConfirm: (unitId: string) => Promise<void>;
}

export const OrgDeleteModal: React.FC<OrgDeleteModalProps> = ({
  isOpen,
  unit,
  allUnits,
  onClose,
  onConfirm,
}) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen || !unit) return null;

  // Kiểm tra xem đơn vị này có tổ chức con trực thuộc đang hoạt động hay không
  const activeChildren = allUnits.filter(
    (u) => u.don_vi_cha_id === unit.id && !u.deleted_at
  );
  const hasChildren = activeChildren.length > 0;

  const handleDelete = async () => {
    if (hasChildren) {
      setErrorMsg(
        `Không thể xóa tổ chức này vì đang có ${activeChildren.length} tổ chức trực thuộc cấp dưới. Vui lòng chuyển hoặc xóa các đơn vị trực thuộc trước.`
      );
      return;
    }

    setIsDeleting(true);
    setErrorMsg(null);
    try {
      await onConfirm(unit.id);
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Có lỗi xảy ra khi xóa tổ chức.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-gradient-to-r from-rose-700 to-red-800 px-6 py-4 text-white flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-white shadow-inner">
              <Trash2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-wide">
                XÓA TỔ CHỨC ĐẢNG
              </h3>
              <p className="text-xs text-rose-100/80">Xác nhận gỡ bỏ tổ chức khỏi cơ cấu</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isDeleting}
            className="p-1.5 text-rose-200 hover:text-white hover:bg-white/10 rounded-lg transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start space-x-2 text-xs text-rose-700 font-medium">
              <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Hộp thông tin tổ chức cần xóa */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
            <div className="flex items-center space-x-2 text-slate-900 font-bold text-sm">
              <Building2 className="w-4 h-4 text-rose-600 flex-shrink-0" />
              <span>{unit.ten}</span>
            </div>
            <div className="text-xs text-slate-500 space-y-1">
              <div>Mã định danh: <span className="font-semibold text-slate-700">{unit.ma || 'Chưa thiết lập'}</span></div>
              <div>Loại hình: <span className="font-semibold text-slate-700">{unit.loai}</span></div>
            </div>
          </div>

          {/* Cảnh báo ràng buộc */}
          {hasChildren ? (
            <div className="p-4 bg-amber-50 border border-amber-300 rounded-xl space-y-2">
              <div className="flex items-center space-x-2 text-amber-900 font-bold text-xs">
                <ShieldAlert className="w-4 h-4 text-amber-600 flex-shrink-0" />
                <span>Không thể xóa do có tổ chức trực thuộc</span>
              </div>
              <p className="text-xs text-amber-800 leading-relaxed">
                Tổ chức này hiện đang quản lý <strong>{activeChildren.length} tổ chức cấp dưới</strong>:
              </p>
              <ul className="text-xs text-amber-900 list-disc list-inside max-h-24 overflow-y-auto space-y-0.5 pl-1">
                {activeChildren.map((c) => (
                  <li key={c.id} className="truncate">{c.ten}</li>
                ))}
              </ul>
              <p className="text-[11px] text-amber-700 font-semibold mt-1">
                👉 Vui lòng chuyển cấp trên cho các đơn vị này hoặc xóa các đơn vị con trước khi xóa tổ chức cha.
              </p>
            </div>
          ) : (
            <div className="p-3.5 bg-rose-50/70 border border-rose-100 rounded-xl text-xs text-slate-600 space-y-1">
              <p className="text-rose-800 font-semibold">⚠️ Cảnh báo:</p>
              <p>
                Hành động này sẽ gỡ bỏ tổ chức <strong>"{unit.ten}"</strong> khỏi hệ thống cây cơ cấu và bảng theo dõi. Bạn có chắc chắn muốn tiếp tục?
              </p>
            </div>
          )}
        </div>

        {/* Footer Buttons */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end space-x-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-100 rounded-xl text-xs font-bold transition cursor-pointer"
          >
            Hủy bỏ
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={hasChildren || isDeleting}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition shadow-sm ${
              hasChildren || isDeleting
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                : 'bg-rose-600 hover:bg-rose-700 text-white cursor-pointer'
            }`}
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{isDeleting ? 'Đang xóa...' : 'Xác nhận xóa tổ chức'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
