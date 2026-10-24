import React, { useState } from 'react';
import type { DonVi } from '../../types';
import { AlertTriangle, Trash2, X, Building2, ShieldAlert, CheckCircle2 } from 'lucide-react';

interface OrgDeleteModalProps {
  isOpen: boolean;
  unit?: DonVi | null;
  units?: DonVi[];
  allUnits: DonVi[];
  onClose: () => void;
  onConfirm: (unitId: string) => Promise<void>;
  onConfirmBatch?: (unitIds: string[]) => Promise<void>;
}

export const OrgDeleteModal: React.FC<OrgDeleteModalProps> = ({
  isOpen,
  unit,
  units,
  allUnits,
  onClose,
  onConfirm,
  onConfirmBatch,
}) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const isBatchMode = Boolean(units && units.length > 0);
  if (!isBatchMode && !unit) return null;

  // ── XỬ LÝ CHẾ ĐỘ XÓA HÀNG LOẠT ──────────────────────────────────────────────
  if (isBatchMode && units && units.length > 0) {
    const selectedIds = new Set(units.map((u) => u.id));

    // Phân loại các đơn vị: hợp lệ xóa vs bị chặn do có con chưa chọn
    const analyzedUnits = units.map((u) => {
      const unselectedChildren = allUnits.filter(
        (child) => child.don_vi_cha_id === u.id && !child.deleted_at && !selectedIds.has(child.id),
      );
      return {
        unit: u,
        isBlocked: unselectedChildren.length > 0,
        unselectedChildren,
      };
    });

    const validUnits = analyzedUnits.filter((a) => !a.isBlocked).map((a) => a.unit);
    const blockedUnits = analyzedUnits.filter((a) => a.isBlocked);

    const handleBatchDelete = async () => {
      if (validUnits.length === 0) {
        setErrorMsg('Không có tổ chức nào đủ điều kiện xóa.');
        return;
      }

      setIsDeleting(true);
      setErrorMsg(null);
      try {
        if (onConfirmBatch) {
          await onConfirmBatch(validUnits.map((u) => u.id));
        } else {
          for (const u of validUnits) {
            await onConfirm(u.id);
          }
        }
        onClose();
      } catch (err: any) {
        setErrorMsg(err?.message || 'Có lỗi xảy ra khi xóa danh sách tổ chức.');
      } finally {
        setIsDeleting(false);
      }
    };

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
        <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
          {/* Header */}
          <div className="bg-gradient-to-r from-rose-700 to-red-800 px-6 py-4 text-white flex items-center justify-between shrink-0">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-white shadow-inner">
                <Trash2 className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white tracking-wide">
                  XÓA HÀNG LOẠT TỔ CHỨC ĐẢNG
                </h3>
                <p className="text-xs text-rose-100/80">
                  Xác nhận gỡ bỏ {units.length} tổ chức đã chọn khỏi cơ cấu
                </p>
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
          <div className="p-6 space-y-4 overflow-y-auto flex-1">
            {errorMsg && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start space-x-2 text-xs text-rose-700 font-medium">
                <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Thống kê tình trạng */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                <div className="text-[11px] font-semibold text-emerald-700">Đủ điều kiện xóa</div>
                <div className="text-lg font-bold text-emerald-900 flex items-center gap-1.5 mt-0.5">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  <span>{validUnits.length} tổ chức</span>
                </div>
              </div>

              {blockedUnits.length > 0 ? (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                  <div className="text-[11px] font-semibold text-amber-700">Bị chặn do có cấp dưới</div>
                  <div className="text-lg font-bold text-amber-900 flex items-center gap-1.5 mt-0.5">
                    <ShieldAlert className="w-5 h-5 text-amber-600" />
                    <span>{blockedUnits.length} tổ chức</span>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <div className="text-[11px] font-semibold text-slate-500">Ràng buộc phân cấp</div>
                  <div className="text-xs font-bold text-slate-700 mt-1">
                    ✓ Toàn bộ hợp lệ để xóa
                  </div>
                </div>
              )}
            </div>

            {/* Cảnh báo nếu có đơn vị bị chặn */}
            {blockedUnits.length > 0 && (
              <div className="p-3.5 bg-amber-50/90 border border-amber-300 rounded-xl text-xs space-y-1.5 text-amber-900">
                <div className="font-bold flex items-center gap-1 text-amber-800">
                  <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Một số tổ chức không thể xóa ngay:</span>
                </div>
                <p className="text-[11px] leading-relaxed text-amber-800">
                  Các tổ chức dưới đây đang quản lý cấp dưới chưa được chọn để xóa cùng. Hệ thống sẽ bỏ qua các tổ chức này và chỉ xóa những tổ chức đủ điều kiện:
                </p>
                <div className="max-h-24 overflow-y-auto space-y-1 pr-1">
                  {blockedUnits.map((b) => (
                    <div
                      key={b.unit.id}
                      className="px-2 py-1 bg-white/80 rounded border border-amber-200 text-[11px] flex items-center justify-between"
                    >
                      <span className="font-semibold text-amber-950 truncate max-w-[220px]">
                        {b.unit.ten}
                      </span>
                      <span className="text-[10px] text-amber-700">
                        {b.unselectedChildren.length} đơn vị con chưa chọn
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Danh sách tổ chức sẽ xóa */}
            <div className="space-y-1.5">
              <div className="text-xs font-bold text-slate-700 flex items-center justify-between">
                <span>Danh sách tổ chức sẽ xóa ({validUnits.length}):</span>
              </div>
              <div className="border border-slate-200 rounded-xl overflow-hidden max-h-44 overflow-y-auto divide-y divide-slate-100 bg-slate-50/50">
                {validUnits.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-400">
                    Không có tổ chức nào đủ điều kiện xóa trong nhóm đã chọn.
                  </div>
                ) : (
                  validUnits.map((u, i) => (
                    <div
                      key={u.id}
                      className="px-3 py-2 text-xs flex items-center justify-between bg-white hover:bg-slate-50"
                    >
                      <div className="flex items-center space-x-2 truncate">
                        <span className="text-slate-400 font-mono text-[11px] w-5 text-right">
                          {i + 1}.
                        </span>
                        <Building2 className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                        <span className="font-semibold text-slate-900 truncate" title={u.ten}>
                          {u.ten}
                        </span>
                      </div>
                      <span className="font-mono text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded shrink-0">
                        {u.ma || 'DU-01'}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="p-3 bg-rose-50/60 border border-rose-100 rounded-xl text-xs text-slate-600">
              <p className="text-rose-800 font-semibold mb-0.5">⚠️ Lưu ý:</p>
              <p className="text-[11px] leading-relaxed">
                Hành động này sẽ gỡ bỏ các tổ chức được xác nhận khỏi cơ cấu và nhật ký hệ thống sẽ ghi nhận người thực hiện. Bạn có chắc chắn muốn tiếp tục?
              </p>
            </div>
          </div>

          {/* Footer Buttons */}
          <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end space-x-3 shrink-0">
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
              onClick={handleBatchDelete}
              disabled={validUnits.length === 0 || isDeleting}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition shadow-sm ${
                validUnits.length === 0 || isDeleting
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  : 'bg-rose-600 hover:bg-rose-700 text-white cursor-pointer shadow-md'
              }`}
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>
                {isDeleting
                  ? 'Đang xóa...'
                  : `Xác nhận xóa ${validUnits.length} tổ chức`}
              </span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── XỬ LÝ CHẾ ĐỘ XÓA 1 ĐƠN VỊ CŨ ──────────────────────────────────────────
  if (!unit) return null;

  const activeChildren = allUnits.filter(
    (u) => u.don_vi_cha_id === unit.id && !u.deleted_at,
  );
  const hasChildren = activeChildren.length > 0;

  const handleDelete = async () => {
    if (hasChildren) {
      setErrorMsg(
        `Không thể xóa tổ chức này vì đang có ${activeChildren.length} tổ chức trực thuộc cấp dưới. Vui lòng chuyển hoặc xóa các đơn vị trực thuộc trước.`,
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
              <div>
                Mã định danh:{' '}
                <span className="font-semibold text-slate-700">{unit.ma || 'Chưa thiết lập'}</span>
              </div>
              <div>
                Loại hình: <span className="font-semibold text-slate-700">{unit.loai}</span>
              </div>
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
