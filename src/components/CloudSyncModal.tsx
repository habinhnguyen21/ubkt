import React, { useState, useEffect } from 'react';
import {
  Cloud,
  CloudUpload,
  CloudDownload,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  X,
  Server,
  Zap,
} from 'lucide-react';
import { cloudSyncService } from '../services/cloudSyncService';

interface CloudSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSynced?: () => void;
}

export const CloudSyncModal: React.FC<CloudSyncModalProps> = ({ isOpen, onClose, onSynced }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
  const [lastSynced, setLastSynced] = useState<string | null>(null);
  const [cloudSummary, setCloudSummary] = useState<any>(null);
  const [localCounts, setLocalCounts] = useState<any>({
    donVi: 0,
    chuongTrinh: 0,
    hoSoDiaBan: 0,
    hoSoFiles: 0,
    baoCaoThang: 0,
    pdfFiles: 0,
  });
  const [statusAlert, setStatusAlert] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [autoSyncEnabled, setAutoSyncEnabled] = useState<boolean>(() => cloudSyncService.isAutoSyncEnabled());
  const [autoSyncInterval, setAutoSyncInterval] = useState<number>(() => cloudSyncService.getAutoSyncInterval());

  const calculateLocalCounts = () => {
    let mockDb: any = {};
    try {
      const raw = localStorage.getItem('ubkt_mock_db');
      if (raw) mockDb = JSON.parse(raw);
    } catch {}

    let diaBan: any[] = [];
    try {
      const raw = localStorage.getItem('ubkt_ho_so_dia_ban_records');
      if (raw) diaBan = JSON.parse(raw);
    } catch {}

    let files: any[] = [];
    try {
      const raw = localStorage.getItem('ubkt_ho_so_dia_ban_files');
      if (raw) files = JSON.parse(raw);
    } catch {}

    let bcs: any[] = [];
    try {
      const raw = localStorage.getItem('ubkt_bao_cao_thang');
      if (raw) bcs = JSON.parse(raw);
    } catch {}

    setLocalCounts({
      donVi: mockDb.donViList?.length || 0,
      chuongTrinh: mockDb.chuongTrinhList?.length || 0,
      hoSoDiaBan: diaBan.length || 0,
      hoSoFiles: files.length || 0,
      baoCaoThang: bcs.length || 0,
      pdfFiles: mockDb.pdfFiles?.length || 0,
    });
  };

  const loadCloudInfo = async () => {
    setLastSynced(cloudSyncService.getLastSyncedAt());
    setAutoSyncEnabled(cloudSyncService.isAutoSyncEnabled());
    setAutoSyncInterval(cloudSyncService.getAutoSyncInterval());
    calculateLocalCounts();
    try {
      const summary = await cloudSyncService.getCloudSummary();
      setCloudSummary(summary);
    } catch {}
  };

  const handleToggleAutoSync = (enabled: boolean) => {
    cloudSyncService.setAutoSyncEnabled(enabled);
    setAutoSyncEnabled(enabled);
  };

  useEffect(() => {
    if (isOpen) {
      loadCloudInfo();
      setStatusAlert(null);
      setProgressMsg('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Xử lý đẩy toàn bộ lên Cloud
  const handlePushAll = async () => {
    setIsProcessing(true);
    setStatusAlert(null);
    try {
      const res = await cloudSyncService.pushAllToCloud((msg) => setProgressMsg(msg));
      if (res.success) {
        setStatusAlert({
          type: 'success',
          message: `Đã tải thành công toàn bộ dữ liệu máy này lên Cloud!\nBây giờ bạn có thể mở ứng dụng trên thiết bị khác để xem dữ liệu.`,
        });
        await loadCloudInfo();
        onSynced?.();
      } else {
        setStatusAlert({
          type: 'error',
          message: `Lỗi khi đẩy lên Cloud: ${res.error || 'Vui lòng kiểm tra kết nối mạng.'}`,
        });
      }
    } catch (e: any) {
      setStatusAlert({ type: 'error', message: e.message || String(e) });
    } finally {
      setIsProcessing(false);
      setProgressMsg('');
    }
  };

  // Xử lý kéo toàn bộ từ Cloud về
  const handlePullAll = async () => {
    setIsProcessing(true);
    setStatusAlert(null);
    try {
      const res = await cloudSyncService.pullAllFromCloud((msg) => setProgressMsg(msg));
      if (res.success) {
        setStatusAlert({
          type: 'success',
          message: `Đã nạp thành công toàn bộ dữ liệu từ Cloud về thiết bị này!`,
        });
        await loadCloudInfo();
        onSynced?.();
      } else {
        setStatusAlert({
          type: 'error',
          message: `Lỗi khi tải từ Cloud: ${res.error || 'Vui lòng kiểm tra kết nối mạng.'}`,
        });
      }
    } catch (e: any) {
      setStatusAlert({ type: 'error', message: e.message || String(e) });
    } finally {
      setIsProcessing(false);
      setProgressMsg('');
    }
  };

  // Xử lý đồng bộ thông minh
  const handleSmartSync = async () => {
    setIsProcessing(true);
    setStatusAlert(null);
    try {
      const res = await cloudSyncService.smartSync((msg) => setProgressMsg(msg));
      if (res.success) {
        const actionText =
          res.action === 'pushed'
            ? 'Đã phát hiện Cloud trống: Tự động tải dữ liệu máy này lên Cloud thành công!'
            : 'Đã cập nhật dữ liệu mới nhất từ Cloud về máy này thành công!';
        setStatusAlert({
          type: 'success',
          message: actionText,
        });
        await loadCloudInfo();
        onSynced?.();
      } else {
        setStatusAlert({
          type: 'error',
          message: 'Quá trình đồng bộ gặp sự cố. Vui lòng thử lại.',
        });
      }
    } catch (e: any) {
      setStatusAlert({ type: 'error', message: e.message || String(e) });
    } finally {
      setIsProcessing(false);
      setProgressMsg('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs font-sans">
      <div className="bg-white rounded-2xl max-w-xl w-full border border-slate-200 shadow-2xl p-6 space-y-5 animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center space-x-3">
            <div className="w-11 h-11 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shadow-xs">
              <Cloud className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 uppercase">
                Đồng Bộ Đám Mây Trực Tuyến
              </h3>
              <p className="text-xs text-slate-500">
                Chia sẻ và đồng bộ dữ liệu tức thời giữa các máy tính & điện thoại qua Firebase Cloud
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Trạng thái kết nối Cloud */}
        <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200 text-xs space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 font-semibold text-slate-700">
              <Server className="w-4 h-4 text-emerald-600" />
              <span>Dự án Cloud: <strong className="font-mono text-emerald-700">ubkt-bf611 (Firestore)</strong></span>
            </div>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
              ● Đã kết nối Cloud
            </span>
          </div>

          <div className="text-slate-500 flex items-center justify-between pt-1 border-t border-slate-200/60 text-[11px]">
            <span>Đồng bộ gần nhất: <strong>{lastSynced || 'Chưa thực hiện trên thiết bị này'}</strong></span>
            <button
              type="button"
              onClick={loadCloudInfo}
              className="text-blue-600 hover:underline flex items-center space-x-1 cursor-pointer font-medium"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Làm mới số liệu</span>
            </button>
          </div>
        </div>

        {/* Khối Cấu hình Tự động đồng bộ ẩn 2 chiều định kỳ 30s */}
        <div className="bg-gradient-to-r from-blue-50/80 via-indigo-50/70 to-slate-50 border border-blue-200/80 rounded-xl p-3.5 flex items-center justify-between shadow-xs">
          <div className="flex items-center space-x-3">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-white transition ${autoSyncEnabled ? 'bg-blue-600 shadow-xs' : 'bg-slate-400'}`}>
              <RefreshCw className={`w-4 h-4 ${autoSyncEnabled ? 'animate-spin' : ''}`} style={{ animationDuration: '6s' }} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-xs text-slate-800">Tự động đồng bộ 2 chiều ẩn</span>
                <span className={`px-2 py-0.5 text-[10px] rounded-full font-bold border ${autoSyncEnabled ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-slate-200 text-slate-600 border-slate-300'}`}>
                  {autoSyncEnabled ? `Mỗi ${autoSyncInterval} giây` : 'Đang tắt'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Hệ thống tự động đồng bộ ngầm mọi thay đổi giữa máy tính này và Cloud định kỳ 30s mà không gián đoạn công việc.
              </p>
            </div>
          </div>

          <label className="relative inline-flex items-center cursor-pointer shrink-0 ml-3">
            <input
              type="checkbox"
              checked={autoSyncEnabled}
              onChange={(e) => handleToggleAutoSync(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-10 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
        </div>

        {/* Bảng so sánh dữ liệu: Máy này vs Cloud */}
        <div className="space-y-1.5">
          <div className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            Đối chiếu số lượng dữ liệu
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs">
            {/* Cột Máy này */}
            <div className="p-3 bg-blue-50/60 border border-blue-200 rounded-xl space-y-1.5">
              <div className="font-bold text-blue-900 flex items-center justify-between border-b border-blue-200/60 pb-1">
                <span>💻 Trên máy tính này</span>
                <span className="text-[11px] font-normal text-blue-600">Bộ nhớ máy</span>
              </div>
              <div className="space-y-1 text-slate-700 text-[11px]">
                <div className="flex justify-between">
                  <span>Cơ cấu tổ chức:</span>
                  <span className="font-bold font-mono">{localCounts.donVi}</span>
                </div>
                <div className="flex justify-between">
                  <span>Chương trình KT-GS:</span>
                  <span className="font-bold font-mono">{localCounts.chuongTrinh}</span>
                </div>
                <div className="flex justify-between">
                  <span>Hồ sơ địa bàn:</span>
                  <span className="font-bold font-mono">{localCounts.hoSoDiaBan}</span>
                </div>
                <div className="flex justify-between">
                  <span>Tài liệu hồ sơ:</span>
                  <span className="font-bold font-mono">{localCounts.hoSoFiles}</span>
                </div>
                <div className="flex justify-between">
                  <span>Báo cáo tháng:</span>
                  <span className="font-bold font-mono">{localCounts.baoCaoThang}</span>
                </div>
                <div className="flex justify-between">
                  <span>Kho dữ liệu điện tử:</span>
                  <span className="font-bold font-mono">{localCounts.pdfFiles}</span>
                </div>
              </div>
            </div>

            {/* Cột Cloud */}
            <div className="p-3 bg-emerald-50/60 border border-emerald-200 rounded-xl space-y-1.5">
              <div className="font-bold text-emerald-900 flex items-center justify-between border-b border-emerald-200/60 pb-1">
                <span>☁️ Trên Đám mây Cloud</span>
                <span className="text-[11px] font-normal text-emerald-600">Dữ liệu chung</span>
              </div>
              <div className="space-y-1 text-slate-700 text-[11px]">
                <div className="flex justify-between">
                  <span>Cơ cấu tổ chức:</span>
                  <span className="font-bold font-mono text-emerald-800">{cloudSummary?.counts?.donVi ?? '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span>Chương trình KT-GS:</span>
                  <span className="font-bold font-mono text-emerald-800">{cloudSummary?.counts?.chuongTrinh ?? '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span>Hồ sơ địa bàn:</span>
                  <span className="font-bold font-mono text-emerald-800">{cloudSummary?.counts?.hoSoDiaBan ?? '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span>Tài liệu hồ sơ:</span>
                  <span className="font-bold font-mono text-emerald-800">{cloudSummary?.counts?.hoSoFiles ?? '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span>Báo cáo tháng:</span>
                  <span className="font-bold font-mono text-emerald-800">{cloudSummary?.counts?.baoCaoThang ?? '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span>Kho dữ liệu điện tử:</span>
                  <span className="font-bold font-mono text-emerald-800">{cloudSummary?.counts?.pdfFiles ?? '—'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Thông báo tiến trình hoặc lỗi */}
        {isProcessing && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-center space-x-2">
            <RefreshCw className="w-4 h-4 text-amber-600 animate-spin shrink-0" />
            <span className="font-medium">{progressMsg || 'Đang thực hiện đồng bộ... Vui lòng chờ giây lát.'}</span>
          </div>
        )}

        {statusAlert && (
          <div
            className={`p-3 rounded-xl text-xs flex items-start space-x-2.5 ${
              statusAlert.type === 'success'
                ? 'bg-emerald-50 border border-emerald-300 text-emerald-900'
                : 'bg-rose-50 border border-rose-300 text-rose-900'
            }`}
          >
            {statusAlert.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            )}
            <div className="whitespace-pre-line leading-relaxed font-medium">{statusAlert.message}</div>
          </div>
        )}

        {/* Khối hướng dẫn ngắn gọn */}
        <div className="p-3 bg-slate-50 rounded-xl text-[11px] text-slate-600 leading-relaxed border border-slate-200">
          💡 <strong>Hướng dẫn sử dụng đa thiết bị:</strong>
          <ul className="list-disc pl-4 mt-1 space-y-0.5">
            <li><strong>Trên máy đã nhập dữ liệu:</strong> Nhấn <strong>"Đẩy toàn bộ lên Cloud"</strong> một lần để tải toàn bộ dữ liệu lên máy chủ đám mây.</li>
            <li><strong>Trên máy tính khác hoặc điện thoại:</strong> Mở trang web và nhấn <strong>"Tải từ Cloud về máy"</strong> để lấy đầy đủ toàn bộ dữ liệu.</li>
          </ul>
        </div>

        {/* Các nút hành động chính */}
        <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={handlePushAll}
            disabled={isProcessing}
            className="flex-1 inline-flex items-center justify-center space-x-1.5 px-3 py-2.5 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer disabled:opacity-50"
            title="Đẩy toàn bộ dữ liệu hiện có từ máy tính này lên Cloud để máy khác có thể xem được"
          >
            <CloudUpload className="w-4 h-4" />
            <span>Đẩy dữ liệu máy này lên Cloud</span>
          </button>

          <button
            type="button"
            onClick={handlePullAll}
            disabled={isProcessing}
            className="flex-1 inline-flex items-center justify-center space-x-1.5 px-3 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer disabled:opacity-50"
            title="Tải toàn bộ dữ liệu mới nhất từ Cloud về máy này"
          >
            <CloudDownload className="w-4 h-4" />
            <span>Tải từ Cloud về máy này</span>
          </button>

          <button
            type="button"
            onClick={handleSmartSync}
            disabled={isProcessing}
            className="inline-flex items-center justify-center space-x-1.5 px-3 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer disabled:opacity-50"
            title="Tự động kiểm tra và đồng bộ hợp nhất 2 chiều"
          >
            <Zap className="w-4 h-4 text-amber-300" />
            <span>Đồng bộ 2 chiều</span>
          </button>
        </div>
      </div>
    </div>
  );
};
