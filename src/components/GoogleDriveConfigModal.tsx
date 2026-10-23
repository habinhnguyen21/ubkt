import React, { useState, useEffect } from 'react';
import {
  X,
  Cloud,
  Check,
  Copy,
  ExternalLink,
  AlertTriangle,
  RefreshCw,
  CheckCircle2,
} from 'lucide-react';
import {
  GOOGLE_APPS_SCRIPT_TEMPLATE,
  getGoogleDriveConfig,
  saveGoogleDriveConfig,
  testGoogleDriveConnection,
} from '../services/googleDriveService';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

export const GoogleDriveConfigModal: React.FC<Props> = ({ isOpen, onClose, onSaved }) => {
  const [scriptUrl, setScriptUrl] = useState('');
  const [folderId, setFolderId] = useState('');
  const [autoUpload, setAutoUpload] = useState(true);

  const [copied, setCopied] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; msg: string } | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const cfg = getGoogleDriveConfig();
      setScriptUrl(cfg.scriptUrl);
      setFolderId(cfg.folderId || '');
      setAutoUpload(cfg.autoUpload);
      setTestResult(null);
      setSaveSuccess(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(GOOGLE_APPS_SCRIPT_TEMPLATE);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
    }
  };

  const handleTestConnection = async () => {
    if (!scriptUrl.trim()) {
      setTestResult({ success: false, msg: 'Vui lòng nhập URL Google Apps Script Web App trước' });
      return;
    }

    setIsTesting(true);
    setTestResult(null);
    try {
      await testGoogleDriveConnection(scriptUrl.trim());
      setTestResult({ success: true, msg: 'Kết nối thành công tới Google Apps Script Web App!' });
    } catch (err: any) {
      setTestResult({
        success: false,
        msg: err.message || 'Không thể kết nối. Hãy kiểm tra lại URL hoặc quyền truy cập của Web App.',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = () => {
    saveGoogleDriveConfig({
      scriptUrl: scriptUrl.trim(),
      folderId: folderId.trim(),
      autoUpload,
    });
    setSaveSuccess(true);
    setTimeout(() => {
      onSaved?.();
      onClose();
    }, 1000);
  };

  const handleClear = () => {
    if (confirm('Bạn có chắc muốn hủy liên kết Google Drive? Dữ liệu sẽ lưu cục bộ như ban đầu.')) {
      saveGoogleDriveConfig({ scriptUrl: '', folderId: '', autoUpload: false });
      setScriptUrl('');
      setFolderId('');
      setAutoUpload(false);
      setTestResult(null);
      onSaved?.();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-[#133863] text-white px-6 py-4 flex items-center justify-between border-b-2 border-emerald-500 flex-shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-400 border border-emerald-400/30">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold tracking-tight uppercase">
                CẤU HÌNH LƯU TRỮ GOOGLE DRIVE
              </h3>
              <p className="text-xs text-blue-200 mt-0.5">
                Kết nối qua Google Apps Script Web App (Hoàn toàn miễn phí & không giới hạn)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-white/70 hover:text-white p-1 rounded-md transition cursor-pointer"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 overflow-y-auto text-xs">
          {/* Hướng dẫn 3 bước */}
          <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-4 space-y-3">
            <h4 className="font-bold text-sm text-[#133863] flex items-center space-x-1.5">
              <span>📋 Hướng dẫn tạo Web App trên Google Drive (khoảng 3 phút)</span>
            </h4>
            <ol className="list-decimal list-inside space-y-2 text-slate-700 leading-relaxed pl-1">
              <li>
                Mở Google Apps Script bằng cách bấm vào liên kết:{' '}
                <a
                  href="https://script.google.com"
                  target="_blank"
                  rel="noreferrer"
                  className="font-bold text-blue-600 hover:underline inline-flex items-center space-x-1"
                >
                  <span>script.google.com</span>
                  <ExternalLink className="w-3 h-3" />
                </a>{' '}
                và nhấn <strong>Dự án mới (New project)</strong>.
              </li>
              <li>
                Nhấn nút bên dưới để <strong>Sao chép mã kịch bản</strong>, sau đó dán đè toàn bộ vào màn hình Google Apps Script:
                <div className="mt-2">
                  <button
                    type="button"
                    onClick={handleCopyCode}
                    className="px-3.5 py-1.5 bg-[#133863] hover:bg-blue-900 text-white rounded-lg font-bold flex items-center space-x-1.5 transition shadow-xs cursor-pointer"
                  >
                    {copied ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
                    <span>{copied ? 'Đã sao chép mã kịch bản!' : 'Sao chép mã Google Apps Script'}</span>
                  </button>
                </div>
              </li>
              <li>
                Tại góc trên bên phải Google Apps Script, chọn: <strong>Triển khai (Deploy)</strong> &gt; <strong>Lượt triển khai mới (New deployment)</strong>:
                <ul className="list-disc list-inside pl-4 mt-1 space-y-1 text-slate-600">
                  <li>Chọn loại: <strong>Ứng dụng web (Web app)</strong>.</li>
                  <li>Thực thi dưới dạng (Execute as): <strong>Tôi (Tài khoản Google của bạn)</strong>.</li>
                  <li>Ai có quyền truy cập (Who has access): <strong>Bất kỳ ai (Anyone)</strong>.</li>
                </ul>
              </li>
              <li>
                Nhấn <strong>Triển khai</strong>, cấp quyền truy cập Google Drive và sao chép <strong>URL ứng dụng web (Web app URL)</strong> dán vào ô bên dưới.
              </li>
              <li className="text-emerald-800 font-semibold bg-emerald-50/80 p-2 rounded-lg border border-emerald-200/80">
                💡 <strong>Nếu bạn đã triển khai trước đó và muốn cập nhật mã mới (hỗ trợ tự động xóa tệp):</strong> Dán đè mã kịch bản mới &gt; bấm <strong>Triển khai (Deploy)</strong> &gt; <strong>Quản lý bản triển khai (Manage deployments)</strong> &gt; bấm biểu tượng <strong>Chỉnh sửa (Cây bút)</strong> &gt; tại mục <em>Phiên bản (Version)</em> chọn <strong>Phiên bản mới (New version)</strong> &gt; bấm <strong>Triển khai (Deploy)</strong>.
              </li>
            </ol>
          </div>

          {/* Form cấu hình */}
          <div className="space-y-4 bg-slate-50 border border-slate-200 rounded-xl p-4">
            <div>
              <label className="font-bold text-slate-800 block mb-1">
                URL Ứng dụng web (Google Apps Script Web App URL) * :
              </label>
              <input
                type="text"
                value={scriptUrl}
                onChange={(e) => setScriptUrl(e.target.value)}
                placeholder="https://script.google.com/macros/s/AKfycbx.../exec"
                className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-xs font-mono bg-white focus:outline-none focus:ring-2 focus:ring-[#133863]"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                * Đây là URL nhận được sau khi bạn hoàn tất bước Triển khai (kết thúc bằng <code className="font-mono text-blue-700">/exec</code>).
              </p>
            </div>

            <div>
              <label className="font-bold text-slate-800 block mb-1">
                ID Thư mục Google Drive lưu trữ (Tùy chọn):
              </label>
              <input
                type="text"
                value={folderId}
                onChange={(e) => setFolderId(e.target.value)}
                placeholder="Ví dụ: 1BxiMVs0XRA5nFMdKvBHK9... (để trống sẽ tự tạo thư mục KHO_DU_LIEU_UBKT)"
                className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-xs font-mono bg-white focus:outline-none focus:ring-2 focus:ring-[#133863]"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                * Mở thư mục trên Google Drive, ID là chuỗi ký tự ở cuối thanh địa chỉ trình duyệt. Nếu để trống, hệ thống sẽ tự động tạo thư mục mang tên <strong>KHO_DU_LIEU_UBKT</strong> trong Drive của bạn.
              </p>
            </div>

            <div className="pt-1 flex items-center space-x-2">
              <input
                type="checkbox"
                id="chkAutoUpload"
                checked={autoUpload}
                onChange={(e) => setAutoUpload(e.target.checked)}
                className="rounded text-[#133863] focus:ring-[#133863] w-4 h-4 cursor-pointer"
              />
              <label htmlFor="chkAutoUpload" className="text-xs font-medium text-slate-700 cursor-pointer">
                Tự động tải lên Google Drive khi cán bộ tải tệp vào Kho dữ liệu / Hồ sơ địa bàn
              </label>
            </div>

            {/* Nút kiểm tra kết nối */}
            <div className="pt-2 flex items-center space-x-3">
              <button
                type="button"
                disabled={isTesting || !scriptUrl.trim()}
                onClick={handleTestConnection}
                className="px-3.5 py-1.5 border border-slate-300 hover:bg-slate-100 rounded-lg font-semibold text-slate-700 flex items-center space-x-1.5 transition cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin text-blue-600' : ''}`} />
                <span>{isTesting ? 'Đang kiểm tra...' : 'Kiểm tra kết nối Web App'}</span>
              </button>

              {testResult && (
                <div
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 ${
                    testResult.success
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
                      : 'bg-rose-50 text-rose-800 border border-rose-300'
                  }`}
                >
                  {testResult.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                  )}
                  <span>{testResult.msg}</span>
                </div>
              )}
            </div>
          </div>

          {saveSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 font-bold flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Đã lưu cấu hình Google Drive thành công!</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between flex-shrink-0">
          <div>
            {scriptUrl && (
              <button
                type="button"
                onClick={handleClear}
                className="px-3 py-1.5 text-xs text-rose-600 hover:bg-rose-50 rounded-lg border border-rose-200 font-semibold transition cursor-pointer"
              >
                Hủy liên kết Drive
              </button>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
            >
              Đóng
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2 bg-[#133863] hover:bg-blue-900 text-white rounded-lg text-xs font-bold shadow-xs transition cursor-pointer"
            >
              Lưu cấu hình
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
