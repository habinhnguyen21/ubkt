import React, { useState, useEffect } from 'react';
import type { DonVi, TrangThaiDonVi, User } from '../../types';
import { isDescendantUnit } from '../../services/donViService';
import {
  X,
  Building2,
  AlertTriangle,
  CheckCircle2,
  Info,
} from 'lucide-react';

interface OrgFormModalProps {
  isOpen: boolean;
  editingUnit: DonVi | null;
  defaultParentId: string | null;
  allUnits: DonVi[];
  currentUser: User;
  onClose: () => void;
  onSave: (data: {
    ten: string;
    don_vi_cha_id: string | null;
    trang_thai: TrangThaiDonVi;
    ghi_chu?: string | null;
  }) => Promise<void>;
}

export const OrgFormModal: React.FC<OrgFormModalProps> = ({
  isOpen,
  editingUnit,
  defaultParentId,
  allUnits,
  currentUser,
  onClose,
  onSave,
}) => {
  const [ten, setTen] = useState('');
  const [donViChaId, setDonViChaId] = useState<string>('');
  const [trangThai, setTrangThai] = useState<TrangThaiDonVi>('DANG_HOAT_DONG');
  const [ghiChu, setGhiChu] = useState('');

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [warningMsg, setWarningMsg] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    if (editingUnit) {
      setTen(editingUnit.ten);
      setDonViChaId(editingUnit.don_vi_cha_id || '');
      setTrangThai(editingUnit.trang_thai || 'DANG_HOAT_DONG');
      setGhiChu(editingUnit.ghi_chu || '');
    } else {
      setTen('');
      setDonViChaId(defaultParentId || '');
      setTrangThai('DANG_HOAT_DONG');
      setGhiChu('');
    }
    setErrorMsg(null);
    setWarningMsg(null);
  }, [isOpen, editingUnit, defaultParentId]);

  // Cảnh báo khi tên tổ chức có khả năng trùng
  const handleTenChange = (val: string) => {
    setTen(val);
    if (!val.trim()) {
      setWarningMsg(null);
      return;
    }
    const duplicate = allUnits.find(
      (u) =>
        (!editingUnit || u.id !== editingUnit.id) &&
        u.ten.trim().toLowerCase() === val.trim().toLowerCase() &&
        !u.deleted_at,
    );
    if (duplicate) {
      setWarningMsg(
        `Chú ý: Đã có tổ chức mang tên "${duplicate.ten}". Vui lòng kiểm tra lại nếu không muốn trùng lặp.`,
      );
    } else {
      setWarningMsg(null);
    }
  };

  // Lọc tổ chức cấp trên hợp lệ (loại trừ chính nó và các con cháu)
  const validParentOptions = allUnits.filter((u) => {
    if (u.deleted_at) return false;
    if (!editingUnit) return true;
    if (u.id === editingUnit.id) return false;
    if (isDescendantUnit(allUnits, editingUnit.id, u.id)) return false;
    return true;
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanTen = ten.trim();
    if (!cleanTen) {
      setErrorMsg('Vui lòng nhập tên tổ chức');
      return;
    }

    // Kiểm tra vòng lặp nếu thay đổi cấp trên
    if (editingUnit && donViChaId) {
      if (donViChaId === editingUnit.id) {
        setErrorMsg('Tổ chức không thể tự nhận chính mình làm cấp trên trực tiếp.');
        return;
      }
      if (isDescendantUnit(allUnits, editingUnit.id, donViChaId)) {
        setErrorMsg('Không thể chuyển tổ chức vào một nhánh cấp dưới của chính nó (gây vòng lặp).');
        return;
      }
    }

    setIsSaving(true);
    try {
      await onSave({
        ten: cleanTen,
        don_vi_cha_id: donViChaId ? donViChaId : null,
        trang_thai: trangThai,
        ghi_chu: ghiChu.trim() ? ghiChu.trim() : null,
      });
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Có lỗi xảy ra khi lưu thông tin tổ chức');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 px-6 py-4 text-white flex items-center justify-between border-b border-blue-900/50">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/80 flex items-center justify-center text-white font-bold shadow-md">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-wide">
                {editingUnit ? 'CHỈNH SỬA TỔ CHỨC ĐẢNG' : 'THÊM MỚI TỔ CHỨC ĐẢNG'}
              </h3>
              <p className="text-xs text-blue-200/80">
                {editingUnit
                  ? 'Cập nhật tên, quan hệ phân cấp và trạng thái hoạt động'
                  : 'Khai báo thông tin tổ chức, đơn vị trực thuộc mới vào hệ thống'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="px-2.5 py-1 text-xs font-semibold text-blue-200 hover:text-white hover:bg-white/10 rounded-lg transition cursor-pointer flex items-center space-x-1"
          >
            <X className="w-4 h-4" />
            <span>Thoát</span>
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {errorMsg && (
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs font-semibold text-red-700 flex items-start space-x-2.5">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {warningMsg && (
            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-start space-x-2.5">
              <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>{warningMsg}</span>
            </div>
          )}

          {/* NHÓM 1: THÔNG TIN TỔ CHỨC */}
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Tên tổ chức <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                required
                value={ten}
                onChange={(e) => handleTenChange(e.target.value)}
                placeholder="Ví dụ: Chi bộ Quân sự, Chi bộ Công an, Chi bộ Khu dân cư số 1..."
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Tổ chức cấp trên trực tiếp
              </label>
              <select
                value={donViChaId}
                onChange={(e) => setDonViChaId(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 font-medium"
              >
                <option value="">-- Là tổ chức cấp cao nhất (Gốc) --</option>
                {validParentOptions.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.ten}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Trạng thái hoạt động
              </label>
              <select
                value={trangThai}
                onChange={(e) => setTrangThai(e.target.value as TrangThaiDonVi)}
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 font-medium"
              >
                <option value="DANG_HOAT_DONG">Đang hoạt động</option>
                <option value="TAM_NGUNG">Tạm ngừng hoạt động</option>
                <option value="CHAM_DUT">Đã chấm dứt hoạt động</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Ghi chú chức năng / địa bàn
              </label>
              <textarea
                rows={3}
                value={ghiChu}
                onChange={(e) => setGhiChu(e.target.value)}
                placeholder="Ghi chú thêm về địa bàn, nhiệm vụ hoặc quy mô của tổ chức..."
                className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
          </div>

          {/* NHÓM 2: THÔNG TIN HỆ THỐNG */}
          <div className="pt-3 border-t border-slate-200">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl grid grid-cols-2 gap-3 text-xs text-slate-600">
              <div>
                <span className="font-medium text-slate-500">Người thực hiện:</span>
                <p className="font-semibold text-slate-800 mt-0.5">
                  {currentUser.ho_ten} (@{currentUser.ten_dang_nhap})
                </p>
              </div>

              {editingUnit && editingUnit.created_at && (
                <div>
                  <span className="font-medium text-slate-500">Ngày tạo:</span>
                  <p className="font-semibold text-slate-800 mt-0.5">
                    {new Date(editingUnit.created_at).toLocaleDateString('vi-VN')}
                  </p>
                </div>
              )}
            </div>
          </div>
        </form>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end space-x-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-slate-300 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
          >
            Hủy bỏ / Thoát
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSaving}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold shadow-md hover:shadow-lg transition cursor-pointer flex items-center space-x-1.5 disabled:opacity-50"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{isSaving ? 'Đang lưu...' : editingUnit ? 'Lưu cập nhật' : 'Tạo tổ chức'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
