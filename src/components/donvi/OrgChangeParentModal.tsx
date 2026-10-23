import React, { useState } from 'react';
import type { DonVi, User } from '../../types';
import { isDescendantUnit } from '../../services/donViService';
import {
  X,
  GitBranch,
  Building2,
  AlertTriangle,
  CheckCircle2,
  Info,
} from 'lucide-react';

interface OrgChangeParentModalProps {
  isOpen: boolean;
  unit: DonVi | null;
  allUnits: DonVi[];
  currentUser: User;
  onClose: () => void;
  onConfirm: (unitId: string, newParentId: string | null, lyDo: string) => Promise<void>;
}

export const OrgChangeParentModal: React.FC<OrgChangeParentModalProps> = ({
  isOpen,
  unit,
  allUnits,
  currentUser: _currentUser,
  onClose,
  onConfirm,
}) => {
  const [selectedParentId, setSelectedParentId] = useState<string>('');
  const [lyDo, setLyDo] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  React.useEffect(() => {
    if (unit && isOpen) {
      setSelectedParentId(unit.don_vi_cha_id || '');
      setLyDo('');
      setErrorMsg(null);
    }
  }, [unit, isOpen]);

  if (!isOpen || !unit) return null;

  const currentParent = allUnits.find((u) => u.id === unit.don_vi_cha_id);
  const directChildren = allUnits.filter((u) => u.don_vi_cha_id === unit.id && !u.deleted_at);

  // Danh sách tổ chức có thể làm cấp trên hợp lệ (loại trừ chính nó và các con cháu)
  const validParentOptions = allUnits.filter((u) => {
    if (u.deleted_at) return false;
    if (u.id === unit.id) return false;
    if (isDescendantUnit(allUnits, unit.id, u.id)) return false;
    return true;
  });

  const selectedNewParent = allUnits.find((u) => u.id === selectedParentId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const newParentId = selectedParentId ? selectedParentId : null;

    if (newParentId === unit.don_vi_cha_id) {
      setErrorMsg('Tổ chức cấp trên mới phải khác với cấp trên hiện tại.');
      return;
    }

    if (newParentId === unit.id) {
      setErrorMsg('Tổ chức không thể tự nhận chính mình làm cấp trên.');
      return;
    }

    if (newParentId && isDescendantUnit(allUnits, unit.id, newParentId)) {
      setErrorMsg('Không thể chuyển vào một tổ chức con cháu trực thuộc (gây lỗi vòng lặp cây).');
      return;
    }

    if (!lyDo.trim()) {
      setErrorMsg('Vui lòng ghi rõ căn cứ / lý do điều chuyển quan hệ trực thuộc.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onConfirm(unit.id, newParentId, lyDo.trim());
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Có lỗi khi điều chuyển cấp trên');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-900 to-slate-900 px-6 py-4 text-white flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/80 flex items-center justify-center text-white font-bold shadow-md">
              <GitBranch className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-wide">
                ĐIỀU CHUYỂN CẤP TRÊN TRỰC TIẾP
              </h3>
              <p className="text-xs text-indigo-200/80">Thay đổi quan hệ phân cấp tổ chức</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-indigo-200 hover:text-white hover:bg-white/10 rounded-lg transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {errorMsg && (
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs font-semibold text-red-700 flex items-start space-x-2.5">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Unit being moved */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
              Tổ chức được điều chuyển:
            </span>
            <div className="flex items-center space-x-2">
              <Building2 className="w-4 h-4 text-indigo-600 shrink-0" />
              <span className="font-bold text-slate-900 text-sm">{unit.ten}</span>
            </div>
          </div>

          {/* Transition Visualizer */}
          <div className="grid grid-cols-2 gap-3 items-center p-3.5 bg-indigo-50/50 border border-indigo-100 rounded-xl">
            <div>
              <span className="text-[10px] font-bold uppercase text-slate-500 block mb-0.5">
                Cấp trên hiện tại:
              </span>
              <p className="text-xs font-semibold text-slate-700 truncate">
                {currentParent ? currentParent.ten : '-- Cấp cao nhất (Gốc) --'}
              </p>
            </div>

            <div className="border-l border-indigo-200 pl-3">
              <span className="text-[10px] font-bold uppercase text-indigo-700 block mb-0.5">
                Cấp trên mới:
              </span>
              <p className="text-xs font-bold text-indigo-900 truncate">
                {selectedNewParent ? selectedNewParent.ten : '-- Cấp cao nhất (Gốc) --'}
              </p>
            </div>
          </div>

          {/* Warning about subordinates */}
          {directChildren.length > 0 && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-start space-x-2">
              <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong>Lưu ý:</strong> Tổ chức này có{' '}
                <strong>{directChildren.length} đơn vị trực thuộc</strong>. Toàn bộ các đơn vị
                con sẽ đi theo tổ chức này về vị trí mới trong cây phân cấp.
              </div>
            </div>
          )}

          {/* Select new parent */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Chọn tổ chức cấp trên mới <span className="text-red-600">*</span>
            </label>
            <select
              value={selectedParentId}
              onChange={(e) => setSelectedParentId(e.target.value)}
              className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-600"
            >
              <option value="">-- Chuyển thành Cấp cao nhất (Gốc) --</option>
              {validParentOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.ten}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-slate-500 mt-1">
              Hệ thống đã tự động loại bỏ chính tổ chức này và các nhánh con của nó khỏi danh sách
              để tránh lỗi vòng lặp.
            </p>
          </div>

          {/* Reason input */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Căn cứ / Lý do điều chuyển <span className="text-red-600">*</span>
            </label>
            <textarea
              rows={3}
              required
              value={lyDo}
              onChange={(e) => setLyDo(e.target.value)}
              placeholder="VD: Căn cứ Quyết định số 25-QĐ/TU về sáp nhập / sắp xếp lại mô hình tổ chức..."
              className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600"
            />
          </div>

          {/* Footer buttons */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-md hover:shadow-lg transition cursor-pointer flex items-center space-x-1.5 disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isSubmitting ? 'Đang điều chuyển...' : 'Xác nhận điều chuyển'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
