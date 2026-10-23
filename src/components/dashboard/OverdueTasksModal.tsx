import React from 'react';
import { X, AlertCircle, Calendar, ExternalLink } from 'lucide-react';
import type { ChuongTrinhKtGs } from '../../types';

interface OverdueTasksModalProps {
  isOpen: boolean;
  onClose: () => void;
  tasks: ChuongTrinhKtGs[];
  onNavigateToTask: (taskId: string) => void;
}

export const OverdueTasksModal: React.FC<OverdueTasksModalProps> = ({
  isOpen,
  onClose,
  tasks,
  onNavigateToTask,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[85vh]">
        {/* Modal Header */}
        <div className="p-4 bg-rose-50 border-b border-rose-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-rose-950">
                Danh sách nhiệm vụ kiểm tra, giám sát quá hạn
              </h3>
              <p className="text-xs text-rose-700">
                Có {tasks.length} nhiệm vụ đã quá thời hạn quy định cần đôn đốc giải quyết
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-rose-500 hover:text-rose-800 hover:bg-rose-100/60 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 overflow-y-auto space-y-3 flex-1">
          {tasks.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-xs">
              Hiện tại không có nhiệm vụ nào bị quá hạn.
            </div>
          ) : (
            tasks.map((task) => {
              const dueDate = task.ngay_ket_thuc
                ? new Date(task.ngay_ket_thuc).toLocaleDateString('vi-VN')
                : 'Chưa xác định';
              return (
                <div
                  key={task.id}
                  className="p-3 rounded-xl border border-rose-100 bg-rose-50/30 hover:bg-rose-50/60 transition flex flex-col gap-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded bg-rose-100 text-rose-800 mb-1">
                        {task.loai_hinh === 'KIEM_TRA' ? 'KIỂM TRA' : 'GIÁM SÁT'}
                      </span>
                      <h4 className="text-xs font-bold text-slate-900 leading-snug">
                        {task.noi_dung}
                      </h4>
                    </div>
                    <button
                      onClick={() => {
                        onClose();
                        onNavigateToTask(task.id);
                      }}
                      className="px-2 py-1 text-[11px] font-semibold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 rounded-lg shrink-0 flex items-center gap-1 transition cursor-pointer"
                    >
                      <span>Xem hồ sơ</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-600 pt-1 border-t border-rose-100/60">
                    <div>
                      <span className="text-slate-400">Đơn vị: </span>
                      <span className="font-semibold">{task.ten_don_vi || 'Toàn Đảng bộ'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">Chủ thể: </span>
                      <span className="font-semibold">{task.chu_the}</span>
                    </div>
                    <div className="flex items-center gap-1 text-rose-600 font-bold ml-auto">
                      <Calendar className="w-3 h-3" />
                      <span>Hạn chót: {dueDate}</span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer transition shadow-2xs"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
