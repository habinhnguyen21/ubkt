import React from 'react';
import { Database, RefreshCw, Wifi, Clock } from 'lucide-react';
import type { AppInfo } from '../types';


interface StatusBarProps {
  appInfo: AppInfo | null;
  onRefresh: () => void;
  isSyncing: boolean;
}

export const StatusBar: React.FC<StatusBarProps> = ({ appInfo, onRefresh, isSyncing }) => {
  const [time, setTime] = React.useState(new Date().toLocaleTimeString('vi-VN'));

  React.useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date().toLocaleTimeString('vi-VN'));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <footer className="fixed bottom-0 left-0 right-0 h-8 bg-slate-900 border-t border-slate-700 text-slate-300 text-xs px-4 flex items-center justify-between select-none z-40">
      <div className="flex items-center space-x-4">
        {/* Chế độ Trực tuyến Full Online */}
        <div className="flex items-center space-x-1.5 text-emerald-400 font-medium">
          <Database className="w-3.5 h-3.5" />
          <span>Hệ thống Trực tuyến (Online Server)</span>
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse inline-block ml-1 shadow-[0_0_8px_#34d399]"></span>
        </div>

        <span className="text-slate-600">|</span>

        {/* Trạng thái kết nối máy chủ */}
        <div className="flex items-center space-x-1.5">
          <Wifi className="w-3.5 h-3.5 text-sky-400" />
          <span>Kết nối máy chủ:</span>
          <span className="text-emerald-300 font-semibold">Trực tuyến 100%</span>
        </div>

        <button
          onClick={onRefresh}
          disabled={isSyncing}
          className="flex items-center space-x-1 text-slate-300 hover:text-white hover:bg-slate-800 px-2 py-0.5 rounded transition"
          title="Kiểm tra và nạp lại dữ liệu"
        >
          <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin text-amber-400' : ''}`} />
          <span>Làm mới</span>
        </button>
      </div>

      <div className="flex items-center space-x-4 text-slate-400">
        <span>Tổng số tổ chức: <strong className="text-slate-200">{appInfo?.total_don_vi ?? 0}</strong></span>
        <span className="text-slate-600">|</span>
        <div className="flex items-center space-x-1">
          <Clock className="w-3.5 h-3.5 text-slate-400" />
          <span>{time}</span>
        </div>
        <span className="text-slate-600">|</span>
        <span>Phiên bản v{appInfo?.version ?? '1.0.0'}</span>
      </div>
    </footer>
  );
};
