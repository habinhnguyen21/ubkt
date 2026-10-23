import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import type { NhatKy } from '../types';
import { History, X, Clock, User as UserIcon } from 'lucide-react';


interface AuditLogModalProps {
  onClose: () => void;
}

export const AuditLogModal: React.FC<AuditLogModalProps> = ({ onClose }) => {
  const [logs, setLogs] = useState<NhatKy[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchLogs = async () => {
      setLoading(true);
      try {
        const data = await api.getAuditLogs(100);
        setLogs(data);
      } catch (err) {
        console.error('Lỗi tải nhật ký:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchLogs();
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-150">
        <div className="bg-red-800 px-5 py-4 text-white flex items-center justify-between border-b-2 border-amber-500">
          <div className="flex items-center space-x-2">
            <History className="w-5 h-5 text-amber-300" />
            <h3 className="text-base font-bold">NHẬT KÝ HOẠT ĐỘNG HỆ THỐNG</h3>
          </div>
          <button
            onClick={onClose}
            className="text-red-200 hover:text-white p-1 rounded-md transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto flex-1 space-y-3">
          {loading ? (
            <div className="py-12 text-center text-slate-400 text-sm">
              <span className="inline-block animate-spin mr-2 text-red-600">⟳</span>
              Đang tải lịch sử hoạt động...
            </div>
          ) : logs.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-sm">
              Chưa có nhật ký hoạt động nào được ghi nhận.
            </div>
          ) : (
            <div className="space-y-2">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs flex items-start justify-between space-x-3"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200 uppercase">
                        {log.hanh_dong}
                      </span>
                      <span className="text-slate-500">bảng: <strong>{log.bang_anh_huong}</strong></span>
                    </div>
                    {log.du_lieu_moi && (
                      <p className="text-slate-600 font-mono text-[11px] truncate max-w-lg bg-white p-1.5 rounded border border-slate-200">
                        {log.du_lieu_moi}
                      </p>
                    )}
                  </div>

                  <div className="text-right flex-shrink-0 text-slate-400 space-y-1">
                    <div className="flex items-center justify-end space-x-1 text-slate-600">
                      <UserIcon className="w-3.5 h-3.5" />
                      <span>{log.ten_nguoi_dung || 'Hệ thống'}</span>
                    </div>
                    <div className="flex items-center justify-end space-x-1">
                      <Clock className="w-3 h-3" />
                      <span>{log.thoi_gian}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-slate-50 px-5 py-3 border-t border-slate-200 text-right">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-700 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold transition cursor-pointer"
          >
            Đóng cửa sổ
          </button>
        </div>
      </div>
    </div>
  );
};
