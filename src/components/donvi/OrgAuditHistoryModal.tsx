import React, { useState, useEffect } from 'react';
import type { DonVi, NhatKy } from '../../types';
import { api } from '../../services/api';
import {
  X,
  History,
  Clock,
  User as UserIcon,
  Search,
} from 'lucide-react';

interface OrgAuditHistoryModalProps {
  isOpen: boolean;
  targetUnit: DonVi | null;
  onClose: () => void;
}

export const OrgAuditHistoryModal: React.FC<OrgAuditHistoryModalProps> = ({
  isOpen,
  targetUnit,
  onClose,
}) => {
  const [logs, setLogs] = useState<NhatKy[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setLoading(true);

    if (targetUnit) {
      // Get relations / history for single unit
      api
        .getDonViRelations(targetUnit.id)
        .then((res) => {
          if (isMounted && res?.history) {
            setLogs(res.history);
          }
        })
        .catch((err) => {
          console.warn('Lỗi lấy lịch sử đơn vị:', err);
        })
        .finally(() => {
          if (isMounted) setLoading(false);
        });
    } else {
      // Get all audit logs
      api
        .getAuditLogs(100)
        .then((allLogs) => {
          if (isMounted && Array.isArray(allLogs)) {
            // Filter logs related to don_vi
            const filtered = allLogs.filter(
              (l) => l.bang_anh_huong === 'don_vi' || l.hanh_dong?.includes('đơn vị') || l.hanh_dong?.includes('tổ chức'),
            );
            setLogs(filtered);
          }
        })
        .catch((err) => {
          console.warn('Lỗi lấy nhật ký kiểm toán:', err);
        })
        .finally(() => {
          if (isMounted) setLoading(false);
        });
    }

    return () => {
      isMounted = false;
    };
  }, [isOpen, targetUnit]);

  if (!isOpen) return null;

  const filteredLogs = logs.filter((log) => {
    if (!searchTerm) return true;
    const s = searchTerm.toLowerCase();
    return (
      log.hanh_dong?.toLowerCase().includes(s) ||
      log.ten_nguoi_dung?.toLowerCase().includes(s) ||
      log.du_lieu_moi?.toLowerCase().includes(s) ||
      log.du_lieu_cu?.toLowerCase().includes(s)
    );
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden my-6 flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 px-6 py-4 text-white flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-slate-700 flex items-center justify-center text-white font-bold shadow-md">
              <History className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-wide">
                {targetUnit
                  ? `LỊCH SỬ THAY ĐỔI: ${targetUnit.ten.toUpperCase()}`
                  : 'NHẬT KÝ THAY ĐỔI CƠ CẤU TỔ CHỨC'}
              </h3>
              <p className="text-xs text-slate-300">
                {targetUnit
                  ? `Mã: ${targetUnit.ma || 'N/A'} • Ghi vết thêm, sửa, đổi cấp trên, ngừng hoạt động`
                  : 'Toàn bộ tiến trình điều chỉnh tổ chức của đơn vị'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-300 hover:text-white hover:bg-white/10 rounded-lg transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm kiếm theo hành động, người thực hiện hoặc nội dung..."
              className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>
          <span className="text-xs font-semibold text-slate-500 whitespace-nowrap">
            {filteredLogs.length} bản ghi
          </span>
        </div>

        {/* Content list */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="text-center py-12 text-slate-400 text-xs">
              <Clock className="w-8 h-8 mx-auto mb-2 text-slate-300 animate-spin" />
              <span>Đang tải nhật ký kiểm toán...</span>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-xs">
              <History className="w-8 h-8 mx-auto mb-2 text-slate-300" />
              <span>Chưa có nhật ký thay đổi nào được ghi nhận</span>
            </div>
          ) : (
            <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
              {filteredLogs.map((log) => {
                const dateStr = log.thoi_gian
                  ? new Date(log.thoi_gian).toLocaleString('vi-VN')
                  : 'N/A';

                return (
                  <div key={log.id} className="relative group">
                    {/* Dot on timeline */}
                    <div className="absolute -left-[29px] top-1.5 w-3.5 h-3.5 rounded-full bg-blue-600 border-2 border-white shadow-2xs group-hover:scale-125 transition"></div>

                    <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs hover:border-slate-300 transition">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1.5">
                        <span className="text-xs font-bold text-slate-900">{log.hanh_dong}</span>
                        <div className="flex items-center space-x-2 text-[11px] text-slate-500">
                          <span className="flex items-center space-x-1 font-medium text-slate-700">
                            <UserIcon className="w-3 h-3 text-slate-400" />
                            <span>{log.ten_nguoi_dung || 'Hệ thống'}</span>
                          </span>
                          <span>•</span>
                          <span className="font-mono">{dateStr}</span>
                        </div>
                      </div>

                      {/* Details of changes */}
                      {log.du_lieu_moi && (
                        <div className="mt-2 text-xs font-mono bg-slate-50 p-2.5 rounded-lg border border-slate-100 text-slate-700 overflow-x-auto max-h-32">
                          {log.du_lieu_moi}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
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
