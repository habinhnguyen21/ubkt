import React, { useState, useEffect } from 'react';
import { Database, RefreshCw, Wifi, WifiOff, Clock, AlertTriangle } from 'lucide-react';
import type { AppInfo } from '../types';

interface StatusBarProps {
  appInfo: AppInfo | null;
  onRefresh: () => void;
  isSyncing: boolean;
}

export const StatusBar: React.FC<StatusBarProps> = ({ appInfo, onRefresh, isSyncing }) => {
  const [time, setTime] = useState(new Date().toLocaleTimeString('vi-VN'));
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [isSaving, setIsSaving] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date().toLocaleTimeString('vi-VN'));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    const handleSavingStart = () => setIsSaving(true);
    const handleSavingEnd = () => setIsSaving(false);
    const handleSyncError = (e: any) => {
      const msg = e.detail?.message || 'Lỗi đồng bộ dữ liệu';
      setSyncError(msg);
      setTimeout(() => setSyncError(null), 12000);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('ubkt_saving_start', handleSavingStart);
    window.addEventListener('ubkt_saving_end', handleSavingEnd);
    window.addEventListener('ubkt_silent_sync_start', handleSavingStart);
    window.addEventListener('ubkt_silent_sync_end', handleSavingEnd);
    window.addEventListener('ubkt_sync_error', handleSyncError);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('ubkt_saving_start', handleSavingStart);
      window.removeEventListener('ubkt_saving_end', handleSavingEnd);
      window.removeEventListener('ubkt_silent_sync_start', handleSavingStart);
      window.removeEventListener('ubkt_silent_sync_end', handleSavingEnd);
      window.removeEventListener('ubkt_sync_error', handleSyncError);
    };
  }, []);

  const isBusy = isSyncing || isSaving;

  return (
    <footer className="fixed bottom-0 left-0 right-0 h-8 bg-slate-900 border-t border-slate-700 text-slate-300 text-xs px-4 flex items-center justify-between select-none z-40">
      <div className="flex items-center space-x-4">
        {/* Trạng thái đồng bộ thời gian thực theo yêu cầu */}
        {syncError ? (
          <div className="flex items-center space-x-1.5 text-rose-400 font-medium" title={syncError}>
            <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            <span className="truncate max-w-sm">{syncError}</span>
            <button
              onClick={() => setSyncError(null)}
              className="text-[10px] text-rose-300 hover:text-white px-1.5 py-0.2 bg-rose-950/60 rounded border border-rose-800 ml-1 transition"
            >
              Đóng
            </button>
          </div>
        ) : !isOnline ? (
          <div className="flex items-center space-x-1.5 text-rose-400 font-medium">
            <WifiOff className="w-3.5 h-3.5 text-rose-400" />
            <span>Mất kết nối mạng</span>
            <span className="w-2 h-2 rounded-full bg-rose-500 inline-block ml-1"></span>
          </div>
        ) : isBusy ? (
          <div className="flex items-center space-x-1.5 text-amber-400 font-medium">
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-400" />
            <span>Đang lưu thay đổi...</span>
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse inline-block ml-1"></span>
          </div>
        ) : (
          <div className="flex items-center space-x-1.5 text-emerald-400 font-medium">
            <Database className="w-3.5 h-3.5 text-emerald-400" />
            <span>Trực tuyến - Đồng bộ tức thì</span>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse inline-block ml-1 shadow-[0_0_8px_#34d399]"></span>
          </div>
        )}

        <span className="text-slate-600">|</span>

        {/* Trạng thái mạng */}
        <div className="flex items-center space-x-1.5 text-slate-400">
          <Wifi className={`w-3.5 h-3.5 ${isOnline ? 'text-sky-400' : 'text-slate-500'}`} />
          <span>Máy chủ:</span>
          <span className={isOnline ? 'text-emerald-300 font-semibold' : 'text-rose-400 font-semibold'}>
            {isOnline ? 'Đã kết nối' : 'Ngoại tuyến'}
          </span>
        </div>

        <button
          onClick={onRefresh}
          disabled={isBusy}
          className="flex items-center space-x-1 text-slate-300 hover:text-white hover:bg-slate-800 px-2 py-0.5 rounded transition"
          title="Kiểm tra và nạp lại dữ liệu"
        >
          <RefreshCw className={`w-3 h-3 ${isBusy ? 'animate-spin text-amber-400' : ''}`} />
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
