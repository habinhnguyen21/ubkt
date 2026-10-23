import React, { useState } from 'react';
import type { LoaiHinhToChuc, DonVi } from '../../types';
import {
  X,
  Layers,
  Plus,
  Edit2,
  Power,
  CheckCircle2,
} from 'lucide-react';

interface OrgTypeManagerModalProps {
  isOpen: boolean;
  loaiHinhList: LoaiHinhToChuc[];
  allUnits: DonVi[];
  onClose: () => void;
  onSaveTypes: (newTypes: LoaiHinhToChuc[]) => void;
}

export const OrgTypeManagerModal: React.FC<OrgTypeManagerModalProps> = ({
  isOpen,
  loaiHinhList,
  allUnits,
  onClose,
  onSaveTypes,
}) => {
  const [types, setTypes] = useState<LoaiHinhToChuc[]>(loaiHinhList);
  const [editingItem, setEditingItem] = useState<LoaiHinhToChuc | null>(null);

  // Form states
  const [ma, setMa] = useState('');
  const [ten, setTen] = useState('');
  const [moTa, setMoTa] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleOpenAdd = () => {
    setEditingItem(null);
    setMa('');
    setTen('');
    setMoTa('');
    setErrorMsg(null);
  };

  const handleOpenEdit = (item: LoaiHinhToChuc) => {
    setEditingItem(item);
    setMa(item.ma);
    setTen(item.ten);
    setMoTa(item.mo_ta || '');
    setErrorMsg(null);
  };

  const handleSaveItem = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanMa = ma.trim().toUpperCase();
    const cleanTen = ten.trim();

    if (!cleanMa || !cleanTen) {
      setErrorMsg('Vui lòng điền đầy đủ Mã và Tên loại hình tổ chức');
      return;
    }

    if (!editingItem) {
      // Check duplicate
      if (types.some((t) => t.ma === cleanMa)) {
        setErrorMsg(`Mã loại hình "${cleanMa}" đã tồn tại.`);
        return;
      }

      const newItem: LoaiHinhToChuc = {
        ma: cleanMa,
        ten: cleanTen,
        mo_ta: moTa.trim() || undefined,
        is_active: true,
        thu_tu: types.length + 1,
      };

      const updated = [...types, newItem];
      setTypes(updated);
      onSaveTypes(updated);
      handleOpenAdd();
    } else {
      const updated = types.map((t) => {
        if (t.ma === editingItem.ma) {
          return {
            ...t,
            ten: cleanTen,
            mo_ta: moTa.trim() || undefined,
          };
        }
        return t;
      });
      setTypes(updated);
      onSaveTypes(updated);
      setEditingItem(null);
      setMa('');
      setTen('');
      setMoTa('');
    }
  };

  const handleToggleActive = (item: LoaiHinhToChuc) => {
    const usingUnitsCount = allUnits.filter((u) => u.loai === item.ma && !u.deleted_at).length;
    if (item.is_active && usingUnitsCount > 0) {
      if (
        !window.confirm(
          `Cảnh báo: Hiện đang có ${usingUnitsCount} tổ chức đang sử dụng loại hình "${item.ten}". Bạn có chắc chắn muốn tạm ngừng sử dụng loại hình này? (Các tổ chức đã tạo vẫn giữ nguyên dữ liệu)`,
        )
      ) {
        return;
      }
    }

    const updated = types.map((t) => (t.ma === item.ma ? { ...t, is_active: !t.is_active } : t));
    setTypes(updated);
    onSaveTypes(updated);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden my-6 flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-900 to-slate-900 px-6 py-4 text-white flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/80 flex items-center justify-center text-white font-bold shadow-md">
              <Layers className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-wide">
                QUẢN LÝ DANH MỤC LOẠI HÌNH TỔ CHỨC
              </h3>
              <p className="text-xs text-blue-200/80">
                Cấu hình danh mục loại hình tổ chức độc lập với cấu trúc phân cấp
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-blue-200 hover:text-white hover:bg-white/10 rounded-lg transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Add / Edit Form */}
          <form
            onSubmit={handleSaveItem}
            className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3"
          >
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center space-x-1.5">
                <Plus className="w-3.5 h-3.5 text-blue-600" />
                <span>
                  {editingItem ? `Chỉnh sửa loại hình: ${editingItem.ma}` : 'Thêm loại hình mới'}
                </span>
              </h4>
              {editingItem && (
                <button
                  type="button"
                  onClick={handleOpenAdd}
                  className="text-xs text-slate-500 hover:text-slate-800 underline"
                >
                  Hủy chỉnh sửa
                </button>
              )}
            </div>

            {errorMsg && (
              <div className="p-2.5 bg-red-50 border border-red-200 text-xs font-medium text-red-700 rounded-lg">
                {errorMsg}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Mã loại hình <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  disabled={Boolean(editingItem)}
                  value={ma}
                  onChange={(e) => setMa(e.target.value.toUpperCase())}
                  placeholder="VD: DANG_BO_BP"
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-900 uppercase focus:outline-none focus:ring-2 focus:ring-blue-600 disabled:bg-slate-100"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Tên loại hình <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={ten}
                  onChange={(e) => setTen(e.target.value)}
                  placeholder="VD: Đảng bộ bộ phận"
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Mô tả / Ghi chú
                </label>
                <input
                  type="text"
                  value={moTa}
                  onChange={(e) => setMoTa(e.target.value)}
                  placeholder="Mô tả chức năng..."
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-2xs transition cursor-pointer flex items-center space-x-1"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{editingItem ? 'Lưu thay đổi' : 'Thêm vào danh mục'}</span>
              </button>
            </div>
          </form>

          {/* List of Organization Types */}
          <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-3 w-32">Mã loại hình</th>
                  <th className="p-3">Tên loại hình</th>
                  <th className="p-3">Mô tả</th>
                  <th className="p-3 w-28 text-center">Đang dùng</th>
                  <th className="p-3 w-28 text-center">Trạng thái</th>
                  <th className="p-3 w-24 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {types.map((item) => {
                  const usageCount = allUnits.filter(
                    (u) => u.loai === item.ma && !u.deleted_at,
                  ).length;
                  return (
                    <tr key={item.ma} className="hover:bg-slate-50/70">
                      <td className="p-3 font-mono font-bold text-slate-800">{item.ma}</td>
                      <td className="p-3 font-semibold text-slate-900">{item.ten}</td>
                      <td className="p-3 text-slate-500 italic">{item.mo_ta || '---'}</td>
                      <td className="p-3 text-center">
                        <span className="font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                          {usageCount} đơn vị
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        {item.is_active ? (
                          <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                            Hoạt động
                          </span>
                        ) : (
                          <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                            Tạm ngừng
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end space-x-1">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(item)}
                            className="p-1 text-slate-500 hover:text-blue-700 hover:bg-blue-50 rounded transition cursor-pointer"
                            title="Sửa tên / mô tả"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleActive(item)}
                            className={`p-1 rounded transition cursor-pointer ${
                              item.is_active
                                ? 'text-amber-600 hover:text-amber-800 hover:bg-amber-50'
                                : 'text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50'
                            }`}
                            title={item.is_active ? 'Ngừng kích hoạt' : 'Kích hoạt lại'}
                          >
                            <Power className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
