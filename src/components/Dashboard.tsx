import { useState, useEffect } from 'react';
import type { AppInfo, NhatKy, User } from '../types';
import { api } from '../services/api';
import { TongQuanExecutiveDashboard } from './TongQuanExecutiveDashboard';
import { History, ShieldCheck } from 'lucide-react';

interface Props {
  currentUser: User;
  appInfo: AppInfo | null;
}

export function Dashboard({ currentUser, appInfo }: Props) {
  const [showLogs, setShowLogs] = useState(false);
  const [recentLogs, setRecentLogs] = useState<NhatKy[]>([]);

  useEffect(() => {
    if (showLogs && recentLogs.length === 0) {
      api.getAuditLogs(8)
        .then((logs) => setRecentLogs(logs || []))
        .catch(() => {});
    }
  }, [showLogs, recentLogs.length]);

  return (
    <div className="space-y-4 font-sans">
      {/* ── GIAO DIỆN TỔNG QUAN THEO MẪU THIẾT KẾ ĐỘNG ────────────────── */}
      <TongQuanExecutiveDashboard currentUser={currentUser} appInfo={appInfo} />

      {/* ── NHẬT KÝ HOẠT ĐỘNG HỆ THỐNG THỜI GIAN THỰC (TÙY CHỌN MỞ RỘNG) ─── */}
      <div className="pt-1">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
            <History className="w-3.5 h-3.5 text-slate-400" />
            Nhật ký kiểm soát hoạt động hệ thống
          </span>
          <button
            onClick={() => setShowLogs(!showLogs)}
            className="text-xs text-blue-600 hover:text-blue-800 font-semibold cursor-pointer px-3 py-1 bg-white border border-slate-200 rounded-lg shadow-2xs hover:bg-slate-50 transition flex items-center gap-1"
          >
            <span>{showLogs ? 'Thu gọn nhật ký ▲' : 'Xem nhật ký hoạt động gần đây ▼'}</span>
          </button>
        </div>

        {showLogs && (
          <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs p-4 animate-fadeIn">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <h4 className="text-xs font-bold text-slate-800">
                  Nhật ký thao tác nghiệp vụ gần đây (Thời gian thực)
                </h4>
              </div>
              <span className="text-[11px] text-slate-400">
                Tài khoản: {currentUser.ho_ten} ({currentUser.vai_tro})
              </span>
            </div>

            {recentLogs.length === 0 ? (
              <p className="text-xs text-slate-400 py-3 text-center">
                Chưa có thao tác nào được ghi nhận trong phiên làm việc này.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                {recentLogs.map((log) => {
                  const logTime = log.thoi_gian
                    ? new Date(log.thoi_gian).toLocaleTimeString('vi-VN', {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      }) +
                      ' ' +
                      new Date(log.thoi_gian).toLocaleDateString('vi-VN')
                    : '';
                  return (
                    <div
                      key={log.id}
                      className="p-2.5 rounded-lg border border-slate-100 bg-slate-50/60 flex items-start gap-2.5"
                    >
                      <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0 mt-1.5" />
                      <div className="min-w-0 flex-1">
                        <p className="text-slate-800 font-medium leading-snug">{log.hanh_dong}</p>
                        <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1.5">
                          <span>{log.ten_nguoi_dung || 'Hệ thống'}</span>
                          <span>·</span>
                          <span>{logTime}</span>
                          {log.bang_anh_huong && (
                            <>
                              <span>·</span>
                              <span className="font-mono text-slate-500 uppercase">
                                [{log.bang_anh_huong}]
                              </span>
                            </>
                          )}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
              <span className="flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                Dữ liệu được bảo mật và phân quyền theo phạm vi quản lý của đơn vị
              </span>
              <span className="font-semibold text-emerald-700">Máy chủ trực tuyến 24/7</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
